/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    '../src/**/*.{js,jsx}',   // desktop components reused via @desktop alias
  ],
  theme: {
    extend: {
      colors: {
        'pm-bg':     '#1e1e2e',
        'pm-panel':  '#252535',
        'pm-border': '#313145',
        'pm-hover':  '#2a2a3a',
        'pm-input':  '#1a1a28',
        'pm-accent': '#4ade80',
      },
      transitionDuration: { fast: '120ms' },
    },
  },
  plugins: [],
};
