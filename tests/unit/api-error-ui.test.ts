import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatApiError, useChatStore } from '../../src/store/useChatStore';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { buildConversationHistory } from '../../src/utils/treeUtils';

describe('API Error Handling & UI State', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.setState({
      sessions: [],
      activeSessionId: null,
      isStreaming: false,
      abortController: null,
    });
    useSettingsStore.setState({
      engineMode: 'simulated',
      apiKey: '',
      apiEndpoint: '',
    });
  });

  describe('formatApiError', () => {
    it('extracts error.message from Gemini JSON error responses while preserving status code', () => {
      const raw = new Error(
        'Gemini API error [400]: {"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT"}}'
      );
      expect(formatApiError(raw)).toBe(
        '[400] API key not valid. Please pass a valid API key.'
      );
    });

    it('extracts error.message from OpenAI JSON error responses', () => {
      const raw = new Error(
        'OpenAI API error [401]: {"error":{"message":"Incorrect API key provided","type":"invalid_request_error"}}'
      );
      expect(formatApiError(raw)).toBe('[401] Incorrect API key provided');
    });

    it('returns plain error message when no JSON payload is present', () => {
      expect(formatApiError(new Error('Network connection failed'))).toBe(
        'Network connection failed'
      );
    });
  });

  describe('useChatStore error persistence & multi-turn history safety', () => {
    it('stores error on assistant MessageNode when Gemini API key is missing', async () => {
      useSettingsStore.setState({
        engineMode: 'gemini',
        apiKey: '',
      });

      await useChatStore.getState().sendChatMessage('Hello Gemini');

      const session = useChatStore.getState().getActiveSession();
      expect(session).not.toBeNull();
      const assistantNode = Object.values(session!.messages).find(
        (m) => m.role === 'assistant'
      );
      expect(assistantNode).toBeDefined();
      expect(assistantNode!.error).toContain('Google Gemini API Key is required');
      expect(assistantNode!.isStreaming).toBe(false);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('stores parsed HTTP 429 error on assistant MessageNode and excludes errored turn from subsequent history', async () => {
      useSettingsStore.setState({
        engineMode: 'gemini',
        apiKey: 'AIzaTestKey123',
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Quota exceeded for quota metric',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await useChatStore.getState().sendChatMessage('First question');

      const session = useChatStore.getState().getActiveSession()!;
      const failedAssistant = Object.values(session.messages).find(
        (m) => m.role === 'assistant'
      )!;
      expect(failedAssistant.error).toBe('[429] Quota exceeded for quota metric');
      expect(failedAssistant.isStreaming).toBe(false);

      // Even if an errored assistant node had partial content, buildConversationHistory should skip it
      useChatStore.getState().updateMessageContent(session.id, failedAssistant.id, 'partial text', false);
      const nextUser = useChatStore.getState().addMessageNode(session.id, {
        role: 'user',
        content: 'Second question',
        parentId: failedAssistant.id,
      });
      const nextAssistant = useChatStore.getState().addMessageNode(session.id, {
        role: 'assistant',
        content: '',
        parentId: nextUser.id,
      });

      const updatedSession = useChatStore.getState().getActiveSession()!;
      const history = buildConversationHistory(updatedSession, nextAssistant.id);
      expect(history).toEqual([{ role: 'user', content: 'First question' }]);

      fetchSpy.mockRestore();
    });
  });
});
