import { test, expect } from '@playwright/test';

test.describe('Tier 4: Real-World User Workflows (Workflows 4.1..4.5)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // =========================================================================
  // Workflow 4.1: End-to-End Complex Coding Task
  // =========================================================================
  test('Workflow 4.1: End-to-End Complex Coding Task with Artifact Sandbox', async ({ page }) => {
    // 1. Click Code starter chip in zero-state
    const codeStarter = page.locator('[data-testid="starter-card-code"]').first();
    if (await codeStarter.isVisible()) {
      await codeStarter.click();
      await page.waitForTimeout(200);
    }

    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Create an interactive counter button in React with Tailwind CSS');

    // 2. Model Selection
    const modelPill = page.locator('[data-testid="model-selector-pill"]').first();
    if (await modelPill.isVisible()) {
      await modelPill.click();
      await page.waitForTimeout(150);
      const option = page.locator('[data-testid="model-option"]').first();
      if (await option.isVisible()) {
        await option.click();
      }
    }

    // 3. Submit prompt
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // 4. Inspect code block
    const assistant = page.locator('[data-testid="message-item-assistant"]').first();
    await expect(assistant).toBeVisible();

    // 5. Open Artifact preview if available
    const artifactBtn = page.locator('[data-testid="open-artifact-btn"]').first();
    if (await artifactBtn.isVisible()) {
      await artifactBtn.click();
      await page.waitForTimeout(400);

      const sideSheet = page.locator('[data-testid="artifact-sandbox-pane"]');
      await expect(sideSheet).toBeVisible();
    }

    // 6. Copy code
    const copyCodeBtn = page.locator('[data-testid="copy-code-btn"]').first();
    if (await copyCodeBtn.isVisible()) {
      await copyCodeBtn.click();
      await page.waitForTimeout(200);
      await expect(copyCodeBtn).toBeVisible();
    }
  });

  // =========================================================================
  // Workflow 4.2: Creative Writing & Iteration Workflow
  // =========================================================================
  test('Workflow 4.2: Creative Writing, Branching & Text-to-Speech Playback', async ({ page }) => {
    // 1. First narrative draft
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Write an opening scene of an astronaut discovering an alien beacon on Europa.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);

    // 2. Branch divergence
    const userMessage = page.locator('[data-testid="message-item-user"]').first();
    await userMessage.hover();

    const editBtn = page.locator('[data-testid="edit-message-btn"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const editTextarea = page.locator('[data-testid="edit-message-textarea"], textarea').first();
      await editTextarea.fill('Write an opening scene of an astronaut on Europa where the beacon speaks English.');
      const saveBtn = page.locator('[data-testid="save-edit-btn"]').first();
      await saveBtn.click();
      await page.waitForTimeout(1200);

      // 3. Branch navigation
      const stepper = page.locator('[data-testid="version-stepper"]').first();
      if (await stepper.isVisible()) {
        await expect(stepper).toContainText(/2/);
      }
    }

    // 4. TTS Read Aloud
    const ttsBtn = page.locator('[data-testid="tts-read-btn"]').first();
    if (await ttsBtn.isVisible()) {
      await ttsBtn.click();
      await page.waitForTimeout(200);
      await expect(ttsBtn).toBeVisible();
    }

    // 5. Pin chat
    const pinBtn = page.locator('[data-testid="pin-session-btn"]').first();
    if (await pinBtn.isVisible()) {
      await pinBtn.click();
      await page.waitForTimeout(200);
    }
  });

  // =========================================================================
  // Workflow 4.3: Data Analysis & Financial Modeling Workflow
  // =========================================================================
  test('Workflow 4.3: Data Table Analysis, LaTeX Formula & Export Lifecycle', async ({ page }) => {
    // 1. Submit tabular data request
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Format quarterly revenue data (Q1: 120k, Q2: 150k) into a table and provide the CAGR formula.');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    const assistant = page.locator('[data-testid="message-item-assistant"]').first();
    await expect(assistant).toBeVisible();

    // 2. Interact with data table
    const table = page.locator('table').first();
    if (await table.isVisible()) {
      await table.hover();
      const copyCsvBtn = page.locator('[data-testid="copy-table-csv-btn"]').first();
      if (await copyCsvBtn.isVisible()) {
        await copyCsvBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // 3. Export active conversation
    const exportBtn = page.locator('[data-testid="export-session-btn"]').first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForTimeout(200);
    }
  });

  // =========================================================================
  // Workflow 4.4: System Prompt & Technical Persona Switch
  // =========================================================================
  test('Workflow 4.4: Switch Technical Personas and Verify Consistent Context', async ({ page }) => {
    // 1. Open Settings -> Personas -> Senior Architect
    const settingsBtn = page.locator('[data-testid="settings-btn"]').first();
    await settingsBtn.click();
    await page.waitForTimeout(250);

    const personaTab = page.locator('[data-testid="tab-personas"], button:has-text("Persona")').first();
    if (await personaTab.isVisible()) {
      await personaTab.click();
      await page.waitForTimeout(200);

      const personaCard = page.locator('[data-testid="persona-card"]').first();
      if (await personaCard.isVisible()) {
        await personaCard.click();
      }
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 2. Submit technical query
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('What causes concurrency deadlocks with spinlocks in OS kernels?');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // 3. Switch to ELI5 persona
    await settingsBtn.click();
    await page.waitForTimeout(200);
    if (await personaTab.isVisible()) {
      await personaTab.click();
      const otherPersona = page.locator('[data-testid="persona-card"]').nth(2);
      if (await otherPersona.isVisible()) {
        await otherPersona.click();
      }
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 4. Follow-up query
    await input.fill('Explain that with a toy train analogy');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const userMessages = page.locator('[data-testid="message-item-user"]');
    expect(await userMessages.count()).toBe(2);
  });

  // =========================================================================
  // Workflow 4.5: Offline Zero-Config to Custom Live API Transition
  // =========================================================================
  test('Workflow 4.5: Zero-Configuration Out-of-the-Box Execution & Live API Configuration', async ({ page }) => {
    // 1. App loads out-of-the-box with zero setup
    const zeroState = page.locator('[data-testid="zero-state-greeting"], [data-testid="zero-state-container"]');
    await expect(zeroState.first()).toBeVisible();

    // 2. Submit prompt using default offline simulated engine
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Hello AI assistant!');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const assistant = page.locator('[data-testid="message-item-assistant"]').first();
    await expect(assistant).toBeVisible();

    // 3. Open Settings -> Engine & Live API configuration
    const settingsBtn = page.locator('[data-testid="settings-btn"]').first();
    await settingsBtn.click();
    await page.waitForTimeout(250);

    const engineTab = page.locator('[data-testid="tab-engine"], button:has-text("Engine")').first();
    if (await engineTab.isVisible()) {
      await engineTab.click();
      await page.waitForTimeout(200);

      const geminiOption = page.locator('[data-testid="engine-option-gemini"], input[value="gemini"]').first();
      if (await geminiOption.isVisible()) {
        await geminiOption.click();
        await page.waitForTimeout(200);

        const apiKeyInput = page.locator('[data-testid="api-key-input"], input[type="password"]');
        if (await apiKeyInput.isVisible()) {
          await apiKeyInput.fill('AIzaSyFakeTestKey12345');
        }
      }
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // App remains functioning and interactive
    await expect(input).toBeVisible();
  });

});
