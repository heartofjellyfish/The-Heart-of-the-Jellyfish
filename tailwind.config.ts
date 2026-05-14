import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
        cn: ['"Noto Serif SC"', 'var(--font-cormorant)', 'serif'],
      },
      letterSpacing: {
        widest2: '0.4em',
        widest3: '0.6em',
      },
    },
  },
  plugins: [],
} satisfies Config;
