import {
  AIEngine,
  ConnectionTestResult,
  StreamCallbacks,
  StreamRequest,
  StreamResult,
} from './aiEngine';
import { Attachment, TokenUsage } from '../types/chat';
import { GeminiModelInfo } from '../types/settings';
import { useSettingsStore } from '../store/useSettingsStore';
import { buildGeminiThinkingConfig } from '../utils/thinkingConfig';

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function buildGeminiParts(text: string, attachments?: Attachment[]): GeminiPart[] {
  const parts: GeminiPart[] = [];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.textContent !== undefined) {
        parts.push({
          text: `[Attached File: ${att.name} (${att.type})]\n\`\`\`\n${att.textContent}\n\`\`\``,
        });
      } else if (att.dataBase64) {
        parts.push({
          inlineData: {
            mimeType: att.type || 'application/octet-stream',
            data: att.dataBase64,
          },
        });
      }
    }
  }

  if (text && text.trim()) {
    parts.push({ text });
  } else if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return parts;
}

export function buildOpenAIMessageContent(
  text: string,
  attachments?: Attachment[]
): string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> {
  if (!attachments || attachments.length === 0) {
    return text;
  }

  const textChunks: string[] = [];
  const imageParts: Array<{ type: 'image_url'; image_url: { url: string } }> = [];

  for (const att of attachments) {
    if (att.textContent !== undefined) {
      textChunks.push(`[Attached File: ${att.name} (${att.type})]\n\`\`\`\n${att.textContent}\n\`\`\``);
    } else if (att.type.startsWith('image/') && att.dataBase64) {
      imageParts.push({
        type: 'image_url',
        image_url: { url: `data:${att.type};base64,${att.dataBase64}` },
      });
    }
  }

  if (text && text.trim()) {
    textChunks.push(text);
  }

  const combinedText = textChunks.join('\n\n');
  if (imageParts.length === 0) {
    return combinedText;
  }

  return [
    ...(combinedText ? [{ type: 'text' as const, text: combinedText }] : []),
    ...imageParts,
  ];
}

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

/**
 * Fetches metadata (including inputTokenLimit and outputTokenLimit) for a specific model
 * using the Gemini REST API `models.get` endpoint: GET /v1beta/models/{model}.
 */
export async function getGeminiModelInfo(params: {
  model: string;
  apiKey: string;
  apiEndpoint?: string;
  signal?: AbortSignal;
}): Promise<GeminiModelInfo> {
  const { model, apiKey, apiEndpoint, signal } = params;
  if (!apiKey) {
    throw new Error('Google Gemini API Key is required for models.get.');
  }
  const resolvedId = resolveGeminiModelId(model);
  const base = buildGeminiV1BetaBase(apiEndpoint);
  const url = `${base}/models/${encodeURIComponent(resolvedId)}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { method: 'GET', signal });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Failed to fetch Gemini model info [HTTP ${res.status}]${detail ? `: ${detail}` : ''}`
    );
  }

  const m: RawGeminiModel = await res.json();
  const id = (m.name || resolvedId).replace(/^models\//, '');
  return {
    id,
    name: m.displayName || id,
    description: m.description || 'Google Gemini generative model',
    inputTokenLimit: m.inputTokenLimit,
    outputTokenLimit: m.outputTokenLimit,
    supportedGenerationMethods: m.supportedGenerationMethods,
  };
}

export interface GeminiCountTokensResult {
  totalTokens: number;
  cachedContentTokenCount?: number;
}

/**
 * Counts tokens for conversation contents using the Gemini REST API `models.countTokens`
 * endpoint documented at https://aistudio.google.com/docs/tokens:
 * POST /v1beta/models/{model}:countTokens
 */
