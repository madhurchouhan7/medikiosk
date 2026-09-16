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
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        clinical: {
          paper: '#f8fafc',
          card: '#ffffff',
          line: '#e2e8f0',
          ink: '#0f172a',
          muted: '#475569',
          faint: '#64748b',
        },
        kiosk: {
          bg: '#f8fafc',
          card: '#ffffff',
          accent: '#0f766e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        clinical: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        raised: '0 4px 12px -2px rgb(15 23 42 / 0.10)',
      },
    },
  },
  plugins: [],
}
