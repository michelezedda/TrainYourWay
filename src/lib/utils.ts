// Shared date and JSON parsing utilities.

/** Returns a YYYY-MM-DD string in local time for the given (or current) date. */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Returns a YYYY-MM-DD string for today in local time. */
export function todayStr(): string {
  return localDateStr()
}

/** Returns a YYYY-MM-DD string offset by `days` from the given date string. */
export function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

// ── Safe JSON parsing helpers ─────────────────────────────────────────────────

/** Safely parses a JSON string as a string array, returning [] on failure. */
export function parseJsonList(json: string): string[] {
  try { return JSON.parse(json) as string[] } catch { return [] }
}

/** Safely parses a JSON string as a string record, returning {} on failure. */
export function parseJsonRecord(json: string): Record<string, string> {
  try { return JSON.parse(json) as Record<string, string> } catch { return {} }
}
