import {
  AIEngine,
  ConnectionTestResult,
  StreamCallbacks,
  StreamRequest,
  StreamResult,
} from './aiEngine';
import { GeminiModelInfo } from '../types/settings';
import { useSettingsStore } from '../store/useSettingsStore';

interface RawGeminiModel {
  name: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

interface RawGeminiModelsResponse {
  models?: RawGeminiModel[];
  nextPageToken?: string;
}

export function buildGeminiV1BetaBase(apiEndpoint?: string): string {
  const trimmed = (apiEndpoint || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return 'https://generativelanguage.googleapis.com/v1beta';
  }
  if (trimmed.endsWith('/v1beta')) {
    return trimmed;
  }
  return `${trimmed}/v1beta`;
}

export function resolveGeminiModelId(
  modelNameOrId: string,
  fetchedModels?: GeminiModelInfo[]
): string {
  const raw = (modelNameOrId || '').trim();
  if (!raw) return 'gemini-1.5-flash';

  const stripped = raw.replace(/^models\//, '');
  const list = fetchedModels || useSettingsStore.getState().fetchedGeminiModels || [];
  const matched = list.find(
    (m) => m.id === stripped || m.name.toLowerCase() === raw.toLowerCase()
  );
  if (matched) return matched.id;

  // Fallback mapping for built-in display names
  const lower = stripped.toLowerCase();
  if (lower === 'gemini 1.5 flash') return 'gemini-1.5-flash';
  if (lower === 'gemini 1.5 pro') return 'gemini-1.5-pro';
  if (lower.includes(' ')) return lower.replace(/\s+/g, '-');
  return stripped;
}

export async function fetchGeminiModels(
  apiKey: string,
  apiEndpoint?: string
): Promise<GeminiModelInfo[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Google Gemini API Key is required to fetch available models.');
  }

  const base = buildGeminiV1BetaBase(apiEndpoint);
  const allRawModels: RawGeminiModel[] = [];
  let pageToken: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 5;

  do {
    const params = new URLSearchParams({
      key: apiKey.trim(),
      pageSize: '100',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const res = await fetch(`${base}/models?${params.toString()}`);
    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        detail = '';
      }
      throw new Error(
        `Failed to fetch Gemini models [HTTP ${res.status}]${detail ? `: ${detail}` : ''}`
      );
    }

    const data: RawGeminiModelsResponse = await res.json();
    if (Array.isArray(data.models)) {
      allRawModels.push(...data.models);
    }
    pageToken = data.nextPageToken;
    pageCount += 1;
  } while (pageToken && pageCount < maxPages);

  return allRawModels
    .filter(
      (m) =>
        Array.isArray(m.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m) => {
      const id = m.name.replace(/^models\//, '');
      return {
        id,
        name: m.displayName || id,
        description: m.description || 'Google Gemini generative model',
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
        supportedGenerationMethods: m.supportedGenerationMethods,
      };
    });
}

// Helper to read SSE or chunked stream line-by-line
async function readStreamLines(
  response: Response,
  signal: AbortSignal | undefined,
  onLine: (line: string) => void
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel().catch(() => {});
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        onLine(trimmed);
      }
    }

    const trailing = buffer.trim();
    if (trailing && !trailing.startsWith(':')) {
      onLine(trailing);
    }
  } finally {
    reader.releaseLock();
  }
}

