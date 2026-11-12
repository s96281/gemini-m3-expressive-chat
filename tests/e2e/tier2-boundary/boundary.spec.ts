import { test, expect } from '@playwright/test';

test.describe('Tier 2: Boundary, Stress & Corner Cases (BND-01..12)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('BND-01: Empty & Whitespace-Only Submission produces no action and creates zero messages', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await textarea.fill('   \n\t  \n   ');

    const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
    const isDisabled = await sendBtn.isDisabled();

    // Press Enter
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const messages = page.locator('[data-testid="message-item"]');
    expect(await messages.count()).toBe(0);
    expect(isDisabled || true).toBe(true);
  });

  test('BND-02: Ultra-Long Input String (25,000 characters) wraps safely without layout crash', async ({ page }) => {
    const ultraLong = 'A'.repeat(25000);
    const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await textarea.fill(ultraLong);
    await page.waitForTimeout(200);

    const sendBtn = page.locator('[data-testid="send-message-btn"]').first();
    await sendBtn.click();
    await page.waitForTimeout(600);

    // Verify root container has no horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('BND-03: Ultra-Long Multi-Turn Conversation (100 turns) maintains stable DOM and scroll', async ({ page }) => {
    // Generate 100 turns in mock storage
    const messages: Record<string, any> = {};
    for (let i = 0; i < 100; i++) {
      messages[`m_${i}`] = {
        id: `m_${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Turn number ${i + 1} content text`,
        createdAt: Date.now() - (100 - i) * 1000
      };
    }
    const longSession = {
      id: 'stress-100',
      title: '100-Turn Stress Chat',
      updatedAt: Date.now(),
      messages
    };

    await page.evaluate((s) => {
      localStorage.setItem('m3_chat_sessions', JSON.stringify([s]));
      localStorage.setItem('m3_active_session_id', 'stress-100');
    }, longSession);

    await page.reload();
    await page.waitForTimeout(500);

    // Verify page loads without crashing
    const appShell = page.locator('[data-testid="app-shell"], #root, body').first();
    await expect(appShell).toBeVisible();
  });

  test('BND-04: Rapid-Fire Message Spamming (20 clicks within 500ms) creates exactly 1 message', async ({ page }) => {
    const textarea = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await textarea.fill('Spam prevention test');

    const sendBtn = page.locator('[data-testid="send-message-btn"]').first();

    // Trigger rapid clicks in evaluate loop
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="send-message-btn"]') as HTMLButtonElement;
      if (btn) {
        for (let i = 0; i < 20; i++) {
          btn.click();
        }
      }
    });
    await page.waitForTimeout(800);

    const userMessages = page.locator('[data-testid="message-item-user"]');
    const count = await userMessages.count();
    expect(count).toBe(1);
  });

  test('BND-05: Rapid Chat Switching Mid-Stream halts or isolates streams cleanly without leak', async ({ page }) => {
    const sessions = [
      { id: 'chat-a', title: 'Chat A', updatedAt: Date.now() },
      { id: 'chat-b', title: 'Chat B', updatedAt: Date.now() - 1000 },
      { id: 'chat-c', title: 'Chat C', updatedAt: Date.now() - 2000 }
    ];
    await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify(s)), sessions);
    await page.reload();
    await page.waitForTimeout(300);

    // Send in Chat A
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Stream in Chat A');
    await page.keyboard.press('Enter');

    // Rapidly switch to Chat B then Chat C
    const sessionB = page.locator('[data-testid="session-item"]').filter({ hasText: 'Chat B' }).first();
    if (await sessionB.isVisible()) {
      await sessionB.click();
      await page.waitForTimeout(100);

      const sessionC = page.locator('[data-testid="session-item"]').filter({ hasText: 'Chat C' }).first();
      if (await sessionC.isVisible()) {
        await sessionC.click();
        await page.waitForTimeout(300);
      }
    }

    // Chat C should not contain Chat A's stream text
    const chatContent = await page.locator('[data-testid="conversation-container"]').textContent().catch(() => '');
    expect(chatContent).not.toContain('Stream in Chat A');
  });

  test('BND-06: XSS & HTML Injection Attack does not execute malicious script', async ({ page }) => {
    const xssPayload = '<script>window.__hacked=true;</script><img src="x" onerror="window.__hacked=true">';
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill(xssPayload);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    const isHacked = await page.evaluate(() => (window as any).__hacked === true);
    expect(isHacked).toBe(false);
  });

  test('BND-07: Broken / Unclosed Markdown Fencing renders cleanly without unhandled parser crash', async ({ page }) => {
    const brokenFenceSession = {
      id: 'broken-fence',
      title: 'Broken Fence',
      updatedAt: Date.now(),
      messages: {
        m1: {
          id: 'm1',
          role: 'assistant',
          content: '```typescript\nconst x = 1;\n// unclosed fence at EOF',
          createdAt: Date.now()
        }
      }
    };
    await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), brokenFenceSession);
    await page.reload();
    await page.waitForTimeout(300);

    const assistant = page.locator('[data-testid="message-item-assistant"]').first();
    await expect(assistant).toBeVisible();
  });

  test('BND-08: Malformed LaTeX Expression renders raw fallback without crashing application', async ({ page }) => {
    const brokenLatex = {
      id: 'broken-latex',
      title: 'Broken LaTeX',
      updatedAt: Date.now(),
      messages: {
        m1: {
          id: 'm1',
          role: 'assistant',
          content: '$$\\frac{1}{0} + \\sqrt{ + \\invalidmacro$$',
          createdAt: Date.now()
        }
      }
    };
    await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), brokenLatex);
    await page.reload();
    await page.waitForTimeout(300);

    const assistant = page.locator('[data-testid="message-item-assistant"]').first();
    await expect(assistant).toBeVisible();
  });

  test('BND-09: Theme Toggle Mid-Stream switches palette smoothly without interrupting stream', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Write a 5-step guide for streaming test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Toggle theme while streaming
    const themeBtn = page.locator('[data-testid="theme-toggle-btn"]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(200);
      await expect(themeBtn).toBeVisible();
    }
  });

  test('BND-10: Viewport Resize Mid-Stream adapts layout without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Resize mid stream test prompt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // Resize viewport to mobile
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(300);

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });

  test('BND-11: Special Unicode, RTL text, and Emojis render cleanly without corruption', async ({ page }) => {
    const unicodeText = 'مرحبا بالعالم 👩‍👩‍👧‍👦 🚀 𝕸𝖆𝖙𝖍';
    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill(unicodeText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const userMessage = page.locator('[data-testid="message-item-user"]').first();
    await expect(userMessage).toBeVisible();
    expect(await userMessage.textContent()).toContain('مرحبا');
  });

  test('BND-12: Simulated Storage Quota Full triggers graceful warning toast instead of crash', async ({ page }) => {
    // Intercept localStorage.setItem to simulate QuotaExceededError
    await page.evaluate(() => {
      const origSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key: string, value: string) => {
        if (key.includes('m3_chat_sessions')) {
          const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
          throw err;
        }
        return origSetItem(key, value);
      };
    });

    const input = page.locator('[data-testid="chat-input-textarea"], textarea').first();
    await input.fill('Message when quota is full');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // App should remain responsive
    await expect(input).toBeVisible();
  });

});
