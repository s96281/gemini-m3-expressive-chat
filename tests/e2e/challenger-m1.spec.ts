import { test, expect } from '@playwright/test';

// Exact RGB equivalents for token assertion
const EXPECTED_PALETTES = {
  ocean: {
    lightPrimary: 'rgb(11, 87, 208)',   // #0B57D0
    darkPrimary: 'rgb(168, 199, 250)',  // #A8C7FA
  },
  purple: {
    lightPrimary: 'rgb(103, 80, 164)',  // #6750A4
    darkPrimary: 'rgb(208, 188, 255)',  // #D0BCFF
  },
  emerald: {
    lightPrimary: 'rgb(0, 108, 76)',    // #006C4C
    darkPrimary: 'rgb(108, 219, 172)',  // #6CDBAC
  },
  rose: {
    lightPrimary: 'rgb(156, 65, 70)',   // #9C4146
    darkPrimary: 'rgb(255, 179, 180)',  // #FFB3B4
  },
  amber: {
    lightPrimary: 'rgb(126, 87, 0)',    // #7E5700
    darkPrimary: 'rgb(255, 186, 40)',   // #FFBA28
  },
} as const;

type SeedKey = keyof typeof EXPECTED_PALETTES;
const SEED_KEYS: SeedKey[] = ['ocean', 'purple', 'emerald', 'rose', 'amber'];

