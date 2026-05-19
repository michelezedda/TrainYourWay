import { storageGetAsync, storageSetAsync } from './storage'

const key = (userId: string) => `onb_${userId}`

export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  const val = await storageGetAsync(key(userId))
  return val === '1'
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  await storageSetAsync(key(userId), '1')
}
