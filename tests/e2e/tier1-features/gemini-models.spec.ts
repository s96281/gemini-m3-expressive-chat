import { test, expect } from '@playwright/test';

test.describe('Google Gemini /v1beta/models/ API & Chat Model Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('fetches available Gemini models via /v1beta/models/ and lets user choose which models appear in chat selector', async ({
    page,
  }) => {
    // Intercept Gemini /v1beta/models API request
    await page.route('**/v1beta/models*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              description: 'Most capable Gemini model for complex reasoning',
              inputTokenLimit: 1048576,
              outputTokenLimit: 65536,
              supportedGenerationMethods: ['generateContent', 'countTokens'],
            },
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              description: 'Fast and versatile multimodal model',
              inputTokenLimit: 1048576,
              outputTokenLimit: 65536,
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.0-flash',
              displayName: 'Gemini 2.0 Flash',
              description: 'Previous generation fast model',
              inputTokenLimit: 1048576,
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/text-embedding-004',
              displayName: 'Text Embedding 004',
              description: 'Embedding only model',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
        }),
      });
    });

    // Open Settings -> Model & Engine tab
    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();

    // Select Google Gemini engine
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await expect(page.locator('[data-testid="gemini-models-section"]')).toBeVisible();

    // Enter API Key and click Fetch Models
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await page.locator('[data-testid="fetch-gemini-models-btn"]').click();

    // Verify status message and filtered models list (embedding model excluded)
    await expect(page.locator('[data-testid="fetch-gemini-models-status"]')).toContainText(
      'Fetched 3 Gemini models'
    );
    await expect(page.locator('[data-testid="gemini-model-item-gemini-2.5-pro"]')).toBeVisible();
    await expect(page.locator('[data-testid="gemini-model-item-gemini-2.5-flash"]')).toBeVisible();
    await expect(page.locator('[data-testid="gemini-model-item-gemini-2.0-flash"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="gemini-model-item-text-embedding-004"]')
    ).toHaveCount(0);

    // Uncheck Gemini 2.0 Flash so only 2.5 Pro and 2.5 Flash are shown in chat UI
    await page.locator('[data-testid="gemini-model-item-gemini-2.0-flash"]').click();
    await expect(page.locator('[data-testid="gemini-selected-count"]')).toContainText(
      '2 / 3 selected'
    );

    // Close Settings
    await page.locator('[data-testid="close-settings-btn"]').click();

    // Open Model Selector Pill in chat input dock
    await page.locator('[data-testid="model-selector-pill"]').click();
    const menu = page.locator('[data-testid="model-selector-menu"]');
    await expect(menu).toBeVisible();

    // Verify ONLY the 2 selected Gemini models appear in the chat selector
    const options = menu.locator('[data-testid="model-option"]');
    await expect(options).toHaveCount(2);
    await expect(menu).toContainText('Gemini 2.5 Pro');
    await expect(menu).toContainText('Gemini 2.5 Flash');
    await expect(menu).not.toContainText('Gemini 2.0 Flash');

    // Select Gemini 2.5 Pro
    await options.filter({ hasText: 'Gemini 2.5 Pro' }).click();
    await expect(page.locator('[data-testid="model-selector-pill"]')).toContainText(
      'Gemini 2.5 Pro'
    );
  });
});
