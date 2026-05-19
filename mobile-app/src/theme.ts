export const Colors = {
  bg: '#050510',
  cardBg: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.11)',
  purple: '#A855F7',
  purpleLight: '#C084FC',
  purpleDim: 'rgba(168,85,247,0.12)',
  purpleBorder: 'rgba(168,85,247,0.3)',
  cyan: '#22D3EE',
  cyanDim: 'rgba(34,211,238,0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.38)',
  textDim: 'rgba(255,255,255,0.25)',
  separator: 'rgba(255,255,255,0.07)',
  gradientPurpleCyan: ['#A855F7', '#22D3EE'] as [string, string],
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
}

export const Typography = {
  h1: { fontSize: 32, fontWeight: '900' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '800' as const, color: Colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.textSecondary, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, color: Colors.textMuted },
  label: { fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  caption: { fontSize: 10, fontWeight: '500' as const, color: Colors.textDim },
}
