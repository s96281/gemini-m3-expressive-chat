import { Attachment } from '../types/chat';
import { EngineMode, SimulatedSpeed, ThinkingPreset } from '../types/settings';

export interface StreamRequest {
  prompt: string;
  history?: { role: 'user' | 'assistant' | 'system'; content: string; attachments?: Attachment[] }[];
  systemPrompt?: string;
  personaName?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  simulatedSpeed?: SimulatedSpeed;
  thinkingPreset?: ThinkingPreset;
  attachments?: Attachment[];
  apiKey?: string;
  apiEndpoint?: string;
  signal?: AbortSignal;
}

export interface StreamResult {
  content: string;
  reasoningContent?: string;
  thinkingDuration?: number;
}

export interface StreamCallbacks {
  onToken?: (token: string, accumulated: string) => void;
  onReasoning?: (reasoningToken: string, accumulatedReasoning: string) => void;
  onThinkingDuration?: (durationMs: number) => void;
  onComplete?: (result: StreamResult) => void;
  onError?: (error: Error) => void;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
}

export interface AIEngine {
  streamChat(
    request: StreamRequest,
    callbacks: StreamCallbacks
  ): Promise<StreamResult>;
  testConnection(config: {
    apiKey?: string;
    apiEndpoint?: string;
  }): Promise<ConnectionTestResult>;
}

import { simulatedEngine } from './simulatedEngine';
import { geminiEngine, openaiEngine, ollamaEngine } from './liveEngine';

export function getAIEngine(mode: EngineMode): AIEngine {
  switch (mode) {
    case 'gemini':
      return geminiEngine;
    case 'openai':
      return openaiEngine;
    case 'ollama':
      return ollamaEngine;
    case 'simulated':
    default:
      return simulatedEngine;
  }
}
