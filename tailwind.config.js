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
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.16,1,0.3,1)',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        spin: 'spin 1s linear infinite',
        'spin-slow': 'spinSlow 2.8s linear infinite',
        'typing-dot': 'typingDot 1.1s ease-in-out infinite',
        'orb-1': 'orbFloat1 14s ease-in-out infinite',
        'orb-2': 'orbFloat2 18s ease-in-out infinite',
        'scale-in': 'scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        typingDot: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '30%': { transform: 'translateY(-5px)', opacity: '1' },
        },
        spinSlow: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        orbFloat1: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '35%': { transform: 'translate(5%,-5%) scale(1.1)' },
          '70%': { transform: 'translate(-3%,4%) scale(0.93)' },
        },
        orbFloat2: {
          '0%, 100%': { transform: 'translate(0,0) scale(1.06)' },
          '40%': { transform: 'translate(-5%,5%) scale(0.97)' },
          '75%': { transform: 'translate(4%,-3%) scale(1.13)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.88)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
