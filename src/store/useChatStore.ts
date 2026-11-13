import { create } from 'zustand';
import { Attachment, ChatSession, MessageNode, Role, TokenUsage } from '../types/chat';
import {
  loadSessionsFromStorage,
  saveSessionsToStorage,
  loadActiveSessionId,
  saveActiveSessionId,
} from '../utils/storage';
import { buildConversationHistory, generateAutoTitle, switchBranchToMessage } from '../utils/treeUtils';
import { getAIEngine } from '../services/aiEngine';
import { generateTitleWithGeminiEmbedding } from '../services/embeddingTitle';
import { useSettingsStore } from './useSettingsStore';

export interface AddMessagePayload {
  role: Role;
  content: string;
  parentId?: string | null;
  attachments?: Attachment[];
  model?: string;
  reasoningContent?: string;
  thinkingDuration?: number;
}

export interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  searchQuery: string;
  isStreaming: boolean;
  abortController: AbortController | null;

  // Session lifecycle
  createSession: (firstPrompt?: string) => string;
  startNewChat: () => void;
  selectSession: (id: string | null) => void;
  updateTitle: (id: string, title: string) => void;
  pinSession: (id: string, pinned?: boolean) => void;
  deleteSession: (id: string) => void;
  clearAllSessions: () => void;
  setSearchQuery: (query: string) => void;
  setSessionModel: (sessionId: string, model: string) => void;

  // Tree & Message actions
  addMessageNode: (sessionId: string, payload: AddMessagePayload) => MessageNode;
  updateMessageContent: (
    sessionId: string,
    messageId: string,
    content: string,
    isStreaming?: boolean
  ) => void;
  appendStreamingChunk: (sessionId: string, messageId: string, chunk: string) => void;
  setStreamingReasoning: (
    sessionId: string,
    messageId: string,
    reasoningChunk: string,
    durationMs?: number
  ) => void;
  finalizeStreamingMessage: (
    sessionId: string,
    messageId: string,
    finalContent?: string,
    reasoning?: string,
    duration?: number,
    tokenUsage?: TokenUsage
  ) => void;
  setMessageError: (sessionId: string, messageId: string, error: string) => void;
  setMessageRating: (
    sessionId: string,
    messageId: string,
    rating: 'up' | 'down' | null
  ) => void;

  switchBranch: (sessionId: string, messageId: string) => void;
  setStreaming: (isStreaming: boolean, abortController?: AbortController | null) => void;
  stopStreaming: () => void;

  // High-level AI actions
  sendChatMessage: (prompt: string, attachments?: Attachment[]) => Promise<void>;
  regenerateResponse: (messageId: string) => Promise<void>;
  editUserMessage: (messageId: string, newContent: string) => Promise<void>;

  // Helpers
  getActiveSession: () => ChatSession | null;
  reloadFromStorage: () => void;
}

export function formatApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'Unknown API error');
  const trimmed = raw.trim();
  if (!trimmed) return 'Unknown API error';

  // Extract optional status code prefix like "Gemini API error [400]: {...}" or "[401] {...}"
  const statusMatch = trimmed.match(/\[(?:HTTP\s*)?(\d{3})\]/);
  const statusPrefix = statusMatch ? `[${statusMatch[1]}] ` : '';

  // Try to parse embedded JSON error body (e.g. Gemini / OpenAI / Anthropic error payloads)
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(jsonStart));
      const apiMsg =
        parsed?.error?.message ||
        parsed?.message ||
        (typeof parsed?.error === 'string' ? parsed.error : null);
      if (typeof apiMsg === 'string' && apiMsg.trim()) {
        return `${statusPrefix}${apiMsg.trim()}`;
      }
    } catch {
      // Fall through to raw message
    }
  }

  return trimmed;
}

function initSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  return loadSessionsFromStorage();
}

function initActiveId(sessions: ChatSession[]): string | null {
  if (typeof window === 'undefined') return null;
  const savedId = loadActiveSessionId();
  if (savedId && sessions.some((s) => s.id === savedId)) {
    return savedId;
  }
  return sessions.length > 0 ? sessions[0].id : null;
}

