export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/pages/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '600px',
        md: '728px',
        lg: '984px',
        xl: '1240px',
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        primary: '#1a1a1a',
        accent: '#66de93',
        bglight: '#f7f7f7',
        bglighter: '#f0f0f5',
        deepblue: '#003380',
        skyblue: '#0baaf7',
        pink: '#bf1363',
      },
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-rtl'), require('tailwind-scrollbar')],
};
