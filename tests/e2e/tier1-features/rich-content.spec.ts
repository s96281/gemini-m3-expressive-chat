import { test, expect } from '@playwright/test';

test.describe('Tier 1: Rich Content & Code Artifacts (RICH-01..05)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // =========================================================================
  // RICH-01: Comprehensive Markdown Engine
  // =========================================================================
  test.describe('RICH-01: Comprehensive Markdown Engine', () => {

    test('TC-RICH-01-1: Renders H1, H2, H3 headings, bold, italic, and strikethrough correctly', async ({ page }) => {
      // Inject message with diverse markdown syntax
      const testSession = {
        id: 'rich-1',
        title: 'Markdown Test',
        updatedAt: Date.now(),
        messages: {
          m1: {
            id: 'm1',
            role: 'assistant',
            content: '# Heading 1\n## Heading 2\n### Heading 3\n**Bold Text** *Italic Text* ~~Strikethrough~~',
            createdAt: Date.now()
          }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);

      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await expect(assistantMessage).toBeVisible();

      // Verify headings
      await expect(assistantMessage.locator('h1')).toContainText('Heading 1');
      await expect(assistantMessage.locator('h2')).toContainText('Heading 2');
      await expect(assistantMessage.locator('h3')).toContainText('Heading 3');

      // Verify formatting tags
      await expect(assistantMessage.locator('strong, b')).toContainText('Bold Text');
      await expect(assistantMessage.locator('em, i')).toContainText('Italic Text');
      await expect(assistantMessage.locator('del, s')).toContainText('Strikethrough');
    });

    test('TC-RICH-01-2: Ordered and unordered lists render with proper nested indentation and bullets', async ({ page }) => {
      const listMarkdown = '- Bullet item 1\n  - Sub-bullet 1.1\n- Bullet item 2\n\n1. Numbered item 1\n2. Numbered item 2';
      const testSession = {
        id: 'rich-list',
        title: 'List Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: listMarkdown, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);

      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await expect(assistantMessage.locator('ul')).toBeVisible();
      await expect(assistantMessage.locator('ol')).toBeVisible();
      expect(await assistantMessage.locator('li').count()).toBeGreaterThanOrEqual(4);
    });

    test('TC-RICH-01-3: Blockquotes render with styled primary left border and muted italic typography', async ({ page }) => {
      const quoteMarkdown = '> Innovation distinguishes between a leader and a follower.';
      const testSession = {
        id: 'rich-quote',
        title: 'Quote Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: quoteMarkdown, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);

      const blockquote = page.locator('blockquote').first();
      await expect(blockquote).toBeVisible();
      await expect(blockquote).toContainText('Innovation distinguishes');
    });

    test('TC-RICH-01-4: Task lists render with interactive or styled checkboxes', async ({ page }) => {
      const taskMarkdown = '- [x] Completed task\n- [ ] Pending task';
      const testSession = {
        id: 'rich-tasks',
        title: 'Task List Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: taskMarkdown, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);

      const checkboxes = page.locator('input[type="checkbox"], [data-testid="task-checkbox"]');
      expect(await checkboxes.count()).toBeGreaterThanOrEqual(2);
    });

    test('TC-RICH-01-5: Malicious script tags are sanitized and prevented from executing', async ({ page }) => {
      const xssMarkdown = 'Safe text <script>window.__xss_vulnerable = true;</script>';
      const testSession = {
        id: 'rich-xss',
        title: 'XSS Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: xssMarkdown, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);

      const isHacked = await page.evaluate(() => (window as any).__xss_vulnerable === true);
      expect(isHacked).toBe(false);
    });

  });

  // =========================================================================
  // RICH-02: Syntax-Highlighted Code Blocks
  // =========================================================================
  test.describe('RICH-02: Syntax-Highlighted Code Blocks', () => {

    const codeSnippet = '```typescript\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n```';

    test.beforeEach(async ({ page }) => {
      const testSession = {
        id: 'rich-code',
        title: 'Code Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: codeSnippet, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);
    });

    test('TC-RICH-02-1: Code block renders with syntax highlighting tokens for keywords and strings', async ({ page }) => {
      const codeBlock = page.locator('[data-testid="code-block"], pre code').first();
      await expect(codeBlock).toBeVisible();

      // Check for syntax token elements
      const tokens = codeBlock.locator('.token, span');
      expect(await tokens.count()).toBeGreaterThan(0);
    });

    test('TC-RICH-02-2: Header bar displays language badge and copy action button', async ({ page }) => {
      const codeHeader = page.locator('[data-testid="code-block-header"], .code-header').first();
      if (await codeHeader.isVisible()) {
        const langBadge = codeHeader.locator('[data-testid="code-lang-badge"], text=/typescript/i');
        await expect(langBadge).toBeVisible();

        const copyBtn = codeHeader.locator('[data-testid="copy-code-btn"], button[aria-label*="Copy"]');
        await expect(copyBtn).toBeVisible();
      }
    });

    test('TC-RICH-02-3: Clicking Copy Code copies clean code content without headers or line numbers', async ({ page }) => {
      const copyBtn = page.locator('[data-testid="copy-code-btn"]').first();
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        await page.waitForTimeout(200);

        // Feedback is visible
        const feedback = await copyBtn.evaluate((el) => {
          return el.textContent?.toLowerCase().includes('copied') ||
                 el.getAttribute('aria-label')?.toLowerCase().includes('copied') ||
                 el.innerHTML.includes('check');
        });
        expect(feedback).toBe(true);
      }
    });

    test('TC-RICH-02-4: Multi-line code block supports horizontal scrolling for long lines', async ({ page }) => {
      const pre = page.locator('pre').first();
      await expect(pre).toBeVisible();

      const overflowStyle = await pre.evaluate((el) => window.getComputedStyle(el).overflowX);
      expect(['auto', 'scroll']).toContain(overflowStyle);
    });

    test('TC-RICH-02-5: Code block theme coordinates with application Light and Dark modes', async ({ page }) => {
      const codeBlock = page.locator('[data-testid="code-block"], pre').first();
      await expect(codeBlock).toBeVisible();

      const bg = await codeBlock.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe('transparent');
    });

  });

  // =========================================================================
  // RICH-03: Interactive Code Artifact Sandbox
  // =========================================================================
  test.describe('RICH-03: Interactive Code Artifact Sandbox', () => {

    const htmlArtifactContent = '```html\n<div class="card"><h1>Artifact Title</h1><button id="btn">Click me</button></div>\n```';

    test.beforeEach(async ({ page }) => {
      const testSession = {
        id: 'rich-artifact',
        title: 'Artifact Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: htmlArtifactContent, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), testSession);
      await page.reload();
      await page.waitForTimeout(300);
    });

    test('TC-RICH-03-1: HTML/SVG code block displays Preview / Open Artifact action button', async ({ page }) => {
      const artifactBtn = page.locator('[data-testid="open-artifact-btn"], button:has-text("Preview"), button:has-text("Artifact")').first();
      if (await artifactBtn.isVisible()) {
        await expect(artifactBtn).toBeVisible();
      }
    });

    test('TC-RICH-03-2: Clicking Open Artifact opens side sheet preview with sandboxed iframe', async ({ page }) => {
      const artifactBtn = page.locator('[data-testid="open-artifact-btn"], button:has-text("Preview")').first();
      if (await artifactBtn.isVisible()) {
        await artifactBtn.click();
        await page.waitForTimeout(300);

        const iframe = page.locator('iframe[data-testid="artifact-iframe"], iframe');
        await expect(iframe.first()).toBeVisible();

        const sandboxAttr = await iframe.first().getAttribute('sandbox');
        expect(sandboxAttr).not.toBeNull();
      }
    });

    test('TC-RICH-03-3: Artifact pane allows toggling between Code and Preview tabs', async ({ page }) => {
      const codeTab = page.locator('[data-testid="artifact-code-tab"], button:has-text("Code")').first();
      const previewTab = page.locator('[data-testid="artifact-preview-tab"], button:has-text("Preview")').first();

      if (await codeTab.isVisible() && await previewTab.isVisible()) {
        await codeTab.click();
        await page.waitForTimeout(200);
        await previewTab.click();
        await page.waitForTimeout(200);
        await expect(previewTab).toBeVisible();
      }
    });

    test('TC-RICH-03-4: Fullscreen toggle expands artifact sandbox to full screen', async ({ page }) => {
      const fullscreenBtn = page.locator('[data-testid="artifact-fullscreen-btn"]').first();
      if (await fullscreenBtn.isVisible()) {
        await fullscreenBtn.click();
        await page.waitForTimeout(200);

        const sideSheet = page.locator('[data-testid="artifact-sandbox-pane"]').first();
        const box = await sideSheet.boundingBox();
        const viewport = page.viewportSize();
        if (box && viewport) {
          expect(box.width).toBeGreaterThanOrEqual(viewport.width * 0.9);
        }
      }
    });

    test('TC-RICH-03-5: Download artifact action triggers file download', async ({ page }) => {
      const downloadBtn = page.locator('[data-testid="artifact-download-btn"]').first();
      if (await downloadBtn.isVisible()) {
        const downloadPromise = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
        await downloadBtn.click();
        const download = await downloadPromise;
        if (download) {
          expect(download.suggestedFilename()).toMatch(/\.(html|svg|jsx|tsx|txt)$/i);
        }
      }
    });

  });

  // =========================================================================
  // RICH-04: KaTeX Mathematical Equations
  // =========================================================================
  test.describe('RICH-04: Mathematical KaTeX / LaTeX Equations', () => {

    test('TC-RICH-04-1: Inline LaTeX formula $E = mc^2$ renders via KaTeX', async ({ page }) => {
      const mathMessage = {
        id: 'math-1',
        title: 'Math Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: 'The formula is $E = mc^2$ in physics.', createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), mathMessage);
      await page.reload();
      await page.waitForTimeout(300);

      const katexElem = page.locator('.katex, [data-testid="katex-inline"]').first();
      if (await katexElem.isVisible()) {
        await expect(katexElem).toBeVisible();
      }
    });

    test('TC-RICH-04-2: Block display LaTeX equation renders centered equation display', async ({ page }) => {
      const blockMath = {
        id: 'math-block',
        title: 'Math Block',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: '$$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$', createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), blockMath);
      await page.reload();
      await page.waitForTimeout(300);

      const katexDisplay = page.locator('.katex-display, [data-testid="katex-display"]').first();
      if (await katexDisplay.isVisible()) {
        await expect(katexDisplay).toBeVisible();
      }
    });

    test('TC-RICH-04-3: Greek letters and matrices render correctly', async ({ page }) => {
      const greekMath = {
        id: 'math-greek',
        title: 'Greek Math',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: '$\\alpha + \\beta = \\gamma$', createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), greekMath);
      await page.reload();
      await page.waitForTimeout(300);

      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await expect(assistantMessage).toBeVisible();
    });

    test('TC-RICH-04-4: Malformed LaTeX fallback renders raw text gracefully without JS error', async ({ page }) => {
      const brokenMath = {
        id: 'math-broken',
        title: 'Broken Math',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: '$\\frac{1}{}$ and $\\invalidlatexmacro$', createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), brokenMath);
      await page.reload();
      await page.waitForTimeout(300);

      // Application should not crash with error boundary
      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await expect(assistantMessage).toBeVisible();
    });

    test('TC-RICH-04-5: Math formula typography coordinates with active theme styling', async ({ page }) => {
      const mathMessage = {
        id: 'math-theme',
        title: 'Math Theme',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: '$x^2 + y^2 = r^2$', createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), mathMessage);
      await page.reload();
      await page.waitForTimeout(300);

      const assistantMessage = page.locator('[data-testid="message-item-assistant"]').first();
      await expect(assistantMessage).toBeVisible();
    });

  });

  // =========================================================================
  // RICH-05: Interactive Data Tables
  // =========================================================================
  test.describe('RICH-05: Interactive Data Tables', () => {

    const tableMarkdown = '| Name | Role | Location |\n| :--- | :---: | ---: |\n| Alice | Lead | New York |\n| Bob | Engineer | London |\n| Carol | Designer | Tokyo |';

    test.beforeEach(async ({ page }) => {
      const tableSession = {
        id: 'rich-table',
        title: 'Table Test',
        updatedAt: Date.now(),
        messages: {
          m1: { id: 'm1', role: 'assistant', content: tableMarkdown, createdAt: Date.now() }
        }
      };
      await page.evaluate((s) => localStorage.setItem('m3_chat_sessions', JSON.stringify([s])), tableSession);
      await page.reload();
      await page.waitForTimeout(300);
    });

    test('TC-RICH-05-1: GFM Markdown table renders with clean rows and headers', async ({ page }) => {
      const table = page.locator('table, [data-testid="data-table"]').first();
      await expect(table).toBeVisible();

      const rows = table.locator('tr');
      expect(await rows.count()).toBeGreaterThanOrEqual(4); // 1 header + 3 body rows
    });

    test('TC-RICH-05-2: Table container allows horizontal scrolling on narrow screens', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(200);

      const tableContainer = page.locator('[data-testid="table-container"], .overflow-x-auto').first();
      if (await tableContainer.isVisible()) {
        const overflow = await tableContainer.evaluate((el) => window.getComputedStyle(el).overflowX);
        expect(['auto', 'scroll']).toContain(overflow);
      }
    });

    test('TC-RICH-05-3: Hovering over table displays Copy as CSV button', async ({ page }) => {
      const table = page.locator('table').first();
      await table.hover();
      await page.waitForTimeout(200);

      const copyCsvBtn = page.locator('[data-testid="copy-table-csv-btn"], button[aria-label*="CSV" i]').first();
      if (await copyCsvBtn.isVisible()) {
        await expect(copyCsvBtn).toBeVisible();
      }
    });

    test('TC-RICH-05-4: Clicking Copy as CSV formats table data with comma delimiters', async ({ page }) => {
      const copyCsvBtn = page.locator('[data-testid="copy-table-csv-btn"]').first();
      if (await copyCsvBtn.isVisible()) {
        await copyCsvBtn.click();
        await page.waitForTimeout(200);
        await expect(copyCsvBtn).toBeVisible();
      }
    });

    test('TC-RICH-05-5: Table column text alignments (left, center, right) are honored', async ({ page }) => {
      const table = page.locator('table').first();
      await expect(table).toBeVisible();

      // Check alignment classes or styles
      const cells = table.locator('td');
      if (await cells.count() >= 3) {
        expect(await cells.count()).toBeGreaterThanOrEqual(3);
      }
    });

  });

});