export const useChatStore = create<ChatState>((set, get) => {
  const initialSessions = initSessions();
  const initialActiveId = initActiveId(initialSessions);

  // Internal helper to run the AI engine stream
  const executeStreamGeneration = async (
    sessionId: string,
    assistantNodeId: string,
    prompt: string,
    signal: AbortSignal
  ) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    const model = session?.model || 'Gemini 1.5 Flash';
    const history = buildConversationHistory(session, assistantNodeId);
    const assistantNode = session?.messages[assistantNodeId];
    const parentUserNode =
      assistantNode?.parentId ? session?.messages[assistantNode.parentId] : undefined;
    const attachments = parentUserNode?.attachments;

    const settings = useSettingsStore.getState();
    const activePersona = settings.getActivePersona();
    const systemPrompt = settings.getEffectiveSystemPrompt();
    const engine = getAIEngine(settings.engineMode);

    let errorHandled = false;

    try {
      await engine.streamChat(
        {
          prompt,
          history,
          systemPrompt,
          personaName: activePersona.name,
          model,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          simulatedSpeed: settings.simulatedSpeed,
          thinkingPreset: settings.thinkingPreset || 'auto',
          geminiTools: settings.geminiTools,
          attachments,
          signal,
          ...(settings.engineMode !== 'simulated'
            ? {
                apiKey: settings.apiKey,
                apiEndpoint: settings.apiEndpoint,
              }
            : {}),
        },
        {
          onToken: (_token, accumulated) => {
            get().updateMessageContent(sessionId, assistantNodeId, accumulated, true);
          },
          onReasoning: (_chunk, accumulated) => {
            get().setStreamingReasoning(sessionId, assistantNodeId, accumulated);
          },
          onThinkingDuration: (durationMs) => {
            get().setStreamingReasoning(sessionId, assistantNodeId, '', durationMs);
          },
          onComplete: (result) => {
            get().finalizeStreamingMessage(
              sessionId,
              assistantNodeId,
              result.content,
              result.reasoningContent,
              result.thinkingDuration,
              result.tokenUsage
            );

            const embeddingModel = settings.titleEmbeddingModel || 'gemini-embedding-2';
            const isFirstTurn = !parentUserNode?.parentId;
            if (
              isFirstTurn &&
              settings.engineMode === 'gemini' &&
              settings.apiKey &&
              embeddingModel !== 'off' &&
              (prompt || result.content)
            ) {
              void generateTitleWithGeminiEmbedding({
                prompt,
                assistantResponse: result.content,
                apiKey: settings.apiKey,
                apiEndpoint: settings.apiEndpoint,
                model: embeddingModel,
              })
                .then((embeddedTitle) => {
                  if (embeddedTitle && embeddedTitle.trim()) {
                    get().updateTitle(sessionId, embeddedTitle.trim());
                  }
                })
                .catch(() => {
                  // Keep local auto-generated title if embedding request fails
                });
            }
          },
          onError: (err) => {
            console.error('Streaming error:', err);
            if (!errorHandled) {
              errorHandled = true;
              get().setMessageError(sessionId, assistantNodeId, formatApiError(err));
            }
          },
        }
      );
    } catch (err: unknown) {
      if (signal.aborted) {
        get().finalizeStreamingMessage(sessionId, assistantNodeId);
        return;
      }
      console.error('Streaming failure:', err instanceof Error ? err.message : String(err));
      if (!errorHandled) {
        errorHandled = true;
        get().setMessageError(sessionId, assistantNodeId, formatApiError(err));
      }
    }
  };

  return {
    sessions: initialSessions,
    activeSessionId: initialActiveId,
    searchQuery: '',
    isStreaming: false,
    abortController: null,

    createSession: (firstPrompt?: string) => {
      const { isStreaming, abortController } = get();
      if (isStreaming && abortController) {
        abortController.abort();
      }

      const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      const title = firstPrompt ? generateAutoTitle(firstPrompt) : 'New chat';

      const messages: Record<string, MessageNode> = {};
      let rootMessageId: string | null = null;
      let activeLeafId: string | null = null;

      if (firstPrompt) {
        const msgId = `m_${now}_${Math.random().toString(36).slice(2, 6)}`;
        rootMessageId = msgId;
        activeLeafId = msgId;
        messages[msgId] = {
          id: msgId,
          parentId: null,
          childrenIds: [],
          role: 'user',
          content: firstPrompt,
          createdAt: now,
        };
      }

      const newSession: ChatSession = {
        id,
        title,
        rootMessageId,
        activeLeafId,
        messages,
        pinned: false,
        model: useSettingsStore.getState().defaultModel || 'Gemini 1.5 Flash',
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        const nextSessions = [newSession, ...state.sessions];
        saveSessionsToStorage(nextSessions);
        saveActiveSessionId(id);
        return {
          sessions: nextSessions,
          activeSessionId: id,
          isStreaming: false,
          abortController: null,
        };
      });

      return id;
    },

    startNewChat: () => {
      const { isStreaming, abortController } = get();
      if (isStreaming && abortController) {
        abortController.abort();
      }

      set(() => {
        saveActiveSessionId(null);
        return {
          activeSessionId: null,
          isStreaming: false,
          abortController: null,
        };
      });
    },

    selectSession: (id: string | null) => {
      const { isStreaming, abortController } = get();
      if (isStreaming && abortController) {
        abortController.abort();
      }
      set(() => {
        saveActiveSessionId(id);
        return {
          activeSessionId: id,
          isStreaming: false,
          abortController: null,
        };
      });
    },

    updateTitle: (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;

      set((state) => {
        const nextSessions = state.sessions.map((s) => {
          if (s.id !== id) return s;
          return {
            ...s,
            title: trimmed,
            updatedAt: Date.now(),
          };
        });
        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    pinSession: (id: string, pinned?: boolean) => {
      set((state) => {
        const nextSessions = state.sessions.map((s) => {
          if (s.id !== id) return s;
          return {
            ...s,
            pinned: pinned !== undefined ? pinned : !s.pinned,
          };
        });
        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    deleteSession: (id: string) => {
      set((state) => {
        const nextSessions = state.sessions.filter((s) => s.id !== id);
        let nextActiveId = state.activeSessionId;

        if (state.activeSessionId === id) {
          nextActiveId = nextSessions.length > 0 ? nextSessions[0].id : null;
        }

        saveSessionsToStorage(nextSessions);
        saveActiveSessionId(nextActiveId);

        return {
          sessions: nextSessions,
          activeSessionId: nextActiveId,
        };
      });
    },

    clearAllSessions: () => {
      set(() => {
        saveSessionsToStorage([]);
        saveActiveSessionId(null);
        return {
          sessions: [],
          activeSessionId: null,
          isStreaming: false,
          abortController: null,
        };
      });
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    setSessionModel: (sessionId: string, model: string) => {
      set((state) => {
        const nextSessions = state.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          return {
            ...s,
            model,
            updatedAt: Date.now(),
          };
        });
        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    addMessageNode: (sessionId: string, payload: AddMessagePayload) => {
      const now = Date.now();
      const nodeMsgId = `m_${now}_${Math.random().toString(36).slice(2, 6)}`;
      let createdNode: MessageNode | null = null;

      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId) return session;

          const parentId =
            payload.parentId !== undefined ? payload.parentId : session.activeLeafId;

          const newNode: MessageNode = {
            id: nodeMsgId,
            parentId,
            childrenIds: [],
            role: payload.role,
            content: payload.content,
            attachments: payload.attachments || [],
            model: payload.model,
            reasoningContent: payload.reasoningContent,
            thinkingDuration: payload.thinkingDuration,
            createdAt: now,
          };
          createdNode = newNode;

          const updatedMessages = { ...session.messages, [newNode.id]: newNode };

          if (parentId && updatedMessages[parentId]) {
            const parent = updatedMessages[parentId];
            updatedMessages[parentId] = {
              ...parent,
              childrenIds: [...parent.childrenIds, newNode.id],
            };
          }

          const rootMessageId = session.rootMessageId ?? newNode.id;
          const activeLeafId = newNode.id;

          let nextTitle = session.title;
          if (
            (session.title.toLowerCase() === 'new chat' || !session.title) &&
            payload.role === 'user' &&
            payload.content.trim()
          ) {
            nextTitle = generateAutoTitle(payload.content);
          }

          return {
            ...session,
            title: nextTitle,
            rootMessageId,
            activeLeafId,
            messages: updatedMessages,
            updatedAt: now,
          };
        });

        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });

      return (
        createdNode ?? {
          id: nodeMsgId,
          parentId: payload.parentId ?? null,
          childrenIds: [],
          role: payload.role,
          content: payload.content,
          createdAt: now,
        }
      );
    },

    updateMessageContent: (
      sessionId: string,
      messageId: string,
      content: string,
      isStreaming?: boolean
    ) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId || !session.messages[messageId]) return session;

          const existingNode = session.messages[messageId];
          const updatedNode: MessageNode = {
            ...existingNode,
            content,
            isStreaming: isStreaming !== undefined ? isStreaming : existingNode.isStreaming,
          };

          return {
            ...session,
            messages: {
              ...session.messages,
              [messageId]: updatedNode,
            },
            updatedAt: Date.now(),
          };
        });

        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    appendStreamingChunk: (sessionId: string, messageId: string, chunk: string) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId || !session.messages[messageId]) return session;

          const existingNode = session.messages[messageId];
          const updatedNode: MessageNode = {
            ...existingNode,
            content: existingNode.content + chunk,
            isStreaming: true,
          };

          return {
            ...session,
            messages: {
              ...session.messages,
              [messageId]: updatedNode,
            },
            updatedAt: Date.now(),
          };
        });

        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    setStreamingReasoning: (
      sessionId: string,
      messageId: string,
      reasoningContent: string,
      durationMs?: number
    ) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId || !session.messages[messageId]) return session;

          const existingNode = session.messages[messageId];
          const updatedNode: MessageNode = {
            ...existingNode,
            reasoningContent: reasoningContent || existingNode.reasoningContent,
            thinkingDuration:
              durationMs !== undefined ? durationMs : existingNode.thinkingDuration,
            isStreaming: true,
          };

          return {
            ...session,
            messages: {
              ...session.messages,
              [messageId]: updatedNode,
            },
            updatedAt: Date.now(),
          };
        });

        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    finalizeStreamingMessage: (
      sessionId: string,
      messageId: string,
      finalContent?: string,
      reasoning?: string,
      duration?: number,
      tokenUsage?: TokenUsage
    ) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId || !session.messages[messageId]) return session;

          const existingNode = session.messages[messageId];
          const updatedNode: MessageNode = {
            ...existingNode,
            content: finalContent !== undefined ? finalContent : existingNode.content,
            reasoningContent:
              reasoning !== undefined ? reasoning : existingNode.reasoningContent,
            thinkingDuration:
              duration !== undefined ? duration : existingNode.thinkingDuration,
            ...(tokenUsage !== undefined ? { tokenUsage } : {}),
            isStreaming: false,
          };

          return {
            ...session,
            messages: {
              ...session.messages,
              [messageId]: updatedNode,
            },
            updatedAt: Date.now(),
          };
        });

        saveSessionsToStorage(nextSessions);
        return {
          sessions: nextSessions,
          isStreaming: false,
          abortController: null,
        };
      });
    },

    setMessageError: (sessionId: string, messageId: string, error: string) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId || !session.messages[messageId]) return session;

          const existingNode = session.messages[messageId];
          const updatedNode: MessageNode = {
            ...existingNode,
            error,
            isStreaming: false,
          };

          return {
            ...session,
            messages: {
              ...session.messages,
              [messageId]: updatedNode,
            },
            updatedAt: Date.now(),
          };
        });

        saveSessionsToStorage(nextSessions);
        return {
          sessions: nextSessions,
          isStreaming: false,
          abortController: null,
        };
      });
    },

    setMessageRating: (
      sessionId: string,
      messageId: string,
      rating: 'up' | 'down' | null
    ) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId || !session.messages[messageId]) return session;

          const existingNode = session.messages[messageId];
          const updatedNode: MessageNode = {
            ...existingNode,
            rating,
          };

          return {
            ...session,
            messages: {
              ...session.messages,
              [messageId]: updatedNode,
            },
            updatedAt: Date.now(),
          };
        });

        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    switchBranch: (sessionId: string, messageId: string) => {
      set((state) => {
        const nextSessions = state.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          return switchBranchToMessage(session, messageId);
        });

        saveSessionsToStorage(nextSessions);
        return { sessions: nextSessions };
      });
    },

    setStreaming: (isStreaming: boolean, abortController?: AbortController | null) => {
      set({
        isStreaming,
        abortController: abortController !== undefined ? abortController : null,
      });
    },

    stopStreaming: () => {
      const { abortController, sessions, activeSessionId } = get();
      if (abortController) {
        abortController.abort();
      }

      // Ensure any message with isStreaming = true is finalized with partial text preserved
      if (activeSessionId) {
        const nextSessions = sessions.map((session) => {
          if (session.id !== activeSessionId) return session;
          let changed = false;
          const updatedMessages = { ...session.messages };
          Object.keys(updatedMessages).forEach((id) => {
            if (updatedMessages[id].isStreaming) {
              updatedMessages[id] = { ...updatedMessages[id], isStreaming: false };
              changed = true;
            }
          });
          return changed ? { ...session, messages: updatedMessages } : session;
        });
        saveSessionsToStorage(nextSessions);
        set({ sessions: nextSessions, isStreaming: false, abortController: null });
      } else {
        set({ isStreaming: false, abortController: null });
      }
    },

    sendChatMessage: async (prompt: string, attachments?: Attachment[]) => {
      const trimmed = prompt.trim();
      const hasAttachments = Boolean(attachments && attachments.length > 0);
      if (!trimmed && !hasAttachments) return;

      // Halt active streaming if any
      const { isStreaming, abortController } = get();
      if (isStreaming && abortController) {
        abortController.abort();
      }

      let sessionId = get().activeSessionId;
      if (!sessionId) {
        sessionId = get().createSession();
      }

      const userNode = get().addMessageNode(sessionId, {
        role: 'user',
        content: trimmed,
        attachments,
      });

      const session = get().sessions.find((s) => s.id === sessionId);
      const model = session?.model || 'Gemini 1.5 Flash';

      const assistantNode = get().addMessageNode(sessionId, {
        role: 'assistant',
        content: '',
        parentId: userNode.id,
        model,
      });

      const nextAbortController = new AbortController();
      get().setStreaming(true, nextAbortController);

      await executeStreamGeneration(
        sessionId,
        assistantNode.id,
        trimmed,
        nextAbortController.signal
      );
    },

    regenerateResponse: async (messageId: string) => {
      const { activeSessionId, sessions, isStreaming, abortController } = get();
      if (!activeSessionId) return;

      const session = sessions.find((s) => s.id === activeSessionId);
      if (!session) return;

      const targetNode = session.messages[messageId];
      if (!targetNode) return;

      if (isStreaming && abortController) {
        abortController.abort();
      }

      let prompt = '';
      let parentId: string | null = null;

      if (targetNode.role === 'assistant') {
        parentId = targetNode.parentId;
        if (parentId && session.messages[parentId]) {
          prompt = session.messages[parentId].content;
        } else {
          prompt = targetNode.content;
        }
      } else {
        // User message
        parentId = targetNode.id;
        prompt = targetNode.content;
      }

      const model = session.model || 'Gemini 1.5 Flash';
      const newAssistantNode = get().addMessageNode(activeSessionId, {
        role: 'assistant',
        content: '',
        parentId,
        model,
      });

      const nextAbortController = new AbortController();
      get().setStreaming(true, nextAbortController);

      await executeStreamGeneration(
        activeSessionId,
        newAssistantNode.id,
        prompt,
        nextAbortController.signal
      );
    },

    editUserMessage: async (messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed) return;

      const { activeSessionId, sessions, isStreaming, abortController } = get();
      if (!activeSessionId) return;

      const session = sessions.find((s) => s.id === activeSessionId);
      if (!session) return;

      const oldUserNode = session.messages[messageId];
      if (!oldUserNode) return;

      if (isStreaming && abortController) {
        abortController.abort();
      }

      // Create new user branch sibling
      const newUserNode = get().addMessageNode(activeSessionId, {
        role: 'user',
        content: trimmed,
        parentId: oldUserNode.parentId,
        attachments: oldUserNode.attachments,
      });

      const model = session.model || 'Gemini 1.5 Flash';
      const newAssistantNode = get().addMessageNode(activeSessionId, {
        role: 'assistant',
        content: '',
        parentId: newUserNode.id,
        model,
      });

      const nextAbortController = new AbortController();
      get().setStreaming(true, nextAbortController);

      await executeStreamGeneration(
        activeSessionId,
        newAssistantNode.id,
        trimmed,
        nextAbortController.signal
      );
    },

    getActiveSession: () => {
      const { sessions, activeSessionId } = get();
      if (!activeSessionId) return null;
      return sessions.find((s) => s.id === activeSessionId) || null;
    },

    reloadFromStorage: () => {
      const sessions = loadSessionsFromStorage();
      const activeId = initActiveId(sessions);
      set({ sessions, activeSessionId: activeId });
    },
  };
});
