import { storageGetSync, storageSetAsync, storagePrefillCache, storageGetAsync } from './storage'

export type Unit = 'metric' | 'imperial'

const STORAGE_KEY = 'uplift_unit'

export function getUnit(): Unit {
  return storageGetSync(STORAGE_KEY) === 'imperial' ? 'imperial' : 'metric'
}

export async function loadUnit(): Promise<Unit> {
  const val = await storageGetAsync(STORAGE_KEY)
  if (val) storagePrefillCache(STORAGE_KEY, val)
  return val === 'imperial' ? 'imperial' : 'metric'
}

export async function saveUnit(unit: Unit): Promise<void> {
  storagePrefillCache(STORAGE_KEY, unit)
  await storageSetAsync(STORAGE_KEY, unit)
}

export function lbsToKg(lbs: number): number { return lbs / 2.2046 }
export function kgToLbs(kg: number): number { return kg * 2.2046 }

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) }
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * 2.54
}

export function toMetricWeight(value: string, unit: Unit): number {
  const n = parseFloat(value)
  return unit === 'metric' ? n : lbsToKg(n)
}

export function toMetricHeight(height: string, heightIn: string, unit: Unit): number {
  if (unit === 'metric') return parseFloat(height)
  return ftInToCm(parseFloat(height) || 0, parseFloat(heightIn) || 0)
}

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

export function convertPlanUnits(text: string, unit: Unit): string {
  if (unit !== 'imperial') return text
  return text
    .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*kg\b/gi, (_, a, b) =>
      `${Math.round(kgToLbs(parseFloat(a)))}-${Math.round(kgToLbs(parseFloat(b)))} lbs`
    )
    .replace(/(\d+(?:\.\d+)?)\s*kg\b/gi, (_, a) =>
      `${Math.round(kgToLbs(parseFloat(a)))} lbs`
    )
    .replace(/(\d+(?:\.\d+)?)\s*cm\b/gi, (_, a) => {
      const { ft, inches } = cmToFtIn(parseFloat(a))
      return `${ft}'${inches}"`
    })
}
