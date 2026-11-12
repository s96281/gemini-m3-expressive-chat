import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-mode="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic roles
        primary: {
          DEFAULT: 'var(--md-sys-color-primary)',
          foreground: 'var(--md-sys-color-on-primary)',
          container: 'var(--md-sys-color-primary-container)',
          'on-container': 'var(--md-sys-color-on-primary-container)',
        },
        secondary: {
          DEFAULT: 'var(--md-sys-color-secondary)',
          foreground: 'var(--md-sys-color-on-secondary)',
          container: 'var(--md-sys-color-secondary-container)',
          'on-container': 'var(--md-sys-color-on-secondary-container)',
        },
        tertiary: {
          DEFAULT: 'var(--md-sys-color-tertiary)',
          foreground: 'var(--md-sys-color-on-tertiary)',
          container: 'var(--md-sys-color-tertiary-container)',
          'on-container': 'var(--md-sys-color-on-tertiary-container)',
        },
        surface: {
          DEFAULT: 'var(--md-sys-color-surface)',
          foreground: 'var(--md-sys-color-on-surface)',
          variant: 'var(--md-sys-color-surface-variant)',
          'on-variant': 'var(--md-sys-color-on-surface-variant)',
          'container-lowest': 'var(--md-sys-color-surface-container-lowest)',
          'container-low': 'var(--md-sys-color-surface-container-low)',
          container: 'var(--md-sys-color-surface-container)',
          'container-high': 'var(--md-sys-color-surface-container-high)',
          'container-highest': 'var(--md-sys-color-surface-container-highest)',
        },
        background: {
          DEFAULT: 'var(--md-sys-color-background)',
          foreground: 'var(--md-sys-color-on-background)',
        },
        outline: {
          DEFAULT: 'var(--md-sys-color-outline)',
          variant: 'var(--md-sys-color-outline-variant)',
        },
        error: {
          DEFAULT: 'var(--md-sys-color-error)',
          foreground: 'var(--md-sys-color-on-error)',
          container: 'var(--md-sys-color-error-container)',
          'on-container': 'var(--md-sys-color-on-error-container)',
        },
        // Flat aliases matching M3 token names
        'on-primary': 'var(--md-sys-color-on-primary)',
        'on-primary-container': 'var(--md-sys-color-on-primary-container)',
        'on-secondary': 'var(--md-sys-color-on-secondary)',
        'on-secondary-container': 'var(--md-sys-color-on-secondary-container)',
        'on-tertiary': 'var(--md-sys-color-on-tertiary)',
        'on-tertiary-container': 'var(--md-sys-color-on-tertiary-container)',
        'on-surface': 'var(--md-sys-color-on-surface)',
        'on-surface-variant': 'var(--md-sys-color-on-surface-variant)',
        'on-background': 'var(--md-sys-color-on-background)',
        'on-error': 'var(--md-sys-color-on-error)',
        'on-error-container': 'var(--md-sys-color-on-error-container)',
        'surface-container-lowest': 'var(--md-sys-color-surface-container-lowest)',
        'surface-container-low': 'var(--md-sys-color-surface-container-low)',
        'surface-container': 'var(--md-sys-color-surface-container)',
        'surface-container-high': 'var(--md-sys-color-surface-container-high)',
        'surface-container-highest': 'var(--md-sys-color-surface-container-highest)',
      },
      borderRadius: {
        'm3-xs': 'var(--md-sys-shape-corner-xs)',
        'm3-sm': 'var(--md-sys-shape-corner-sm)',
        'm3-md': 'var(--md-sys-shape-corner-md)',
        'm3-lg': 'var(--md-sys-shape-corner-lg)',
        'm3-xl': 'var(--md-sys-shape-corner-xl)',
        'm3-2xl': 'var(--md-sys-shape-corner-2xl)',
        'm3-3xl': 'var(--md-sys-shape-corner-3xl)',
        'm3-4xl': 'var(--md-sys-shape-corner-4xl)',
        'm3-full': 'var(--md-sys-shape-corner-full)',
        'user-bubble': 'var(--md-sys-shape-user-bubble)',
        'assistant-card': 'var(--md-sys-shape-assistant-card)',
        'input-dock': 'var(--md-sys-shape-input-dock)',
        'starter-card': 'var(--md-sys-shape-starter-card)',
      },
      boxShadow: {
        'elevation-1': 'var(--md-sys-elevation-1)',
        'elevation-2': 'var(--md-sys-elevation-2)',
        'elevation-3': 'var(--md-sys-elevation-3)',
        'elevation-4': 'var(--md-sys-elevation-4)',
        'm3-1': 'var(--md-sys-elevation-1)',
        'm3-2': 'var(--md-sys-elevation-2)',
        'm3-3': 'var(--md-sys-elevation-3)',
        'm3-4': 'var(--md-sys-elevation-4)',
      },
      transitionTimingFunction: {
        'm3-spring': 'var(--md-sys-motion-easing-spring)',
        'm3-emphasized': 'var(--md-sys-motion-easing-emphasized)',
        'm3-exit': 'var(--md-sys-motion-easing-exit)',
      },
      transitionDuration: {
        'short-1': '100ms',
        'short-2': '200ms',
        'med-1': '250ms',
        'med-2': '300ms',
        'long-1': '450ms',
        'long-2': '600ms',
      },
      animation: {
        'glow-pulse': 'glowPulse 2s cubic-bezier(0.2, 0.0, 0, 1.0) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', boxShadow: '0 0 12px var(--md-sys-color-primary)' },
          '50%': { opacity: '0.6', transform: 'scale(0.96)', boxShadow: '0 0 4px var(--md-sys-color-primary)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [typography],
};
