export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/pages/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
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
        sans: ['Heebo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwindcss-rtl'),
    require('tailwind-scrollbar')
],
}
