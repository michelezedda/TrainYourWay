export interface NutritionProfile {
  sex: 'male' | 'female'
  age: number
  weight: number   // kg
  height: number   // cm
  goals: string[]
  daysPerWeek: number
  dietType: string    // 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo'
  allergies: string[] // e.g. ['Gluten-free', 'Dairy-free']
  mealsPerDay: number // 2 | 3 | 4 | 5
}

export interface DailyTargets {
  kcal: number
  protein: number  // grams
  carbs: number    // grams
  fat: number      // grams
}

const STORAGE_KEY = 'uplift_nutrition_profile'

export function saveNutritionProfile(profile: NutritionProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}

export function getNutritionProfile(): NutritionProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as NutritionProfile) : null
  } catch {
    return null
  }
}

export function calculateTargets(profile: NutritionProfile): DailyTargets {
  // Mifflin-St Jeor BMR
  const bmr =
    profile.sex === 'male'
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161

  // Activity multiplier indexed by training days per week (0-7)
  const activityFactors = [1.2, 1.375, 1.375, 1.55, 1.55, 1.725, 1.725, 1.9]
  const tdee = bmr * (activityFactors[Math.min(profile.daysPerWeek, 7)] ?? 1.375)

  const isWeightLoss = profile.goals.some(g => /weight.?loss|fat.?loss/i.test(g))
  const isMuscleGain = profile.goals.some(g => /muscle/i.test(g))
  const isKeto = profile.dietType === 'keto'

  const targetKcal = Math.round(
    isWeightLoss ? tdee - 400 : isMuscleGain ? tdee + 200 : tdee,
  )

  // Macro ratios — keto overrides standard splits
  const proteinRatio = isKeto ? 0.25 : isMuscleGain ? 0.30 : isWeightLoss ? 0.32 : 0.25
  const fatRatio     = isKeto ? 0.65 : isMuscleGain ? 0.20 : 0.25
  const carbRatio    = 1 - proteinRatio - fatRatio

  return {
    kcal:    targetKcal,
    protein: Math.round((targetKcal * proteinRatio) / 4),
    carbs:   Math.round((targetKcal * carbRatio) / 4),
    fat:     Math.round((targetKcal * fatRatio) / 9),
  }
}
