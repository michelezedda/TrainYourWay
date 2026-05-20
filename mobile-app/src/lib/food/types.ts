// ── Unified food product schema ───────────────────────────────────────────────
// All providers normalize into this type. The frontend never touches
// provider-specific shapes.

export type FoodSource = 'internal' | 'usda' | 'edamam' | 'off' | 'ai'

export interface FoodProduct {
  // Identity
  name: string
  brand: string
  barcode: string | null

  // Nutrition per 100g (null = not available from this provider)
  kcalPer100g: number | null
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  sugarsPer100g: number | null
  fiberPer100g: number | null
  sodiumPer100g: number | null       // grams per 100g
  saturatedFatPer100g: number | null

  // Serving
  servingSize: number | null
  servingUnit: string | null

  // Extra
  ingredients: string | null
  allergens: string[]                // e.g. ['gluten', 'milk']
  imageUrl: string | null

  // Health classification (only OFF provides these reliably)
  nutriscoreGrade: string | null     // A–E
  novaGroup: number | null           // 1–4

  // Provenance
  source: FoodSource
  confidence: number                 // 0–1
  fetchedAt: number
}

// Scan history entry stored locally
export interface ScanHistoryEntry {
  barcode: string
  name: string
  brand: string
  grade: string
  gradeColor: string
  source: FoodSource
  scannedAt: number
}
