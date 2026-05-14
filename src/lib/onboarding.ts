const key = (userId: string) => `onb_${userId}`

export function hasSeenOnboarding(userId: string): boolean {
  return localStorage.getItem(key(userId)) === '1'
}

export function markOnboardingSeen(userId: string): void {
  localStorage.setItem(key(userId), '1')
}
