/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fresh: '#1ea96d',
        protein: '#2f7cf6',
        carbs: '#f6b41f',
        fat: '#e45454',
      },
      boxShadow: {
        panel: '0 16px 40px -22px rgba(16, 44, 33, 0.45)',
      },
    },
  },
  plugins: [],
}

