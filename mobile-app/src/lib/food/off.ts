// ── Open Food Facts (fallback only) ──────────────────────────────────────────
// Used ONLY when USDA and Edamam both fail.
// Provides long-tail UPC coverage and Nutri-Score / NOVA group data.
// Data is crowdsourced — sanitize before use.

import type { FoodProduct } from './types'

const BASE = 'https://world.openfoodfacts.org/api/v0/product'

interface OFFRawProduct {
  product_name?: string
  brands?: string
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
    sodium_100g?: number           // already in g/100g in OFF
  }
  image_url?: string
  allergens_tags?: string[]
  ingredients_text?: string
  serving_size?: string
}

function sanitizeString(s: string | undefined): string {
  if (!s) return ''
  // Strip HTML tags and excess whitespace that sometimes appears in OFF data
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function normalizeAllergens(tags: string[] | undefined): string[] {
  if (!tags) return []
  return tags
    .map(t => t.replace(/^en:/, '').replace(/-/g, ' ').trim())
    .filter(Boolean)
}

function parseServingSize(raw: string | undefined): { size: number | null; unit: string | null } {
  if (!raw) return { size: null, unit: null }
  const m = raw.match(/^([\d.]+)\s*([a-zA-Z]+)/)
  if (!m) return { size: null, unit: null }
  return { size: parseFloat(m[1]), unit: m[2].toLowerCase() }
}

export async function lookupByBarcodeOFF(barcode: string): Promise<FoodProduct | null> {
  if (!barcode.trim()) return null
  try {
    const res = await fetch(`${BASE}/${barcode}.json`, {
      headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json() as { status: number; product?: OFFRawProduct }
    if (json.status !== 1 || !json.product) return null

    const p = json.product
    const n = p.nutriments ?? {}
    const { size: servingSize, unit: servingUnit } = parseServingSize(p.serving_size)

    return {
      name: sanitizeString(p.product_name) || 'Unknown product',
      brand: sanitizeString(p.brands?.split(',')[0]),
      barcode,
      kcalPer100g: n['energy-kcal_100g'] ?? null,
      proteinPer100g: n.proteins_100g ?? null,
      carbsPer100g: n.carbohydrates_100g ?? null,
      fatPer100g: n.fat_100g ?? null,
      saturatedFatPer100g: n['saturated-fat_100g'] ?? null,
      sugarsPer100g: n.sugars_100g ?? null,
      fiberPer100g: n.fiber_100g ?? null,
      sodiumPer100g: n.sodium_100g ?? null,     // OFF already stores g/100g
      servingSize,
      servingUnit,
      ingredients: sanitizeString(p.ingredients_text) || null,
      allergens: normalizeAllergens(p.allergens_tags),
      imageUrl: p.image_url || null,
      nutriscoreGrade: p.nutriscore_grade?.toUpperCase() ?? null,
      novaGroup: p.nova_group ?? null,
      source: 'off',
      confidence: 0.72,
      fetchedAt: Date.now(),
    }
  } catch {
    return null
  }
}
