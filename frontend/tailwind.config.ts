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
 * The pastel steps (50–200) are for backgrounds and tints. Text and filled
 * buttons use the deeper steps (600+) so everything meets WCAG AA contrast.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F7FAF9',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F2F7F5',
          sunken: '#E9F1EE',
        },
        line: {
          DEFAULT: '#DDE7E3',
          strong: '#C6D6D0',
        },
        ink: {
          DEFAULT: '#1D2A30',
          muted: '#475860',
          subtle: '#5E6F77',
          inverse: '#FFFFFF',
        },
        primary: {
          50: '#F1F7FC',
          100: '#E1EEF8',
          200: '#C5DEF0',
          300: '#9CC6E3',
          400: '#6FA8CF',
          500: '#4F8CB8',
          600: '#3C739C',
          700: '#315E80',
          800: '#284C68',
          900: '#203D53',
        },
        rose: {
          50: '#FDF3F5',
          100: '#FAE4E9',
          200: '#F4C8D2',
          300: '#EAA3B3',
          400: '#DB7D93',
          500: '#C55C76',
          600: '#A6475F',
          700: '#86394D',
        },
        mint: {
          50: '#EFF8F3',
          100: '#DCF0E5',
          200: '#BEE3CF',
          300: '#95CEB0',
          400: '#6AB591',
          500: '#4B9775',
          600: '#3A7A5E',
          700: '#2F624C',
          800: '#264F3E',
        },
        amber: {
          50: '#FEF7E8',
          100: '#FCEBC6',
          200: '#F8D892',
          500: '#C0841B',
          600: '#9A6912',
          700: '#78520E',
        },
        red: {
          50: '#FDF1F0',
          100: '#FADBD8',
          200: '#F3B6B1',
          500: '#C8453D',
          600: '#A7352F',
          700: '#852A25',
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
        'toast-in': 'toast-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
