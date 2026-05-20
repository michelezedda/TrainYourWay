import type { FoodProduct } from './food/types'

export type NovaGroup = 1 | 2 | 3 | 4

export interface FoodScore {
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  gradeColor: string
  novaGroup: NovaGroup | null
  novaLabel: string
  verdict: string
  tips: string[]
}

export interface Verdict {
  type: 'positive' | 'negative' | 'warning'
  text: string
}

export interface ScoredProduct {
  grade: 'A' | 'B' | 'C' | 'D' | 'E'
  gradeColor: string
  gradeBg: string
  gradeLabel: string
  verdicts: Verdict[]
  allergenWarnings: string[]
}

export const GRADE_COLOR: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  E: '#ef4444',
}

const GRADE_BG: Record<string, string> = {
  A: 'rgba(34,197,94,0.12)',
  B: 'rgba(132,204,22,0.12)',
  C: 'rgba(234,179,8,0.12)',
  D: 'rgba(249,115,22,0.12)',
  E: 'rgba(239,68,68,0.12)',
}

const GRADE_LABELS: Record<string, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Average',
  D: 'Poor',
  E: 'Very Poor',
}

const NOVA_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#f97316',
  4: '#ef4444',
}

export function novaColor(novaGroup: number): string {
  return NOVA_COLORS[novaGroup] ?? '#94a3b8'
}

export function scoreFoodProduct(data: {
  nutriscoreGrade?: string
  novaGroup?: number
  nutriments?: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    sugars_100g?: number
    'saturated-fat_100g'?: number
    fiber_100g?: number
    sodium_100g?: number
  }
}): FoodScore {
  const nutriGrade = data.nutriscoreGrade?.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E' | undefined
  const nova = (data.novaGroup as NovaGroup | undefined) ?? null

  const grade = nutriGrade ?? 'C'
  const gradeColor = GRADE_COLOR[grade] ?? '#eab308'

  const novaLabels: Record<number, string> = {
    1: 'Minimally processed',
    2: 'Processed culinary ingredient',
    3: 'Processed food',
    4: 'Ultra-processed food',
  }
  const novaLabel = nova ? novaLabels[nova] : 'Processing level unknown'

  const verdicts: Record<string, string> = {
    A: 'Excellent choice. This product is nutritionally strong.',
    B: 'Good choice. Solid nutritional profile.',
    C: 'Average product. Fine occasionally.',
    D: 'Below average. Consider better options.',
    E: 'Poor nutritional profile. Limit intake.',
  }
  const verdict = verdicts[grade] ?? 'Nutritional profile unknown.'

  const tips: string[] = []
  const n = data.nutriments ?? {}
  if ((n.sugars_100g ?? 0) > 20) tips.push('High sugar content. Watch portion size.')
  if ((n['saturated-fat_100g'] ?? 0) > 10) tips.push('High in saturated fat.')
  if ((n.sodium_100g ?? 0) > 0.6) tips.push('High sodium. Limit if managing blood pressure.')
  if ((n.fiber_100g ?? 0) >= 5) tips.push('Good source of fiber.')
  if ((n.proteins_100g ?? 0) >= 15) tips.push('Good protein source.')
  if (nova === 4) tips.push('Ultra-processed: contains additives to enhance flavor or shelf life.')

  return { grade, gradeColor, novaGroup: nova, novaLabel, verdict, tips }
}

