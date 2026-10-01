/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f3f1ff',
          100: '#e9e5ff',
          200: '#d5ceff',
          300: '#b5a6ff',
          400: '#9175ff',
          500: '#7246fd',
          600: '#6128f4',
          700: '#5218d9',
          800: '#4515b1',
          900: '#3a148f',
        },
        ink: {
          950: '#0b0b14',
          900: '#11111c',
          850: '#161624',
          800: '#1c1c2e',
          700: '#2a2a40',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,16,40,0.04), 0 4px 16px rgba(16,16,40,0.06)',
        glow: '0 10px 30px -10px rgba(97,40,244,0.55)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
