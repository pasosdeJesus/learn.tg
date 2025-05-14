/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './**/*.{vue,js,ts,jsx,tsx}'
  ],
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
    fontFamily: {
      sans: ['DM Sans', 'sans-serif'],
      serif: ['DM Serif Display', 'serif'],
    },
    extend: {
      colors: {
        primary: {
          100: '#a63005',
          200: '#b9a3d9'
        },
        secondary: {
          100: '#714ba6',
          200: '#8d69bf'
        }

      }
    },
  },
  variants: {
  },
  plugins: [],
}