export function scoreProduct(
  data: {
    nutriscore_grade?: string
    nova_group?: number
    nutriments?: {
      'energy-kcal_100g'?: number
      proteins_100g?: number
      carbohydrates_100g?: number
      fat_100g?: number
      sugars_100g?: number
      'saturated-fat_100g'?: number
      fiber_100g?: number
      sodium_100g?: number
    }
    allergens_tags?: string[]
  },
  profile: { allergies?: string[] } | null,
): ScoredProduct {
  const grade = (data.nutriscore_grade?.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E') ?? 'C'
  const gradeColor = GRADE_COLOR[grade] ?? '#eab308'
  const gradeBg = GRADE_BG[grade] ?? 'rgba(234,179,8,0.12)'
  const gradeLabel = GRADE_LABELS[grade] ?? 'Unknown'

  const n = data.nutriments ?? {}
  const verdicts: Verdict[] = []

  if (grade === 'A' || grade === 'B') verdicts.push({ type: 'positive', text: 'Strong nutritional profile' })
  if ((n.proteins_100g ?? 0) >= 15) verdicts.push({ type: 'positive', text: 'Good protein source' })
  if ((n.fiber_100g ?? 0) >= 5) verdicts.push({ type: 'positive', text: 'High in fiber' })
  if ((n.sugars_100g ?? 0) > 20) verdicts.push({ type: 'warning', text: 'High sugar content' })
  if ((n.sodium_100g ?? 0) > 0.6) verdicts.push({ type: 'warning', text: 'High sodium' })
  if (data.nova_group === 3) verdicts.push({ type: 'warning', text: 'Processed food' })
  if ((n['saturated-fat_100g'] ?? 0) > 10) verdicts.push({ type: 'negative', text: 'High in saturated fat' })
  if (data.nova_group === 4) verdicts.push({ type: 'negative', text: 'Ultra-processed food' })
  if (grade === 'D' || grade === 'E') verdicts.push({ type: 'negative', text: 'Poor nutritional quality' })

  const allergenWarnings: string[] = []
  if (profile?.allergies && data.allergens_tags) {
    const tags = data.allergens_tags.map(t => t.replace('en:', '').toLowerCase())
    for (const allergy of profile.allergies) {
      if (tags.some(t => t.includes(allergy.toLowerCase()))) {
        allergenWarnings.push(`Contains ${allergy}`)
      }
    }
  }

  return { grade, gradeColor, gradeBg, gradeLabel, verdicts, allergenWarnings }
}

// Scorer for the new unified FoodProduct schema
export function scoreNormalizedProduct(
  product: FoodProduct,
  profile: { allergies?: string[] } | null,
): ScoredProduct {
  const grade = (product.nutriscoreGrade?.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E') ?? 'C'
  const gradeColor = GRADE_COLOR[grade] ?? '#eab308'
  const gradeBg = GRADE_BG[grade] ?? 'rgba(234,179,8,0.12)'
  const gradeLabel = GRADE_LABELS[grade] ?? 'Unknown'

  const verdicts: Verdict[] = []
  if (grade === 'A' || grade === 'B') verdicts.push({ type: 'positive', text: 'Strong nutritional profile' })
  if ((product.proteinPer100g ?? 0) >= 15) verdicts.push({ type: 'positive', text: 'Good protein source' })
  if ((product.fiberPer100g ?? 0) >= 5) verdicts.push({ type: 'positive', text: 'High in fiber' })
  if ((product.sugarsPer100g ?? 0) > 20) verdicts.push({ type: 'warning', text: 'High sugar content' })
  if ((product.sodiumPer100g ?? 0) > 0.6) verdicts.push({ type: 'warning', text: 'High sodium' })
  if (product.novaGroup === 3) verdicts.push({ type: 'warning', text: 'Processed food' })
  if ((product.saturatedFatPer100g ?? 0) > 10) verdicts.push({ type: 'negative', text: 'High in saturated fat' })
  if (product.novaGroup === 4) verdicts.push({ type: 'negative', text: 'Ultra-processed food' })
  if (grade === 'D' || grade === 'E') verdicts.push({ type: 'negative', text: 'Poor nutritional quality' })

  const allergenWarnings: string[] = []
  if (profile?.allergies && product.allergens.length > 0) {
    for (const allergy of profile.allergies) {
      if (product.allergens.some(a => a.toLowerCase().includes(allergy.toLowerCase()))) {
        allergenWarnings.push(`Contains ${allergy}`)
      }
    }
  }

  return { grade, gradeColor, gradeBg, gradeLabel, verdicts, allergenWarnings }
}
