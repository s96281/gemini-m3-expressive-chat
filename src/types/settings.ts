export type EngineMode = 'simulated' | 'gemini' | 'openai' | 'ollama';
export type SimulatedSpeed = 'fast' | 'natural' | 'relaxed';

export interface Persona {
  id: string;
  name: string;
  roleTitle: string;
  description: string;
  systemPrompt: string;
  avatarIcon: string;
  badgeLabel: string;
}

export interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

export interface AppSettings {
  engineMode: EngineMode;
  apiKey?: string;
  apiEndpoint?: string;
  temperature: number;
  maxTokens: number;
  simulatedSpeed: SimulatedSpeed;
  activePersonaId: string;
  customSystemPrompt: string;
  fetchedGeminiModels?: GeminiModelInfo[];
  enabledGeminiModels?: string[];
  defaultModel?: string;
}
