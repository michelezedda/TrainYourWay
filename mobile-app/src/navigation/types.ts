import type { NavigatorScreenParams } from '@react-navigation/native'

export type RootStackParamList = {
  Landing: undefined
  Auth: undefined
  Questionnaire: undefined
  Generating: { formData: Record<string, unknown> }
  Results: { planId: string; plan: string; analysis?: string; formData?: string }
  App: undefined
}

export type AppTabParamList = {
  Workout: NavigatorScreenParams<TrainingStackParamList>
  Diet: NavigatorScreenParams<DietStackParamList>
  Dashboard: undefined
  Wellness: NavigatorScreenParams<WellnessStackParamList>
  Scanner: undefined
  Me: NavigatorScreenParams<MeStackParamList>
}

export type DietStackParamList = {
  DietHome: undefined
  FoodScanner: undefined
}

export type MeStackParamList = {
  MeHome: undefined
  Community: undefined
  Support: undefined
  MachineScanner: undefined
}

export type WellnessStackParamList = {
  WellnessHome: undefined
  Breathing: undefined
  Focus: undefined
  Journal: undefined
  Affirmations: undefined
  Session: { type: 'breathing' | 'meditation' | 'sleep' | 'focus' | 'journal' }
}

export type TrainingStackParamList = {
  WorkoutHome: undefined
  Reevaluate: {
    planId: string
    originalPlan: string
    userName: string
    fitnessLevel: string
    goals: string
    equipment: string
  }
  Import: undefined
}
