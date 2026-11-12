import {
  AIEngine,
  ConnectionTestResult,
  StreamCallbacks,
  StreamRequest,
  StreamResult,
} from './aiEngine';

// Helper to read SSE or chunked stream
async function readSSEStream(
  response: Response,
  signal: AbortSignal | undefined,
  parseChunk: (line: string) => string | null,
  callbacks: StreamCallbacks
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
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

        const token = parseChunk(trimmed);
        if (token) {
          accumulated += token;
          callbacks.onToken?.(token, accumulated);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

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
    const { prompt, model = 'gemini-1.5-flash', temperature, maxTokens, signal, apiKey = '' } = request;

    if (!apiKey) {
      const err = new Error('Google Gemini API Key is required. Please set it in Settings.');
      callbacks.onError?.(err);
      throw err;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = {
      contents: [
        ...(request.history?.map((h) => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }],
        })) || []),
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

      const accumulated = await readSSEStream(
        res,
        signal,
        (line) => {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const text =
                data?.candidates?.[0]?.content?.parts?.[0]?.text;
              return text || null;
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
        message: 'API Key required for Gemini endpoint',
      };
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`
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
