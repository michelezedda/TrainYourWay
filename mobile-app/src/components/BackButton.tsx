import { TouchableOpacity, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface BackButtonProps {
  onPress: () => void
  style?: StyleProp<ViewStyle>
}

export default function BackButton({ onPress, style }: BackButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.btn, style]}
    >
      <View style={[StyleSheet.absoluteFillObject, styles.bg]} />
      <View style={styles.specularRim} pointerEvents="none" />
      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 3,
  },
  bg: {
    backgroundColor: 'rgba(10,7,26,0.82)',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
})
