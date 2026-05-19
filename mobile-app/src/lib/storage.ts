import AsyncStorage from '@react-native-async-storage/async-storage'

const cache: Record<string, string | null> = {}

export async function storageGetAsync(key: string): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(key)
    cache[key] = val
    return val
  } catch {
    return null
  }
}

export async function storageSetAsync(key: string, value: string): Promise<void> {
  try {
    cache[key] = value
    await AsyncStorage.setItem(key, value)
  } catch { /* quota */ }
}

export async function storageRemoveAsync(key: string): Promise<void> {
  try {
    delete cache[key]
    await AsyncStorage.removeItem(key)
  } catch { /* ignore */ }
}

export async function storageGetAllKeys(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    return [...keys]
  } catch {
    return []
  }
}

export async function storageMultiRemove(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys)
    keys.forEach(k => delete cache[k])
  } catch { /* ignore */ }
}

export function storageGetSync(key: string): string | null {
  return cache[key] ?? null
}

export function storagePrefillCache(key: string, value: string | null): void {
  cache[key] = value
}
