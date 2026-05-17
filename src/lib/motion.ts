// Shared Framer Motion animation presets.
// Import these instead of duplicating inline configs.

import type { Variants, Transition } from 'framer-motion'

// ── Slide-up fade (standard section entrance) ─────────────────────────────────
export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

// ── Slide-down fade (header/title entrance from above) ────────────────────────
export const fadeDownVariant: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0 },
}

// ── Pure fade (no movement) ───────────────────────────────────────────────────
export const fadeVariant: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

// ── Scale-in (used for cards, modals) ─────────────────────────────────────────
export const scaleInVariant: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
}

// ── Stagger container (wraps groups of animated children) ─────────────────────
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

// ── Standard transition timings ───────────────────────────────────────────────
export const transition = {
  fast:    { duration: 0.25 } satisfies Transition,
  default: { duration: 0.4  } satisfies Transition,
  slow:    { duration: 0.55 } satisfies Transition,
  spring:  { type: 'spring', stiffness: 280, damping: 14, mass: 0.85 } satisfies Transition,
}

// ── Convenience: initial+animate+transition for direct prop use ───────────────
export function fadeUpProps(delay = 0) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  } as const
}

export function fadeDownProps(delay = 0) {
  return {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay },
  } as const
}
