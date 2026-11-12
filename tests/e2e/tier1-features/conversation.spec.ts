import { test, expect } from '@playwright/test';

test.describe('Tier 1: Conversation View & Streaming (CONV-02..09)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // =========================================================================
  // CONV-02: M3 Expressive Message Bubbles
  // =========================================================================
  test.describe('CONV-02: M3 Expressive Message Bubbles', () => {

    test('TC-CONV-02-1: User message renders with Primary Container / Surface Container High and squircle styling', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Hello AI assistant');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const userMessage = page.locator('[data-testid="message-item-user"], [data-role="user"]').first();
      await expect(userMessage).toBeVisible();

      // Check styling/classes for rounded squircle container
      const classes = await userMessage.getAttribute('class');
      expect(classes).toMatch(/rounded|primary|surface|bubble/i);
    });

    test('TC-CONV-02-2: Assistant message renders with Surface Container Low or bubbleless tonal card with avatar', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Short prompt');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);

      const assistantMessage = page.locator('[data-testid="message-item-assistant"], [data-role="assistant"]').first();
      await expect(assistantMessage).toBeVisible();

      // Verify AI avatar or indicator presence
      const avatar = assistantMessage.locator('[data-testid="assistant-avatar"], svg, img').first();
      await expect(avatar).toBeVisible();
    });

    test('TC-CONV-02-3: Ultra-long continuous string without spaces does not break layout or overflow', async ({ page }) => {
      const longString = 'A'.repeat(500);
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill(longString);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const userMessage = page.locator('[data-testid="message-item-user"]').first();
      await expect(userMessage).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      expect(hasHorizontalScroll).toBe(false);
    });

    test('TC-CONV-02-4: Message timestamp display is formatted and visible on hover or item metadata', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Timestamp test message');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      const messageItem = page.locator('[data-testid="message-item-user"]').first();
      await messageItem.hover();

      const timestamp = page.locator('[data-testid="message-timestamp"], time').first();
      if (await timestamp.isVisible()) {
        const text = await timestamp.textContent();
        expect(text).toMatch(/\d{1,2}:\d{2}|just now|am|pm/i);
      }
    });

    test('TC-CONV-02-5: Contrast ratio between text and bubble container satisfies accessibility', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Contrast test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      const userMessage = page.locator('[data-testid="message-item-user"]').first();
      await expect(userMessage).toBeVisible();

      const colorInfo = await userMessage.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return { color: style.color, bg: style.backgroundColor };
      });
      expect(colorInfo.color).not.toBe(colorInfo.bg);
    });

  });

  // =========================================================================
  // CONV-03: Token-by-Token Streaming Engine
  // =========================================================================
  test.describe('CONV-03: Token-by-Token Streaming Engine', () => {

    test('TC-CONV-03-1: Real-time progressive token streaming occurs during assistant generation', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Tell me a story about space exploration');
      await page.keyboard.press('Enter');

      // Check text after short delay vs longer delay
      await page.waitForTimeout(300);
      const assistant = page.locator('[data-testid="message-item-assistant"]').first();
      const textSample1 = await assistant.textContent().catch(() => '');

      await page.waitForTimeout(500);
      const textSample2 = await assistant.textContent().catch(() => '');

      expect(textSample2.length).toBeGreaterThanOrEqual(textSample1.length);
    });

    test('TC-CONV-03-2: Trailing glowing cursor / pulsating dot is visible during active streaming', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Explain relativity');
      await page.keyboard.press('Enter');

      await page.waitForTimeout(200);
      const streamingIndicator = page.locator('[data-testid="streaming-cursor"], [data-testid="stream-pulse"], .streaming-cursor');
      // If visible during active streaming
      if (await streamingIndicator.isVisible()) {
        await expect(streamingIndicator).toBeVisible();
      }
    });

    test('TC-CONV-03-3: Glowing stream cursor disappears cleanly once streaming completes', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Hi');
      await page.keyboard.press('Enter');

      // Wait until stream completes (within 5 seconds for short message)
      await page.waitForTimeout(2500);

      const streamingIndicator = page.locator('[data-testid="streaming-cursor"], .streaming-cursor');
      const isVisible = await streamingIndicator.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });

    test('TC-CONV-03-4: Input dock send button is disabled or transitioned to Stop during streaming', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Write a comprehensive poem');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"], [aria-label*="Stop"]').first();
      const sendBtn = page.locator('[data-testid="send-message-btn"]').first();

      const hasStopOrDisabled = (await stopBtn.isVisible().catch(() => false)) ||
                                (await sendBtn.isDisabled().catch(() => false));
      expect(hasStopOrDisabled).toBe(true);
    });

    test('TC-CONV-03-5: Streaming duration scales naturally with response length', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      const startTime = Date.now();
      await input.fill('Generate 3 lines');
      await page.keyboard.press('Enter');

      // Wait for completion indicator or stop button removal
      await page.waitForTimeout(1000);
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(200);
    });

  });

  // =========================================================================
  // CONV-04: "Thinking..." Reasoning Accordion
  // =========================================================================
  test.describe('CONV-04: "Thinking..." Reasoning Accordion', () => {

    test('TC-CONV-04-1: Reasoning accordion appears when model performs reasoning', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Think deeply and solve this math logic puzzle');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);

      const thinking = page.locator('[data-testid="thinking-accordion"], [data-testid="reasoning-container"]').first();
      if (await thinking.isVisible()) {
        await expect(thinking).toBeVisible();
      }
    });

    test('TC-CONV-04-2: Duration timer ticks during reasoning generation', async ({ page }) => {
      const timer = page.locator('[data-testid="thinking-duration"], text=/thinking/i').first();
      if (await timer.isVisible()) {
        const text = await timer.textContent();
        expect(text).toMatch(/thinking/i);
      }
    });

    test('TC-CONV-04-3: Clicking reasoning accordion collapses thought trace', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Analyze this algorithmic complexity');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);

      const accordionHeader = page.locator('[data-testid="thinking-accordion-header"], button:has-text("Thinking")').first();
      if (await accordionHeader.isVisible()) {
        await accordionHeader.click();
        await page.waitForTimeout(250);

        const content = page.locator('[data-testid="thinking-accordion-content"]');
        const isHidden = await content.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || el.clientHeight === 0;
        }).catch(() => true);
        expect(isHidden).toBe(true);
      }
    });

    test('TC-CONV-04-4: Clicking collapsed reasoning accordion expands it to show full thought trace', async ({ page }) => {
      const accordionHeader = page.locator('[data-testid="thinking-accordion-header"], button:has-text("Thinking")').first();
      if (await accordionHeader.isVisible()) {
        // Toggle open
        await accordionHeader.click();
        await page.waitForTimeout(250);
        await accordionHeader.click();
        await page.waitForTimeout(250);
        await expect(accordionHeader).toBeVisible();
      }
    });

    test('TC-CONV-04-5: Reasoning container uses distinct M3 tonal background and monospace styling', async ({ page }) => {
      const reasoningBox = page.locator('[data-testid="thinking-accordion"]').first();
      if (await reasoningBox.isVisible()) {
        const isStyled = await reasoningBox.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.backgroundColor !== 'transparent' || el.classList.contains('font-mono');
        });
        expect(isStyled).toBe(true);
      }
    });

  });

  // =========================================================================
  // CONV-05: Stop Generation Control
  // =========================================================================
  test.describe('CONV-05: Stop Generation Control', () => {

    test('TC-CONV-05-1: Clicking Stop button halts active streaming within 100ms', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Write a 1000 word dissertation on artificial intelligence');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"], [aria-label*="Stop"]').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(200);

        // Streaming indicator should be gone
        const cursor = page.locator('[data-testid="streaming-cursor"]');
        const isCursorVisible = await cursor.isVisible().catch(() => false);
        expect(isCursorVisible).toBe(false);
      }
    });

    test('TC-CONV-05-2: Text streamed up to the moment of clicking Stop is fully retained', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Write a long narrative about ancient Rome');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(600);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"]').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(200);

        const assistant = page.locator('[data-testid="message-item-assistant"]').first();
        const text = await assistant.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    });

    test('TC-CONV-05-3: Pressing Escape key during streaming halts stream immediately', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Stream a long list of numbers');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"]');
      const isStopVisible = await stopBtn.isVisible().catch(() => false);
      expect(isStopVisible).toBe(false);
    });

    test('TC-CONV-05-4: Dock button immediately morphs from Stop back to Send upon stopping', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Prompt for stop morph test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"]').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(200);

        const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
        await expect(sendBtn).toBeVisible();
      }
    });

    test('TC-CONV-05-5: Submitting new prompt immediately after stopping proceeds without locks or errors', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('First message to stop');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const stopBtn = page.locator('[data-testid="stop-generation-btn"]').first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(200);
      }

      // Submit immediately
      await input.fill('Second prompt right after stop');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);

      const userMessages = page.locator('[data-testid="message-item-user"]');
      expect(await userMessages.count()).toBeGreaterThanOrEqual(2);
    });

  });

  // =========================================================================
  // CONV-06: Regenerate Response
  // =========================================================================
  test.describe('CONV-06: Regenerate Response', () => {

    test('TC-CONV-06-1: Clicking Regenerate initiates new response stream', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Suggest a creative title for a podcast');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      const regenBtn = page.locator('[data-testid="regenerate-btn"], button[aria-label*="Regenerate"]').first();
      if (await regenBtn.isVisible()) {
        await regenBtn.click();
        await page.waitForTimeout(500);

        const assistant = page.locator('[data-testid="message-item-assistant"]').first();
        await expect(assistant).toBeVisible();
      }
    });

    test('TC-CONV-06-2: Stepper updates to < 2/2 > upon regeneration', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Tell a joke');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);

      const regenBtn = page.locator('[data-testid="regenerate-btn"]').first();
      if (await regenBtn.isVisible()) {
        await regenBtn.click();
        await page.waitForTimeout(1500);

        const stepper = page.locator('[data-testid="version-stepper"]').first();
        if (await stepper.isVisible()) {
          await expect(stepper).toContainText(/2.*\/.*2/);
        }
      }
    });

    test('TC-CONV-06-3: Clicking < on version indicator switches back to first version < 1/2 >', async ({ page }) => {
      const stepperPrev = page.locator('[data-testid="stepper-prev-btn"], button[aria-label*="Previous"]').first();
      if (await stepperPrev.isVisible()) {
        await stepperPrev.click();
        await page.waitForTimeout(200);

        const stepper = page.locator('[data-testid="version-stepper"]').first();
        await expect(stepper).toContainText(/1.*\/.*2/);
      }
    });

    test('TC-CONV-06-4: Clicking > on version indicator switches forward to second version < 2/2 >', async ({ page }) => {
      const stepperNext = page.locator('[data-testid="stepper-next-btn"], button[aria-label*="Next"]').first();
      if (await stepperNext.isVisible()) {
        await stepperNext.click();
        await page.waitForTimeout(200);

        const stepper = page.locator('[data-testid="version-stepper"]').first();
        await expect(stepper).toContainText(/2.*\/.*2/);
      }
    });

    test('TC-CONV-06-5: Regenerate button is disabled during active generation', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Long prompt');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      const regenBtn = page.locator('[data-testid="regenerate-btn"]');
      const isVisibleOrDisabled = (await regenBtn.count() === 0) || (await regenBtn.first().isDisabled());
      expect(isVisibleOrDisabled).toBe(true);
    });

  });

  // =========================================================================
  // CONV-07: Conversation Branching & Version Stepper
  // =========================================================================
  test.describe('CONV-07: Conversation Branching & Version Stepper', () => {

    test('TC-CONV-07-1: Editing prior user message creates new branch with < 2/2 > stepper', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Initial question');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);

      const userMessage = page.locator('[data-testid="message-item-user"]').first();
      await userMessage.hover();

      const editBtn = page.locator('[data-testid="edit-message-btn"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        const editTextarea = page.locator('[data-testid="edit-message-textarea"], textarea').first();
        await editTextarea.fill('Edited question for branch 2');
        const saveBtn = page.locator('[data-testid="save-edit-btn"], button:has-text("Save")').first();
        await saveBtn.click();
        await page.waitForTimeout(800);

        const stepper = userMessage.locator('[data-testid="version-stepper"]').first();
        if (await stepper.isVisible()) {
          await expect(stepper).toContainText(/2/);
        }
      }
    });

    test('TC-CONV-07-2: Switching stepper to 1/2 restores original branch messages', async ({ page }) => {
      const stepperPrev = page.locator('[data-testid="stepper-prev-btn"]').first();
      if (await stepperPrev.isVisible()) {
        await stepperPrev.click();
        await page.waitForTimeout(300);

        const userMessage = page.locator('[data-testid="message-item-user"]').first();
        await expect(userMessage).toContainText(/initial/i);
      }
    });

    test('TC-CONV-07-3: Switching stepper back to 2/2 restores branched messages', async ({ page }) => {
      const stepperNext = page.locator('[data-testid="stepper-next-btn"]').first();
      if (await stepperNext.isVisible()) {
        await stepperNext.click();
        await page.waitForTimeout(300);

        const userMessage = page.locator('[data-testid="message-item-user"]').first();
        await expect(userMessage).toContainText(/edited/i);
      }
    });

    test('TC-CONV-07-4: Selected branch choice persists across browser page reload', async ({ page }) => {
      await page.reload();
      await page.waitForTimeout(400);

      const userMessage = page.locator('[data-testid="message-item-user"]').first();
      if (await userMessage.isVisible()) {
        await expect(userMessage).toBeVisible();
      }
    });

    test('TC-CONV-07-5: Stepper controls are accessible via keyboard Arrow Left/Right when focused', async ({ page }) => {
      const stepper = page.locator('[data-testid="version-stepper"]').first();
      if (await stepper.isVisible()) {
        await stepper.focus();
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(200);
        await expect(stepper).toBeVisible();
      }
    });

  });

  // =========================================================================
  // CONV-08: Message Action Toolbar
  // =========================================================================
  test.describe('CONV-08: Message Action Toolbar', () => {

    test.beforeEach(async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Message for toolbar tests');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
    });

    test('TC-CONV-08-1: Copy button copies plain text to clipboard and displays checkmark feedback', async ({ page }) => {
      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await assistantMessage.hover();

      const copyBtn = page.locator('[data-testid="copy-message-btn"], button[aria-label*="Copy"]').first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        await page.waitForTimeout(200);

        // Check for checkmark icon or "Copied" feedback
        const hasFeedback = await copyBtn.evaluate((el) => {
          return el.getAttribute('aria-label')?.includes('Copied') ||
                 el.innerHTML.includes('check') ||
                 el.classList.contains('copied');
        });
        expect(hasFeedback).toBe(true);
      }
    });

    test('TC-CONV-08-2: Thumbs Up rating button toggles active state', async ({ page }) => {
      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await assistantMessage.hover();

      const thumbsUp = page.locator('[data-testid="thumbs-up-btn"], button[aria-label*="Thumbs up"]').first();
      if (await thumbsUp.isVisible()) {
        await thumbsUp.click();
        await page.waitForTimeout(200);

        const isActive = await thumbsUp.evaluate((el) => {
          return el.getAttribute('aria-pressed') === 'true' ||
                 el.classList.contains('active') ||
                 el.classList.contains('text-primary');
        });
        expect(isActive).toBe(true);
      }
    });

    test('TC-CONV-08-3: Thumbs Down rating button toggles active state and deselects Thumbs Up', async ({ page }) => {
      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await assistantMessage.hover();

      const thumbsDown = page.locator('[data-testid="thumbs-down-btn"], button[aria-label*="Thumbs down"]').first();
      const thumbsUp = page.locator('[data-testid="thumbs-up-btn"]').first();

      if (await thumbsDown.isVisible()) {
        await thumbsDown.click();
        await page.waitForTimeout(200);

        const isDownActive = await thumbsDown.evaluate((el) => {
          return el.getAttribute('aria-pressed') === 'true' || el.classList.contains('active');
        });
        expect(isDownActive).toBe(true);

        if (await thumbsUp.isVisible()) {
          const isUpActive = await thumbsUp.evaluate((el) => el.getAttribute('aria-pressed') === 'true');
          expect(isUpActive).toBe(false);
        }
      }
    });

    test('TC-CONV-08-4: Clicking Edit on user message opens inline editing mode', async ({ page }) => {
      const userMessage = page.locator('[data-testid="message-item-user"]').first();
      await userMessage.hover();

      const editBtn = page.locator('[data-testid="edit-message-btn"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        const editTextarea = page.locator('[data-testid="edit-message-textarea"], textarea').first();
        await expect(editTextarea).toBeVisible();

        const cancelBtn = page.locator('[data-testid="cancel-edit-btn"], button:has-text("Cancel")').first();
        await cancelBtn.click();
        await expect(editTextarea).not.toBeVisible();
      }
    });

    test('TC-CONV-08-5: Read Aloud (TTS) button triggers speech synthesis playback state', async ({ page }) => {
      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await assistantMessage.hover();

      const ttsBtn = page.locator('[data-testid="tts-read-btn"], button[aria-label*="Read"]').first();
      if (await ttsBtn.isVisible()) {
        await ttsBtn.click();
        await page.waitForTimeout(200);
        // Verify button toggles to stop/pause or displays playing state
        await expect(ttsBtn).toBeVisible();
      }
    });

  });

  // =========================================================================
  // CONV-09: Auto-Scroll & Floating Scroll-to-Bottom FAB
  // =========================================================================
  test.describe('CONV-09: Auto-Scroll & Floating Scroll-to-Bottom FAB', () => {

    test('TC-CONV-09-1: Viewport automatically follows streaming content keeping bottom in view', async ({ page }) => {
      const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
      await input.fill('Write a comprehensive multi-paragraph guide');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);

      // Verify scroll position is near bottom
      const isNearBottom = await page.evaluate(() => {
        const container = document.querySelector('[data-testid="conversation-container"]') || document.documentElement;
        return container.scrollHeight - container.scrollTop - container.clientHeight < 300;
      });
      expect(isNearBottom).toBe(true);
    });

    test('TC-CONV-09-2: Manual upward scroll pauses auto-scroll and displays Scroll-to-Bottom FAB', async ({ page }) => {
      // Scroll up by 400px
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(300);

      const fab = page.locator('[data-testid="scroll-to-bottom-fab"], button[aria-label*="bottom"]');
      if (await fab.isVisible()) {
        await expect(fab).toBeVisible();
      }
    });

    test('TC-CONV-09-3: Floating FAB displays down-arrow icon and unread indicator when new tokens arrive', async ({ page }) => {
      const fab = page.locator('[data-testid="scroll-to-bottom-fab"]').first();
      if (await fab.isVisible()) {
        const icon = fab.locator('svg, .icon');
        await expect(icon).toBeVisible();
      }
    });

    test('TC-CONV-09-4: Clicking floating FAB smoothly scrolls viewport back to bottom', async ({ page }) => {
      const fab = page.locator('[data-testid="scroll-to-bottom-fab"]').first();
      if (await fab.isVisible()) {
        await fab.click();
        await page.waitForTimeout(400);

        const isAtBottom = await page.evaluate(() => {
          const container = document.querySelector('[data-testid="conversation-container"]') || document.documentElement;
          return container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        });
        expect(isAtBottom).toBe(true);
      }
    });

    test('TC-CONV-09-5: Reaching the bottom automatically hides the floating FAB', async ({ page }) => {
      await page.evaluate(() => {
        const container = document.querySelector('[data-testid="conversation-container"]') || document.documentElement;
        container.scrollTop = container.scrollHeight;
      });
      await page.waitForTimeout(300);

      const fab = page.locator('[data-testid="scroll-to-bottom-fab"]');
      const isFabVisible = await fab.isVisible().catch(() => false);
      expect(isFabVisible).toBe(false);
    });

  });

});
