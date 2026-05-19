import { storageGetSync, storageGetAsync, storageSetAsync, storagePrefillCache } from './storage'

export interface NutritionProfile {
  sex: 'male' | 'female'
  age: number
  weight: number
  height: number
  goals: string[]
  daysPerWeek: number
  dietType: string
  allergies: string[]
  mealsPerDay: number
}

export interface DailyTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

const STORAGE_KEY = 'uplift_nutrition_profile'

export async function saveNutritionProfile(profile: NutritionProfile): Promise<void> {
  const json = JSON.stringify(profile)
  storagePrefillCache(STORAGE_KEY, json)
  await storageSetAsync(STORAGE_KEY, json)
}

export function getNutritionProfile(): NutritionProfile | null {
  try {
    const raw = storageGetSync(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as NutritionProfile) : null
  } catch {
    return null
  }
}

export async function loadNutritionProfile(): Promise<NutritionProfile | null> {
  try {
    const raw = await storageGetAsync(STORAGE_KEY)
    if (raw) storagePrefillCache(STORAGE_KEY, raw)
    return raw ? (JSON.parse(raw) as NutritionProfile) : null
  } catch {
    return null
  }
}

export function calculateTargets(profile: NutritionProfile): DailyTargets {
  const bmr =
    profile.sex === 'male'
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161

  const activityFactors = [1.2, 1.375, 1.375, 1.55, 1.55, 1.725, 1.725, 1.9]
  const tdee = bmr * (activityFactors[Math.min(profile.daysPerWeek, 7)] ?? 1.375)

  const isWeightLoss = profile.goals.some(g => /weight.?loss|fat.?loss/i.test(g))
  const isMuscleGain = profile.goals.some(g => /muscle/i.test(g))
  const isKeto = profile.dietType === 'keto'

  const targetKcal = Math.round(
    isWeightLoss ? tdee - 400 : isMuscleGain ? tdee + 200 : tdee,
  )

  const proteinRatio = isKeto ? 0.25 : isMuscleGain ? 0.30 : isWeightLoss ? 0.32 : 0.25
  const fatRatio = isKeto ? 0.65 : isMuscleGain ? 0.20 : 0.25
  const carbRatio = 1 - proteinRatio - fatRatio

  return {
    kcal: targetKcal,
    protein: Math.round((targetKcal * proteinRatio) / 4),
    carbs: Math.round((targetKcal * carbRatio) / 4),
    fat: Math.round((targetKcal * fatRatio) / 9),
  }
}
