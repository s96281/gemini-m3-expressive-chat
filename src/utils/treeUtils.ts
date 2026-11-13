import { ChatSession, MessageNode } from '../types/chat';

export interface BranchInfo {
  currentIndex: number; // 1-indexed (e.g. 1 of 2)
  totalVersions: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevSiblingId: string | null;
  nextSiblingId: string | null;
}

/**
 * Traverses upward from activeLeafId to root to construct the active chronological timeline.
 */
export function getActiveTimeline(session: ChatSession | null): MessageNode[] {
  if (!session) return [];

  // If no active leaf is set or leaf not in messages, check root or return empty
  if (!session.activeLeafId || !session.messages[session.activeLeafId]) {
    if (session.rootMessageId && session.messages[session.rootMessageId]) {
      return [session.messages[session.rootMessageId]];
    }
    // If there are messages but neither root nor leaf set, sort all by createdAt as fallback
    const allMsgs = Object.values(session.messages);
    if (allMsgs.length > 0) {
      return allMsgs.sort((a, b) => a.createdAt - b.createdAt);
    }
    return [];
  }

  const timeline: MessageNode[] = [];
  const visited = new Set<string>();
  let currentId: string | null = session.activeLeafId;

  while (currentId && session.messages[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    const node: MessageNode = session.messages[currentId];
    timeline.unshift(node); // Prepend to preserve root -> leaf order
    currentId = node.parentId;
  }

  return timeline;
}

/**
 * Computes version branching information (< m/n >) for a given message in the tree.
 */
export function getBranchInfo(session: ChatSession, messageId: string): BranchInfo {
  const node = session.messages[messageId];
  if (!node) {
    return {
      currentIndex: 1,
      totalVersions: 1,
      hasPrev: false,
      hasNext: false,
      prevSiblingId: null,
      nextSiblingId: null,
    };
  }

  let siblings: string[] = [];
  if (node.parentId && session.messages[node.parentId]) {
    siblings = session.messages[node.parentId].childrenIds;
  } else {
    // Root level alternatives: all messages with parentId === null
    siblings = Object.values(session.messages)
      .filter((m) => m.parentId === null)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((m) => m.id);
  }

  if (siblings.length <= 1) {
    return {
      currentIndex: 1,
      totalVersions: 1,
      hasPrev: false,
      hasNext: false,
      prevSiblingId: null,
      nextSiblingId: null,
    };
  }

  const index = siblings.indexOf(messageId);
  const currentIndex = index !== -1 ? index + 1 : 1;
  const totalVersions = siblings.length;

  return {
    currentIndex,
    totalVersions,
    hasPrev: currentIndex > 1,
    hasNext: currentIndex < totalVersions,
    prevSiblingId: currentIndex > 1 ? siblings[index - 1] : null,
    nextSiblingId: currentIndex < totalVersions ? siblings[index + 1] : null,
  };
}

/**
 * Switches the active conversation branch to target a specific message and follows descendants to leaf.
 */
export function switchBranchToMessage(session: ChatSession, targetMessageId: string): ChatSession {
  if (!session.messages[targetMessageId]) return session;

  // Walk downward from targetMessageId to the most recent leaf node
  let currentId = targetMessageId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = session.messages[currentId];
    if (!node || !node.childrenIds || node.childrenIds.length === 0) break;
    // Follow the latest branch child
    currentId = node.childrenIds[node.childrenIds.length - 1];
  }

  return {
    ...session,
    activeLeafId: currentId,
  };
}

/**
 * Generates a concise automatic title (3-6 words) from the user's initial prompt.
 */
export function generateAutoTitle(firstPrompt: string): string {
  if (!firstPrompt || !firstPrompt.trim()) return 'New chat';

  // 1. Strip code blocks, inline code, URLs, and HTML tags
  let text = firstPrompt
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`.*?`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  // 2. Remove common conversational filler prefixes
  const prefixRegex =
    /^(please\s+|can\s+you\s+|could\s+you\s+|help\s+me\s+|i\s+want\s+to\s+|how\s+do\s+i\s+|tell\s+me\s+about\s+|explain\s+to\s+me\s+|explain\s+|how\s+to\s+)/i;
  while (prefixRegex.test(text)) {
    text = text.replace(prefixRegex, '').trim();
  }

  // 3. Clean special characters, keeping alphanumeric, spaces, and hyphens
  text = text.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();

  const words = text.split(' ').filter(Boolean);
  if (words.length === 0) return 'New chat';

  // Take 3 to 6 words
  const count = Math.min(6, Math.max(3, words.length <= 4 ? words.length : 5));
  const selectedWords = words.slice(0, count);

  // Capitalize each word (Title Case)
  let title = selectedWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  if (title.length > 40) {
    title = title.slice(0, 37).trim() + '...';
  }

  return title || 'New chat';
}

/**
 * Sanitizes a title for safe file naming in exports.
 */
export function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

/**
 * Walks upward from a target node (inclusive) to root or the latest context summary node,
 * returning chronological turns for active context or compression.
 */
export function buildActiveContextHistory(
  session: ChatSession | undefined,
  fromNodeId?: string | null,
  compressionPrompt?: string
): { role: 'user' | 'assistant'; content: string; attachments?: MessageNode['attachments'] }[] {
  if (!session) return [];
  const startId = fromNodeId !== undefined ? fromNodeId : session.activeLeafId;
  if (!startId || !session.messages[startId]) return [];

  const history: {
    role: 'user' | 'assistant';
    content: string;
    attachments?: MessageNode['attachments'];
  }[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startId;

  while (currentId && session.messages[currentId] && !visited.has(currentId)) {
    visited.add(currentId);
    const node: MessageNode = session.messages[currentId];
    const hasText = Boolean(node.content && node.content.trim());
    const hasAttachments = Boolean(node.attachments && node.attachments.length > 0);

    if (!node.error && node.isContextSummary && hasText) {
      if (compressionPrompt) {
        history.unshift(
          {
            role: 'user',
            content: compressionPrompt,
          },
          {
            role: 'assistant',
            content: node.content,
          }
        );
      } else {
        history.unshift({
          role: 'assistant',
          content: node.content,
        });
      }
      break;
    }

    if (
      !node.error &&
      (hasText || hasAttachments) &&
      (node.role === 'user' || node.role === 'assistant')
    ) {
      history.unshift({
        role: node.role,
        content: node.content,
        ...(hasAttachments ? { attachments: node.attachments } : {}),
      });
    }
    currentId = node.parentId;
  }

  return history;
}

/**
 * Walks upward from the current turn's parent user message to root (or latest compressed summary),
 * returning chronological prior turns for multi-turn context continuation.
 */
export function buildConversationHistory(
  session: ChatSession | undefined,
  assistantNodeId: string,
  compressionPrompt?: string
): { role: 'user' | 'assistant'; content: string; attachments?: MessageNode['attachments'] }[] {
  if (!session) return [];
  const assistantNode = session.messages[assistantNodeId];
  if (!assistantNode || !assistantNode.parentId) return [];

  const currentUserNode = session.messages[assistantNode.parentId];
  if (!currentUserNode || !currentUserNode.parentId) return [];

  return buildActiveContextHistory(session, currentUserNode.parentId, compressionPrompt);
}

