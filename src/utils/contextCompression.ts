import { ChatSession } from '../types/chat';
import { GeminiModelInfo } from '../types/settings';
import { computeThreadTokenStats } from './tokenStats';
import { getActiveTimeline } from './treeUtils';

export const CONTEXT_COMPRESSION_PROMPT = `Summarize this conversation as a handoff briefing for an assistant that will continue it WITHOUT access to the full history. This is an out-of-character, meta-level request: do NOT continue the conversation or reply in character.

First determine what kind of conversation this is, then cover the matching sections with concrete detail:

If it is task-oriented (work, coding, analysis, research, tool use):
1. Goal & current state — what the user ultimately wants; what is done, in progress, or blocked right now
2. Key decisions and conclusions, and the reasons behind them
3. Facts learned from tool calls that are worth keeping — exact file paths, command outputs, data values, URLs, error messages
4. Files or artifacts created/modified, and what was changed in them
5. Next steps, in order

If it is role-play or creative writing (stories, characters, worldbuilding):
1. Premise, setting, and established world rules
2. Characters — names, roles, personality, speech style, and details established so far
3. Plot so far — key events and revelations, in order
4. Current scene — where things stand right now: location, ongoing action, emotional tone, relationship dynamics
5. Open threads — unresolved plot points, foreshadowing, and the user's stated preferences about direction and style

For general chat or mixed conversations, cover whichever of the above apply.

Preserve exact identifiers and established names verbatim (paths, code symbols, keys, numbers, character names). Skip sections that do not apply.
Write in 繁體中文; if the conversation itself is mainly in a different language, use that language instead.
Be concise but complete. Do NOT include prefaces or meta-commentary.`;

export const DEFAULT_AUTO_COMPRESS_THRESHOLD_PCT = 80;
export const DEFAULT_CONTEXT_WINDOW_LIMIT = 128000;

/**
 * Resolves the input token context window limit for a model.
 * Uses fetched Gemini model metadata when available, falling back to model-family defaults.
 */
export function getModelContextWindowLimit(
  modelNameOrId?: string,
  fetchedGeminiModels?: GeminiModelInfo[]
): number {
  const raw = (modelNameOrId || '').trim();
  const stripped = raw.replace(/^models\//, '');
  const normalized = stripped.toLowerCase().replace(/\s+/g, '-');

  if (fetchedGeminiModels && fetchedGeminiModels.length > 0) {
    const match = fetchedGeminiModels.find(
      (m) =>
        m.id === raw ||
        m.id === stripped ||
        m.id.toLowerCase() === normalized ||
        m.name.toLowerCase() === raw.toLowerCase()
    );
    if (match && typeof match.inputTokenLimit === 'number' && match.inputTokenLimit > 0) {
      return match.inputTokenLimit;
    }
  }

  if (normalized.includes('gemini-1.5') || normalized.includes('gemini-2') || normalized.includes('gemini-3')) {
    return 1048576;
  }

  return DEFAULT_CONTEXT_WINDOW_LIMIT;
}

export interface AutoCompressCheckParams {
  session: ChatSession | null | undefined;
  autoCompressContext?: boolean;
  autoCompressThresholdPct?: number;
  fetchedGeminiModels?: GeminiModelInfo[];
  contextWindowOverride?: number;
  additionalTokens?: number;
}

/**
 * Determines whether the active conversation branch has reached the user-configured
 * context window threshold and should be automatically compressed.
 */
export function shouldAutoCompressSession(params: AutoCompressCheckParams): boolean {
  const {
    session,
    autoCompressContext = false,
    autoCompressThresholdPct = DEFAULT_AUTO_COMPRESS_THRESHOLD_PCT,
    fetchedGeminiModels,
    contextWindowOverride,
    additionalTokens = 0,
  } = params;

  if (!autoCompressContext || !session) return false;

  const timeline = getActiveTimeline(session);
  if (timeline.length === 0) return false;

  const lastNode = timeline[timeline.length - 1];
  if (lastNode.isContextSummary || lastNode.isStreaming) {
    return false;
  }

  // Require at least one completed message with content before compressing
  const hasCompressibleContent = timeline.some(
    (m) => !m.isContextSummary && !m.error && Boolean(m.content && m.content.trim())
  );
  if (!hasCompressibleContent) return false;

  const stats = computeThreadTokenStats(session);
  const currentContextTokens = stats.contextTokens + Math.max(0, additionalTokens);
  if (currentContextTokens <= 0) return false;

  const limit =
    typeof contextWindowOverride === 'number' && contextWindowOverride > 0
      ? contextWindowOverride
      : getModelContextWindowLimit(session.model, fetchedGeminiModels);

  const clampedPct = Math.min(100, Math.max(1, autoCompressThresholdPct));
  const thresholdTokens = Math.floor(limit * (clampedPct / 100));

  return currentContextTokens >= thresholdTokens;
}
