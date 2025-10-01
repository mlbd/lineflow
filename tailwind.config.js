// tailwind.config.js
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
      /* Use your CSS variable (from Next Font or manual) */
      fontFamily: {
        sans: ['var(--font-figree)', 'Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        figree: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'], // keep your old alias working
      },
      /* Sizes only; apply weights with Tailwind classes */
      fontSize: {
        base: 'var(--body-size)',
        h1: ['var(--h1-size)', { lineHeight: 'var(--h1-lh)' }],
        h2: ['var(--h2-size)', { lineHeight: 'var(--h2-lh)' }],
        h3: ['var(--h3-size)', { lineHeight: 'var(--h3-lh)' }],
        h4: ['var(--h4-size)', { lineHeight: 'var(--h4-lh)' }],
        h5: ['var(--h5-size)', { lineHeight: 'var(--h5-lh)' }],
        h6: ['var(--h6-size)', { lineHeight: 'var(--h6-lh)' }],
        body: ['var(--body-size)', { lineHeight: 'var(--body-lh)' }],
        'body-sm': ['var(--body-sm-size)', { lineHeight: 'var(--body-sm-lh)' }],
      },
    },
  },
  plugins: [require('tailwindcss-rtl'), require('tailwind-scrollbar')],
};
