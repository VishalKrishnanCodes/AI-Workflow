// PATH: frontend/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        head: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        bg:      '#0a0b0f',
        bg2:     '#111318',
        bg3:     '#1a1d25',
        border:  '#23262f',
        border2: '#2e3240',
        accent:  '#4f8ef7',
        accent2: '#7c3aed',
      },
    },
  },
  plugins: [],
}