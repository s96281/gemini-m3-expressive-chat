import { ChatSession } from '../types/chat';
import { getActiveTimeline } from './treeUtils';

export interface ThreadTokenStats {
  promptTokens: number;
  completionTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  contextTokens: number;
  messageCount: number;
  hasEstimated: boolean;
}

const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;

/**
 * Estimates token count for mixed CJK/ASCII text when API usageMetadata is unavailable.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  const cjkMatches = text.match(CJK_REGEX);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const nonCjkLength = Math.max(0, text.length - cjkCount);
  return Math.ceil(cjkCount * 1.5 + nonCjkLength / 4);
}

/**
 * Computes token statistics across the active conversation branch.
 * Uses exact API `tokenUsage` where available and falls back to estimation otherwise.
 */
export function computeThreadTokenStats(session: ChatSession | null): ThreadTokenStats {
  if (!session) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      thoughtsTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      messageCount: 0,
      hasEstimated: false,
    };
  }

  const timeline = getActiveTimeline(session);
  if (timeline.length === 0) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      thoughtsTokens: 0,
      totalTokens: 0,
      contextTokens: 0,
      messageCount: 0,
      hasEstimated: false,
    };
  }

  let promptTokens = 0;
  let completionTokens = 0;
  let thoughtsTokens = 0;
  let totalTokens = 0;
  let contextTokens = 0;
  let hasEstimated = false;
  let runningTextTokens = 0;

  for (const msg of timeline) {
    if (msg.role === 'user') {
      let userEst = estimateTokenCount(msg.content);
      if (msg.attachments) {
        for (const att of msg.attachments) {
          if (att.textContent) {
            userEst += estimateTokenCount(att.textContent);
          } else if (att.dataBase64) {
            // Approximate multimodal image/media token footprint
            userEst += 258;
          }
        }
      }
      runningTextTokens += userEst;
      contextTokens = runningTextTokens;
      continue;
    }

    if (msg.role === 'assistant') {
      if (msg.isContextSummary) {
        const estSummary =
          (msg.tokenUsage?.completionTokens || estimateTokenCount(msg.content)) +
          (msg.tokenUsage?.thoughtsTokens || estimateTokenCount(msg.reasoningContent || ''));
        if (msg.tokenUsage) {
          promptTokens += msg.tokenUsage.promptTokens;
          completionTokens += msg.tokenUsage.completionTokens;
          thoughtsTokens += msg.tokenUsage.thoughtsTokens || 0;
          totalTokens += msg.tokenUsage.totalTokens;
          if (msg.tokenUsage.isEstimated) {
            hasEstimated = true;
          }
        } else if (estSummary > 0) {
          hasEstimated = true;
          completionTokens += estSummary;
          totalTokens += estSummary;
        }
        // Reset active context window to the compressed handoff summary
        runningTextTokens = estSummary;
        contextTokens = estSummary;
        continue;
      }

      if (msg.tokenUsage) {
        promptTokens += msg.tokenUsage.promptTokens;
        completionTokens += msg.tokenUsage.completionTokens;
        thoughtsTokens += msg.tokenUsage.thoughtsTokens || 0;
        totalTokens += msg.tokenUsage.totalTokens;
        contextTokens = msg.tokenUsage.totalTokens;
        if (msg.tokenUsage.isEstimated) {
          hasEstimated = true;
        }
        runningTextTokens = msg.tokenUsage.totalTokens;
      } else {
        const estOut = estimateTokenCount(msg.content);
        const estThink = estimateTokenCount(msg.reasoningContent || '');
        if (estOut > 0 || estThink > 0) {
          hasEstimated = true;
          const estPrompt = runningTextTokens;
          const turnTotal = estPrompt + estOut + estThink;
          promptTokens += estPrompt;
          completionTokens += estOut;
          thoughtsTokens += estThink;
          totalTokens += turnTotal;
          runningTextTokens += estOut + estThink;
          contextTokens = runningTextTokens;
        }
      }
    }
  }

  // If only user message(s) exist without any assistant reply yet
  if (totalTokens === 0 && runningTextTokens > 0) {
    hasEstimated = true;
    promptTokens = runningTextTokens;
    totalTokens = runningTextTokens;
    contextTokens = runningTextTokens;
  }

  return {
    promptTokens,
    completionTokens,
    thoughtsTokens,
    totalTokens,
    contextTokens,
    messageCount: timeline.length,
    hasEstimated,
  };
}

export function formatTokenCount(count: number): string {
  return count.toLocaleString('en-US');
}

/**
 * Converts the active conversation branch into Gemini REST `contents` format
 * for accurate token counting via `POST /v1beta/models/{model}:countTokens`.
 * Starts from the latest compressed context summary if present, and preserves
 * `thoughtSignature` on model response parts per
 * https://aistudio.google.com/docs/thinking?codelanguage=rest#signatures.
 */
export function buildGeminiContentsFromSession(session: ChatSession | null): Array<{
  role: 'user' | 'model';
  parts: Array<
    | { text: string; thoughtSignature?: string }
    | { inlineData: { mimeType: string; data: string }; thoughtSignature?: string }
  >;
}> {
  if (!session) return [];
  const timeline = getActiveTimeline(session);
  const contents: Array<{
    role: 'user' | 'model';
    parts: Array<
      | { text: string; thoughtSignature?: string }
      | { inlineData: { mimeType: string; data: string }; thoughtSignature?: string }
    >;
  }> = [];

  let startIndex = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].isContextSummary && !timeline[i].error && timeline[i].content.trim()) {
      startIndex = i;
      break;
    }
  }

  for (let i = startIndex; i < timeline.length; i++) {
    const msg = timeline[i];
    if (msg.role === 'system') continue;
    const parts: Array<
      | { text: string; thoughtSignature?: string }
      | { inlineData: { mimeType: string; data: string }; thoughtSignature?: string }
    > = [];

    if (msg.isContextSummary && msg.content && msg.content.trim().length > 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Summarize this conversation as a handoff briefing.' }],
      });
      contents.push({
        role: 'model',
        parts: [
          {
            text: msg.content,
            ...(msg.thoughtSignature ? { thoughtSignature: msg.thoughtSignature } : {}),
          },
        ],
      });
      continue;
    }

    if (msg.role === 'user') {
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.textContent !== undefined) {
            parts.push({
              text: `[Attached File: ${att.name} (${att.type})]\n\`\`\`\n${att.textContent}\n\`\`\``,
            });
          } else if (att.dataBase64) {
            parts.push({
              inlineData: {
                mimeType: att.type || 'application/octet-stream',
                data: att.dataBase64,
              },
            });
          }
        }
      }
      if (msg.content && msg.content.trim().length > 0) {
        parts.push({ text: msg.content });
      }
    } else if (
      msg.role === 'assistant' &&
      ((msg.content && msg.content.trim().length > 0) ||
        (msg.thoughtSignature && msg.thoughtSignature.trim().length > 0))
    ) {
      parts.push({
        text: msg.content || '',
        ...(msg.thoughtSignature ? { thoughtSignature: msg.thoughtSignature } : {}),
      });
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  return contents;
}
