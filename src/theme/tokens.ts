export type SeedColor = 'ocean' | 'purple' | 'emerald' | 'rose' | 'amber';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export interface SeedOption {
  id: SeedColor;
  name: string;
  lightPrimary: string;
  darkPrimary: string;
  accentGradient: string;
}

export const SEED_COLORS: readonly SeedOption[] = [
  {
    id: 'ocean',
    name: 'Ocean Blue',
    lightPrimary: '#0B57D0',
    darkPrimary: '#A8C7FA',
    accentGradient: 'from-[#0B57D0] to-[#7FCFFF]',
  },
  {
    id: 'purple',
    name: 'Berry Purple',
    lightPrimary: '#6750A4',
    darkPrimary: '#D0BCFF',
    accentGradient: 'from-[#6750A4] to-[#EFB8C8]',
  },
  {
    id: 'emerald',
    name: 'Spring Emerald',
    lightPrimary: '#006C4C',
    darkPrimary: '#6CDBAC',
    accentGradient: 'from-[#006C4C] to-[#A5CCDF]',
  },
  {
    id: 'rose',
    name: 'Rose Sunset',
    lightPrimary: '#9C4146',
    darkPrimary: '#FFB3B4',
    accentGradient: 'from-[#9C4146] to-[#E5C18D]',
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    lightPrimary: '#7E5700',
    darkPrimary: '#FFBA28',
    accentGradient: 'from-[#7E5700] to-[#B1CCA9]',
  },
] as const;

export const STORAGE_KEY_M3_SEED = 'm3_seed_color';
export const STORAGE_KEY_M3_MODE = 'm3_theme_mode';
export const STORAGE_KEY_GEMINI_SEED = 'gemini_theme_seed';
export const STORAGE_KEY_GEMINI_MODE = 'gemini_theme_mode';

export const DEFAULT_SEED: SeedColor = 'ocean';
export const DEFAULT_MODE: ThemeMode = 'system';
