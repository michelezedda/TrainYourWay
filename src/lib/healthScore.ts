import type { OFFProduct } from './openFoodFacts'
import type { NutritionProfile } from './nutrition'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Verdict {
  text: string
  type: 'positive' | 'negative' | 'warning'
}

export interface ScoredProduct {
  grade: Grade
  gradeColor: string
  gradeBg: string
  numericScore: number
  verdicts: Verdict[]
  isUltraProcessed: boolean
  allergenWarnings: string[]
  needsAlternative: boolean
  gradeLabel: string
}

const GRADE_MAP: Record<string, number> = { a: 5, b: 4, c: 3, d: 2, e: 1 }

const GRADE_COLOR: Record<Grade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  E: '#ef4444',
}

const GRADE_BG: Record<Grade, string> = {
  A: 'rgba(34,197,94,0.15)',
  B: 'rgba(132,204,22,0.15)',
  C: 'rgba(234,179,8,0.15)',
  D: 'rgba(249,115,22,0.15)',
  E: 'rgba(239,68,68,0.15)',
}

const GRADE_LABEL: Record<Grade, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Fair',
  D: 'Poor',
  E: 'Avoid',
}

const NOVA_COLOR = ['', '#22c55e', '#84cc16', '#f97316', '#ef4444']

export function novaColor(group: number): string {
  return NOVA_COLOR[group] ?? '#ef4444'
}

// Normalise allergen tag to readable label: "en:gluten" → "gluten"
function allergenLabel(tag: string): string {
  return tag.replace(/^en:/, '').replace(/-/g, ' ')
}

// Map profile allergy strings to OFF allergen tag patterns
const ALLERGY_TAG_MAP: Record<string, string> = {
  'gluten-free':    'gluten',
  'dairy-free':     'milk',
  'nut-free':       'nuts',
  'peanut-free':    'peanuts',
  'egg-free':       'eggs',
  'soy-free':       'soybeans',
  'shellfish-free': 'crustaceans',
  'fish-free':      'fish',
}

function scoreToGrade(score: number): Grade {
  if (score >= 4.5) return 'A'
  if (score >= 3.5) return 'B'
  if (score >= 2.5) return 'C'
  if (score >= 1.5) return 'D'
  return 'E'
}

export function scoreProduct(
  product: OFFProduct,
  profile: NutritionProfile | null,
): ScoredProduct {
  const n = product.nutriments ?? {}
  const kcal    = n['energy-kcal_100g'] ?? 0
  const protein = n.proteins_100g ?? 0
  const sugars  = n.sugars_100g ?? 0
  const satFat  = n['saturated-fat_100g'] ?? 0
  const fiber   = n.fiber_100g ?? 0
  const sodium  = n.sodium_100g ?? 0
  const nova    = product.nova_group ?? 0
  const isUltraProcessed = nova === 4

  // Base score from official Nutri-Score
  const rawGrade = (product.nutriscore_grade ?? '').toLowerCase()
  let score = GRADE_MAP[rawGrade] ?? 3 // default C when unknown

  // NOVA penalty
  if (nova === 4) score -= 1
  else if (nova === 3) score -= 0.5

  // Profile-based bonuses
  if (profile) {
    const goals = profile.goals.map(g => g.toLowerCase())
    const wantsMuslce = goals.some(g => g.includes('muscle'))
    const wantsLoss   = goals.some(g => g.includes('weight') || g.includes('fat'))

    if (wantsMuslce && protein > 15) score += 0.5
    if (wantsLoss && sugars < 5)     score += 0.5
    if (wantsLoss && kcal < 200)     score += 0.3
  }

  score = Math.min(5, Math.max(1, score))
  const grade = scoreToGrade(score)

  // Verdicts
  const verdicts: Verdict[] = []

  if (protein >= 15) verdicts.push({ text: 'High protein', type: 'positive' })
  if (fiber >= 5)    verdicts.push({ text: 'High fiber',   type: 'positive' })
  if (sugars < 5)    verdicts.push({ text: 'Low sugar',    type: 'positive' })
  if (kcal < 150 && kcal > 0) verdicts.push({ text: 'Low calorie', type: 'positive' })

  if (isUltraProcessed)   verdicts.push({ text: 'Ultra-processed', type: 'negative' })
  if (sugars > 15)        verdicts.push({ text: 'High sugar',      type: 'negative' })
  if (sodium > 0.6)       verdicts.push({ text: 'High sodium',     type: 'negative' })
  if (satFat > 5)         verdicts.push({ text: 'High sat fat',    type: 'negative' })
  if (kcal > 450)         verdicts.push({ text: 'Very caloric',    type: 'negative' })

  // Diet compatibility
  if (profile?.dietType === 'vegan') {
    const isVegan = product.labels_tags?.some(t => t.includes('vegan'))
    if (isVegan)  verdicts.push({ text: 'Vegan', type: 'positive' })
    else          verdicts.push({ text: 'Not vegan', type: 'warning' })
  }

  // Allergen warnings
  const allergenWarnings: string[] = []
  if (profile?.allergies?.length) {
    for (const allergy of profile.allergies) {
      const tag = ALLERGY_TAG_MAP[allergy.toLowerCase()]
      if (tag) {
        const matched = product.allergens_tags?.some(a => a.includes(tag))
        if (matched) {
          const label = `Contains ${allergenLabel(tag)}`
          allergenWarnings.push(label)
          verdicts.push({ text: label, type: 'warning' })
        }
      }
    }
  }

  // Cap verdicts at 6 — keep warnings first, then negatives, then positives
  const ordered = [
    ...verdicts.filter(v => v.type === 'warning'),
    ...verdicts.filter(v => v.type === 'negative'),
    ...verdicts.filter(v => v.type === 'positive'),
  ].slice(0, 6)

  return {
    grade,
    gradeColor: GRADE_COLOR[grade],
    gradeBg:    GRADE_BG[grade],
    numericScore: score,
    verdicts: ordered,
    isUltraProcessed,
    allergenWarnings,
    needsAlternative: grade === 'D' || grade === 'E',
    gradeLabel: GRADE_LABEL[grade],
  }
}

export { GRADE_COLOR, GRADE_BG, NOVA_COLOR }
