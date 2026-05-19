import { useEffect } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Colors } from '@/theme'
import { db } from '@/lib/db'
import { setAuthUserId } from '@/lib/userId'
import type { RootStackParamList } from './types'
import LoadingSpinner from '@/components/LoadingSpinner'

import LandingScreen from '@/screens/onboarding/LandingScreen'
import AuthScreen from '@/screens/onboarding/AuthScreen'
import QuestionnaireScreen from '@/screens/onboarding/QuestionnaireScreen'
import GeneratingScreen from '@/screens/onboarding/GeneratingScreen'
import ResultsScreen from '@/screens/training/ResultsScreen'
import AppNavigator from './AppNavigator'

const Stack = createNativeStackNavigator<RootStackParamList>()

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.bg },
  animation: 'fade' as const,
}

function AuthGuardNavigator() {
  const { isLoading, user } = db.useAuth()

  const { data: planData, isLoading: plansLoading } = db.useQuery(
    user ? { workoutPlans: { $: { where: { userId: user.id } } } } : null,
  )

  if (isLoading || (user && plansLoading)) {
    return <LoadingSpinner message="Getting everything ready..." />
  }

  const hasPlans = (planData?.workoutPlans ?? []).length > 0

  if (!user) {
    return (
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
        <Stack.Screen name="Generating" component={GeneratingScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
      </Stack.Navigator>
    )
  }

  if (!hasPlans) {
    return (
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
        <Stack.Screen name="Generating" component={GeneratingScreen} />
        <Stack.Screen name="Results" component={ResultsScreen} />
      </Stack.Navigator>
    )
  }

  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="App" component={AppNavigator} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="Generating" component={GeneratingScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
    </Stack.Navigator>
  )
}

export default function RootNavigator() {
  const { user } = db.useAuth()
  useEffect(() => { setAuthUserId(user?.id ?? null) }, [user?.id])

  return <AuthGuardNavigator />
}
