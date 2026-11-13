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
      continue;
    }

    if (msg.role === 'assistant') {
      if (msg.tokenUsage) {
        promptTokens += msg.tokenUsage.promptTokens;
        completionTokens += msg.tokenUsage.completionTokens;
        thoughtsTokens += msg.tokenUsage.thoughtsTokens || 0;
        totalTokens += msg.tokenUsage.totalTokens;
        contextTokens = msg.tokenUsage.totalTokens;
        if (msg.tokenUsage.isEstimated) {
          hasEstimated = true;
        }
        runningTextTokens +=
          msg.tokenUsage.completionTokens + (msg.tokenUsage.thoughtsTokens || 0);
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
