import type { Config } from 'tailwindcss';

/**
 * Hearth design tokens — pastel palette taken from the Landing and Sign-in screens.
 *
 *  - primary (powder sky blue) → brand, primary actions, links, focus
 *  - rose    (rosy pink)       → warm accent, highlights, badges
 *  - mint                      → success, availability, calm states
 *  - amber / red               → warning / critical
 *  - canvas / surface / ink    → soft near-white paper with cool slate text
 *
 * Every colour is a CSS variable (values live in src/styles/index.css) so the same class
 * names work in the light and dark themes and in high-contrast mode. Steps 50–200 are tints
 * for backgrounds, 300–500 are mid tones for borders and small marks, and 600–900 are text
 * colours that stay readable on those tints. Anything that carries white text or a white icon
 * (buttons, selected tabs, checked boxes, count badges) uses `solid-*` instead, because a
 * step that is a good text colour in dark mode is too light to hold white text.
 */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (name: string, steps: number[]) => Object.fromEntries(steps.map((step) => [step, v(`${name}-${step}`)]));

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // The dark theme is switched by <html data-theme="dark"> (see src/lib/prefs.ts), not by the OS alone.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: {
          DEFAULT: v('surface'),
          muted: v('surface-muted'),
          sunken: v('surface-sunken'),
        },
        line: {
          DEFAULT: v('line'),
          strong: v('line-strong'),
        },
        /** Borders of inputs and other controls: at least 3:1 against the page (WCAG 1.4.11). */
        field: v('field'),
        ink: {
          DEFAULT: v('ink'),
          muted: v('ink-muted'),
          subtle: v('ink-subtle'),
          inverse: '#FFFFFF',
        },
        primary: scale('primary', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        rose: scale('rose', [50, 100, 200, 300, 400, 500, 600, 700]),
        mint: scale('mint', [50, 100, 200, 300, 400, 500, 600, 700, 800]),
        amber: scale('amber', [50, 100, 200, 500, 600, 700]),
        red: scale('red', [50, 100, 200, 300, 400, 500, 600, 700, 800]),
        solid: {
          primary: { DEFAULT: v('solid-primary'), hover: v('solid-primary-hover'), active: v('solid-primary-active') },
          rose: { DEFAULT: v('solid-rose'), hover: v('solid-rose-hover') },
          red: { DEFAULT: v('solid-red'), hover: v('solid-red-hover') },
          mint: { DEFAULT: v('solid-mint') },
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader Variable"', 'Newsreader', 'Georgia', 'serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(30, 50, 60, 0.05), 0 1px 3px rgba(30, 50, 60, 0.04)',
        raised: '0 12px 32px -14px rgba(30, 60, 80, 0.20), 0 2px 6px rgba(30, 50, 60, 0.05)',
        overlay: '0 24px 60px -16px rgba(20, 40, 55, 0.30)',
      },
      maxWidth: {
        content: '76rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-in': 'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
