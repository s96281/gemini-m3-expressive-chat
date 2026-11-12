import { ThinkingPreset } from '../types/settings';

export type ThinkingParamMode = 'none' | 'budget' | 'level';
export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface ThinkingCapability {
  mode: ThinkingParamMode;
  supportedPresets: ThinkingPreset[];
  canDisable: boolean;
  minBudget?: number;
  maxBudget?: number;
  allowedLevels?: GeminiThinkingLevel[];
}

export interface ThinkingPresetMeta {
  id: ThinkingPreset;
  label: string;
  shortLabel: string;
  description: string;
}

export const THINKING_PRESET_META: Record<ThinkingPreset, ThinkingPresetMeta> = {
  auto: {
    id: 'auto',
    label: 'Auto (Dynamic)',
    shortLabel: 'Auto',
    description: 'Model dynamically decides how deeply to reason',
  },
  off: {
    id: 'off',
    label: 'Off',
    shortLabel: 'Off',
    description: 'Disable thinking for fastest responses (when supported)',
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    shortLabel: 'Minimal',
    description: 'Lightest reasoning pass before answering',
  },
  low: {
    id: 'low',
    label: 'Low',
    shortLabel: 'Low',
    description: 'Brief reasoning for straightforward tasks',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    shortLabel: 'Medium',
    description: 'Balanced reasoning depth and latency',
  },
  high: {
    id: 'high',
    label: 'High',
    shortLabel: 'High',
    description: 'Maximum reasoning depth for complex problems',
  },
};

export const ALL_THINKING_PRESETS: ThinkingPreset[] = [
  'auto',
  'off',
  'minimal',
  'low',
  'medium',
  'high',
];

function normalizeModelId(modelIdOrName: string): string {
  return (modelIdOrName || '')
    .trim()
    .toLowerCase()
    .replace(/^models\//, '')
    .replace(/\s+/g, '-');
}

/**
 * Resolves the thinking capability of a Google Gemini model.
 * - Gemini 3.x uses `thinkingLevel` (`minimal` | `low` | `medium` | `high`)
 * - Gemini 2.5.x & 2.0-flash-thinking use `thinkingBudget` (numeric tokens)
 * - Gemini 1.5 / 2.0-flash (non-thinking) / Gemma do not support `thinkingConfig`
 */
export function getGeminiThinkingCapability(modelIdOrName: string): ThinkingCapability {
  const id = normalizeModelId(modelIdOrName);

  // Gemini 3 series -> thinkingLevel
  if (id.includes('gemini-3')) {
    if (id.includes('pro')) {
      return {
        mode: 'level',
        canDisable: false,
        allowedLevels: ['low', 'high'],
        supportedPresets: ['auto', 'low', 'high'],
      };
    }
    return {
      mode: 'level',
      canDisable: false,
      allowedLevels: ['minimal', 'low', 'medium', 'high'],
      supportedPresets: ['auto', 'minimal', 'low', 'medium', 'high'],
    };
  }

  // Gemini 2.5 series -> thinkingBudget
  if (id.includes('gemini-2.5')) {
    if (id.includes('pro')) {
      return {
        mode: 'budget',
        canDisable: false,
        minBudget: 128,
        maxBudget: 32768,
        supportedPresets: ['auto', 'low', 'medium', 'high'],
      };
    }
    if (id.includes('flash-lite')) {
      return {
        mode: 'budget',
        canDisable: true,
        minBudget: 512,
        maxBudget: 24576,
        supportedPresets: ['auto', 'off', 'low', 'medium', 'high'],
      };
    }
    return {
      mode: 'budget',
      canDisable: true,
      minBudget: 0,
      maxBudget: 24576,
      supportedPresets: ['auto', 'off', 'low', 'medium', 'high'],
    };
  }

  // Gemini 2.0 Flash Thinking experimental -> thinkingBudget
  if (id.includes('thinking')) {
    return {
      mode: 'budget',
      canDisable: false,
      minBudget: 1024,
      maxBudget: 24576,
      supportedPresets: ['auto', 'low', 'medium', 'high'],
    };
  }

  // Non-thinking or unknown models -> do not send thinkingConfig
  return {
    mode: 'none',
    canDisable: true,
    supportedPresets: [],
  };
}

/**
 * Converts a unified UI ThinkingPreset into the exact `generationConfig.thinkingConfig`
 * payload expected by the target Gemini model, or `undefined` if unsupported.
 */
export function buildGeminiThinkingConfig(
  modelIdOrName: string,
  preset: ThinkingPreset = 'auto'
): Record<string, unknown> | undefined {
  const cap = getGeminiThinkingCapability(modelIdOrName);

  if (cap.mode === 'none') {
    return undefined;
  }

  if (cap.mode === 'budget') {
    if (preset === 'off') {
      if (cap.canDisable) {
        return {
          thinkingBudget: 0,
          includeThoughts: false,
        };
      }
      return {
        thinkingBudget: cap.minBudget ?? 128,
        includeThoughts: true,
      };
    }

    if (preset === 'auto') {
      return {
        thinkingBudget: -1,
        includeThoughts: true,
      };
    }

    const minB = cap.minBudget ?? 0;
    const maxB = cap.maxBudget ?? 24576;
    const rawMap: Record<'minimal' | 'low' | 'medium' | 'high', number> = {
      minimal: 1024,
      low: 2048,
      medium: 8192,
      high: maxB,
    };
    const rawBudget = rawMap[preset] ?? 8192;
    const clampedBudget = Math.max(minB, Math.min(maxB, rawBudget));

    return {
      thinkingBudget: clampedBudget,
      includeThoughts: true,
    };
  }

  // cap.mode === 'level' (Gemini 3 series)
  if (preset === 'auto') {
    return {
      includeThoughts: true,
    };
  }

  const allowed = cap.allowedLevels || ['low', 'high'];
  let resolvedLevel: GeminiThinkingLevel;

  if (preset === 'off') {
    resolvedLevel = allowed.includes('minimal') ? 'minimal' : allowed[0];
  } else if (allowed.includes(preset as GeminiThinkingLevel)) {
    resolvedLevel = preset as GeminiThinkingLevel;
  } else if (preset === 'minimal') {
    resolvedLevel = allowed[0];
  } else if (preset === 'medium') {
    resolvedLevel = allowed.includes('high') ? 'high' : allowed[allowed.length - 1];
  } else {
    resolvedLevel = allowed[allowed.length - 1];
  }

  return {
    thinkingLevel: resolvedLevel,
    includeThoughts: true,
  };
}
