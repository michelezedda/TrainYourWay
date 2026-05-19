import { Easing } from 'react-native'

// Duration presets (ms) matching web app
export const D = {
  fast: 250,
  default: 400,
  slow: 550,
} as const

// Easing presets matching web app's Framer Motion cubic-bezier curves
export const E = {
  // cubic-bezier(0.4, 0, 0.2, 1) — standard ease, step transitions, card reveals
  standard: Easing.bezier(0.4, 0, 0.2, 1),
  // cubic-bezier(0.16, 1, 0.3, 1) — bounce-like decelerate, fade-up entrances
  decelerate: Easing.bezier(0.16, 1, 0.3, 1),
  // cubic-bezier(0.34, 1.56, 0.64, 1) — overshoot spring-like, scale-in
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
  // cubic-bezier(0.25, 0.1, 0.25, 1) — CSS ease, dashboard stagger items
  smooth: Easing.bezier(0.25, 0.1, 0.25, 1),
  easeOut: Easing.out(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
  linear: Easing.linear,
} as const

// Stagger timing (ms)
export const STAGGER_STEP = 80   // between siblings — matches web staggerChildren: 0.08
export const STAGGER_DELAY = 50  // before first child — matches web delayChildren: 0.05
