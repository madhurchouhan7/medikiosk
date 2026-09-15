/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6f7f9',
          100: '#cceef3',
          500: '#00a896',
          600: '#007791',
          700: '#005f73',
          900: '#0a2540',
        },
        kiosk: {
          bg: '#0f172a',
          card: '#1e293b',
          accent: '#0284c7',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
