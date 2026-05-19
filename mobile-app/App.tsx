import 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MoodProvider } from '@/context/MoodContext'
import { LocaleProvider } from '@/context/LocaleContext'
import RootNavigator from '@/navigation/RootNavigator'

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <MoodProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </MoodProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  )
}
