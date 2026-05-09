const PREFIX = 'uplift_weights_'

export function getWeights(planId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + planId) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function setWeight(planId: string, exercise: string, value: string): void {
  const all = getWeights(planId)
  if (value.trim()) {
    all[exercise] = value
  } else {
    delete all[exercise]
  }
  localStorage.setItem(PREFIX + planId, JSON.stringify(all))
}
