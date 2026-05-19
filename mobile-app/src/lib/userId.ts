import * as Crypto from 'expo-crypto'
import { storageGetAsync, storageSetAsync, storageGetSync, storagePrefillCache } from './storage'

const KEY = 'tyw_user_id'

let _authUserId: string | null = null

export function setAuthUserId(id: string | null) {
  _authUserId = id
}

export function getUserId(): string {
  if (_authUserId) return _authUserId
  const cached = storageGetSync(KEY)
  return cached ?? 'pending-init'
}

export async function initUserId(): Promise<string> {
  if (_authUserId) return _authUserId
  let id = await storageGetAsync(KEY)
  if (!id) {
    id = Crypto.randomUUID()
    await storageSetAsync(KEY, id)
  }
  storagePrefillCache(KEY, id)
  return id
}
