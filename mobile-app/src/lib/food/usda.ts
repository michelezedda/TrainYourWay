// ── USDA FoodData Central ─────────────────────────────────────────────────────
// Primary nutrition authority. Best for branded + generic NA foods.
// API key: https://api.data.gov/signup (free, 1000 req/hr)
// Set EXPO_PUBLIC_USDA_API_KEY in your .env file.

import type { FoodProduct } from './types'

const BASE = 'https://api.nal.usda.gov/fdc/v1'
const API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY'

// USDA stores GTIN-14 (14-digit zero-padded). UPC-A/EAN-13 must be padded.
function toGTIN14(barcode: string): string {
  return barcode.replace(/\D/g, '').padStart(14, '0')
}

// Nutrient IDs in the FoodData Central schema
const NID = {
  kcal: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  saturatedFat: 1258,
  sugars: 2000,
  fiber: 1079,
  sodium: 1093,   // reported in mg/100g by USDA
} as const

interface USDANutrient {
  nutrientId: number
  value: number
}

interface USDAFood {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients: USDANutrient[]
}

interface USDASearchResponse {
  totalHits: number
  foods: USDAFood[]
}

function getNutrient(nutrients: USDANutrient[], id: number): number | null {
  const n = nutrients.find(n => n.nutrientId === id)
  return n != null ? n.value : null
}

function normalizeUSDAFood(food: USDAFood, barcode: string): FoodProduct {
  const n = food.foodNutrients
  const sodiumMg = getNutrient(n, NID.sodium)
  return {
    name: food.description
      .replace(/,\s*(UPC|GTIN).*$/i, '')
      .split(',')[0]
      .trim(),
    brand: food.brandName ?? food.brandOwner ?? '',
    barcode,
    kcalPer100g: getNutrient(n, NID.kcal),
    proteinPer100g: getNutrient(n, NID.protein),
    carbsPer100g: getNutrient(n, NID.carbs),
    fatPer100g: getNutrient(n, NID.fat),
    saturatedFatPer100g: getNutrient(n, NID.saturatedFat),
    sugarsPer100g: getNutrient(n, NID.sugars),
    fiberPer100g: getNutrient(n, NID.fiber),
    sodiumPer100g: sodiumMg != null ? sodiumMg / 1000 : null,  // mg → g
    servingSize: food.servingSize ?? null,
    servingUnit: food.servingSizeUnit ?? null,
    ingredients: null,
    allergens: [],
    imageUrl: null,
    nutriscoreGrade: null,
    novaGroup: null,
    source: 'usda',
    confidence: 0.95,
    fetchedAt: Date.now(),
  }
}

export async function lookupByBarcodeUSDA(barcode: string): Promise<FoodProduct | null> {
  if (!barcode.trim()) return null
  try {
    const gtin14 = toGTIN14(barcode)
    const url = `${BASE}/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=10&api_key=${API_KEY}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json() as USDASearchResponse
    const match = data.foods?.find(f => f.gtinUpc === gtin14)
    if (!match) return null
    return normalizeUSDAFood(match, barcode)
  } catch {
    return null
  }
}

// Text/NLP search (used by DietScreen or future NLP feature)
export async function searchUSDA(query: string): Promise<FoodProduct[]> {
  if (!query.trim()) return []
  try {
    const url = `${BASE}/foods/search?query=${encodeURIComponent(query)}&pageSize=5&api_key=${API_KEY}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json() as USDASearchResponse
    return (data.foods ?? []).map(f => normalizeUSDAFood(f, f.gtinUpc ?? ''))
  } catch {
    return []
  }
}
