import { View, type ViewStyle, type StyleProp, StyleSheet, Platform } from 'react-native'
import { Colors, Radius } from '@/theme'

interface GlassCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  padding?: number
}

export default function GlassCard({ children, style, padding = 16 }: GlassCardProps) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {/* Simulates the inset top highlight of the web glass-card */}
      <View style={styles.topHighlight} pointerEvents="none" />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 32 },
      android: { elevation: 0 },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
})