test.describe('Challenger Milestone 1: Empirical Verification & Stress Harness', () => {

  // =========================================================================
  // 1. ALL 5 SEED PALETTES IN LIGHT AND DARK MODES
  // =========================================================================
  test.describe('1. Theme Palette Switching across 5 seeds in Light and Dark', () => {
    for (const seed of SEED_KEYS) {
      test(`Verify palette "${seed}" in LIGHT mode matches M3 CSS token`, async ({ page }) => {
        await page.goto('/');
        await page.evaluate(({ s }) => {
          localStorage.setItem('m3_seed_color', s);
          localStorage.setItem('m3_theme_mode', 'light');
        }, { s: seed });

        await page.reload();
        await page.waitForTimeout(150);

        // Verify root attributes
        const rootAttrs = await page.evaluate(() => {
          const root = document.documentElement;
          return {
            dataSeed: root.getAttribute('data-seed'),
            dataMode: root.getAttribute('data-mode'),
            hasDarkClass: root.classList.contains('dark'),
          };
        });

        expect(rootAttrs.dataSeed).toBe(seed);
        expect(rootAttrs.dataMode).toBe('light');
        expect(rootAttrs.hasDarkClass).toBe(false);

        // Verify primary CSS variable
        const primaryColor = await page.evaluate(() => {
          return getComputedStyle(document.documentElement)
            .getPropertyValue('--md-sys-color-primary')
            .trim();
        });

        // Resolve hex to rgb if computed as hex
        const computedPrimary = await page.evaluate(() => {
          const dummy = document.createElement('div');
          dummy.style.color = 'var(--md-sys-color-primary)';
          document.body.appendChild(dummy);
          const rgb = getComputedStyle(dummy).color;
          dummy.remove();
          return rgb;
        });

        expect(computedPrimary).toBe(EXPECTED_PALETTES[seed].lightPrimary);
      });

      test(`Verify palette "${seed}" in DARK mode matches M3 CSS token`, async ({ page }) => {
        await page.goto('/');
        await page.evaluate(({ s }) => {
          localStorage.setItem('m3_seed_color', s);
          localStorage.setItem('m3_theme_mode', 'dark');
        }, { s: seed });

        await page.reload();
        await page.waitForTimeout(150);

        // Verify root attributes
        const rootAttrs = await page.evaluate(() => {
          const root = document.documentElement;
          return {
            dataSeed: root.getAttribute('data-seed'),
            dataMode: root.getAttribute('data-mode'),
            hasDarkClass: root.classList.contains('dark'),
          };
        });

        expect(rootAttrs.dataSeed).toBe(seed);
        expect(rootAttrs.dataMode).toBe('dark');
        expect(rootAttrs.hasDarkClass).toBe(true);

        // Verify primary CSS variable
        const computedPrimary = await page.evaluate(() => {
          const dummy = document.createElement('div');
          dummy.style.color = 'var(--md-sys-color-primary)';
          document.body.appendChild(dummy);
          const rgb = getComputedStyle(dummy).color;
          dummy.remove();
          return rgb;
        });

        expect(computedPrimary).toBe(EXPECTED_PALETTES[seed].darkPrimary);
      });
    }
  });

  // =========================================================================
  // 2. LOCALSTORAGE PERSISTENCE & CORRUPTION RECOVERY
  // =========================================================================
  test.describe('2. LocalStorage Persistence & Resilience Harness', () => {
    test('Persists customized theme seed and mode across multiple simulated reloads', async ({ page }) => {
      await page.goto('/');

      await page.evaluate(() => {
        localStorage.setItem('m3_seed_color', 'emerald');
        localStorage.setItem('m3_theme_mode', 'dark');
      });

      // First reload
      await page.reload();
      let seed = await page.evaluate(() => document.documentElement.getAttribute('data-seed'));
      let mode = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));
      expect(seed).toBe('emerald');
      expect(mode).toBe('dark');

      // Second reload
      await page.reload();
      seed = await page.evaluate(() => document.documentElement.getAttribute('data-seed'));
      mode = await page.evaluate(() => document.documentElement.getAttribute('data-mode'));
      expect(seed).toBe('emerald');
      expect(mode).toBe('dark');
    });

    test('Recovers gracefully to ocean and system defaults when localStorage is polluted with invalid data', async ({ page }) => {
      await page.goto('/');

      // Write corrupted garbage into localStorage
      await page.evaluate(() => {
        localStorage.setItem('m3_seed_color', 'neon-cyberpunk-yellow-9000');
        localStorage.setItem('m3_theme_mode', 'supernova-ultra-violet');
        localStorage.setItem('m3_sidebar_open', '{malformed json: true}');
      });

      await page.reload();
      await page.waitForTimeout(200);

      const appShell = page.locator('[data-testid="app-shell"]');
      await expect(appShell).toBeVisible();

      // Seed should fall back to ocean
      const recoveredSeed = await page.evaluate(() => document.documentElement.getAttribute('data-seed'));
      expect(recoveredSeed).toBe('ocean');
    });
  });

  // =========================================================================
  // 3. RESPONSIVE LAYOUT VERIFICATION ACROSS VIEWPORT BREAKPOINTS
  // =========================================================================
  test.describe('3. Responsive Layout across Breakpoints', () => {
    const testViewports = [
      { name: 'Ultra-small mobile', width: 320, height: 568, category: 'mobile' },
      { name: 'Standard mobile (iPhone)', width: 375, height: 667, category: 'mobile' },
      { name: 'Upper mobile boundary', width: 767, height: 1024, category: 'mobile' },
      { name: 'Tablet portrait boundary', width: 768, height: 1024, category: 'tablet' },
      { name: 'Tablet iPad Air', width: 820, height: 1180, category: 'tablet' },
      { name: 'Upper tablet boundary', width: 1023, height: 768, category: 'tablet' },
      { name: 'Desktop standard', width: 1280, height: 800, category: 'desktop' },
      { name: 'Large desktop', width: 1920, height: 1080, category: 'desktop' },
      { name: 'Ultra-wide monitor', width: 2560, height: 1440, category: 'desktop' },
    ];

    for (const vp of testViewports) {
      test(`Breakpoint test: ${vp.name} (${vp.width}x${vp.height}) Category: ${vp.category}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('/');
        await page.waitForTimeout(100);

        // Check horizontal overflow
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalScroll, `Horizontal overflow detected at ${vp.width}px`).toBe(false);

        const drawer = page.locator('[data-testid="navigation-drawer"]');
        const scrim = page.locator('[data-testid="drawer-scrim"]');

        if (vp.category === 'mobile') {
          // Scrim must not block screen initially
          const isScrimVisible = await scrim.isVisible().catch(() => false);
          expect(isScrimVisible).toBe(false);

          // Click hamburger to open modal drawer
          const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');
          await toggleBtn.click();
          await page.waitForTimeout(300);

          await expect(drawer).toBeVisible();
          await expect(scrim).toBeVisible();

          // Scrim click dismisses drawer
          await scrim.click({ position: { x: vp.width - 20, y: vp.height / 2 }, force: true });
          await expect(scrim).toBeHidden({ timeout: 2000 });
        } else if (vp.category === 'tablet') {
          // On tablet, scrim should never be visible
          const isScrimVisible = await scrim.isVisible().catch(() => false);
          expect(isScrimVisible).toBe(false);

          // TopAppBar must be visible
          await expect(page.locator('[data-testid="top-app-bar"]')).toBeVisible();
        } else {
          // Desktop: drawer should be open by default
          await expect(drawer).toBeVisible();
          // Scrim should not be visible
          const isScrimVisible = await scrim.isVisible().catch(() => false);
          expect(isScrimVisible).toBe(false);
        }
      });
    }
  });

  // =========================================================================
  // 4. ADVERSARIAL STRESS TEST & MICRO-INTERACTIONS
  // =========================================================================
  test.describe('4. Adversarial Stress & Micro-interactions', () => {
    test('Rapid theme toggling (20 toggles in burst) maintains consistent state', async ({ page }) => {
      await page.goto('/');
      const themeToggle = page.locator('[data-testid="theme-toggle-btn"]');
      await expect(themeToggle).toBeVisible();

      // Click rapidly 20 times
      for (let i = 0; i < 20; i++) {
        await themeToggle.click();
      }

      await page.waitForTimeout(200);

      // Verify DOM and theme context remain synchronized
      const syncStatus = await page.evaluate(() => {
        const root = document.documentElement;
        const mode = root.getAttribute('data-mode');
        const hasDark = root.classList.contains('dark');
        const storageMode = localStorage.getItem('m3_theme_mode');
        return {
          mode,
          hasDark,
          storageMode,
          isConsistent: (mode === 'dark' && hasDark) || (mode === 'light' && !hasDark),
        };
      });

      expect(syncStatus.isConsistent).toBe(true);
      expect(['light', 'dark']).toContain(syncStatus.mode);
      expect(syncStatus.storageMode).toBe(syncStatus.mode);
    });

    test('Rapid desktop sidebar toggling maintains valid state and rail/drawer alternation', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      const toggleBtn = page.locator('[data-testid="sidebar-toggle-btn"]');

      // Click rapidly 10 times
      for (let i = 0; i < 10; i++) {
        await toggleBtn.click();
      }

      await page.waitForTimeout(300);

      // Verify drawer or rail is visible without layout corruption
      const drawerVisible = await page.locator('[data-testid="navigation-drawer"]').isVisible().catch(() => false);
      const railVisible = await page.locator('[data-testid="navigation-rail"]').isVisible().catch(() => false);

      expect(drawerVisible || railVisible).toBe(true);
    });

    test('Interactive prompt cards populate input textarea and allow submission', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');

      const codeCard = page.locator('[data-testid="starter-card-code"]');
      await expect(codeCard).toBeVisible();
      await codeCard.click();

      const textarea = page.locator('[data-testid="chat-input-textarea"]');
      const val = await textarea.inputValue();
      expect(val.length).toBeGreaterThan(10);

      // Submit via Enter
      await textarea.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);

      // Textarea should be cleared upon submission
      const valAfter = await textarea.inputValue();
      expect(valAfter).toBe('');
    });
  });

});
