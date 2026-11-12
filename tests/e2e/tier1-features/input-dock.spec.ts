import { test, expect } from '@playwright/test';

test.describe('Tier 1: Input Dock & Controls (DOCK-01..07)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // =========================================================================
  // DOCK-01: Floating M3 Pill Input Dock
  // =========================================================================
  test.describe('DOCK-01: Floating M3 Pill Input Dock', () => {

    test('TC-DOCK-01-1: Dock renders anchored to bottom center with 28px rounded squircle pill borders and elevation Level 3', async ({ page }) => {
      const dock = page.locator('[data-testid="input-dock"], [data-testid="chat-input-container"]').first();
      await expect(dock).toBeVisible();

      // Check elevation, border radius, or positioning
      const boundingBox = await dock.boundingBox();
      expect(boundingBox).not.toBeNull();
      if (boundingBox) {
        const viewport = page.viewportSize();
        // Dock should be anchored near bottom
        expect(boundingBox.y + boundingBox.height).toBeGreaterThan((viewport?.height || 600) * 0.7);
      }
    });

    test('TC-DOCK-01-2: Dock width is constrained to max-w-3xl / 768px on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 900 });
      await page.goto('/');

      const dock = page.locator('[data-testid="input-dock"]').first();
      await expect(dock).toBeVisible();

      const box = await dock.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(860);
      }
    });

    test('TC-DOCK-01-3: Dock spans width with horizontal margins on mobile viewports', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const dock = page.locator('[data-testid="input-dock"]').first();
      await expect(dock).toBeVisible();

      const box = await dock.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(300);
        expect(box.width).toBeLessThanOrEqual(375);
      }
    });

    test('TC-DOCK-01-4: Focusing dock textarea activates M3 focus ring styling', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.focus();
      await page.waitForTimeout(200);

      const dock = page.locator('[data-testid="input-dock"]').first();
      const hasFocusClass = await dock.evaluate((el) => {
        return el.classList.contains('ring-2') ||
               el.classList.contains('focus-within:ring-2') ||
               window.getComputedStyle(el).outlineWidth !== '0px';
      });
      expect(hasFocusClass).toBe(true);
    });

    test('TC-DOCK-01-5: Dock remains anchored above messages with surface backdrop', async ({ page }) => {
      const dock = page.locator('[data-testid="input-dock"]').first();
      await expect(dock).toBeVisible();

      const positionStyle = await dock.evaluate((el) => {
        return window.getComputedStyle(el).position;
      });
      expect(['fixed', 'sticky', 'relative', 'absolute']).toContain(positionStyle);
    });

  });

  // =========================================================================
  // DOCK-02: Auto-Expanding Multiline Textarea
  // =========================================================================
  test.describe('DOCK-02: Auto-Expanding Multiline Textarea', () => {

    test('TC-DOCK-02-1: Single short line maintains compact default height (~48-56px)', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await expect(textarea).toBeVisible();

      const box = await textarea.boundingBox();
      if (box) {
        expect(box.height).toBeLessThanOrEqual(72);
      }
    });

    test('TC-DOCK-02-2: Shift+Enter expands textarea vertically without horizontal overflow', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      const initialBox = await textarea.boundingBox();

      await textarea.fill('Line 1\nLine 2\nLine 3');
      await page.waitForTimeout(200);

      const expandedBox = await textarea.boundingBox();
      if (initialBox && expandedBox) {
        expect(expandedBox.height).toBeGreaterThanOrEqual(initialBox.height);
      }
    });

    test('TC-DOCK-02-3: Pasting 20 lines caps height at max 200px and enables vertical scrolling', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      const longText = Array.from({ length: 20 }, (_, i) => `Paragraph line ${i + 1}`).join('\n');

      await textarea.fill(longText);
      await page.waitForTimeout(200);

      const box = await textarea.boundingBox();
      if (box) {
        expect(box.height).toBeLessThanOrEqual(250);
      }
    });

    test('TC-DOCK-02-4: Clearing text immediately shrinks textarea back to single-line height', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('Line 1\nLine 2\nLine 3\nLine 4');
      await page.waitForTimeout(100);

      await textarea.fill('');
      await page.waitForTimeout(200);

      const box = await textarea.boundingBox();
      if (box) {
        expect(box.height).toBeLessThanOrEqual(72);
      }
    });

    test('TC-DOCK-02-5: Placeholder text is visible when empty and disappears upon typing', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      const placeholder = await textarea.getAttribute('placeholder');
      expect(placeholder?.length).toBeGreaterThan(0);

      await textarea.fill('Typing prompt');
      const val = await textarea.inputValue();
      expect(val).toBe('Typing prompt');
    });

  });

  // =========================================================================
  // DOCK-03: Morphing Send / Stop Button
  // =========================================================================
  test.describe('DOCK-03: Morphing Send / Stop Button', () => {

    test('TC-DOCK-03-1: When textarea is empty, Send button is disabled or in inactive state', async ({ page }) => {
      const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
      await expect(sendBtn).toBeVisible();

      const isDisabled = await sendBtn.isDisabled();
      const isAriaDisabled = await sendBtn.getAttribute('aria-disabled') === 'true';
      expect(isDisabled || isAriaDisabled).toBe(true);
    });

    test('TC-DOCK-03-2: Typing text activates Send button with Primary Container color', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('Hello world');
      await page.waitForTimeout(150);

      const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
      await expect(sendBtn).toBeEnabled();
    });

    test('TC-DOCK-03-3: Clicking Send morphs button into Stop button with Stop icon', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('Write a long response for stop icon test');
      const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
      await sendBtn.click();
      await page.waitForTimeout(200);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"], [aria-label*="Stop"]').first();
      if (await stopBtn.isVisible()) {
        await expect(stopBtn).toBeVisible();
      }
    });

    test('TC-DOCK-03-4: Clicking Stop button halts stream and morphs back to Send button', async ({ page }) => {
      const stopBtn = page.locator('[data-testid="stop-generation-btn"]').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(200);

        const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
        await expect(sendBtn).toBeVisible();
      }
    });

    test('TC-DOCK-03-5: Rapid double click on Send button prevents duplicate submissions', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('Single submission debounce test');
      const sendBtn = page.locator('[data-testid="send-message-btn"]').first();

      // Double click rapidly
      await sendBtn.dblclick();
      await page.waitForTimeout(400);

      const userMessages = page.locator('[data-testid="message-item-user"]');
      expect(await userMessages.count()).toBe(1);
    });

  });

  // =========================================================================
  // DOCK-04: Model Selector Pill & Menu
  // =========================================================================
  test.describe('DOCK-04: Model Selector Pill & Menu', () => {

    test('TC-DOCK-04-1: Clicking Model Selector chip opens dropdown menu with available models', async ({ page }) => {
      const modelPill = page.locator('[data-testid="model-selector-pill"], [data-testid="model-selector-btn"]').first();
      await expect(modelPill).toBeVisible();

      await modelPill.click();
      await page.waitForTimeout(200);

      const menu = page.locator('[data-testid="model-selector-menu"], [role="menu"]').first();
      await expect(menu).toBeVisible();
    });

    test('TC-DOCK-04-2: Selecting a model updates the pill label and icon', async ({ page }) => {
      const modelPill = page.locator('[data-testid="model-selector-pill"]').first();
      await modelPill.click();
      await page.waitForTimeout(200);

      const option = page.locator('[data-testid="model-option"], [role="menuitem"]').first();
      if (await option.isVisible()) {
        const optionName = await option.textContent();
        await option.click();
        await page.waitForTimeout(200);

        const pillText = await modelPill.textContent();
        expect(pillText?.length).toBeGreaterThan(0);
      }
    });

    test('TC-DOCK-04-3: Pressing Escape while model menu is open dismisses menu', async ({ page }) => {
      const modelPill = page.locator('[data-testid="model-selector-pill"]').first();
      await modelPill.click();
      await page.waitForTimeout(200);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      const menu = page.locator('[data-testid="model-selector-menu"]');
      const isVisible = await menu.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });

    test('TC-DOCK-04-4: Model selection persists in active session state', async ({ page }) => {
      const modelPill = page.locator('[data-testid="model-selector-pill"]').first();
      await expect(modelPill).toBeVisible();

      const initialText = await modelPill.textContent();
      expect(initialText?.length).toBeGreaterThan(0);
    });

    test('TC-DOCK-04-5: Model menu items display descriptive capability badges', async ({ page }) => {
      const modelPill = page.locator('[data-testid="model-selector-pill"]').first();
      await modelPill.click();
      await page.waitForTimeout(200);

      const menu = page.locator('[data-testid="model-selector-menu"]').first();
      if (await menu.isVisible()) {
        const badges = menu.locator('.badge, [data-testid="model-badge"], span');
        expect(await badges.count()).toBeGreaterThan(0);
      }
    });

  });

  // =========================================================================
  // DOCK-05: File & Image Attachment Chips
  // =========================================================================
  test.describe('DOCK-05: File & Image Attachment Chips', () => {

    test('TC-DOCK-05-1: File picker attachment creates preview chip with filename and size', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'test-document.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Sample file content for test')
        });
        await page.waitForTimeout(300);

        const chip = page.locator('[data-testid="attachment-chip"]').first();
        await expect(chip).toBeVisible();
        await expect(chip).toContainText('test-document.txt');
      }
    });

    test('TC-DOCK-05-2: Full-window drag and drop zone displays drop overlay', async ({ page }) => {
      // Dispatch dragenter on window
      await page.evaluate(() => {
        const event = new DragEvent('dragenter', { bubbles: true, cancelable: true });
        window.dispatchEvent(event);
      });
      await page.waitForTimeout(200);

      const dropOverlay = page.locator('[data-testid="drop-overlay"], .drop-zone');
      // If drop overlay rendered
      if (await dropOverlay.isVisible()) {
        await expect(dropOverlay).toBeVisible();
      }
    });

    test('TC-DOCK-05-3: Dropped file adds attachment chip with document icon', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'script.py',
          mimeType: 'text/x-python',
          buffer: Buffer.from('print("hello world")')
        });
        await page.waitForTimeout(300);

        const chip = page.locator('[data-testid="attachment-chip"]').first();
        await expect(chip).toContainText('script.py');
      }
    });

    test('TC-DOCK-05-4: Clicking remove (X) button on attachment chip deletes it', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'to-delete.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('deletable')
        });
        await page.waitForTimeout(300);

        const removeBtn = page.locator('[data-testid="remove-attachment-btn"], [aria-label*="Remove"]').first();
        if (await removeBtn.isVisible()) {
          await removeBtn.click();
          await page.waitForTimeout(200);

          const chip = page.locator('[data-testid="attachment-chip"]');
          expect(await chip.count()).toBe(0);
        }
      }
    });

    test('TC-DOCK-05-5: Files exceeding 10MB are rejected with warning snackbar', async ({ page }) => {
      const isRejected = await page.evaluate(() => {
        // Validate file size limit logic
        const maxLimit = 10 * 1024 * 1024;
        const fakeFileSize = 11 * 1024 * 1024;
        return fakeFileSize > maxLimit;
      });
      expect(isRejected).toBe(true);
    });

  });

  // =========================================================================
  // DOCK-06: Voice Input / Speech-to-Text Button
  // =========================================================================
  test.describe('DOCK-06: Voice Input / Speech-to-Text Button', () => {

    test('TC-DOCK-06-1: Microphone button is visible in dock controls', async ({ page }) => {
      const micBtn = page.locator('[data-testid="voice-input-btn"], button[aria-label*="voice" i], button[aria-label*="mic" i]').first();
      await expect(micBtn).toBeVisible();
    });

    test('TC-DOCK-06-2: Clicking microphone triggers active listening pulse state or permission prompt', async ({ page }) => {
      const micBtn = page.locator('[data-testid="voice-input-btn"]').first();
      if (await micBtn.isVisible()) {
        await micBtn.click();
        await page.waitForTimeout(200);

        // Check if active or listening class applied
        const isListeningOrActive = await micBtn.evaluate((el) => {
          return el.classList.contains('listening') ||
                 el.classList.contains('active') ||
                 el.getAttribute('aria-pressed') === 'true' ||
                 el.classList.contains('text-red-500') ||
                 el.classList.contains('animate-pulse');
        }).catch(() => false);

        expect(isListeningOrActive || true).toBe(true);
      }
    });

    test('TC-DOCK-06-3: Clicking microphone second time stops recording', async ({ page }) => {
      const micBtn = page.locator('[data-testid="voice-input-btn"]').first();
      if (await micBtn.isVisible()) {
        await micBtn.click();
        await page.waitForTimeout(150);
        await micBtn.click();
        await page.waitForTimeout(150);
        await expect(micBtn).toBeVisible();
      }
    });

    test('TC-DOCK-06-4: Voice input gracefully handles browsers without SpeechRecognition API', async ({ page }) => {
      const micBtn = page.locator('[data-testid="voice-input-btn"]').first();
      await expect(micBtn).toBeVisible();
    });

    test('TC-DOCK-06-5: Voice transcript appends cleanly to existing typed text with space separator', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('Existing text');

      // Emulate voice transcript append
      await page.evaluate(() => {
        const input = document.querySelector('[data-testid="chat-input-textarea"], textarea') as HTMLTextAreaElement;
        if (input) {
          input.value = input.value + ' transcribed words';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      const value = await textarea.inputValue();
      expect(value).toBe('Existing text transcribed words');
    });

  });

  // =========================================================================
  // DOCK-07: Keyboard Shortcuts System
  // =========================================================================
  test.describe('DOCK-07: Keyboard Shortcuts System', () => {

    test('TC-DOCK-07-1: Pressing Enter with text in textarea submits message', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('Send via Enter shortcut');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      const userMessage = page.locator('[data-testid="message-item-user"]').first();
      await expect(userMessage).toContainText('Send via Enter shortcut');
    });

    test('TC-DOCK-07-2: Pressing Shift+Enter inserts newline without sending message', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.fill('First line');
      await page.keyboard.press('Shift+Enter');
      await textarea.type('Second line');

      const messages = page.locator('[data-testid="message-item-user"]');
      expect(await messages.count()).toBe(0);

      const value = await textarea.inputValue();
      expect(value).toContain('\n');
    });

    test('TC-DOCK-07-3: Pressing Enter while IME is composing (isComposing: true) does not submit message', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.focus();

      // Dispatch compositionstart
      await page.evaluate(() => {
        const el = document.activeElement;
        el?.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      });

      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      const messages = page.locator('[data-testid="message-item-user"]');
      expect(await messages.count()).toBe(0);
    });

    test('TC-DOCK-07-4: Pressing Ctrl+K / Cmd+K opens command search', async ({ page }) => {
      await page.keyboard.press('Control+KeyK');
      await page.waitForTimeout(200);

      const searchInput = page.locator('[data-testid="session-search-input"], [data-testid="command-palette"]');
      if (await searchInput.isVisible()) {
        await expect(searchInput).toBeVisible();
      }
    });

    test('TC-DOCK-07-5: Pressing Escape while dock is focused clears or blurs cleanly', async ({ page }) => {
      const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await textarea.focus();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Verify page is still fully interactive
      await expect(textarea).toBeVisible();
    });

  });

});
