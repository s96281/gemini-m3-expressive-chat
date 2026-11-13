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

  test('renders Gemini thought: true parts inside ThinkingAccordion and sends multi-turn history', async ({
    page,
  }) => {
    const capturedBodies: any[] = [];

    await page.route('**/v1beta/models/*:streamGenerateContent*', async (route) => {
      const postData = route.request().postDataJSON();
      capturedBodies.push(postData);

      const turn = capturedBodies.length;
      const sseBody =
        turn === 1
          ? [
              `data: ${JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [{ thought: true, text: 'Thinking: User introduced themselves as Bob.' }],
                    },
                  },
                ],
              })}\n\n`,
              `data: ${JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [{ text: 'Hello Bob! Nice to meet you.' }],
                    },
                  },
                ],
              })}\n\n`,
            ].join('')
          : [
              `data: ${JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [{ thought: true, text: 'Thinking: Checking prior context -> Bob.' }],
                    },
                  },
                ],
              })}\n\n`,
              `data: ${JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [{ text: 'Your name is Bob.' }],
                    },
                  },
                ],
              })}\n\n`,
            ].join('');

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseBody,
      });
    });

    // Configure Gemini mode + API key
    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await page.locator('[data-testid="close-settings-btn"]').click();

    const textarea = page.locator('[data-testid="chat-input-textarea"]');
    const sendBtn = page.locator('[data-testid="send-message-btn"]');

    // Turn 1
    await textarea.fill('My name is Bob.');
    await sendBtn.click();

    await expect(page.locator('[data-testid="thinking-accordion-content"]').first()).toContainText(
      'Thinking: User introduced themselves as Bob.'
    );
    await expect(page.locator('[data-testid="message-item-assistant"]').first()).toContainText(
      'Hello Bob! Nice to meet you.'
    );

    // Turn 2 (multi-turn context continuation)
    await textarea.fill('What is my name?');
    await sendBtn.click();

    await expect(page.locator('[data-testid="thinking-accordion-content"]').nth(1)).toContainText(
      'Thinking: Checking prior context -> Bob.'
    );
    await expect(page.locator('[data-testid="message-item-assistant"]').nth(1)).toContainText(
      'Your name is Bob.'
    );

    // Verify Turn 2 payload included Turn 1 user & model messages in contents
    expect(capturedBodies).toHaveLength(2);
    expect(capturedBodies[1].contents).toEqual([
      { role: 'user', parts: [{ text: 'My name is Bob.' }] },
      { role: 'model', parts: [{ text: 'Hello Bob! Nice to meet you.' }] },
      { role: 'user', parts: [{ text: 'What is my name?' }] },
    ]);
  });

  test('adapts ThinkingSelectorPill options and thinkingConfig payload per Gemini model generation', async ({
    page,
  }) => {
    const capturedBodies: any[] = [];

    await page.route('**/v1beta/models**', async (route) => {
      if (route.request().url().includes(':streamGenerateContent')) {
        capturedBodies.push(route.request().postDataJSON());
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'OK' }] } }],
          })}\n\n`,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          models: [
            {
              name: 'models/gemini-1.5-flash',
              displayName: 'Gemini 1.5 Flash',
              description: 'Legacy non-thinking model',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-2.5-pro',
              displayName: 'Gemini 2.5 Pro',
              description: '2.5 Pro with thinkingBudget',
              supportedGenerationMethods: ['generateContent'],
            },
            {
              name: 'models/gemini-3-pro-preview',
              displayName: 'Gemini 3 Pro',
              description: '3 Pro with thinkingLevel',
              supportedGenerationMethods: ['generateContent'],
            },
          ],
        }),
      });
    });

    // Enable Gemini mode, fetch models, close settings
    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await page.locator('[data-testid="fetch-gemini-models-btn"]').click();
    await expect(page.locator('[data-testid="fetch-gemini-models-status"]')).toContainText(
      'Fetched 3 Gemini models'
    );
    await page.locator('[data-testid="close-settings-btn"]').click();

    // 1. Default Gemini 1.5 Flash does not support thinking -> ThinkingSelectorPill hidden
    await expect(page.locator('[data-testid="thinking-selector-pill"]')).toHaveCount(0);

    // 2. Switch to Gemini 2.5 Pro -> ThinkingSelectorPill appears with thinkingBudget presets (no Off)
    await page.locator('[data-testid="model-selector-pill"]').click();
    await page
      .locator('[data-testid="model-option"]')
      .filter({ hasText: 'Gemini 2.5 Pro' })
      .click();

    const thinkingPill = page.locator('[data-testid="thinking-selector-pill"]');
    await expect(thinkingPill).toBeVisible();
    await thinkingPill.click();

    const menu = page.locator('[data-testid="thinking-selector-menu"]');
    await expect(menu).toContainText('thinkingBudget');
    await expect(menu.locator('[data-testid="thinking-option-off"]')).toHaveCount(0);
    await menu.locator('[data-testid="thinking-option-high"]').click();

    await page.locator('[data-testid="chat-input-textarea"]').fill('Solve this');
    await page.locator('[data-testid="send-message-btn"]').click();
    await expect(page.locator('[data-testid="message-item-assistant"]').first()).toContainText('OK');

    expect(capturedBodies[0].generationConfig.thinkingConfig).toEqual({
      thinkingBudget: 32768,
      includeThoughts: true,
    });

    // 3. Switch to Gemini 3 Pro -> ThinkingSelectorPill adapts to thinkingLevel (Auto, Low, High)
    await page.locator('[data-testid="model-selector-pill"]').click();
    await page
      .locator('[data-testid="model-option"]')
      .filter({ hasText: 'Gemini 3 Pro' })
      .click();

    await thinkingPill.click();
    await expect(menu).toContainText('thinkingLevel');
    await expect(menu.locator('[data-testid="thinking-option-medium"]')).toHaveCount(0);
    await menu.locator('[data-testid="thinking-option-low"]').click();
    await expect(menu).toBeHidden();

    await page.locator('[data-testid="chat-input-textarea"]').fill('Next question');
    await page.locator('[data-testid="chat-input-textarea"]').press('Enter');
    await expect(page.locator('[data-testid="message-item-assistant"]').nth(1)).toContainText('OK');

    expect(capturedBodies[1].generationConfig.thinkingConfig).toEqual({
      thinkingLevel: 'low',
      includeThoughts: true,
    });
  });

  test('displays API error banner in assistant message and recovers on Retry', async ({
    page,
  }) => {
    let attempt = 0;

    await page.route('**/v1beta/models**', async (route) => {
      if (route.request().url().includes(':streamGenerateContent')) {
        attempt += 1;
        if (attempt === 1) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 400,
                message: 'API key not valid. Please pass a valid API key.',
                status: 'INVALID_ARGUMENT',
              },
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Recovered successfully!' }] } }],
          })}\n\n`,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] }),
      });
    });

    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaInvalidKey');
    await page.locator('[data-testid="close-settings-btn"]').click();

    await page.locator('[data-testid="chat-input-textarea"]').fill('Test error display');
    await page.locator('[data-testid="send-message-btn"]').click();

    const errorBanner = page.locator('[data-testid="message-error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('[400] API key not valid. Please pass a valid API key.');

    // Click Retry inside the error banner and verify recovery
    await page.locator('[data-testid="error-retry-btn"]').click();
    await expect(page.locator('[data-testid="message-item-assistant"]').first()).toContainText(
      'Recovered successfully!'
    );
    await expect(page.locator('[data-testid="message-error-banner"]')).toHaveCount(0);
  });

  test('reads attached file content and sends it to the Gemini API', async ({ page }) => {
    let capturedBody: any = null;

    await page.route('**/v1beta/models**', async (route) => {
      if (route.request().url().includes(':streamGenerateContent')) {
        capturedBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'File content received: ALPHA-77' }] } }],
          })}\n\n`,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] }),
      });
    });

    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await page.locator('[data-testid="close-settings-btn"]').click();

    // Attach a text file via the hidden file input
    const fileInput = page.locator('[data-testid="input-dock"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'report.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Project code: ALPHA-77'),
    });

    await expect(page.locator('[data-testid="attachment-chip"]')).toContainText('report.txt');

    await page.locator('[data-testid="chat-input-textarea"]').fill('What is the project code?');
    await page.locator('[data-testid="send-message-btn"]').click();

    await expect(page.locator('[data-testid="message-item-assistant"]').first()).toContainText(
      'File content received: ALPHA-77'
    );

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.contents[0].parts).toEqual([
      {
        text: '[Attached File: report.txt (text/plain)]\n```\nProject code: ALPHA-77\n```',
      },
      {
        text: 'What is the project code?',
      },
    ]);
  });

  test('supports 65536 max output tokens, Gemini tools toggles, image preview lightbox, and embedding title generation', async ({
    page,
  }) => {
    let capturedStreamBody: any = null;
    let embedCalled = false;

    await page.route('**/v1beta/models**', async (route) => {
      const url = route.request().url();
      if (url.includes(':batchEmbedContents')) {
        embedCalled = true;
        const reqBody = route.request().postDataJSON();
        const embeddings = reqBody.requests.map((_: unknown, idx: number) => ({
          values: idx === 0 ? [1, 0] : idx === 1 ? [0.99, 0.05] : [0, 1],
        }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ embeddings }),
        });
        return;
      }

      if (url.includes(':streamGenerateContent')) {
        capturedStreamBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Image & tools processed!' }] } }],
          })}\n\n`,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] }),
      });
    });

    // 1. Verify Max Output Tokens slider supports 65536 and enable Gemini mode
    await page.locator('[data-testid="settings-btn"]').first().click();
    const maxTokensSlider = page.locator('[data-testid="max-tokens-slider"]');
    await expect(maxTokensSlider).toHaveAttribute('max', '65536');
    await maxTokensSlider.fill('65536');
    await expect(page.locator('[data-testid="max-tokens-value"]')).toContainText('65536');

    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await expect(page.locator('[data-testid="title-embedding-model-select"]')).toHaveValue(
      'gemini-embedding-2'
    );
    await page.locator('[data-testid="close-settings-btn"]').click();

    // 2. Toggle Google Search & Code Execution tools via ToolsSelectorPill
    await page.locator('[data-testid="tools-selector-pill"]').click();
    await page.locator('[data-testid="tool-toggle-googleSearch"]').click();
    await page.locator('[data-testid="tool-toggle-codeExecution"]').click();
    await expect(page.locator('[data-testid="tools-selector-pill"]')).toContainText('Tools (2)');
    // Close tools menu by clicking textarea
    await page.locator('[data-testid="chat-input-textarea"]').click();

    // 3. Upload an image and verify thumbnail in AttachmentBar
    const png1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const fileInput = page.locator('[data-testid="input-dock"] input[type="file"]');
    await fileInput.setInputFiles({
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: png1x1,
    });

    await expect(page.locator('[data-testid="attachment-image-thumb"]')).toBeVisible();

    // 4. Send message and verify image preview + lightbox in conversation
    await page.locator('[data-testid="chat-input-textarea"]').fill('Analyze this image');
    await page.locator('[data-testid="send-message-btn"]').click();

    await expect(page.locator('[data-testid="message-item-assistant"]').first()).toContainText(
      'Image & tools processed!'
    );

    const msgImgPreview = page.locator('[data-testid="message-image-preview"]').first();
    await expect(msgImgPreview).toBeVisible();
    await msgImgPreview.click();
    await expect(page.locator('[data-testid="image-lightbox-modal"]')).toBeVisible();
    await page.locator('[data-testid="close-image-lightbox-btn"]').click();
    await expect(page.locator('[data-testid="image-lightbox-modal"]')).toHaveCount(0);

    // 5. Verify tools, maxOutputTokens=65536, and embedding title call
    expect(capturedStreamBody.tools).toEqual([
      { googleSearch: {} },
      { codeExecution: {} },
    ]);
    expect(capturedStreamBody.generationConfig.maxOutputTokens).toBe(65536);
    await expect.poll(() => embedCalled).toBe(true);
  });

  test('shows waiting animation before first token and renders mermaid diagram blocks', async ({
    page,
  }) => {
    await page.route('**/v1beta/models**', async (route) => {
      if (route.request().url().includes(':streamGenerateContent')) {
        // Delay response slightly so we can observe the waiting animation before first token
        await new Promise((r) => setTimeout(r, 600));
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: 'Flowchart:\n\n```mermaid\nflowchart LR\n  User --> Gemini\n```\n',
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] }),
      });
    });

    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await page.locator('[data-testid="close-settings-btn"]').click();

    await page.locator('[data-testid="chat-input-textarea"]').fill('Draw a mermaid flowchart');
    await page.locator('[data-testid="send-message-btn"]').click();

    // Waiting animation appears before first token arrives
    await expect(page.locator('[data-testid="streaming-waiting-indicator"]')).toBeVisible();

    // Once response completes, waiting indicator disappears and mermaid SVG renders
    await expect(page.locator('[data-testid="streaming-waiting-indicator"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mermaid-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="mermaid-svg-container"] svg')).toBeVisible();

    // Toggle to source code and back
    await page.locator('[data-testid="mermaid-toggle-code-btn"]').click();
    await expect(page.locator('[data-testid="mermaid-block"]')).toContainText('User --> Gemini');
  });

  test('displays thread token statistics pill, breakdown popover, and per-message token badge from Gemini usageMetadata', async ({
    page,
  }) => {
    await page.route('**/v1beta/models**', async (route) => {
      if (route.request().url().includes(':streamGenerateContent')) {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Here is the token usage response.' }],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 120,
              candidatesTokenCount: 80,
              thoughtsTokenCount: 40,
              totalTokenCount: 240,
            },
          })}\n\n`,
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [] }),
      });
    });

    await page.locator('[data-testid="settings-btn"]').first().click();
    await page.locator('[data-testid="tab-engine"]').click();
    await page.locator('[data-testid="engine-option-gemini"]').click();
    await page.locator('[data-testid="api-key-input"]').fill('AIzaTestMockKey12345');
    await page.locator('[data-testid="close-settings-btn"]').click();

    await page.locator('[data-testid="chat-input-textarea"]').fill('Count my tokens');
    await page.locator('[data-testid="send-message-btn"]').click();

    await expect(page.locator('[data-testid="message-item-assistant"]')).toContainText(
      'Here is the token usage response.'
    );

    // Per-message token badge
    const msgBadge = page.locator('[data-testid="message-token-badge"]').first();
    await expect(msgBadge).toBeVisible();
    await expect(msgBadge).toContainText('240 tok');

    // Top bar thread token stats pill
    const statsPill = page.locator('[data-testid="conversation-token-stats"]');
    await expect(statsPill).toBeVisible();
    await expect(statsPill).toContainText('240 tok');

    // Click to open breakdown popover
    await statsPill.click();
    const popover = page.locator('[data-testid="token-stats-popover"]');
    await expect(popover).toBeVisible();
    await expect(popover).toContainText('Thread Token Usage');
    await expect(popover).toContainText('240');
    await expect(popover).toContainText('120');
    await expect(popover).toContainText('80');
    await expect(popover).toContainText('40');
  });
});
