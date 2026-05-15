export interface OFFNutriments {
  'energy-kcal_100g': number
  proteins_100g: number
  carbohydrates_100g: number
  sugars_100g: number
  fat_100g: number
  'saturated-fat_100g': number
  fiber_100g: number
  sodium_100g: number
}

export interface OFFProduct {
  product_name: string
  brands: string
  image_url: string
  nutriscore_grade: 'a' | 'b' | 'c' | 'd' | 'e' | 'unknown' | ''
  nova_group: 1 | 2 | 3 | 4
  allergens_tags: string[]
  ingredients_text: string
  labels_tags: string[]
  nutriments: Partial<OFFNutriments>
  categories_tags: string[]
}

export async function fetchProduct(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'UPLYFT-App/1.0' } },
    )
    if (!res.ok) return null
    const data = await res.json() as { status: number; product: OFFProduct }
    if (data.status !== 1) return null
    return data.product
  } catch {
    return null
  }
}

export interface ScanHistoryEntry {
  barcode: string
  name: string
  brand: string
  grade: string
  gradeColor: string
  scannedAt: number
}

const HISTORY_KEY = 'tyw_scan_history'
const MAX_HISTORY = 20

export function getScanHistory(): ScanHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as ScanHistoryEntry[]
  } catch {
    return []
  }
}

export function addToScanHistory(entry: ScanHistoryEntry): void {
  const history = getScanHistory().filter(h => h.barcode !== entry.barcode)
  history.unshift(entry)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}
