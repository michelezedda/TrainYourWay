export interface OpenFoodFactsProduct {
  productName: string
  brand: string
  nutriscoreGrade: string
  novaGroup: number | null
  nutriments: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    sugars_100g?: number
    'saturated-fat_100g'?: number
    fiber_100g?: number
    sodium_100g?: number
  }
  imageUrl: string
  allergenTags: string[]
}

export interface OFFProduct {
  product_name: string
  brands: string
  nutriscore_grade?: string
  nova_group?: number
  nutriments: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    sugars_100g?: number
    'saturated-fat_100g'?: number
    fiber_100g?: number
    sodium_100g?: number
  }
  image_url: string
  allergens_tags?: string[]
  ingredients_text?: string
}

export interface ScanHistoryEntry {
  barcode: string
  name: string
  brand: string
  grade: string
  gradeColor: string
  scannedAt: number
}

export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' } },
    )
    const json = await res.json() as {
      status: number
      product?: {
        product_name?: string
        brands?: string
        nutriscore_grade?: string
        nova_group?: number
        nutriments?: Record<string, number>
        image_url?: string
        allergens_tags?: string[]
      }
    }

    if (json.status !== 1 || !json.product) return null

    const p = json.product
    return {
      productName: p.product_name ?? 'Unknown product',
      brand: p.brands ?? '',
      nutriscoreGrade: p.nutriscore_grade ?? '',
      novaGroup: p.nova_group ?? null,
      nutriments: (p.nutriments ?? {}) as OpenFoodFactsProduct['nutriments'],
      imageUrl: p.image_url ?? '',
      allergenTags: p.allergens_tags ?? [],
    }
  } catch {
    return null
  }
}

export async function fetchProduct(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'UPLYFT-Mobile/1.0' } },
    )
    const json = await res.json() as {
      status: number
      product?: Record<string, unknown>
    }

    if (json.status !== 1 || !json.product) return null

    const p = json.product
    return {
      product_name: (p.product_name as string) ?? 'Unknown product',
      brands: (p.brands as string) ?? '',
      nutriscore_grade: p.nutriscore_grade as string | undefined,
      nova_group: p.nova_group as number | undefined,
      nutriments: (p.nutriments ?? {}) as OFFProduct['nutriments'],
      image_url: (p.image_url as string) ?? '',
      allergens_tags: (p.allergens_tags as string[]) ?? [],
      ingredients_text: p.ingredients_text as string | undefined,
    }
  } catch {
    return null
  }
}
