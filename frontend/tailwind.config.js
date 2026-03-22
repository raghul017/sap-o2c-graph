/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(250, 204, 21, 0.35), 0 12px 32px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};
