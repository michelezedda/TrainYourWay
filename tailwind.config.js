/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          purple: '#A855F7',
          cyan: '#22D3EE',
          dark: '#050510',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #A855F7, #22D3EE)',
        'gradient-app': 'radial-gradient(ellipse at top, #0f0a2e 0%, #050510 60%)',
      },
      borderRadius: {
        '4xl': '32px',
      },
      backdropBlur: {
        '2xl': '40px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
        glow: '0 0 32px rgba(168, 85, 247, 0.35)',
        'glow-cyan': '0 0 32px rgba(34, 211, 238, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        spin: 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
