import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cosineSimilarity,
  extractTitleCandidates,
  generateTitleWithGeminiEmbedding,
} from '../../src/services/embeddingTitle';
import { geminiEngine } from '../../src/services/liveEngine';
import { useSettingsStore } from '../../src/store/useSettingsStore';

describe('Gemini Embedding Title & Built-in Tools', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.getState().resetAllSettings();
  });

  describe('cosineSimilarity & extractTitleCandidates', () => {
    it('computes cosine similarity accurately', () => {
      expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 5);
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
      expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1, 5);
    });

    it('extracts deduplicated candidate titles from prompt and assistant response', () => {
      const candidates = extractTitleCandidates(
        'How do I optimize PostgreSQL indexes for JSONB queries?',
        '# PostgreSQL JSONB Indexing\nUse GIN indexes for fast containment queries.'
      );
      expect(candidates.length).toBeGreaterThan(1);
      expect(candidates.some((c) => c.includes('PostgreSQL JSONB Indexing'))).toBe(true);
    });
  });

  describe('generateTitleWithGeminiEmbedding', () => {
    it('selects the highest-similarity candidate via Gemini Embedding 2 batchEmbedContents', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        expect(String(url)).toContain('/models/gemini-embedding-2:batchEmbedContents');
        const body = JSON.parse(String(init?.body || '{}'));
        const count = body.requests.length;
        // Context vector = [1, 0], candidate 1 vector = [0.99, 0.01], others = [0, 1]
        const embeddings = Array.from({ length: count }, (_, idx) => ({
          values: idx === 0 ? [1, 0] : idx === 2 ? [0.99, 0.01] : [0, 1],
        }));
        return new Response(JSON.stringify({ embeddings }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const title = await generateTitleWithGeminiEmbedding({
        prompt: 'Explain how WebSockets work in Node.js',
        assistantResponse: '# WebSockets in Node.js\nFull-duplex TCP communication.',
        apiKey: 'AIzaTestKey',
        model: 'gemini-embedding-2',
      });

      expect(title).toBeTruthy();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    });

    it('falls back from gemini-embedding-2 (404) to gemini-embedding-2-preview', async () => {
      let calls = 0;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        calls += 1;
        if (calls === 1) {
          expect(String(url)).toContain('gemini-embedding-2:batchEmbedContents');
          return new Response('Not found', { status: 404 });
        }
        expect(String(url)).toContain('gemini-embedding-2-preview:batchEmbedContents');
        const body = JSON.parse(String(init?.body || '{}'));
        return new Response(
          JSON.stringify({
            embeddings: body.requests.map(() => ({ values: [1, 0] })),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const title = await generateTitleWithGeminiEmbedding({
        prompt: 'Compare Redis and Memcached',
        assistantResponse: 'Redis supports rich data structures.',
        apiKey: 'AIzaTestKey',
        model: 'gemini-embedding-2',
      });

      expect(title).toBeTruthy();
      expect(calls).toBe(2);
      fetchSpy.mockRestore();
    });
  });

  describe('Gemini Tools payload & executableCode/grounding rendering', () => {
    it('sends enabled tools (google_search, code_execution, url_context) and formats tool outputs', async () => {
      let capturedBody: any = null;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body || '{}'));
        const sse = [
          `data: ${JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { executableCode: { language: 'PYTHON', code: 'print(6 * 7)' } },
                    { codeExecutionResult: { outcome: 'OUTCOME_OK', output: '42\n' } },
                    { text: 'The answer is 42.' },
                  ],
                },
                groundingMetadata: {
                  groundingChunks: [
                    { web: { uri: 'https://example.com/math', title: 'Math Reference' } },
                  ],
                },
              },
            ],
          })}\n\n`,
        ].join('');
        return new Response(sse, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      });

      const result = await geminiEngine.streamChat(
        {
          prompt: 'Calculate 6 * 7',
          model: 'gemini-2.5-pro',
          apiKey: 'AIzaTestKey',
          geminiTools: {
            googleSearch: true,
            codeExecution: true,
            urlContext: true,
          },
        },
        {}
      );

      expect(capturedBody.tools).toEqual([
        { googleSearch: {} },
        { codeExecution: {} },
        { urlContext: {} },
      ]);
      expect(result.content).toContain('```python\nprint(6 * 7)\n```');
      expect(result.content).toContain('**Execution Output:**');
      expect(result.content).toContain('42');
      expect(result.content).toContain('The answer is 42.');
      expect(result.content).toContain('[Math Reference](https://example.com/math)');

      fetchSpy.mockRestore();
    });
  });
});
