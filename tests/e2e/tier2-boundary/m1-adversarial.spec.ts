import { test, expect } from '@playwright/test';

test.describe('Milestone 1 Adversarial Challenge Suite (Challenger 2)', () => {
  let jsErrors: string[] = [];
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    jsErrors = [];
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        if (!msg.text().includes('ERR_CERT_AUTHORITY_INVALID')) {
          jsErrors.push(msg.text());
        }
      }
    });
    page.on('pageerror', (err) => {
      jsErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // Assert zero JavaScript / React runtime errors occurred
    expect(jsErrors).toEqual([]);
  });

  // =========================================================================
  // 1. Stress-test drawer toggle interactions
  // =========================================================================
  test.describe('1. Drawer Toggle Stress & Interaction Invariants', () => {

    test('ADV-M1-01: Rapid-fire clicking sidebar toggle button (30 clicks) maintains DOM stability and strict state consistency', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      await expect(toggleBtn).toBeVisible();

      // Read initial state
      const initialAriaExpanded = await toggleBtn.getAttribute('aria-expanded');
      expect(initialAriaExpanded).toBe('true');

      // Click rapidly 30 times (even count)
      for (let i = 0; i < 30; i++) {
        await toggleBtn.click();
      }

      await page.waitForTimeout(350);

      // After 30 toggles, state should return to initial ('true')
      const finalAriaExpanded = await toggleBtn.getAttribute('aria-expanded');
      expect(finalAriaExpanded).toBe('true');

      // Navigation drawer should be visible
      const drawer = page.locator('[data-testid="navigation-drawer"]');
      await expect(drawer).toBeVisible();

      // Now click 1 more time (odd count)
      await toggleBtn.click();
      await page.waitForTimeout(350);

      const oddAriaExpanded = await toggleBtn.getAttribute('aria-expanded');
      expect(oddAriaExpanded).toBe('false');

      // Navigation rail should now be visible
      const rail = page.locator('[data-testid="navigation-rail"]');
      await expect(rail).toBeVisible();
    });

    test('ADV-M1-02: Keyboard shortcut Ctrl+[ and Cmd+[ toggles drawer cleanly', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      const drawer = page.locator('[data-testid="navigation-drawer"]');
      const rail = page.locator('[data-testid="navigation-rail"]');

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('true');
      await expect(drawer).toBeVisible();

      // Press Ctrl+[
      await page.keyboard.press('Control+BracketLeft');
      await page.waitForTimeout(350);

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');
      await expect(rail).toBeVisible();

      // Press Ctrl+[ again to reopen
      await page.keyboard.press('Control+BracketLeft');
      await page.waitForTimeout(350);

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('true');
      await expect(drawer).toBeVisible();

      // Press Meta+[ (Command on macOS)
      await page.keyboard.press('Meta+BracketLeft');
      await page.waitForTimeout(350);

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');
      await expect(rail).toBeVisible();

      // Typing '[' alone in the textarea must NOT toggle sidebar
      const textarea = page.locator('[data-testid="chat-input-textarea"]');
      await textarea.focus();
      await page.keyboard.press('BracketLeft');
      await page.waitForTimeout(200);

      // Sidebar should still be closed ('false')
      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');
      expect(await textarea.inputValue()).toBe('[');
    });

    test('ADV-M1-03: ESC key dismisses drawer on mobile viewport (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      const drawer = page.locator('[data-testid="navigation-drawer"]');
      const scrim = page.locator('[data-testid="drawer-scrim"]');

      // Drawer is initially hidden on mobile
      await expect(toggleBtn).toBeVisible();
      const isDrawerOpenInit = await toggleBtn.getAttribute('aria-expanded');
      expect(isDrawerOpenInit).toBe('false');

      // Open drawer via toggle button
      await toggleBtn.click();
      await page.waitForTimeout(350);

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('true');
      await expect(scrim).toBeVisible();
      await expect(drawer).toBeVisible();

      // Press ESC key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);

      // Scrim should now be hidden
      const isScrimHidden = await scrim.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || el.classList.contains('pointer-events-none');
      });
      expect(isScrimHidden).toBe(true);

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');

      // Pressing ESC again when drawer is already closed should NOT throw or alter state
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');
    });

    test('ADV-M1-04: Backdrop scrim click dismisses drawer on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      const scrim = page.locator('[data-testid="drawer-scrim"]');

      // Open drawer
      await toggleBtn.click();
      await page.waitForTimeout(350);
      await expect(scrim).toBeVisible();

      // Click on backdrop outside the 280px drawer (e.g. x=340, y=200)
      await scrim.click({ position: { x: 340, y: 200 } });
      await page.waitForTimeout(350);

      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');
    });

  });

  // =========================================================================
  // 2. ZeroState starter cards trigger prompt callbacks cleanly
  // =========================================================================
  test.describe('2. ZeroState Starter Cards Callback & Resilience', () => {

    test('ADV-M1-05: All 4 starter cards populate textarea cleanly without exceptions', async ({ page }) => {
      await page.goto('/');

      const textarea = page.locator('[data-testid="chat-input-textarea"]');
      await expect(textarea).toBeVisible();
      expect(await textarea.inputValue()).toBe('');

      const cards = [
        { id: 'starter-card-code', keyword: 'React hook' },
        { id: 'starter-card-brainstorm', keyword: 'innovative features' },
        { id: 'starter-card-write', keyword: 'blog post' },
        { id: 'starter-card-analyze', keyword: 'architectural trade-offs' },
      ];

      for (const card of cards) {
        const cardLocator = page.locator(`[data-testid="${card.id}"]`);
        await expect(cardLocator).toBeVisible();
        await cardLocator.click();

        const currentVal = await textarea.inputValue();
        expect(currentVal).toContain(card.keyword);
      }
    });

    test('ADV-M1-06: Rapid alternating clicks across starter cards trigger prompt callbacks cleanly', async ({ page }) => {
      await page.goto('/');

      const textarea = page.locator('[data-testid="chat-input-textarea"]');

      // Alternating clicks rapidly
      for (let i = 0; i < 3; i++) {
        await page.locator('[data-testid="starter-card-code"]').click();
        await page.locator('[data-testid="starter-card-brainstorm"]').click();
        await page.locator('[data-testid="starter-card-write"]').click();
        await page.locator('[data-testid="starter-card-analyze"]').click();
      }

      await page.waitForTimeout(100);

      // Final prompt should match the last clicked card (analyze)
      const finalVal = await textarea.inputValue();
      expect(finalVal).toContain('architectural trade-offs');
    });

    test('ADV-M1-07: Selecting prompt and submitting creates session and resets input cleanly', async ({ page }) => {
      await page.goto('/');

      const textarea = page.locator('[data-testid="chat-input-textarea"]');
      await page.locator('[data-testid="starter-card-code"]').click();

      expect((await textarea.inputValue()).length).toBeGreaterThan(0);

      // Submit via Enter
      await textarea.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      // Textarea should be reset
      expect(await textarea.inputValue()).toBe('');

      // Top bar title or session list should reflect the new session
      const topBar = page.locator('[data-testid="top-app-bar"]');
      await expect(topBar).toContainText(/Create a custom React/i);
    });

  });

  // =========================================================================
  // 3. DOM test attributes (data-testid, aria-expanded, aria-label)
  // =========================================================================
  test.describe('3. Strict DOM Test Attributes & Accessibility Invariants', () => {

    test('ADV-M1-08: Complete testid inventory verified on desktop', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      const requiredTestIds = [
        'app-shell',
        'top-app-bar',
        'sidebar-toggle-btn',
        'model-badge',
        'theme-toggle-btn',
        'settings-btn',
        'navigation-drawer',
        'new-chat-btn',
        'drawer-scrim',
        'zero-state-container',
        'zero-state-greeting',
        'starter-card-code',
        'starter-card-brainstorm',
        'starter-card-write',
        'starter-card-analyze',
        'chat-input-textarea',
      ];

      for (const id of requiredTestIds) {
        const el = page.locator(`[data-testid="${id}"]`);
        expect(await el.count(), `Expected [data-testid="${id}"] to exist in DOM`).toBeGreaterThan(0);
      }
    });

    test('ADV-M1-09: Navigation rail testid and aria attributes verified when drawer collapsed', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      // Collapse drawer
      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      await toggleBtn.click();
      await page.waitForTimeout(300);

      const rail = page.locator('[data-testid="navigation-rail"]');
      await expect(rail).toBeVisible();

      // Check rail FAB
      const railNewChat = page.locator('[data-testid="rail-new-chat-btn"]');
      await expect(railNewChat).toBeVisible();
      expect(await railNewChat.getAttribute('aria-label')).toBe('Start new chat');

      // Check rail accessibility
      expect(await rail.getAttribute('role')).toBe('navigation');
      expect(await rail.getAttribute('aria-label')).toBe('Compact navigation rail');
    });

    test('ADV-M1-10: ARIA labels and states conform to accessibility standards', async ({ page }) => {
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      const themeBtn = page.locator('[data-testid="theme-toggle-btn"]');
      const settingsBtn = page.locator('[data-testid="settings-btn"]');
      const drawer = page.locator('[data-testid="navigation-drawer"]');

      // aria-label checks
      const toggleLabel = await toggleBtn.getAttribute('aria-label');
      expect(toggleLabel).toBeTruthy();
      expect(['Close sidebar', 'Open sidebar']).toContain(toggleLabel);

      const themeLabel = await themeBtn.getAttribute('aria-label');
      expect(themeLabel).toMatch(/toggle theme mode/i);

      const settingsLabel = await settingsBtn.getAttribute('aria-label');
      expect(settingsLabel).toMatch(/settings/i);

      // role & aria-label on drawer
      expect(await drawer.getAttribute('role')).toBe('navigation');
      expect(await drawer.getAttribute('aria-label')).toBe('Chat navigation drawer');

      // aria-expanded synchronization check
      const isExpanded = await toggleBtn.getAttribute('aria-expanded');
      expect(isExpanded === 'true' || isExpanded === 'false').toBe(true);
    });

  });

  // =========================================================================
  // 4. Viewport resilience & Responsive boundary stress
  // =========================================================================
  test.describe('4. Viewport Resilience & Boundary Stress', () => {

    test('ADV-M1-11: Extreme narrow viewport (320px) renders without layout break or overflow', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/');

      const appShell = page.locator('[data-testid="app-shell"]');
      await expect(appShell).toBeVisible();

      const greeting = page.locator('[data-testid="zero-state-greeting"]');
      await expect(greeting).toBeVisible();

      const textarea = page.locator('[data-testid="chat-input-textarea"]');
      await expect(textarea).toBeVisible();

      // Verify no horizontal overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      expect(hasHorizontalOverflow).toBe(false);
    });

    test('ADV-M1-12: Dynamic resizing stress (1200 -> 360 -> 1200) maintains state consistency', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('true');

      // Resize down to mobile (360px)
      await page.setViewportSize({ width: 360, height: 640 });
      await page.waitForTimeout(200);

      // On mobile, drawer should be closed
      expect(await toggleBtn.getAttribute('aria-expanded')).toBe('false');

      // Resize back to desktop (1200px)
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(200);

      // App should remain fully operational
      const greeting = page.locator('[data-testid="zero-state-greeting"]');
      await expect(greeting).toBeVisible();
    });

  });

});
