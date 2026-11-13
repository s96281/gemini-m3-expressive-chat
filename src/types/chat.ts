export type Role = 'user' | 'assistant' | 'system';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // base64 or object URL
  textContent?: string;
  dataBase64?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  thoughtsTokens?: number;
  totalTokens: number;
  isEstimated?: boolean;
}

export interface GeminiExecutableCode {
  language: string;
  code: string;
}

export interface GeminiCodeExecutionResult {
  outcome: string;
  output?: string;
}

export interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

export interface GeminiModelPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  executableCode?: GeminiExecutableCode;
  codeExecutionResult?: GeminiCodeExecutionResult;
  functionCall?: GeminiFunctionCall;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface MessageNode {
  id: string;
  parentId: string | null;
  childrenIds: string[];
  role: Role;
  content: string;
  reasoningContent?: string;
  thoughtSignature?: string;
  modelParts?: GeminiModelPart[];
  thinkingDuration?: number;
  isStreaming?: boolean;
  error?: string;
  model?: string;
  attachments?: Attachment[];
  rating?: 'up' | 'down' | null;
  tokenUsage?: TokenUsage;
  isContextSummary?: boolean;
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
