/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        edge: {
          bg: '#0a0a0f',
          card: '#13131f',
          border: '#1e1e2e',
          primary: '#e2e2ea',
          secondary: '#6e6e80',
          error: '#ff4d4d',
          cyan: '#00f0ff',
          orange: '#ff6b35',
          purple: '#a78bfa',
          green: '#34d399',
          amber: '#fbbf24',
          pink: '#f472b6',
          terminal: '#0d0d14',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-dot': 'pulseDot 2s ease-out infinite',
      },
      keyframes: {
        pulseDot: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
