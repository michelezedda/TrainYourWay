import { storageGetAsync, storageSetAsync, storageGetSync, storagePrefillCache } from './storage'
import { getUnit } from './units'

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Text transforms ────────────────────────────────────────────────────────────

export function sanitizePlan(text: string): string {
  return text
    .replace(/\s*—\s*/g, ' - ')
    .replace(/–/g, '-')
}

export function transformExercises(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (/^\*\*\d+\./.test(trimmed)) {
      const name = trimmed.replace(/^\*\*/, '').replace(/\*+$/, '').trim()
      const nextTrimmed = lines[i + 1]?.trim() ?? ''
      if (/^Sets:/i.test(nextTrimmed)) {
        const meta = nextTrimmed
        const after = lines[i + 2]?.trim() ?? ''
        const isTip = after.startsWith('*') && !after.startsWith('**') && after.endsWith('*')
        const tip = isTip ? after.slice(1, -1).trim() : ''
        result.push('```exercise')
        result.push(name)
        result.push(meta)
        if (tip) result.push(tip)
        result.push('```')
        i += isTip ? 3 : 2
        continue
      }
    }
    result.push(lines[i])
    i++
  }
  return result.join('\n')
}

// ── Parsed exercise type ───────────────────────────────────────────────────────

export interface ParsedExercise {
  name: string
  meta: string
  tip: string
  exerciseKey: string
  isNew: boolean
  num: string
  metaParts: Record<string, string>
  setsCount: number
  reps: string
}

function parseSetsInfo(setsStr: string): { count: number; reps: string } {
  const s = setsStr.trim()
  const xMatch = s.match(/^(\d+)(?:-\d+)?\s*(?:sets?)?\s*[x×]\s*(.+?)(?:\s*reps?)?$/i)
  if (xMatch) {
    const count = parseInt(xMatch[1], 10)
    const reps = xMatch[2].replace(/\s*reps?$/i, '').trim()
    return { count: Math.max(1, Math.min(count, 10)), reps }
  }
  const numMatch = s.match(/^(\d+)/)
  if (numMatch) return { count: Math.max(1, Math.min(parseInt(numMatch[1], 10), 10)), reps: '' }
  return { count: 3, reps: '' }
}

export function parseRestSeconds(restStr: string): number {
  const minMatch = restStr.match(/(\d+)\s*min/i)
  if (minMatch) return parseInt(minMatch[1], 10) * 60
  const numMatch = restStr.match(/\d+/)
  return numMatch ? parseInt(numMatch[0], 10) : 60
}

export function parseExerciseBlock(content: string): ParsedExercise {
  const contentLines = content.trim().split('\n')
  const name = contentLines[0] ?? ''
  const meta = contentLines[1] ?? ''
  const tip = contentLines.slice(2).join(' ').replace(/^Form tip:\s*/i, '').trim()

  const exerciseKey = name.replace(/^\d+\.\s*/, '').replace(/\s*\*+[^*]+\*+\s*/g, '').trim()
  const isNew = /\*+\(new\)\*+/.test(name)
  const num = name.match(/^(\d+)\./)?.[1] ?? ''

  const metaParts: Record<string, string> = {}
  for (const part of meta.split('|')) {
    const colon = part.indexOf(':')
    if (colon !== -1) {
      metaParts[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).trim()
    }
  }

  const { count: setsCount, reps } = metaParts['sets']
    ? parseSetsInfo(metaParts['sets'])
    : { count: 0, reps: '' }

  return { name, meta, tip, exerciseKey, isNew, num, metaParts, setsCount, reps }
}

// ── Plan structure parsers ─────────────────────────────────────────────────────

