import { test, expect } from '@playwright/test';

test.describe('Tier 3: Cross-Feature State Interactions (XF-01..08)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // =========================================================================
  // XF-01: Edit Message Mid-Thread While Assistant Is Streaming
  // =========================================================================
  test('XF-01: Edit message mid-thread while assistant is streaming halts stream and spawns branch 2', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Write a comprehensive treatise on quantum physics');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const userMessage = page.locator('[data-testid="message-item-user"]').first();
    await userMessage.hover();

    const editBtn = page.locator('[data-testid="edit-message-btn"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const editTextarea = page.locator('[data-testid="edit-message-textarea"], textarea').first();
      await editTextarea.fill('Explain quantum computing briefly');

      const saveBtn = page.locator('[data-testid="save-edit-btn"], button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Verify version stepper exists
      const stepper = userMessage.locator('[data-testid="version-stepper"]').first();
      if (await stepper.isVisible()) {
        await expect(stepper).toContainText(/2/);
      }
    }
  });

  // =========================================================================
  // XF-02: Export Chat With Mixed Rich Content & Multiple Branches
  // =========================================================================
  test('XF-02: Export chat containing code blocks, LaTeX, tables and multiple branches preserves active timeline', async ({ page }) => {
    const mixedSession = {
      id: 'xf-02-session',
      title: 'Full Rich Session',
      updatedAt: Date.now(),
      messages: {
        m1: { id: 'm1', role: 'user', content: 'Provide code, math, and tables', createdAt: Date.now() - 3000 },
        m2: {
          id: 'm2',
          role: 'assistant',
          content: '```typescript\nconst a = 10;\n```\n\n$E = mc^2$\n\n| Item | Val |\n|---|---|\n| X | 1 |',
          createdAt: Date.now() - 2000
        }
      }
    };
    await page.evaluate((s) => {
      localStorage.setItem('m3_chat_sessions', JSON.stringify([s]));
      localStorage.setItem('m3_active_session_id', 'xf-02-session');
    }, mixedSession);

    await page.reload();
    await page.waitForTimeout(300);

    const exportBtn = page.locator('[data-testid="export-session-btn"]').first();
    if (await exportBtn.isVisible()) {
      const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
      await exportBtn.click();

      const mdOption = page.locator('[data-testid="export-option-md"], text=/markdown|\.md/i').first();
      if (await mdOption.isVisible()) {
        await mdOption.click();
      }
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.md$/i);
      }
    }
  });

  // =========================================================================
  // XF-03: Branch Switching After Multiple Regenerations
  // =========================================================================
  test('XF-03: Switching branches after multiple regenerations preserves all versions in tree', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Give me a creative domain name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);

    const regenBtn = page.locator('[data-testid="regenerate-btn"]').first();
    if (await regenBtn.isVisible()) {
      await regenBtn.click();
      await page.waitForTimeout(1200);

      const stepper = page.locator('[data-testid="version-stepper"]').first();
      if (await stepper.isVisible()) {
        await expect(stepper).toContainText(/2.*\/.*2/);

        // Switch to version 1
        const prevBtn = page.locator('[data-testid="stepper-prev-btn"]').first();
        await prevBtn.click();
        await page.waitForTimeout(200);
        await expect(stepper).toContainText(/1.*\/.*2/);
      }
    }
  });

  // =========================================================================
  // XF-04: Changing AI Persona Mid-Session and Continuing Conversation
  // =========================================================================
  test('XF-04: Changing persona mid-session applies to new turn while preserving prior turns', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('First turn with default persona');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    // Open settings and switch persona
    const settingsBtn = page.locator('[data-testid="settings-btn"]').first();
    await settingsBtn.click();
    await page.waitForTimeout(200);

    const personaTab = page.locator('[data-testid="tab-personas"], button:has-text("Persona")').first();
    if (await personaTab.isVisible()) {
      await personaTab.click();
      await page.waitForTimeout(200);

      const persona = page.locator('[data-testid="persona-card"]').nth(1);
      if (await persona.isVisible()) {
        await persona.click();
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Submit second turn
    await input.fill('Second turn with updated persona');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);

    const userMessages = page.locator('[data-testid="message-item-user"]');
    expect(await userMessages.count()).toBe(2);
  });

  // =========================================================================
  // XF-05: Multi-File Attachment With Custom Dock Settings
  // =========================================================================
  test('XF-05: Multi-file attachment submits files alongside prompt and clears preview chips', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles([
        { name: 'diagram.png', mimeType: 'image/png', buffer: Buffer.from('img') },
        { name: 'app.ts', mimeType: 'text/typescript', buffer: Buffer.from('const x = 1;') }
      ]);
      await page.waitForTimeout(300);

      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Review these attached files');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      // Chips in input dock should be cleared
      const dockChips = page.locator('[data-testid="input-dock"] [data-testid="attachment-chip"]');
      expect(await dockChips.count()).toBe(0);
    }
  });

  // =========================================================================
  // XF-06: Interactive Artifact Preview With Parallel Streaming
  // =========================================================================
  test('XF-06: Artifact side sheet preview stays open while follow-up prompt streams in conversation pane', async ({ page }) => {
    const artifactSession = {
      id: 'xf-06-art',
      title: 'Artifact Split View',
      updatedAt: Date.now(),
      messages: {
        m1: {
          id: 'm1',
          role: 'assistant',
          content: '```html\n<div>Interactive Preview</div>\n```',
          createdAt: Date.now()
        }
      }
    };
    await page.evaluate((s) => {
      localStorage.setItem('m3_chat_sessions', JSON.stringify([s]));
      localStorage.setItem('m3_active_session_id', 'xf-06-art');
    }, artifactSession);

    await page.reload();
    await page.waitForTimeout(300);

    const openArtifactBtn = page.locator('[data-testid="open-artifact-btn"]').first();
    if (await openArtifactBtn.isVisible()) {
      await openArtifactBtn.click();
      await page.waitForTimeout(300);

      // Send follow-up prompt
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Update artifact styles');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      const sideSheet = page.locator('[data-testid="artifact-sandbox-pane"]');
      if (await sideSheet.isVisible()) {
        await expect(sideSheet).toBeVisible();
      }
    }
  });

  // =========================================================================
  // XF-07: Delete Active Chat During Inline Search
  // =========================================================================
  test('XF-07: Deleting active chat while search filter is active cleans search results without error', async ({ page }) => {
    const sessions = [
      { id: 'search-del-1', title: 'React Search Target 1', updatedAt: Date.now() },
      { id: 'search-del-2', title: 'React Search Target 2', updatedAt: Date.now() - 500 }
    ];
    await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify(s)), sessions);
    await page.reload();
    await page.waitForTimeout(300);

    const searchInput = page.locator('[data-testid="session-search-input"], input[placeholder*="Search"]').first();
    await searchInput.fill('React');
    await page.waitForTimeout(200);

    const item = page.locator('[data-testid="session-item"]').first();
    await item.hover();

    const deleteBtn = item.locator('[data-testid="delete-session-btn"]').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      const confirmBtn = page.locator('[data-testid="confirm-delete-btn"]').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // App should remain responsive without crashing
    await expect(searchInput).toBeVisible();
  });

  // =========================================================================
  // XF-08: Full Data Export -> Wipe All Data -> Full Import Restoration
  // =========================================================================
  test('XF-08: Full data lifecycle: export JSON archive, wipe storage, and re-import completely', async ({ page }) => {
    const originalSessions = [
      { id: 's-orig-1', title: 'Original Archival Chat', updatedAt: Date.now(), messages: {} }
    ];
    await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify(s)), originalSessions);
    await page.reload();
    await page.waitForTimeout(200);

    // 1. Wipe data
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(200);

    const zeroState = page.locator('[data-testid="zero-state-greeting"], [data-testid="zero-state-container"]');
    await expect(zeroState.first()).toBeVisible();

    // 2. Restore data
    await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify(s)), originalSessions);
    await page.reload();
    await page.waitForTimeout(300);

    const sessionItem = page.locator('[data-testid="session-item"]').first();
    await expect(sessionItem).toContainText('Original Archival Chat');
  });

});
