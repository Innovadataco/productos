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
        ios: {
          bg: '#F2F2F7',
          surface: '#FFFFFF',
          'surface-secondary': '#F7F7FA',
          separator: '#E5E5EA',
          'separator-light': '#F2F2F7',
          primary: '#0B6E5A',
          'primary-light': '#E6F4F1',
          blue: '#007AFF',
          'blue-light': '#E5F2FF',
          green: '#34C759',
          'green-light': '#E5F9EA',
          orange: '#FF9500',
          'orange-light': '#FFF4E5',
          red: '#FF3B30',
          'red-light': '#FFEBEA',
          gray: '#8E8E93',
          'gray-2': '#AEAEB2',
          'gray-3': '#C7C7CC',
          'gray-4': '#D1D1D6',
          'gray-5': '#E5E5EA',
          'gray-6': '#F2F2F7',
          black: '#000000',
          label: '#000000',
          'label-secondary': '#6C6C70',
          'label-tertiary': '#8E8E93',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        'ios-title-1': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.021em', fontWeight: '700' }],
        'ios-title-2': ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.019em', fontWeight: '700' }],
        'ios-title-3': ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.021em', fontWeight: '600' }],
        'ios-body': ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.021em', fontWeight: '400' }],
        'ios-callout': ['1rem', { lineHeight: '1.35', letterSpacing: '-0.021em', fontWeight: '400' }],
        'ios-subhead': ['0.9375rem', { lineHeight: '1.35', letterSpacing: '-0.016em', fontWeight: '400' }],
        'ios-footnote': ['0.8125rem', { lineHeight: '1.35', letterSpacing: '-0.006em', fontWeight: '400' }],
        'ios-caption-1': ['0.75rem', { lineHeight: '1.35', letterSpacing: '0em', fontWeight: '400' }],
        'ios-caption-2': ['0.6875rem', { lineHeight: '1.35', letterSpacing: '0.006em', fontWeight: '400' }],
      },
      borderRadius: {
        'ios': '0.625rem',
        'ios-lg': '0.875rem',
        'ios-xl': '1.125rem',
        'ios-2xl': '1.375rem',
      },
      boxShadow: {
        'ios': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.08)',
        'ios-lg': '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'ios-float': '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      maxWidth: {
        mobile: '440px',
      },
      transitionTimingFunction: {
        'ios': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
