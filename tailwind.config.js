/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Inter', 'sans-serif'],
      },
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        section: 'var(--bg-section)',
        primary: 'var(--text-primary)',
        body: 'var(--text-body)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'accent-border': 'var(--accent-border)',
        'accent-tint': 'var(--accent-tint)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        themeborder: 'var(--border)',
        'themeborder-hover': 'var(--border-hover)',
        glass: 'var(--glass-bg)',
        'glass-border': 'var(--glass-border)',
      }
    },
  },
  plugins: [],
}
