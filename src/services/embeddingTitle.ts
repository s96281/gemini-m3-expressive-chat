import { TitleEmbeddingModel } from '../types/settings';
import { generateAutoTitle } from '../utils/treeUtils';
import { buildGeminiV1BetaBase } from './liveEngine';

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function cleanPhrase(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#*_~>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCandidateTitle(text: string): string {
  const trimmed = cleanPhrase(text);
  if (!trimmed) return '';
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 37).trim() + '...';
}

export function extractTitleCandidates(prompt: string, assistantResponse = ''): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  const addCandidate = (raw: string) => {
    const formatted = formatCandidateTitle(raw);
    if (!formatted || formatted.length < 2) return;
    const key = formatted.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(formatted);
    }
  };

  // Baseline heuristic title
  addCandidate(generateAutoTitle(prompt));

  // Clauses from prompt
  const promptClauses = cleanPhrase(prompt).split(/[.!?。！？\n;；,，]+/);
  for (const clause of promptClauses) {
    if (clause.trim().length >= 3) {
      addCandidate(clause.trim());
    }
  }

  // Headings or opening clauses from assistant response
  if (assistantResponse) {
    const headingMatches = assistantResponse.match(/^#{1,3}\s+(.+)$/gm) || [];
    for (const h of headingMatches.slice(0, 3)) {
      addCandidate(h.replace(/^#{1,3}\s+/, ''));
    }

    const respClauses = cleanPhrase(assistantResponse.slice(0, 400)).split(/[.!?。！？\n;；]+/);
    for (const clause of respClauses.slice(0, 3)) {
      if (clause.trim().length >= 4) {
        addCandidate(clause.trim());
      }
    }
  }

  return candidates.slice(0, 8);
}

async function callBatchEmbedContents(
  base: string,
  modelId: string,
  apiKey: string,
  texts: string[]
): Promise<number[][]> {
  const res = await fetch(
    `${base}/models/${encodeURIComponent(modelId)}:batchEmbedContents?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${modelId}`,
          content: { parts: [{ text }] },
          taskType: 'SEMANTIC_SIMILARITY',
        })),
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Embedding API error [${res.status}]: ${errText}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    embeddings?: Array<{ values?: number[] }>;
  };

  if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
    throw new Error('Unexpected batchEmbedContents response shape');
  }

  return data.embeddings.map((e) => e.values || []);
}

export async function generateTitleWithGeminiEmbedding(params: {
  prompt: string;
  assistantResponse?: string;
  apiKey: string;
  apiEndpoint?: string;
  model: TitleEmbeddingModel;
}): Promise<string> {
  const { prompt, assistantResponse = '', apiKey, apiEndpoint, model } = params;
  const fallback = generateAutoTitle(prompt);
  if (!apiKey || model === 'off') return fallback;

  const candidates = extractTitleCandidates(prompt, assistantResponse);
  if (candidates.length === 0) return fallback;
  if (candidates.length === 1) return candidates[0];

  const contextText = [
    `User: ${prompt.slice(0, 600)}`,
    assistantResponse ? `Assistant: ${assistantResponse.slice(0, 600)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const base = buildGeminiV1BetaBase(apiEndpoint);
  const texts = [contextText, ...candidates];

  let vectors: number[][];
  try {
    vectors = await callBatchEmbedContents(base, model, apiKey, texts);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (model === 'gemini-embedding-2' && status === 404) {
      // Fallback to preview alias if GA alias is not enabled on endpoint
      vectors = await callBatchEmbedContents(base, 'gemini-embedding-2-preview', apiKey, texts);
    } else {
      throw err;
    }
  }

  const contextVec = vectors[0];
  let bestIdx = 0;
  let bestScore = -Infinity;

  for (let i = 1; i < vectors.length; i += 1) {
    const score = cosineSimilarity(contextVec, vectors[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i - 1;
    }
  }

  return candidates[bestIdx] || fallback;
}
