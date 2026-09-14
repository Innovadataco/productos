import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pgn: {
          50: '#f0fdf9',
          100: '#ccfbf3',
          200: '#99f6e6',
          300: '#5eead7',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.72)',
          strong: 'rgba(255, 255, 255, 0.88)',
          soft: 'rgba(255, 255, 255, 0.48)',
        },
        ink: {
          DEFAULT: '#0f172a',
          muted: '#475569',
          subtle: '#94a3b8',
        },
        accent: {
          DEFAULT: '#0d9488',
          light: '#5eead7',
          glow: 'rgba(13, 148, 136, 0.35)',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        'display': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'title-1': ['1.25rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        'title-2': ['1.125rem', { lineHeight: '1.35', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.55', fontWeight: '400' }],
        'callout': ['0.9375rem', { lineHeight: '1.45', fontWeight: '500' }],
        'footnote': ['0.8125rem', { lineHeight: '1.4', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.35', letterSpacing: '0.01em', fontWeight: '500' }],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.04)',
        'glass-lg': '0 16px 48px rgba(15, 23, 42, 0.1), 0 4px 12px rgba(15, 23, 42, 0.05)',
        'glow': '0 0 0 1px rgba(13, 148, 136, 0.12), 0 0 24px rgba(13, 148, 136, 0.2)',
        'button': '0 4px 14px rgba(13, 148, 136, 0.28), 0 1px 3px rgba(13, 148, 136, 0.16)',
        'button-hover': '0 8px 24px rgba(13, 148, 136, 0.35), 0 2px 6px rgba(13, 148, 136, 0.2)',
      },
      backdropBlur: {
        'glass': '20px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite linear',
      },
      maxWidth: {
        mobile: '480px',
      },
    },
  },
  plugins: [],
};

export default config;