export function parseWeeklySchedule(plan: string): Record<string, string> {
  const result: Record<string, string> = {}
  const section = plan.match(/## Weekly Schedule([\s\S]*?)(?=\n## )/)?.[1] ?? ''
  for (const day of DAY_NAMES) {
    const m = section.match(new RegExp(`\\*\\*${day}:?\\*\\*:?\\s*([^\\n·]+)`, 'i'))
    if (m) result[day] = m[1].replace(/·.*$/, '').trim()
  }
  return result
}

export function parseDayChunks(plan: string): string[] {
  const section = plan.match(/## Day-by-Day Workouts([\s\S]*?)(?=\n## (?!Day)|$)/)?.[1] ?? ''
  return section
    .split(/(?=\n### Day \d+:)/)
    .map(s => s.replace(/\n---\s*$/, '').trim())
    .filter(s => /### Day \d+:/.test(s))
}

export function parseSectionContent(plan: string, heading: string): string {
  const esc = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return plan.match(new RegExp(`## ${esc}([\\s\\S]*?)(?=\\n## |$)`))?.[1]?.trim() ?? ''
}

export function getWeeklyWorkoutDays(planText: string): number {
  const section = planText.match(/## Weekly Schedule([\s\S]*?)(?=\n## )/)?.[1] ?? ''
  if (section) {
    let count = 0
    for (const day of DAY_NAMES) {
      const m = section.match(new RegExp(`\\*\\*${day}:?\\*\\*:?\\s*([^\\n]+)`, 'i'))
      if (m && !/rest|recovery/i.test(m[1])) count++
    }
    if (count > 0) return count
  }
  const dayHeaders = planText.match(/### Day \d+:[^\n]*/gi) ?? []
  const count = dayHeaders.filter(h => !/rest|recovery/i.test(h)).length
  return count > 0 ? count : 0
}

export function getDefaultDayIdx(schedule: Record<string, string>): number {
  const today = (new Date().getDay() + 6) % 7
  const todayLabel = schedule[DAY_NAMES[today]] ?? ''
  if (todayLabel && !/rest/i.test(todayLabel)) return today
  for (let i = 1; i <= 6; i++) {
    const idx = (today + i) % 7
    const label = schedule[DAY_NAMES[idx]] ?? ''
    if (label && !/rest/i.test(label)) return idx
  }
  return today
}

// ── Exercise keys for tracking ─────────────────────────────────────────────────

export function extractExerciseKeys(rawText: string): string[] {
  const keys: string[] = []
  const lines = rawText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (/^\*\*\d+\./.test(trimmed)) {
      const nextLine = lines[i + 1]?.trim() ?? ''
      if (/^Sets:/i.test(nextLine)) {
        const name = trimmed.replace(/^\*\*/, '').replace(/\*+$/, '').trim()
        const key = name.replace(/^\d+\.\s*/, '').replace(/\s*\*+[^*]+\*+\s*/g, '').trim()
        if (key && !keys.includes(key)) keys.push(key)
      }
    }
  }
  return keys
}

export function countTotalSets(dayBody: string): number {
  let total = 0
  for (const line of dayBody.split('\n')) {
    const m = line.match(/Sets:\s*(\d+)/i)
    if (m) total += parseInt(m[1], 10)
  }
  return total
}

// ── Week tracking storage ──────────────────────────────────────────────────────

function computeWeekKey(): string {
  const weekStart = getUnit() === 'imperial' ? 0 : 1
  const d = new Date()
  const diff = (d.getDay() - weekStart + 7) % 7
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEK_KEY_STORE = 'tyw-workout-week'

export function readDoneMap(): Record<string, boolean> {
  try {
    const raw = storageGetSync(`tyw-done-map-${computeWeekKey()}`)
    return raw ? JSON.parse(raw) as Record<string, boolean> : {}
  } catch { return {} }
}

export function readSetsMap(): Record<string, boolean[]> {
  try {
    const raw = storageGetSync(`tyw-sets-map-${computeWeekKey()}`)
    return raw ? JSON.parse(raw) as Record<string, boolean[]> : {}
  } catch { return {} }
}

export function readFiredMap(): Record<string, boolean> {
  try {
    const raw = storageGetSync(`tyw-fired-${computeWeekKey()}`)
    return raw ? JSON.parse(raw) as Record<string, boolean> : {}
  } catch { return {} }
}

export async function writeDoneMap(map: Record<string, boolean>): Promise<void> {
  const key = `tyw-done-map-${computeWeekKey()}`
  const json = JSON.stringify(map)
  storagePrefillCache(key, json)
  await storageSetAsync(key, json)
}

export async function writeSetsMap(map: Record<string, boolean[]>): Promise<void> {
  const key = `tyw-sets-map-${computeWeekKey()}`
  const json = JSON.stringify(map)
  storagePrefillCache(key, json)
  await storageSetAsync(key, json)
}

export async function writeFiredMap(map: Record<string, boolean>): Promise<void> {
  const key = `tyw-fired-${computeWeekKey()}`
  const json = JSON.stringify(map)
  storagePrefillCache(key, json)
  await storageSetAsync(key, json)
}

export async function clearWeekPersistence(): Promise<void> {
  const wk = computeWeekKey()
  const keys = [`tyw-done-map-${wk}`, `tyw-sets-map-${wk}`, `tyw-fired-${wk}`]
  for (const k of keys) {
    storagePrefillCache(k, null)
    await storageSetAsync(k, '')
  }
}

export async function evictOldWeekIfNeeded(): Promise<void> {
  const currentWk = computeWeekKey()
  try {
    const stored = await storageGetAsync(WEEK_KEY_STORE)
    if (stored !== currentWk) {
      if (stored) {
        storagePrefillCache(`tyw-done-map-${stored}`, null)
        storagePrefillCache(`tyw-sets-map-${stored}`, null)
        storagePrefillCache(`tyw-fired-${stored}`, null)
      }
      storagePrefillCache(WEEK_KEY_STORE, currentWk)
      await storageSetAsync(WEEK_KEY_STORE, currentWk)
    }
  } catch {}
}
