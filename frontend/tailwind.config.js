/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Grounded in the actual campus photos: tree-canopy green as the
        // institutional primary, brick-path terracotta as the secondary
        // accent. Standard light-theme ordering (50 = subtlest tint, 900 =
        // deepest/darkest).
        brand: {
          50: '#eef5f0', 100: '#d7e8dc', 200: '#b0d1ba', 300: '#7fb28f',
          400: '#4f8f64', 500: '#2f7148', 600: '#1f5636', 700: '#1a452c',
          800: '#163823', 900: '#122c1c'
        },
        clay: {
          50: '#fbf1ec', 100: '#f4ddd0', 200: '#e7b79c', 300: '#d68e68',
          400: '#c26a41', 500: '#a8502b', 600: '#8c4023', 700: '#70331d',
          800: '#582816', 900: '#3f1c10'
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        fadeInUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.96)' }, to: { opacity: 1, transform: 'scale(1)' } },
        crossfade: {
          '0%, 30%': { opacity: 1 },
          '33%, 96%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.35s ease-out both',
        fadeInUp: 'fadeInUp 0.4s ease-out both',
        scaleIn: 'scaleIn 0.18s ease-out both',
        crossfade: 'crossfade 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
