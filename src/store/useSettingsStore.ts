import { create } from 'zustand';
import { AppSettings, EngineMode, Persona, SimulatedSpeed } from '../types/settings';
import { STORAGE_KEYS } from '../utils/storage';

export const PERSONA_PRESETS: Persona[] = [
  {
    id: 'architect',
    name: 'Software Architect',
    roleTitle: 'Senior Software Architect',
    description:
      'Expert in system architecture, design patterns, clean code, scalability, and distributed systems.',
    systemPrompt:
      'You are an elite Principal Software Architect. Provide rigorous, modular, and maintainable software engineering solutions, architectural trade-offs, and clean code examples.',
    avatarIcon: 'Cpu',
    badgeLabel: 'Architect',
  },
  {
    id: 'writer',
    name: 'Creative Writer',
    roleTitle: 'Creative Storyteller',
    description:
      'Imaginative storyteller focused on vivid prose, evocative narrative arcs, and creative voice.',
    systemPrompt:
      'You are an imaginative Creative Writer. Respond with vivid prose, creative narratives, and engaging tone tailored to the user’s vision.',
    avatarIcon: 'Feather',
    badgeLabel: 'Writer',
  },
  {
    id: 'tutor',
    name: 'Concise Tutor',
    roleTitle: 'Concise Tutor (ELI5)',
    description:
      'Breaks down complex topics simply using everyday analogies and the Feynman technique.',
    systemPrompt:
      'You are an intuitive educator skilled in the Feynman technique and ELI5 (Explain Like I’m 5). Explain complex concepts using everyday analogies and concise language.',
    avatarIcon: 'BookOpen',
    badgeLabel: 'ELI5 Tutor',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    roleTitle: 'Senior Data Analyst',
    description:
      'Specialist in statistical data breakdown, causal analysis, hypothesis testing, and metrics.',
    systemPrompt:
      'You are a meticulous Senior Data Analyst. Analyze trends, hypothesize causality, suggest metrics, and provide clear structured data breakdowns.',
    avatarIcon: 'BarChart2',
    badgeLabel: 'Analyst',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  engineMode: 'simulated',
  apiKey: '',
  apiEndpoint: '',
  temperature: 0.7,
  maxTokens: 2048,
  simulatedSpeed: 'natural',
  activePersonaId: 'architect',
  customSystemPrompt: '',
};

export interface SettingsState extends AppSettings {
  setEngineMode: (mode: EngineMode) => void;
  setApiKey: (key: string) => void;
  setApiEndpoint: (endpoint: string) => void;
  setTemperature: (temperature: number) => void;
  setMaxTokens: (maxTokens: number) => void;
  setSimulatedSpeed: (speed: SimulatedSpeed) => void;
  setActivePersonaId: (id: string) => void;
  setCustomSystemPrompt: (prompt: string) => void;
  resetParameters: () => void;
  resetPersona: () => void;
  resetAllSettings: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  getActivePersona: () => Persona;
  getEffectiveSystemPrompt: () => string;
}

function loadInitialSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const data = parsed && typeof parsed.state === 'object' ? parsed.state : parsed;
    return {
      engineMode: data.engineMode || DEFAULT_SETTINGS.engineMode,
      apiKey: data.apiKey ?? DEFAULT_SETTINGS.apiKey,
      apiEndpoint: data.apiEndpoint ?? DEFAULT_SETTINGS.apiEndpoint,
      temperature: typeof data.temperature === 'number' ? data.temperature : DEFAULT_SETTINGS.temperature,
      maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : DEFAULT_SETTINGS.maxTokens,
      simulatedSpeed: data.simulatedSpeed || DEFAULT_SETTINGS.simulatedSpeed,
      activePersonaId: data.activePersonaId || DEFAULT_SETTINGS.activePersonaId,
      customSystemPrompt: data.customSystemPrompt ?? DEFAULT_SETTINGS.customSystemPrompt,
    };
  } catch (err) {
    console.warn('Failed to load settings from storage:', err);
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(state: AppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    const flat: AppSettings = {
      engineMode: state.engineMode,
      apiKey: state.apiKey,
      apiEndpoint: state.apiEndpoint,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      simulatedSpeed: state.simulatedSpeed,
      activePersonaId: state.activePersonaId,
      customSystemPrompt: state.customSystemPrompt,
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(flat));
  } catch (err) {
    console.warn('Failed to save settings to storage:', err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadInitialSettings();

  const sync = (updater: (prev: SettingsState) => Partial<SettingsState>) => {
    set((prev) => {
      const updated = { ...prev, ...updater(prev) };
      persistSettings(updated);
      return updated;
    });
  };

  return {
    ...initial,

    setEngineMode: (engineMode) => sync(() => ({ engineMode })),
    setApiKey: (apiKey) => sync(() => ({ apiKey })),
    setApiEndpoint: (apiEndpoint) => sync(() => ({ apiEndpoint })),
    setTemperature: (temperature) => sync(() => ({ temperature })),
    setMaxTokens: (maxTokens) => sync(() => ({ maxTokens })),
    setSimulatedSpeed: (simulatedSpeed) => sync(() => ({ simulatedSpeed })),
    setActivePersonaId: (activePersonaId) => sync(() => ({ activePersonaId })),
    setCustomSystemPrompt: (customSystemPrompt) => sync(() => ({ customSystemPrompt })),

    resetParameters: () =>
      sync(() => ({
        temperature: DEFAULT_SETTINGS.temperature,
        maxTokens: DEFAULT_SETTINGS.maxTokens,
        simulatedSpeed: DEFAULT_SETTINGS.simulatedSpeed,
      })),

    resetPersona: () =>
      sync(() => ({
        activePersonaId: DEFAULT_SETTINGS.activePersonaId,
        customSystemPrompt: DEFAULT_SETTINGS.customSystemPrompt,
      })),

    resetAllSettings: () =>
      sync(() => ({
        ...DEFAULT_SETTINGS,
      })),

    updateSettings: (partial) => sync(() => partial),

    getActivePersona: () => {
      const currentId = get().activePersonaId;
      return PERSONA_PRESETS.find((p) => p.id === currentId) || PERSONA_PRESETS[0];
    },

    getEffectiveSystemPrompt: () => {
      const custom = get().customSystemPrompt.trim();
      if (custom) return custom;
      const persona = get().getActivePersona();
      return persona.systemPrompt;
    },
  };
});
