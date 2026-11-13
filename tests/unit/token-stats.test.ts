import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  estimateTokenCount,
  computeThreadTokenStats,
  formatTokenCount,
  buildGeminiContentsFromSession,
} from '../../src/utils/tokenStats';
import {
  GeminiEngine,
  countGeminiTokens,
  getGeminiModelInfo,
} from '../../src/services/liveEngine';
import { useChatStore } from '../../src/store/useChatStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { ChatSession } from '../../src/types/chat';

function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('Thread Token Statistics', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.getState().resetAllSettings();
    useChatStore.getState().clearAllSessions();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('estimates tokens for ASCII and CJK text', () => {
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('Hello world!')).toBe(3); // 12 / 4 = 3
    expect(estimateTokenCount('你好世界')).toBe(6); // 4 * 1.5 = 6
  });

  it('formats token counts with thousand separators', () => {
    expect(formatTokenCount(240)).toBe('240');
    expect(formatTokenCount(12500)).toBe('12,500');
  });

  it('computes exact thread token stats from API usageMetadata and ignores abandoned branches', () => {
    const session: ChatSession = {
      id: 's1',
      title: 'Token Test',
      rootMessageId: 'u1',
      activeLeafId: 'a2',
      pinned: false,
      model: 'gemini-2.5-pro',
      createdAt: 1,
      updatedAt: 5,
      messages: {
        u1: {
          id: 'u1',
          parentId: null,
          childrenIds: ['a1', 'a1_alt'],
          role: 'user',
          content: 'Hi',
          createdAt: 1,
        },
        a1_alt: {
          id: 'a1_alt',
          parentId: 'u1',
          childrenIds: [],
          role: 'assistant',
          content: 'Abandoned branch reply',
          createdAt: 2,
          tokenUsage: {
            promptTokens: 999,
            completionTokens: 999,
            totalTokens: 1998,
          },
        },
        a1: {
          id: 'a1',
          parentId: 'u1',
          childrenIds: ['u2'],
          role: 'assistant',
          content: 'Hello!',
          createdAt: 2,
          tokenUsage: {
            promptTokens: 10,
            completionTokens: 20,
            thoughtsTokens: 5,
            totalTokens: 35,
          },
        },
        u2: {
          id: 'u2',
          parentId: 'a1',
          childrenIds: ['a2'],
          role: 'user',
          content: 'How are you?',
          createdAt: 3,
        },
        a2: {
          id: 'a2',
          parentId: 'u2',
          childrenIds: [],
          role: 'assistant',
          content: 'Doing great!',
          createdAt: 4,
          tokenUsage: {
            promptTokens: 40,
            completionTokens: 30,
            totalTokens: 70,
          },
        },
      },
    };

    const stats = computeThreadTokenStats(session);
    expect(stats.promptTokens).toBe(50);
    expect(stats.completionTokens).toBe(50);
    expect(stats.thoughtsTokens).toBe(5);
    expect(stats.totalTokens).toBe(105);
    expect(stats.contextTokens).toBe(70);
    expect(stats.messageCount).toBe(4);
    expect(stats.hasEstimated).toBe(false);
  });

  it('falls back to estimation when assistant messages lack tokenUsage', () => {
    const session: ChatSession = {
      id: 's2',
      title: 'Estimated Test',
      rootMessageId: 'u1',
      activeLeafId: 'a1',
      pinned: false,
      model: 'Simulated',
      createdAt: 1,
      updatedAt: 2,
      messages: {
        u1: {
          id: 'u1',
          parentId: null,
          childrenIds: ['a1'],
          role: 'user',
          content: 'Hello world!', // 3 tokens
          createdAt: 1,
        },
        a1: {
          id: 'a1',
          parentId: 'u1',
          childrenIds: [],
          role: 'assistant',
          content: 'Hi there!', // 3 tokens
          createdAt: 2,
        },
      },
    };

    const stats = computeThreadTokenStats(session);
    expect(stats.hasEstimated).toBe(true);
    expect(stats.promptTokens).toBe(3);
    expect(stats.completionTokens).toBe(3);
    expect(stats.totalTokens).toBe(6);
    expect(stats.messageCount).toBe(2);
  });

  it('captures usageMetadata from Gemini streamGenerateContent and stores it on MessageNode', async () => {
    useSettingsStore.getState().setEngineMode('gemini');
    useSettingsStore.getState().setApiKey('AIzaTestKey');
    useSettingsStore.getState().setTitleEmbeddingModel('off');
    useSettingsStore.getState().setDefaultModel('gemini-2.5-flash');

    const sseChunks = [
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ thought: true, text: 'Let me think' }] } }],
      })}\n\n`,
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Final answer' }] } }],
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 80,
          thoughtsTokenCount: 40,
          totalTokenCount: 240,
        },
      })}\n\n`,
    ];

    global.fetch = vi.fn().mockImplementation(async () =>
      new Response(createSSEStream(sseChunks), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const engine = new GeminiEngine();
    const result = await engine.streamChat(
      {
        messages: [{ role: 'user', content: 'Test prompt' }],
        model: 'gemini-2.5-flash',
        apiKey: 'AIzaTestKey',
      },
      {}
    );

    expect(result.tokenUsage).toEqual({
      promptTokens: 120,
      completionTokens: 80,
      thoughtsTokens: 40,
      totalTokens: 240,
    });

    await useChatStore.getState().sendChatMessage('Test prompt');
    const session = useChatStore.getState().getActiveSession()!;
    const assistantMsg = Object.values(session.messages).find((m) => m.role === 'assistant')!;
    expect(assistantMsg.tokenUsage).toEqual({
      promptTokens: 120,
      completionTokens: 80,
      thoughtsTokens: 40,
      totalTokens: 240,
    });
  });

  it('calls Gemini models.countTokens and models.get REST endpoints for exact token count and inputTokenLimit', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes(':countTokens')) {
        return new Response(JSON.stringify({ totalTokens: 312 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          name: 'models/gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          description: 'Fast model',
          inputTokenLimit: 1048576,
          outputTokenLimit: 65536,
          supportedGenerationMethods: ['generateContent'],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    global.fetch = fetchMock;

    const session: ChatSession = {
      id: 's-api',
      title: 'API Count Test',
      rootMessageId: 'u1',
      activeLeafId: 'a1',
      pinned: false,
      model: 'gemini-2.5-flash',
      createdAt: 1,
      updatedAt: 2,
      messages: {
        u1: {
          id: 'u1',
          parentId: null,
          childrenIds: ['a1'],
          role: 'user',
          content: 'Hello Gemini',
          createdAt: 1,
        },
        a1: {
          id: 'a1',
          parentId: 'u1',
          childrenIds: [],
          role: 'assistant',
          content: 'Hello user!',
          createdAt: 2,
        },
      },
    };

    const contents = buildGeminiContentsFromSession(session);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'Hello Gemini' }] },
      { role: 'model', parts: [{ text: 'Hello user!' }] },
    ]);

    const countRes = await countGeminiTokens({
      model: 'gemini-2.5-flash',
      apiKey: 'AIzaTestKey',
      contents,
    });
    expect(countRes.totalTokens).toBe(312);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1beta/models/gemini-2.5-flash:countTokens?key=AIzaTestKey'),
      expect.objectContaining({ method: 'POST' })
    );

    const modelInfo = await getGeminiModelInfo({
      model: 'gemini-2.5-flash',
      apiKey: 'AIzaTestKey',
    });
    expect(modelInfo.inputTokenLimit).toBe(1048576);
    expect(modelInfo.outputTokenLimit).toBe(65536);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1beta/models/gemini-2.5-flash?key=AIzaTestKey'),
      expect.objectContaining({ method: 'GET' })
    );
  });
});
