export type Role = 'user' | 'assistant' | 'system';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // base64 or object URL
}

export interface MessageNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: Role;
  content: string;
  reasoningContent?: string;
  thinkingDuration?: number;
  isStreaming?: boolean;
  error?: string;
  model?: string;
  attachments?: Attachment[];
  rating?: 'up' | 'down' | null;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  rootMessageId: string | null;
  activeLeafId: string | null;
  messages: Record<string, MessageNode>;
  pinned: boolean;
  model: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ThemeConfig {
  seedColor: 'ocean' | 'purple' | 'emerald' | 'rose' | 'amber';
  mode: 'light' | 'dark' | 'system';
}