export async function countGeminiTokens(params: {
  model: string;
  apiKey: string;
  apiEndpoint?: string;
  contents: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }>;
  signal?: AbortSignal;
}): Promise<GeminiCountTokensResult> {
  const { model, apiKey, apiEndpoint, contents, signal } = params;
  if (!apiKey) {
    throw new Error('Google Gemini API Key is required for countTokens.');
  }
  if (!contents || contents.length === 0) {
    return { totalTokens: 0 };
  }

  const resolvedId = resolveGeminiModelId(model);
  const base = buildGeminiV1BetaBase(apiEndpoint);
  const url = `${base}/models/${encodeURIComponent(resolvedId)}:countTokens?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
    signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Failed to count Gemini tokens [HTTP ${res.status}]${detail ? `: ${detail}` : ''}`
    );
  }

  const data = await res.json();
  return {
    totalTokens: typeof data?.totalTokens === 'number' ? data.totalTokens : 0,
    ...(typeof data?.cachedContentTokenCount === 'number'
      ? { cachedContentTokenCount: data.cachedContentTokenCount }
      : {}),
  };
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
      thinkingPreset = 'auto',
      geminiTools,
    } = request;

    if (!apiKey) {
      const err = new Error('Google Gemini API Key is required. Please set it in Settings.');
      callbacks.onError?.(err);
      throw err;
    }

    const resolvedModelId = resolveGeminiModelId(model);
    const base = buildGeminiV1BetaBase(apiEndpoint);
    const endpoint = `${base}/models/${encodeURIComponent(resolvedModelId)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const thinkingConfig = buildGeminiThinkingConfig(resolvedModelId, thinkingPreset);

    const tools: Array<Record<string, Record<string, never>>> = [];
    if (geminiTools?.googleSearch) tools.push({ googleSearch: {} });
    if (geminiTools?.codeExecution) tools.push({ codeExecution: {} });
    if (geminiTools?.urlContext) tools.push({ urlContext: {} });

    const priorContents = (request.history || [])
      .filter(
        (h) =>
          h.role !== 'system' &&
          ((h.content && h.content.trim().length > 0) ||
            (h.attachments && h.attachments.length > 0))
      )
      .map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts:
          h.role === 'user'
            ? buildGeminiParts(h.content, h.attachments)
            : [{ text: h.content }],
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
          parts: buildGeminiParts(prompt, request.attachments),
        },
      ],
      ...(tools.length > 0 ? { tools } : {}),
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 2048,
        ...(thinkingConfig ? { thinkingConfig } : {}),
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
      let tokenUsage: TokenUsage | undefined;
      const groundingLinks = new Map<string, string>();

      await readStreamLines(res, signal, (line) => {
        if (!line.startsWith('data: ')) return;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') return;

        try {
          const data = JSON.parse(raw);

          if (data?.usageMetadata && typeof data.usageMetadata === 'object') {
            const um = data.usageMetadata;
            const promptTokens = typeof um.promptTokenCount === 'number' ? um.promptTokenCount : 0;
            const completionTokens =
              typeof um.candidatesTokenCount === 'number' ? um.candidatesTokenCount : 0;
            const thoughtsTokens =
              typeof um.thoughtsTokenCount === 'number' ? um.thoughtsTokenCount : 0;
            const totalTokens =
              typeof um.totalTokenCount === 'number'
                ? um.totalTokenCount
                : promptTokens + completionTokens + thoughtsTokens;

            if (totalTokens > 0 || promptTokens > 0 || completionTokens > 0) {
              tokenUsage = {
                promptTokens,
                completionTokens,
                ...(thoughtsTokens > 0 ? { thoughtsTokens } : {}),
                totalTokens,
              };
            }
          }

          const candidate = data?.candidates?.[0];
          const chunks = candidate?.groundingMetadata?.groundingChunks;
          if (Array.isArray(chunks)) {
            for (const ch of chunks) {
              const uri = ch?.web?.uri;
              const title = ch?.web?.title || uri;
              if (typeof uri === 'string' && uri) {
                groundingLinks.set(uri, typeof title === 'string' ? title : uri);
              }
            }
          }

          const parts = candidate?.content?.parts;
          if (!Array.isArray(parts)) return;

          for (const part of parts) {
            if (!part) continue;

            if (part.executableCode && typeof part.executableCode.code === 'string') {
              const lang = String(part.executableCode.language || 'python').toLowerCase();
              const snippet = `\n\`\`\`${lang}\n${part.executableCode.code.trim()}\n\`\`\`\n`;
              accumulatedContent += snippet;
              callbacks.onToken?.(snippet, accumulatedContent);
              continue;
            }

            if (part.codeExecutionResult && typeof part.codeExecutionResult.output === 'string') {
              const out = `\n**Execution Output:**\n\`\`\`text\n${part.codeExecutionResult.output.trim()}\n\`\`\`\n`;
              accumulatedContent += out;
              callbacks.onToken?.(out, accumulatedContent);
              continue;
            }

            if (typeof part.text !== 'string' || part.text.length === 0) {
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

      if (groundingLinks.size > 0) {
        const sourcesBlock =
          '\n\n---\n**Sources:**\n' +
          Array.from(groundingLinks.entries())
            .map(([uri, title]) => `- [${title}](${uri})`)
            .join('\n');
        accumulatedContent += sourcesBlock;
        callbacks.onToken?.(sourcesBlock, accumulatedContent);
      }

      const result: StreamResult = {
        content: accumulatedContent,
        ...(accumulatedReasoning
          ? {
              reasoningContent: accumulatedReasoning,
              thinkingDuration,
            }
          : {}),
        ...(tokenUsage ? { tokenUsage } : {}),
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
      ...(request.history || []).map((h) => ({
        role: h.role,
        content:
          h.role === 'user'
            ? buildOpenAIMessageContent(h.content, h.attachments)
            : h.content,
      })),
      { role: 'user', content: buildOpenAIMessageContent(prompt, request.attachments) },
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
