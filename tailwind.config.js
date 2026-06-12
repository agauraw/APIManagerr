/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pm: {
          bg: '#1e1e2e',
          panel: '#252535',
          border: '#383850',
          accent: '#4ade80',
          hover: '#2e2e45',
          input: '#2a2a3e',
        },
      },
    },
  },
  plugins: [],
};
