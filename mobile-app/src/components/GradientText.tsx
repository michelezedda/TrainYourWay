import { Text, View, StyleProp, TextStyle, ViewStyle } from 'react-native'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'

type Props = {
  children: string
  style?: StyleProp<TextStyle>
  containerStyle?: StyleProp<ViewStyle>
  colors?: string[]
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  numberOfLines?: number
}

const DEFAULT_COLORS: [string, string] = ['#A855F7', '#22D3EE']

export default function GradientText({
  children,
  style,
  containerStyle,
  colors = DEFAULT_COLORS,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  numberOfLines,
}: Props) {
  const masked = (
    <MaskedView
      style={{ backgroundColor: 'transparent' }}
      maskElement={
        <Text style={[style, { backgroundColor: 'transparent' }]} numberOfLines={numberOfLines}>{children}</Text>
      }
    >
      <LinearGradient colors={colors as [string, string, ...string[]]} start={start} end={end}>
        <Text style={[style, { opacity: 0 }]} numberOfLines={numberOfLines}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  )
  if (containerStyle) {
    return <View style={containerStyle}>{masked}</View>
  }
  return masked
}
