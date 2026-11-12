import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiEngine } from '../../src/services/liveEngine';
import { buildConversationHistory } from '../../src/utils/treeUtils';
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

describe('Multi-turn conversation history & Gemini thought: true support', () => {
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

  it('buildConversationHistory extracts chronological ancestor turns along the active branch', () => {
    const session: ChatSession = {
      id: 's1',
      title: 'Test',
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
          childrenIds: ['a1'],
          role: 'user',
          content: 'My name is Alice.',
          createdAt: 1,
        },
        a1: {
          id: 'a1',
          parentId: 'u1',
          childrenIds: ['u2'],
          role: 'assistant',
          content: 'Nice to meet you, Alice!',
          createdAt: 2,
        },
        u2: {
          id: 'u2',
          parentId: 'a1',
          childrenIds: ['a2'],
          role: 'user',
          content: 'What is my name?',
          createdAt: 3,
        },
        a2: {
          id: 'a2',
          parentId: 'u2',
          childrenIds: [],
          role: 'assistant',
          content: '',
          createdAt: 4,
        },
      },
    };

    const history = buildConversationHistory(session, 'a2');
    expect(history).toEqual([
      { role: 'user', content: 'My name is Alice.' },
      { role: 'assistant', content: 'Nice to meet you, Alice!' },
    ]);
  });

  it('GeminiEngine separates thought: true parts into reasoningContent and sends multi-turn history', async () => {
    const sseChunks = [
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ thought: true, text: 'Step 1: Recall user name. ' }] } }],
      })}\n\n`,
      `data: ${JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'Step 2: Answer concisely.' },
                { text: 'Your name is ' },
              ],
            },
          },
        ],
      })}\n\n`,
      `data: ${JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Alice.' }] } }],
      })}\n\n`,
    ];

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSSEStream(sseChunks),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const engine = new GeminiEngine();
    const reasoningTokens: string[] = [];
    const contentTokens: string[] = [];

    const result = await engine.streamChat(
      {
        prompt: 'What is my name?',
        history: [
          { role: 'user', content: 'My name is Alice.' },
          { role: 'assistant', content: 'Hello Alice!' },
        ],
        systemPrompt: 'Be helpful.',
        model: 'gemini-2.5-pro',
        apiKey: 'AIzaTestKey',
      },
      {
        onReasoning: (_token, acc) => reasoningTokens.push(acc),
        onToken: (_token, acc) => contentTokens.push(acc),
      }
    );

    // Verify request body includes systemInstruction and multi-turn contents
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const reqInit = fetchMock.mock.calls[0][1] as RequestInit;
    const sentBody = JSON.parse(reqInit.body as string);
    expect(sentBody.systemInstruction).toEqual({ parts: [{ text: 'Be helpful.' }] });
    expect(sentBody.contents).toEqual([
      { role: 'user', parts: [{ text: 'My name is Alice.' }] },
      { role: 'model', parts: [{ text: 'Hello Alice!' }] },
      { role: 'user', parts: [{ text: 'What is my name?' }] },
    ]);

    // Verify thought: true went to reasoningContent and normal text went to content
    expect(reasoningTokens).toEqual([
      'Step 1: Recall user name. ',
      'Step 1: Recall user name. Step 2: Answer concisely.',
    ]);
    expect(contentTokens).toEqual(['Your name is ', 'Your name is Alice.']);
    expect(result.reasoningContent).toBe('Step 1: Recall user name. Step 2: Answer concisely.');
    expect(result.content).toBe('Your name is Alice.');
    expect(result.thinkingDuration).toBeGreaterThan(0);
  });

  it('useChatStore sends prior turns as history on turn 2 in Gemini mode', async () => {
    useSettingsStore.getState().updateSettings({
      engineMode: 'gemini',
      apiKey: 'AIzaTestKey',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ thought: true, text: 'Greeting user.' }, { text: 'Hi Bob!' }] } }],
          })}\n\n`,
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSSEStream([
          `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'You are Bob.' }] } }],
          })}\n\n`,
        ]),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    await useChatStore.getState().sendChatMessage('I am Bob');
    await useChatStore.getState().sendChatMessage('Who am I?');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(secondBody.contents).toEqual([
      { role: 'user', parts: [{ text: 'I am Bob' }] },
      { role: 'model', parts: [{ text: 'Hi Bob!' }] },
      { role: 'user', parts: [{ text: 'Who am I?' }] },
    ]);

    const session = useChatStore.getState().getActiveSession()!;
    const messages = Object.values(session.messages);
    const firstAssistant = messages.find((m) => m.role === 'assistant' && m.content === 'Hi Bob!');
    expect(firstAssistant?.reasoningContent).toBe('Greeting user.');
  });
});
