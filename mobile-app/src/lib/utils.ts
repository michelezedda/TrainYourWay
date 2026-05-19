export function localDateStr(date?: Date): string {
  const d = date ?? new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

export function todayStr(): string {
  return localDateStr()
}

export function parseJsonList(json: string): string[] {
  try { return JSON.parse(json) as string[] } catch { return [] }
}

export function parseJsonRecord(json: string): Record<string, string> {
  try { return JSON.parse(json) as Record<string, string> } catch { return {} }
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}
