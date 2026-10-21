import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--border) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        tint: 'rgb(var(--accent-tint) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { md: '8px', lg: '12px' },
      boxShadow: { pop: '0 8px 30px rgba(28,27,25,0.08)' },
    },
  },
  plugins: [],
};
export default config;
