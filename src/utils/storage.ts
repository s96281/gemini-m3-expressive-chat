import { ChatSession, MessageNode } from '../types/chat';

export const STORAGE_KEYS = {
  SESSIONS: 'm3_chat_sessions',
  SESSIONS_FALLBACK: 'chat_sessions',
  ACTIVE_SESSION: 'm3_active_session_id',
  SETTINGS: 'm3_settings',
} as const;

/**
 * Normalizes a raw or partially populated session object from localStorage or test fixtures.
 */
export function normalizeSession(raw: Partial<ChatSession>): ChatSession {
  const id = raw.id || `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = raw.createdAt || Date.now();
  const updatedAt = raw.updatedAt || createdAt;
  const messages: Record<string, MessageNode> = {};

  if (raw.messages && typeof raw.messages === 'object') {
    if (Array.isArray(raw.messages)) {
      raw.messages.forEach((m, idx) => {
        if (!m) return;
        const mId = m.id || `m_${idx}_${Date.now()}`;
        messages[mId] = {
          id: mId,
          parentId: m.parentId !== undefined ? m.parentId : null,
          childrenIds: Array.isArray(m.childrenIds) ? m.childrenIds : [],
          role: m.role || 'user',
          content: m.content || '',
          reasoningContent: m.reasoningContent,
          ...(m.thoughtSignature !== undefined ? { thoughtSignature: m.thoughtSignature } : {}),
          ...(Array.isArray(m.modelParts) && m.modelParts.length > 0
            ? { modelParts: m.modelParts }
            : {}),
          thinkingDuration: m.thinkingDuration,
          isStreaming: Boolean(m.isStreaming),
          ...(m.error !== undefined ? { error: m.error } : {}),
          model: m.model,
          attachments: m.attachments || [],
          ...(m.rating !== undefined ? { rating: m.rating } : {}),
          ...(m.tokenUsage !== undefined ? { tokenUsage: m.tokenUsage } : {}),
          ...(m.isContextSummary !== undefined ? { isContextSummary: m.isContextSummary } : {}),
          createdAt: m.createdAt || createdAt,
        };
      });
    } else {
      for (const [mId, m] of Object.entries(raw.messages)) {
        if (!m) continue;
        messages[mId] = {
          id: m.id || mId,
          parentId: m.parentId !== undefined ? m.parentId : null,
          childrenIds: Array.isArray(m.childrenIds) ? m.childrenIds : [],
          role: m.role || 'user',
          content: m.content || '',
          reasoningContent: m.reasoningContent,
          ...(m.thoughtSignature !== undefined ? { thoughtSignature: m.thoughtSignature } : {}),
          ...(Array.isArray(m.modelParts) && m.modelParts.length > 0
            ? { modelParts: m.modelParts }
            : {}),
          thinkingDuration: m.thinkingDuration,
          isStreaming: Boolean(m.isStreaming),
          ...(m.error !== undefined ? { error: m.error } : {}),
          model: m.model,
          attachments: m.attachments || [],
          ...(m.rating !== undefined ? { rating: m.rating } : {}),
          ...(m.tokenUsage !== undefined ? { tokenUsage: m.tokenUsage } : {}),
          ...(m.isContextSummary !== undefined ? { isContextSummary: m.isContextSummary } : {}),
          createdAt: m.createdAt || createdAt,
        };
      }
    }
  }

  // Ensure childrenIds are consistent
  for (const msg of Object.values(messages)) {
    if (msg.parentId && messages[msg.parentId]) {
      const parent = messages[msg.parentId];
      if (!parent.childrenIds.includes(msg.id)) {
        parent.childrenIds.push(msg.id);
      }
    }
  }

  // Infer rootMessageId if missing
  let rootMessageId = raw.rootMessageId || null;
  const msgKeys = Object.keys(messages);
  if (!rootMessageId && msgKeys.length > 0) {
    const rootCandidate = Object.values(messages).find((m) => m.parentId === null);
    rootMessageId = rootCandidate ? rootCandidate.id : msgKeys[0];
  }

  // Infer activeLeafId if missing
  let activeLeafId = raw.activeLeafId || null;
  if (!activeLeafId && msgKeys.length > 0) {
    const leafCandidate = Object.values(messages).find(
      (m) => !m.childrenIds || m.childrenIds.length === 0
    );
    activeLeafId = leafCandidate ? leafCandidate.id : msgKeys[msgKeys.length - 1];
  }

  return {
    id,
    title: raw.title || 'New chat',
    rootMessageId,
    activeLeafId,
    messages,
    pinned: Boolean(raw.pinned),
    model: raw.model || 'Gemini 1.5 Flash',
    systemPrompt: raw.systemPrompt || '',
    createdAt,
    updatedAt,
  };
}

/**
 * Loads and normalizes sessions from localStorage.
 */
export function loadSessionsFromStorage(): ChatSession[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEYS.SESSIONS) ||
      localStorage.getItem(STORAGE_KEYS.SESSIONS_FALLBACK);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSession);
  } catch (err) {
    console.warn('Failed to parse sessions from localStorage:', err);
    return [];
  }
}

/**
 * Persists raw array of sessions directly to localStorage.
 */
export function saveSessionsToStorage(sessions: ChatSession[]): boolean {
  try {
    const json = JSON.stringify(sessions);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, json);
    return true;
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      console.warn('LocalStorage quota exceeded! Handling gracefully.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('app-storage-quota-exceeded', { detail: { error: err } })
        );
      }
    } else {
      console.error('Error persisting sessions to localStorage:', err);
    }
    return false;
  }
}

/**
 * Loads active session ID from localStorage.
 */
export function loadActiveSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch {
    return null;
  }
}

/**
 * Persists active session ID to localStorage.
 */
export function saveActiveSessionId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
    }
  } catch (err) {
    console.warn('Failed to persist active session ID:', err);
  }
}
