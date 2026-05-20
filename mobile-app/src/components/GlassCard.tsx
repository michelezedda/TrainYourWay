import { View, type ViewStyle, type StyleProp, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Radius } from '@/theme'

interface GlassCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: number
}

export default function GlassCard({ children, style, padding = 16 }: GlassCardProps) {
  return (
    <View style={[styles.glass, style]}>
      {/* ── Backdrop ── */}
      <View style={[StyleSheet.absoluteFillObject, styles.base]} />

      {/* Brand vibrancy: purple ambient bleed from above (Apple: "color from
          content spills onto glass surface"). Kept at 4% — barely visible but
          adds warmth and brand character to the material. */}
      <LinearGradient
        colors={['rgba(168,85,247,0.07)', 'rgba(168,85,247,0.0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Top specular rim — Apple's signature edge highlight.
          A thin bright line at the top edge simulates light hitting the glass
          rim at a sharp angle. White at high opacity fades down fast. */}
      <View style={styles.specularRim} pointerEvents="none" />

      {/* Content */}
      <View style={{ padding }}>
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  glass: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.36,
    shadowRadius: 28,
    elevation: 8,
  },
  base: {
    backgroundColor: 'rgba(20,15,50,0.68)',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Apple rim height is typically 1–2px. We use 1.5 for visibility.
    height: 1.5,
    // Bright white fading from center outward would be ideal, but RN doesn't
    // support horizontal gradient on a 1.5px View efficiently. A solid
    // semi-transparent white reads identically at this scale.
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
})
