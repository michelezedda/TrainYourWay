import { storageGetAsync, storageSetAsync, storageGetSync, storagePrefillCache } from './storage'

const PREFIX = 'uplift_weights_'

export function getWeights(planId: string): Record<string, string> {
  try {
    const raw = storageGetSync(PREFIX + planId)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export async function loadWeights(planId: string): Promise<Record<string, string>> {
  try {
    const raw = await storageGetAsync(PREFIX + planId)
    if (raw) storagePrefillCache(PREFIX + planId, raw)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export async function setWeight(planId: string, exercise: string, value: string): Promise<void> {
  const all = await loadWeights(planId)
  if (value.trim()) {
    all[exercise] = value
  } else {
    delete all[exercise]
  }
  const json = JSON.stringify(all)
  storagePrefillCache(PREFIX + planId, json)
  await storageSetAsync(PREFIX + planId, json)
}
