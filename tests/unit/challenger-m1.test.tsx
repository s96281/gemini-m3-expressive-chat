import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme, getSystemMode } from '../../src/theme/ThemeProvider';
import { SEED_COLORS, DEFAULT_SEED, DEFAULT_MODE, STORAGE_KEY_M3_SEED, STORAGE_KEY_M3_MODE, SeedColor, ThemeMode } from '../../src/theme/tokens';
import { AppShell } from '../../src/components/layout/AppShell';

const ThemeTester: React.FC<{ onRender?: (theme: ReturnType<typeof useTheme>) => void }> = ({ onRender }) => {
  const theme = useTheme();
  onRender?.(theme);
  return (
    <div>
      <span data-testid="seed">{theme.seedColor}</span>
      <span data-testid="mode">{theme.mode}</span>
      <span data-testid="resolved">{theme.resolvedMode}</span>
    </div>
  );
};

describe('Empirical Challenger: Theme Engine Robustness & Fallbacks', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-seed');
    document.documentElement.removeAttribute('data-mode');
    document.documentElement.removeAttribute('data-theme');
  });

  it('verifies all 5 seed palettes are present in SEED_COLORS specification', () => {
    const seedIds = SEED_COLORS.map(s => s.id);
    expect(seedIds).toEqual(['ocean', 'purple', 'emerald', 'rose', 'amber']);
  });

  it('recovers to DEFAULT_SEED and DEFAULT_MODE when localStorage contains corrupted seed/mode strings', () => {
    localStorage.setItem(STORAGE_KEY_M3_SEED, 'invalid-nonexistent-seed');
    localStorage.setItem(STORAGE_KEY_M3_MODE, 'hyper-glow-mode');

    render(
      <ThemeProvider>
        <ThemeTester />
      </ThemeProvider>
    );

    expect(screen.getByTestId('seed').textContent).toBe(DEFAULT_SEED);
    expect(screen.getByTestId('mode').textContent).toBe(DEFAULT_MODE);
  });

  it('cycles through all 5 seed colors and synchronizes DOM attributes in both light and dark modes', () => {
    let currentTheme: ReturnType<typeof useTheme> | undefined;

    const { rerender } = render(
      <ThemeProvider>
        <ThemeTester onRender={(t) => { currentTheme = t; }} />
      </ThemeProvider>
    );

    const seeds: SeedColor[] = ['ocean', 'purple', 'emerald', 'rose', 'amber'];
    const modes: ThemeMode[] = ['light', 'dark'];

    for (const s of seeds) {
      for (const m of modes) {
        act(() => {
          currentTheme?.setSeedColor(s);
          currentTheme?.setMode(m);
        });

        expect(currentTheme?.seedColor).toBe(s);
        expect(currentTheme?.mode).toBe(m);
        expect(currentTheme?.resolvedMode).toBe(m);

        // Verify root DOM attributes
        expect(document.documentElement.getAttribute('data-seed')).toBe(s);
        expect(document.documentElement.getAttribute('data-mode')).toBe(m);
        expect(document.documentElement.getAttribute('data-theme')).toBe(m);

        if (m === 'dark') {
          expect(document.documentElement.classList.contains('dark')).toBe(true);
        } else {
          expect(document.documentElement.classList.contains('dark')).toBe(false);
        }

        // Verify storage persistence
        expect(localStorage.getItem(STORAGE_KEY_M3_SEED)).toBe(s);
        expect(localStorage.getItem(STORAGE_KEY_M3_MODE)).toBe(m);
      }
    }
  });

  it('handles simulated localStorage security exception without crashing ThemeProvider', () => {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;

    // Simulate SecurityError (e.g. sandbox or incognito blocking storage)
    localStorage.getItem = () => { throw new Error('SecurityError: Access is denied'); };
    localStorage.setItem = () => { throw new Error('SecurityError: Access is denied'); };

    let currentTheme: ReturnType<typeof useTheme> | undefined;

    expect(() => {
      render(
        <ThemeProvider>
          <ThemeTester onRender={(t) => { currentTheme = t; }} />
        </ThemeProvider>
      );
    }).not.toThrow();

    expect(screen.getByTestId('seed').textContent).toBe(DEFAULT_SEED);

    // Calling setSeedColor when setItem throws must not throw
    expect(() => {
      act(() => {
        currentTheme?.setSeedColor('rose');
        currentTheme?.setMode('dark');
      });
    }).not.toThrow();

    localStorage.getItem = originalGetItem;
    localStorage.setItem = originalSetItem;
  });

  it('AppShell gracefully handles corrupt m3_sidebar_open localStorage values', () => {
    localStorage.setItem('m3_sidebar_open', 'undefined_or_junk');

    expect(() => {
      render(
        <ThemeProvider>
          <AppShell>
            <div>Main Content</div>
          </AppShell>
        </ThemeProvider>
      );
    }).not.toThrow();
  });
});
