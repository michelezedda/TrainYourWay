// ── Hybrid food lookup orchestrator ───────────────────────────────────────────
// Priority chain: internal cache -> USDA -> Edamam -> Open Food Facts
//
// Cache tiers:
//   FRESH  (0-14 days)  - return immediately, no network
//   STALE  (14-90 days) - return immediately, refresh in background
//   ANCIENT (>90 days)  - re-fetch synchronously, fall back to old data if all fail
//   MISS                - fetch synchronously from provider chain
//
// Barcode normalization: EAN-13 starting with "0" is collapsed to 12-digit UPC-A
// so the same physical product always maps to the same cache key regardless of
// which scanner/API produced the barcode string.

import { getCachedEntry, setCached, updateCachedIfBetter } from './cache'
import { lookupByBarcodeUSDA } from './usda'
import { lookupByBarcodeEdamam } from './edamam'
import { lookupByBarcodeOFF } from './off'
import { foodLog } from './log'
import type { FoodProduct } from './types'

export type { FoodProduct, FoodSource, ScanHistoryEntry } from './types'

// EAN-13 barcodes that start with "0" are equivalent UPC-A with a leading zero.
// Normalize to 12-digit UPC-A so both representations share the same cache key.
export function normalizeBarcode(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('0')) {
    return digits.slice(1)
  }
  return digits || raw.trim()
}

// Hits the provider chain in priority order: USDA -> Edamam -> OFF.
// Returns the first successful result, or null if all fail.
async function fetchFromProviders(barcode: string): Promise<FoodProduct | null> {
  const usda = await lookupByBarcodeUSDA(barcode)
  if (usda) {
    foodLog('provider-hit', barcode, 'source=usda')
    return usda
  }

  const edamam = await lookupByBarcodeEdamam(barcode)
  if (edamam) {
    foodLog('provider-hit', barcode, 'source=edamam')
    return edamam
  }

  const off = await lookupByBarcodeOFF(barcode)
  if (off) {
    foodLog('provider-hit', barcode, 'source=off')
    return off
  }

  foodLog('provider-miss', barcode, 'all-providers-failed')
  return null
}

// Background refresh - fires and forgets. Does not block the caller.
// Uses updateCachedIfBetter so a partial result never overwrites richer data.
function scheduleBackgroundRefresh(barcode: string): void {
  Promise.resolve().then(async () => {
    foodLog('bg-refresh-start', barcode)
    const fresh = await fetchFromProviders(barcode)
    if (fresh) {
      await updateCachedIfBetter(barcode, fresh)
      foodLog('bg-refresh-done', barcode, `source=${fresh.source}`)
    } else {
      foodLog('bg-refresh-noop', barcode, 'no-provider-returned-data')
    }
  })
}

export async function lookupByBarcode(barcode: string): Promise<FoodProduct | null> {
  const clean = normalizeBarcode(barcode)
  if (!clean) return null

  const entry = await getCachedEntry(clean)

  if (entry) {
    if (entry.isFresh) {
      foodLog('cache-fresh', clean)
      return entry.product
    }

    if (entry.isStale) {
      // Return immediately, kick off a background refresh
      foodLog('cache-stale', clean, 'serving-and-refreshing')
      scheduleBackgroundRefresh(clean)
      return entry.product
    }

    // ANCIENT: re-fetch synchronously, fall back to old data if all providers fail
    foodLog('cache-ancient', clean, 're-fetching')
    const fresh = await fetchFromProviders(clean)
    if (fresh) {
      await updateCachedIfBetter(clean, fresh)
      return fresh
    }
    // All providers failed - return stale data rather than dropping it
    foodLog('cache-ancient-fallback', clean, 'all-providers-failed-serving-old')
    return entry.product
  }

  // Cache miss - fetch synchronously
  foodLog('cache-miss', clean)
  const product = await fetchFromProviders(clean)
  if (product) {
    await setCached(product)
  }
  return product
}

export const SOURCE_LABEL: Record<string, string> = {
  internal: 'Cached',
  usda: 'USDA FoodData Central',
  edamam: 'Edamam',
  off: 'Open Food Facts',
  ai: 'AI Extraction',
}
