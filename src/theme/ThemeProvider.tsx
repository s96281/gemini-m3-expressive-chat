import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  SeedColor,
  ThemeMode,
  ResolvedThemeMode,
  SEED_COLORS,
  STORAGE_KEY_M3_SEED,
  STORAGE_KEY_M3_MODE,
  STORAGE_KEY_GEMINI_SEED,
  STORAGE_KEY_GEMINI_MODE,
  DEFAULT_SEED,
  DEFAULT_MODE,
} from './tokens';

interface ThemeContextType {
  seedColor: SeedColor;
  setSeedColor: (seed: SeedColor) => void;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: ResolvedThemeMode;
  toggleMode: () => void;
  availableSeeds: typeof SEED_COLORS;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function getSystemMode(): ResolvedThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [seedColor, setSeedColorState] = useState<SeedColor>(() => {
    if (typeof window === 'undefined') return DEFAULT_SEED;
    try {
      const saved = (localStorage.getItem(STORAGE_KEY_M3_SEED) ||
        localStorage.getItem(STORAGE_KEY_GEMINI_SEED)) as SeedColor;
      return SEED_COLORS.some((s) => s.id === saved) ? saved : DEFAULT_SEED;
    } catch {
      return DEFAULT_SEED;
    }
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_MODE;
    try {
      const saved = (localStorage.getItem(STORAGE_KEY_M3_MODE) ||
        localStorage.getItem(STORAGE_KEY_GEMINI_MODE)) as ThemeMode;
      return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : DEFAULT_MODE;
    } catch {
      return DEFAULT_MODE;
    }
  });

  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemMode);

  // Monitor prefers-color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedMode: ResolvedThemeMode = mode === 'system' ? systemMode : mode;

  // Sync DOM attributes whenever seedColor or resolvedMode changes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    root.setAttribute('data-seed', seedColor);
    root.setAttribute('data-mode', resolvedMode);
    root.setAttribute('data-theme', resolvedMode);

    if (resolvedMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.style.colorScheme = resolvedMode;
  }, [seedColor, resolvedMode]);

  const setSeedColor = (seed: SeedColor) => {
    setSeedColorState(seed);
    try {
      localStorage.setItem(STORAGE_KEY_M3_SEED, seed);
      localStorage.setItem(STORAGE_KEY_GEMINI_SEED, seed);
    } catch {
      // ignore in storage-blocked environments
    }
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY_M3_MODE, newMode);
      localStorage.setItem(STORAGE_KEY_GEMINI_MODE, newMode);
    } catch {
      // ignore
    }
  };

  const toggleMode = () => {
    const next = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(next);
  };

  const value = useMemo(
    () => ({
      seedColor,
      setSeedColor,
      mode,
      setMode,
      resolvedMode,
      toggleMode,
      availableSeeds: SEED_COLORS,
    }),
    [seedColor, mode, resolvedMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
