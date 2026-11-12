import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildGeminiV1BetaBase,
  fetchGeminiModels,
  resolveGeminiModelId,
} from '../../src/services/liveEngine';
import { useSettingsStore } from '../../src/store/useSettingsStore';

describe('Google Gemini /v1beta/models/ integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.getState().resetAllSettings();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('builds default and custom /v1beta base URLs cleanly', () => {
    expect(buildGeminiV1BetaBase()).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(buildGeminiV1BetaBase('https://proxy.example.com/')).toBe(
      'https://proxy.example.com/v1beta'
    );
    expect(buildGeminiV1BetaBase('https://proxy.example.com/v1beta/')).toBe(
      'https://proxy.example.com/v1beta'
    );
  });

  it('throws an error if API key is missing when fetching models', async () => {
    await expect(fetchGeminiModels('')).rejects.toThrow(/API Key is required/i);
  });

  it('fetches paginated models from /v1beta/models/ and filters to generateContent models', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              description: 'Fast multimodal model',
              inputTokenLimit: 1048576,
              outputTokenLimit: 65536,
              supportedGenerationMethods: ['generateContent', 'countTokens'],
            },
            {
              name: 'models/text-embedding-004',
              displayName: 'Text Embedding 004',
              description: 'Embedding model',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
          nextPageToken: 'page-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              description: 'Advanced reasoning model',
              inputTokenLimit: 1048576,
              outputTokenLimit: 65536,
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const models = await fetchGeminiModels('AIzaTestKey123');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/v1beta/models?key=AIzaTestKey123');
    expect(fetchMock.mock.calls[1][0]).toContain('pageToken=page-2');

    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      inputTokenLimit: 1048576,
    });
    expect(models[1]).toMatchObject({
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
    });
  });

  it('resolves display names and model IDs accurately', () => {
    const fetched = [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Pro',
      },
    ];

    expect(resolveGeminiModelId('Gemini 2.5 Pro', fetched)).toBe('gemini-2.5-pro');
    expect(resolveGeminiModelId('models/gemini-2.5-pro', fetched)).toBe('gemini-2.5-pro');
    expect(resolveGeminiModelId('Gemini 1.5 Flash', [])).toBe('gemini-1.5-flash');
  });

  it('manages fetched and enabled Gemini models in useSettingsStore', () => {
    const sample = Array.from({ length: 7 }, (_, i) => ({
      id: `gemini-model-${i + 1}`,
      name: `Gemini Model ${i + 1}`,
      description: `Model ${i + 1}`,
    }));

    useSettingsStore.getState().setFetchedGeminiModels(sample);

    // Auto-enables top 5 on initial fetch
    expect(useSettingsStore.getState().fetchedGeminiModels).toHaveLength(7);
    expect(useSettingsStore.getState().enabledGeminiModels).toHaveLength(5);

    // Toggle individual model
    useSettingsStore.getState().toggleGeminiModelEnabled('gemini-model-1');
    expect(useSettingsStore.getState().enabledGeminiModels).not.toContain('gemini-model-1');

    useSettingsStore.getState().toggleGeminiModelEnabled('gemini-model-7');
    expect(useSettingsStore.getState().enabledGeminiModels).toContain('gemini-model-7');

    // Set explicit list
    useSettingsStore.getState().setEnabledGeminiModels(['gemini-model-2', 'gemini-model-6']);
    expect(useSettingsStore.getState().enabledGeminiModels).toEqual([
      'gemini-model-2',
      'gemini-model-6',
    ]);
  });
});
