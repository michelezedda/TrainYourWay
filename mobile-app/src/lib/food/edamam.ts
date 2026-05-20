// ── Edamam Food Database ──────────────────────────────────────────────────────
// Strong UPC coverage for branded NA packaged foods + NLP food parsing.
// Get keys at: https://developer.edamam.com/food-database-api
// Set EXPO_PUBLIC_EDAMAM_APP_ID and EXPO_PUBLIC_EDAMAM_APP_KEY in .env

import type { FoodProduct } from './types'

const BASE = 'https://api.edamam.com/api/food-database/v2'
const APP_ID = process.env.EXPO_PUBLIC_EDAMAM_APP_ID ?? ''
const APP_KEY = process.env.EXPO_PUBLIC_EDAMAM_APP_KEY ?? ''

// Edamam nutrient keys (per 100g)
interface EdamamNutrients {
  ENERC_KCAL?: number   // Energy kcal
  PROCNT?: number        // Protein
  CHOCDF?: number        // Carbohydrates
  FAT?: number           // Total fat
  FASAT?: number         // Saturated fat
  SUGAR?: number         // Sugars
  FIBTG?: number         // Fiber
  NA?: number            // Sodium mg
}

interface EdamamFood {
  foodId: string
  label: string
  brand?: string
  nutrients: EdamamNutrients
  image?: string
  category?: string
}

interface EdamamResponse {
  parsed?: Array<{ food: EdamamFood }>
  hints?: Array<{ food: EdamamFood }>
}

function normalizeEdamamFood(food: EdamamFood, barcode: string): FoodProduct {
  const n = food.nutrients
  const sodiumMg = n.NA ?? null
  return {
    name: food.label,
    brand: food.brand ?? '',
    barcode,
    kcalPer100g: n.ENERC_KCAL ?? null,
    proteinPer100g: n.PROCNT ?? null,
    carbsPer100g: n.CHOCDF ?? null,
    fatPer100g: n.FAT ?? null,
    saturatedFatPer100g: n.FASAT ?? null,
    sugarsPer100g: n.SUGAR ?? null,
    fiberPer100g: n.FIBTG ?? null,
    sodiumPer100g: sodiumMg != null ? sodiumMg / 1000 : null,  // mg → g
    servingSize: null,
    servingUnit: null,
    ingredients: null,
    allergens: [],
    imageUrl: food.image ?? null,
    nutriscoreGrade: null,
    novaGroup: null,
    source: 'edamam',
    confidence: 0.88,
    fetchedAt: Date.now(),
  }
}

function hasCredentials(): boolean {
  return Boolean(APP_ID && APP_KEY)
}

export async function lookupByBarcodeEdamam(barcode: string): Promise<FoodProduct | null> {
  if (!barcode.trim() || !hasCredentials()) return null
  try {
    const url = `${BASE}/parser?upc=${encodeURIComponent(barcode)}&app_id=${APP_ID}&app_key=${APP_KEY}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as EdamamResponse
    const food = data.parsed?.[0]?.food ?? data.hints?.[0]?.food
    if (!food) return null
    return normalizeEdamamFood(food, barcode)
  } catch {
    return null
  }
}

// NLP text parsing - "2 eggs and toast", "protein bar 50g"
export async function parseNLPEdamam(text: string): Promise<FoodProduct[]> {
  if (!text.trim() || !hasCredentials()) return []
  try {
    const url = `${BASE}/parser?ingr=${encodeURIComponent(text)}&app_id=${APP_ID}&app_key=${APP_KEY}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json() as EdamamResponse
    const results = [...(data.parsed ?? []), ...(data.hints?.slice(0, 3) ?? [])]
    return results.map(r => normalizeEdamamFood(r.food, ''))
  } catch {
    return []
  }
}
