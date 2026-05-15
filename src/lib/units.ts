export type Unit = 'metric' | 'imperial'

const STORAGE_KEY = 'uplift_unit'

export function getUnit(): Unit {
  return localStorage.getItem(STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric'
}

export function saveUnit(unit: Unit): void {
  localStorage.setItem(STORAGE_KEY, unit)
}

// ── Conversion math ───────────────────────────────────────────────────────────

export function lbsToKg(lbs: number): number { return lbs / 2.2046 }
export function kgToLbs(kg: number): number   { return kg * 2.2046 }

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) }
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * 2.54
}

// ── Form helpers (display value → stored metric) ──────────────────────────────

export function toMetricWeight(value: string, unit: Unit): number {
  const n = parseFloat(value)
  return unit === 'metric' ? n : lbsToKg(n)
}

export function toMetricHeight(height: string, heightIn: string, unit: Unit): number {
  if (unit === 'metric') return parseFloat(height)
  return ftInToCm(parseFloat(height) || 0, parseFloat(heightIn) || 0)
}

// ── Display formatting (stored metric → user-facing string) ───────────────────

export function formatWeight(kg: number, unit: Unit): string {
  if (unit === 'imperial') return `${kgToLbs(kg).toFixed(1)} lbs`
  return `${kg} kg`
}

export function formatHeight(cm: number, unit: Unit): string {
  if (unit === 'imperial') {
    const { ft, inches } = cmToFtIn(cm)
    return `${ft}'${inches}"`
  }
  return `${cm} cm`
}

export function weightUnitLabel(unit: Unit): string { return unit === 'metric' ? 'kg' : 'lbs' }
export function heightUnitLabel(unit: Unit): string { return unit === 'metric' ? 'cm' : 'ft' }

// ── Plan text conversion (stored metric text → user-facing display) ────────────
// Converts "X kg" / "X-Y kg" and "X cm" occurrences in AI-generated plan text.
// Safe to call on already-converted text (idempotent).

export function convertPlanUnits(text: string, unit: Unit): string {
  if (unit !== 'imperial') return text
  return text
    // Weight ranges first: "8-12 kg" → "18-26 lbs"
    .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*kg\b/gi, (_, a, b) =>
      `${Math.round(kgToLbs(parseFloat(a)))}-${Math.round(kgToLbs(parseFloat(b)))} lbs`
    )
    // Single weights: "75 kg" → "165 lbs"
    .replace(/(\d+(?:\.\d+)?)\s*kg\b/gi, (_, a) =>
      `${Math.round(kgToLbs(parseFloat(a)))} lbs`
    )
    // Heights: "170 cm" → "5'7""
    .replace(/(\d+(?:\.\d+)?)\s*cm\b/gi, (_, a) => {
      const { ft, inches } = cmToFtIn(parseFloat(a))
      return `${ft}'${inches}"`
    })
}
