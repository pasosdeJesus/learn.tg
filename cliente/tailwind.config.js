/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html', './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  darkMode: false,
  mode: 'jit',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        md: '2rem',
        lg: '3rem',
      },
    },
    extend: {
      colors: {
        primary: {
          100: '#d0c0e1',
          200: '#b9a2d3'
        },
        secondary: {
          100: '#714ba6',
          200: '#937cc4'
        }

      }
    },
  },
  variants: {
  },
  plugins: [],
}

