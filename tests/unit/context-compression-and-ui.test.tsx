import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  CONTEXT_COMPRESSION_PROMPT,
  shouldAutoCompressSession,
} from '../../src/utils/contextCompression';
import { buildConversationHistory } from '../../src/utils/treeUtils';
import {
  buildGeminiContentsFromSession,
  computeThreadTokenStats,
} from '../../src/utils/tokenStats';
import { useChatStore } from '../../src/store/useChatStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { ThinkingAccordion } from '../../src/components/conversation/ThinkingAccordion';
import { ConversationView } from '../../src/components/conversation/ConversationView';
import { TopAppBar } from '../../src/components/layout/TopAppBar';
import { SettingsDialog } from '../../src/components/settings/SettingsDialog';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

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

describe('Context Compression, CodeBlock Scroll Persistence & Default Collapsed Thought', () => {
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

  describe('1. Default Collapsed Thought (ThinkingAccordion)', () => {
    it('renders ThinkingAccordion collapsed by default and toggles open on click', () => {
      render(
        <ThinkingAccordion
          reasoningContent="Step 1: Analyze problem. Step 2: Solve."
          thinkingDuration={1500}
          isStreaming={false}
        />
      );

      const header = screen.getByTestId('thinking-accordion-header');
      const content = screen.getByTestId('thinking-accordion-content');

      expect(header).toHaveAttribute('aria-expanded', 'false');
      expect(content).toHaveStyle({ display: 'none' });

      // Click to expand
      fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'true');
      expect(content).toHaveStyle({ display: 'block' });

      // Click again to collapse
      fireEvent.click(header);
      expect(header).toHaveAttribute('aria-expanded', 'false');
      expect(content).toHaveStyle({ display: 'none' });
    });
  });

  describe('2. CodeBlock Collapsed State Preserved During Window Scroll', () => {
    it('keeps CodeBlock collapsed when ConversationView scrolls and toggles ScrollToBottomFab', () => {
      const sessionId = useChatStore.getState().createSession('Write TypeScript code');
      const session = useChatStore.getState().getActiveSession()!;
      const userId = session.activeLeafId!;

      useChatStore.getState().addMessageNode(sessionId, {
        role: 'assistant',
        parentId: userId,
        content: 'Here is the code:\n```typescript\nconst x = 42;\nconsole.log(x);\n```',
      });

      render(<ConversationView />);

      const codeBlock = screen.getByTestId('code-block');
      const collapseBtn = screen.getByTestId('toggle-code-collapse-btn');

      expect(codeBlock).toHaveAttribute('data-collapsed', 'false');
      expect(screen.getByTestId('code-block-body')).toBeInTheDocument();

      // Collapse the CodeBlock
      fireEvent.click(collapseBtn);
      expect(codeBlock).toHaveAttribute('data-collapsed', 'true');
      expect(screen.queryByTestId('code-block-body')).not.toBeInTheDocument();

      // Simulate scrolling up and down on the conversation container
      const container = screen.getByTestId('conversation-container');
      Object.defineProperty(container, 'scrollHeight', { value: 2000, configurable: true });
      Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
      Object.defineProperty(container, 'scrollTop', { value: 200, configurable: true, writable: true });

      // Scroll up (distanceFromBottom = 1300 > 150 -> triggers setShowFab(true) re-render)
      fireEvent.scroll(container);
      expect(screen.getByTestId('code-block')).toHaveAttribute('data-collapsed', 'true');
      expect(screen.queryByTestId('code-block-body')).not.toBeInTheDocument();

      // Scroll down near bottom (distanceFromBottom = 50 <= 150 -> triggers setShowFab(false) re-render)
      Object.defineProperty(container, 'scrollTop', { value: 1450, configurable: true, writable: true });
      fireEvent.scroll(container);
      expect(screen.getByTestId('code-block')).toHaveAttribute('data-collapsed', 'true');
      expect(screen.queryByTestId('code-block-body')).not.toBeInTheDocument();
    });
  });

  describe('3. Context Compression (Manual & Auto near Context Window)', () => {
    it('uses the exact required handoff briefing prompt for manual compression and prunes prior history on subsequent turns', async () => {
      useSettingsStore.getState().updateSettings({
        engineMode: 'gemini',
        apiKey: 'AIzaTestKey',
        titleEmbeddingModel: 'off',
      });

      const fetchMock = vi
        .fn()
        // Turn 1 response
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'Hello Alice, ready to build src/app.ts!' }] } }],
            })}\n\n`,
          ]),
        })
        // Manual compression response
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: '1. 目標與當前狀態：使用者 Alice 正在建立 src/app.ts。',
                      },
                    ],
                  },
                },
              ],
            })}\n\n`,
          ]),
        })
        // Turn 2 response after compression
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'Continuing with src/app.ts for Alice.' }] } }],
            })}\n\n`,
          ]),
        });

      global.fetch = fetchMock as unknown as typeof fetch;

      await useChatStore.getState().sendChatMessage('I am Alice and I want to create src/app.ts');
      await useChatStore.getState().compressContext();

      // Verify compression request sent the exact CONTEXT_COMPRESSION_PROMPT
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const compressReqBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(compressReqBody.contents).toEqual([
        { role: 'user', parts: [{ text: 'I am Alice and I want to create src/app.ts' }] },
        { role: 'model', parts: [{ text: 'Hello Alice, ready to build src/app.ts!' }] },
        { role: 'user', parts: [{ text: CONTEXT_COMPRESSION_PROMPT }] },
      ]);

      // Verify summary node is marked with isContextSummary
      const sessionAfterCompress = useChatStore.getState().getActiveSession()!;
      const leafAfterCompress = sessionAfterCompress.messages[sessionAfterCompress.activeLeafId!];
      expect(leafAfterCompress.isContextSummary).toBe(true);
      expect(leafAfterCompress.content).toContain('使用者 Alice 正在建立 src/app.ts');

      // Send a follow-up message after compression
      await useChatStore.getState().sendChatMessage('What is the next step?');
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Verify Turn 2 after compression ONLY sends the compressed handoff briefing + new prompt (pruning pre-compression messages)
      const followUpReqBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string);
      expect(followUpReqBody.contents).toEqual([
        { role: 'user', parts: [{ text: CONTEXT_COMPRESSION_PROMPT }] },
        { role: 'model', parts: [{ text: '1. 目標與當前狀態：使用者 Alice 正在建立 src/app.ts。' }] },
        { role: 'user', parts: [{ text: 'What is the next step?' }] },
      ]);
    });

    it('automatically compresses when context tokens reach the user-configured context window threshold', async () => {
      useSettingsStore.getState().updateSettings({
        engineMode: 'gemini',
        apiKey: 'AIzaTestKey',
        titleEmbeddingModel: 'off',
        autoCompressContext: true,
        autoCompressThresholdPct: 80,
        fetchedGeminiModels: [
          {
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            description: 'Fast model',
            inputTokenLimit: 1000, // Small 1000 token window so 850 tokens (85%) triggers auto-compress
          },
        ],
      });

      const fetchMock = vi
        .fn()
        // Turn 1 response with usageMetadata reporting 850 totalTokens (>= 80% of 1000)
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'Detailed response reaching 85% window.' }] } }],
              usageMetadata: {
                promptTokenCount: 400,
                candidatesTokenCount: 450,
                totalTokenCount: 850,
              },
            })}\n\n`,
          ]),
        })
        // Auto-triggered compression call
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: '自動壓縮交接摘要：已完成第一階段分析。' }] } }],
              usageMetadata: {
                promptTokenCount: 850,
                candidatesTokenCount: 30,
                totalTokenCount: 880,
              },
            })}\n\n`,
          ]),
        });

      global.fetch = fetchMock as unknown as typeof fetch;

      await useChatStore.getState().sendChatMessage('Analyze system architecture in detail');

      // Expect 2 calls: 1 for the chat message + 1 automatic context compression call
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const autoCompressBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(autoCompressBody.contents[autoCompressBody.contents.length - 1]).toEqual({
        role: 'user',
        parts: [{ text: CONTEXT_COMPRESSION_PROMPT }],
      });

      const activeSession = useChatStore.getState().getActiveSession()!;
      const latestLeaf = activeSession.messages[activeSession.activeLeafId!];
      expect(latestLeaf.isContextSummary).toBe(true);
      expect(latestLeaf.content).toContain('自動壓縮交接摘要');

      // Verify current context tokens reset to the compact summary size (30 tokens)
      const stats = computeThreadTokenStats(activeSession);
      expect(stats.contextTokens).toBe(30);
    });

    it('renders UI controls for manual and automatic compression in SettingsDialog and TopAppBar', async () => {
      const sessionId = useChatStore.getState().createSession('Hello world');
      const session = useChatStore.getState().getActiveSession()!;
      useChatStore.getState().addMessageNode(sessionId, {
        role: 'assistant',
        parentId: session.activeLeafId,
        content: 'Hi there!',
      });

      render(
        <ThemeProvider>
          <TopAppBar isSidebarOpen={true} onToggleSidebar={() => {}} />
          <SettingsDialog isOpen={true} onClose={() => {}} />
        </ThemeProvider>
      );

      // SettingsDialog auto-compress toggle & threshold slider
      const autoToggle = screen.getByTestId('auto-compress-toggle');
      expect(autoToggle).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(autoToggle);
      expect(useSettingsStore.getState().autoCompressContext).toBe(true);

      const thresholdSlider = screen.getByTestId('auto-compress-threshold-slider');
      fireEvent.change(thresholdSlider, { target: { value: '75' } });
      expect(useSettingsStore.getState().autoCompressThresholdPct).toBe(75);
      expect(screen.getByTestId('auto-compress-threshold-value')).toHaveTextContent('75%');

      // TopAppBar manual compress button
      const compressBtn = screen.getByTestId('compress-context-btn');
      expect(compressBtn).toBeInTheDocument();

      useSettingsStore.getState().setSimulatedSpeed('fast');
      fireEvent.click(compressBtn);

      await waitFor(() => {
        const updated = useChatStore.getState().getActiveSession()!;
        const leaf = updated.messages[updated.activeLeafId!];
        expect(leaf.isContextSummary).toBe(true);
        expect(leaf.content).toContain('目標與當前狀態');
      });
    });
  });

  describe('4. Thinking Process & Thought Signatures in Multi-turn Context & Token Counting', () => {
    it('captures thoughtSignature and reasoningContent from Gemini SSE and includes them in subsequent turn requests and countTokens contents', async () => {
      useSettingsStore.getState().updateSettings({
        engineMode: 'gemini',
        apiKey: 'AIzaTestKey',
        titleEmbeddingModel: 'off',
        thinkingPreset: 'high',
      });

      const fetchMock = vi
        .fn()
        // Turn 1 response with thought part and thoughtSignature
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: 'Let us factor the quadratic equation first.',
                        thought: true,
                      },
                    ],
                  },
                },
              ],
            })}\n\n`,
            `data: ${JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: 'The roots are x = 2 and x = 3.',
                        thoughtSignature: 'Em8KSignatureBase64XYZ==',
                      },
                    ],
                  },
                },
              ],
              usageMetadata: {
                promptTokenCount: 15,
                candidatesTokenCount: 12,
                thoughtsTokenCount: 45,
                totalTokenCount: 72,
              },
            })}\n\n`,
          ]),
        })
        // Turn 2 response
        .mockResolvedValueOnce({
          ok: true,
          body: createSSEStream([
            `data: ${JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: 'Substituting x = 2 gives 4 - 10 + 6 = 0.',
                      },
                    ],
                  },
                },
              ],
            })}\n\n`,
          ]),
        });

      global.fetch = fetchMock as unknown as typeof fetch;

      await useChatStore.getState().sendChatMessage('Solve x^2 - 5x + 6 = 0');

      const sessionAfterTurn1 = useChatStore.getState().getActiveSession()!;
      const assistantTurn1 = sessionAfterTurn1.messages[sessionAfterTurn1.activeLeafId!];
      expect(assistantTurn1.reasoningContent).toBe('Let us factor the quadratic equation first.');
      expect(assistantTurn1.thoughtSignature).toBe('Em8KSignatureBase64XYZ==');

      // Verify buildGeminiContentsFromSession (used by countTokens) includes thoughtSignature without plain-text thought summary
      const countTokensContents = buildGeminiContentsFromSession(sessionAfterTurn1);
      expect(countTokensContents).toEqual([
        {
          role: 'user',
          parts: [{ text: 'Solve x^2 - 5x + 6 = 0' }],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'The roots are x = 2 and x = 3.',
              thoughtSignature: 'Em8KSignatureBase64XYZ==',
            },
          ],
        },
      ]);

      // Verify Turn 2 request includes Turn 1's thoughtSignature (and does NOT stuff plain-text reasoningContent into contents)
      await useChatStore.getState().sendChatMessage('Verify the first root');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const turn2Body = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
      expect(turn2Body.contents).toEqual([
        {
          role: 'user',
          parts: [{ text: 'Solve x^2 - 5x + 6 = 0' }],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'The roots are x = 2 and x = 3.',
              thoughtSignature: 'Em8KSignatureBase64XYZ==',
            },
          ],
        },
        {
          role: 'user',
          parts: [{ text: 'Verify the first root' }],
        },
      ]);
    });
  });
});