async function readSSEStream(
  response: Response,
  signal: AbortSignal | undefined,
  parseChunk: (line: string) => string | null,
  callbacks: StreamCallbacks
): Promise<string> {
  let accumulated = '';
  await readStreamLines(response, signal, (line) => {
    const token = parseChunk(line);
    if (token) {
      accumulated += token;
      callbacks.onToken?.(token, accumulated);
    }
  });
  return accumulated;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// 1. Google Gemini SSE Adapter
export class GeminiEngine implements AIEngine {
  async streamChat(
    request: StreamRequest,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    const {
      prompt,
      model = 'gemini-1.5-flash',
      temperature,
      maxTokens,
      signal,
      apiKey = '',
      apiEndpoint,
      systemPrompt,
    } = request;

    if (!apiKey) {
      const err = new Error('Google Gemini API Key is required. Please set it in Settings.');
      callbacks.onError?.(err);
      throw err;
    }

    const resolvedModelId = resolveGeminiModelId(model);
    const base = buildGeminiV1BetaBase(apiEndpoint);
    const endpoint = `${base}/models/${encodeURIComponent(resolvedModelId)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    const priorContents = (request.history || [])
      .filter((h) => h.role !== 'system' && h.content && h.content.trim().length > 0)
      .map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));

    const body = {
      ...(systemPrompt && systemPrompt.trim()
        ? {
            systemInstruction: {
              parts: [{ text: systemPrompt.trim() }],
            },
          }
        : {}),
      contents: [
        ...priorContents,
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 2048,
      },
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error [${res.status}]: ${errText}`);
      }

      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let thinkingStartTime: number | null = null;
      let thinkingDuration = 0;

      await readStreamLines(res, signal, (line) => {
        if (!line.startsWith('data: ')) return;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') return;

        try {
          const data = JSON.parse(raw);
          const parts = data?.candidates?.[0]?.content?.parts;
          if (!Array.isArray(parts)) return;

          for (const part of parts) {
            if (!part || typeof part.text !== 'string' || part.text.length === 0) {
              continue;
            }

            if (part.thought === true) {
              if (thinkingStartTime === null) {
                thinkingStartTime = Date.now();
              }
              accumulatedReasoning += part.text;
              thinkingDuration = Math.max(100, Date.now() - thinkingStartTime);
              callbacks.onReasoning?.(part.text, accumulatedReasoning);
              callbacks.onThinkingDuration?.(thinkingDuration);
            } else {
              accumulatedContent += part.text;
              callbacks.onToken?.(part.text, accumulatedContent);
            }
          }
        } catch {
          // Ignore malformed partial JSON chunks
        }
      });

      const result: StreamResult = {
        content: accumulatedContent,
        ...(accumulatedReasoning
          ? {
              reasoningContent: accumulatedReasoning,
              thinkingDuration,
            }
          : {}),
      };
      callbacks.onComplete?.(result);
      return result;
    } catch (err: unknown) {
      if (signal?.aborted) {
        const partialResult: StreamResult = { content: '' };
        callbacks.onComplete?.(partialResult);
        return partialResult;
      }
      callbacks.onError?.(toError(err));
      throw err;
    }
  }

  async testConnection(config: { apiKey?: string; apiEndpoint?: string }): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    if (!config.apiKey) {
      return {
        success: false,
        message: 'API Key required for Gemini endpoint',
      };
    }

    try {
      const base = buildGeminiV1BetaBase(config.apiEndpoint);
      const res = await fetch(
        `${base}/models?key=${encodeURIComponent(config.apiKey)}`
      );
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return {
          success: true,
          message: 'Connected to GEMINI successfully',
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Gemini API returned status ${res.status}`,
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to reach Gemini API endpoint',
      };
    }
  }
}

// 2. OpenAI Chat Completions SSE Adapter
export class OpenAIEngine implements AIEngine {
  async streamChat(
    request: StreamRequest,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    const { prompt, model = 'gpt-4o', temperature, maxTokens, signal, apiKey = '', apiEndpoint } = request;
    const endpoint = apiEndpoint || 'https://api.openai.com/v1';

    if (!apiKey) {
      const err = new Error('OpenAI API Key is required. Please set it in Settings.');
      callbacks.onError?.(err);
      throw err;
    }

    const messages = [
      ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
      ...(request.history || []),
      { role: 'user', content: prompt },
    ];

    try {
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          temperature: temperature ?? 0.7,
          max_tokens: maxTokens ?? 2048,
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error [${res.status}]: ${errText}`);
      }

      const accumulated = await readSSEStream(
        res,
        signal,
        (line) => {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            if (raw === '[DONE]') return null;
            try {
              const data = JSON.parse(raw);
              return data?.choices?.[0]?.delta?.content || null;
            } catch {
              return null;
            }
          }
          return null;
        },
        callbacks
      );

      const result: StreamResult = { content: accumulated };
      callbacks.onComplete?.(result);
      return result;
    } catch (err: unknown) {
      if (signal?.aborted) {
        const partialResult: StreamResult = { content: '' };
        callbacks.onComplete?.(partialResult);
        return partialResult;
      }
      callbacks.onError?.(toError(err));
      throw err;
    }
  }

  async testConnection(config: { apiKey?: string; apiEndpoint?: string }): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    if (!config.apiKey) {
      return {
        success: false,
        message: 'API Key required for OpenAI endpoint',
      };
    }

    const endpoint = config.apiEndpoint || 'https://api.openai.com/v1';

    try {
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
      });
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return {
          success: true,
          message: 'Connected to OPENAI successfully',
          latencyMs,
        };
      }
      return {
        success: false,
        message: `OpenAI API returned status ${res.status}`,
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to reach OpenAI API endpoint',
      };
    }
  }
}

// 3. Ollama Local Endpoint Adapter
export class OllamaEngine implements AIEngine {
  async streamChat(
    request: StreamRequest,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    const { prompt, model = 'llama3', signal, apiEndpoint } = request;
    const endpoint = apiEndpoint || 'http://localhost:11434';

    const messages = [
      ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
      ...(request.history || []),
      { role: 'user', content: prompt },
    ];

    try {
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama API error [${res.status}]: ${errText}`);
      }

      const accumulated = await readSSEStream(
        res,
        signal,
        (line) => {
          try {
            const data = JSON.parse(line);
            return data?.message?.content || null;
          } catch {
            return null;
          }
        },
        callbacks
      );

      const result: StreamResult = { content: accumulated };
      callbacks.onComplete?.(result);
      return result;
    } catch (err: unknown) {
      if (signal?.aborted) {
        const partialResult: StreamResult = { content: '' };
        callbacks.onComplete?.(partialResult);
        return partialResult;
      }
      callbacks.onError?.(toError(err));
      throw err;
    }
  }

  async testConnection(config: { apiKey?: string; apiEndpoint?: string }): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    const endpoint = config.apiEndpoint || 'http://localhost:11434';

    try {
      const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/tags`);
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        return {
          success: true,
          message: 'Connected to local Ollama instance (HTTP 200 OK)',
          latencyMs,
        };
      }
      return {
        success: false,
        message: `Ollama returned HTTP ${res.status}`,
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to reach Ollama endpoint',
      };
    }
  }
}

export const geminiEngine = new GeminiEngine();
export const openaiEngine = new OpenAIEngine();
export const ollamaEngine = new OllamaEngine();
