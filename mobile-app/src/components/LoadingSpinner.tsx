import { ActivityIndicator, View, Text, StyleSheet } from 'react-native'
import { Colors } from '@/theme'

interface LoadingSpinnerProps {
  size?: 'small' | 'large'
  message?: string
}

export default function LoadingSpinner({ size = 'large', message }: LoadingSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={Colors.purple} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
    gap: 16,
  },
  message: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})
