// ── Food product cache ────────────────────────────────────────────────────────
// Two-tier: in-memory Map (instant) + AsyncStorage (persistent across restarts).
//
// TTL semantics — two thresholds, never a hard eviction:
//   FRESH  (0–14 days)  → return immediately, skip network entirely
//   STALE (14–90 days) → return immediately (unblocking), refresh in background
//   ANCIENT (>90 days) → re-fetch synchronously but STILL fall back to old data
//                        if all external providers fail
//
// The cache NEVER returns null if it has ANY previous data for a barcode.
// A product previously found can only disappear if the user explicitly clears
// their data — never due to TTL, network failure, or API outage.

import { storageGetAsync, storageSetAsync } from '../storage'
import type { FoodProduct } from './types'
import { foodLog } from './log'

const PREFIX = 'tyw-food-v1-'
const FRESH_MS  = 14 * 24 * 60 * 60 * 1000   // 14 days
const STALE_MS  = 90 * 24 * 60 * 60 * 1000   // 90 days

// In-memory hot cache — survives the session, clears on app restart
const memCache = new Map<string, FoodProduct>()

export type CacheEntry = {
  product: FoodProduct
  isFresh: boolean   // true = within FRESH_MS, no network needed
  isStale: boolean   // true = within STALE_MS, serve + background-refresh
  isAncient: boolean // true = older than STALE_MS, re-fetch but fall back here
}

function classifyAge(fetchedAt: number): Pick<CacheEntry, 'isFresh' | 'isStale' | 'isAncient'> {
  const age = Date.now() - (fetchedAt || 0)
  return {
    isFresh:   age < FRESH_MS,
    isStale:   age >= FRESH_MS && age < STALE_MS,
    isAncient: age >= STALE_MS,
  }
}

// Returns whatever is cached regardless of age.
// Returns null only if the barcode has truly never been seen.
export async function getCachedEntry(barcode: string): Promise<CacheEntry | null> {
  // 1. In-memory (zero I/O)
  const mem = memCache.get(barcode)
  if (mem) {
    foodLog('mem-hit', barcode)
    return { product: { ...mem, source: 'internal' }, ...classifyAge(mem.fetchedAt) }
  }

  // 2. AsyncStorage (persisted across restarts)
  try {
    const raw = await storageGetAsync(`${PREFIX}${barcode}`)
    if (!raw) return null
    const product = JSON.parse(raw) as FoodProduct
    // Warm the in-memory cache for this session
    memCache.set(barcode, product)
    foodLog('disk-hit', barcode, `age=${Math.round((Date.now() - product.fetchedAt) / 86400000)}d`)
    return { product: { ...product, source: 'internal' }, ...classifyAge(product.fetchedAt) }
  } catch (err) {
    foodLog('cache-read-error', barcode, String(err))
    return null
  }
}

// Writes to memory + disk. Returns true if disk write was verified.
export async function setCached(product: FoodProduct): Promise<boolean> {
  if (!product.barcode) return false

  const record: FoodProduct = { ...product, fetchedAt: Date.now() }
  const key = `${PREFIX}${product.barcode}`
  const json = JSON.stringify(record)

  // 1. Update in-memory immediately (synchronous, always succeeds)
  memCache.set(product.barcode, record)

  // 2. Persist to AsyncStorage and verify
  try {
    await storageSetAsync(key, json)
    // Verify the write actually landed
    const verify = await storageGetAsync(key)
    const ok = verify === json
    if (!ok) {
      foodLog('cache-write-verify-failed', product.barcode)
    } else {
      foodLog('cache-write-ok', product.barcode, `source=${product.source}`)
    }
    return ok
  } catch (err) {
    foodLog('cache-write-error', product.barcode, String(err))
    // In-memory write succeeded so this session is still fine
    return false
  }
}

// Replaces cached entry only if the new product has richer data.
// Prevents a partial USDA result from wiping a full OFF entry.
export async function updateCachedIfBetter(
  barcode: string,
  incoming: FoodProduct,
): Promise<void> {
  const existing = await getCachedEntry(barcode)
  if (!existing) {
    await setCached(incoming)
    return
  }
  // "Better" = more non-null macro fields
  const score = (p: FoodProduct) =>
    [p.kcalPer100g, p.proteinPer100g, p.carbsPer100g, p.fatPer100g,
     p.ingredients, p.imageUrl].filter(v => v != null).length
  if (score(incoming) >= score(existing.product)) {
    await setCached(incoming)
  } else {
    foodLog('cache-skip-downgrade', barcode,
      `existing=${score(existing.product)} incoming=${score(incoming)}`)
  }
}

// Prewarms the in-memory cache at app start (optional — call from App.tsx)
export async function prewarmCache(): Promise<void> {
  try {
    const { storageGetAllKeys } = await import('../storage')
    const keys = await storageGetAllKeys()
    const foodKeys = keys.filter(k => k.startsWith(PREFIX))
    await Promise.all(foodKeys.map(k => getCachedEntry(k.slice(PREFIX.length))))
    foodLog('prewarm', 'done', `${foodKeys.length} entries`)
  } catch {
    // prewarm is best-effort
  }
}
