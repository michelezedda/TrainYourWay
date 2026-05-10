import type { ScanHistoryEntry } from '@/lib/openFoodFacts'

export interface WeekNutritionSummary {
  daysLogged: number
  avgKcal: number
  avgProtein: number
  avgCarbs: number
  avgFat: number
  proteinHitDays: number
}

export interface ScanWeekSummary {
  total: number
  healthy: number
  poor: number
}

export interface HabitAlert {
  id: string
  severity: 'warn' | 'info' | 'success'
  message: string
}

function getWeekDates(today: string): string[] {
  const d = new Date(today + 'T12:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
  })
}

export function analyzeWeekNutrition(
  mealEntries: Array<{ date: string; kcal?: number; protein?: number; carbs?: number; fat?: number }>,
  targets: { kcal: number; protein: number; carbs: number; fat: number },
  today: string,
): WeekNutritionSummary {
  const weekDates = new Set(getWeekDates(today))
  const weekEntries = mealEntries.filter(e => weekDates.has(e.date))

  const byDate = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
  for (const e of weekEntries) {
    const cur = byDate.get(e.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    byDate.set(e.date, {
      kcal:    cur.kcal    + (e.kcal    ?? 0),
      protein: cur.protein + (e.protein ?? 0),
      carbs:   cur.carbs   + (e.carbs   ?? 0),
      fat:     cur.fat     + (e.fat     ?? 0),
    })
  }

  const days = [...byDate.values()]
  const n = days.length
  if (n === 0) return { daysLogged: 0, avgKcal: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, proteinHitDays: 0 }

  const totals = days.reduce(
    (acc, d) => ({ kcal: acc.kcal + d.kcal, protein: acc.protein + d.protein, carbs: acc.carbs + d.carbs, fat: acc.fat + d.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return {
    daysLogged:      n,
    avgKcal:         Math.round(totals.kcal    / n),
    avgProtein:      Math.round(totals.protein / n),
    avgCarbs:        Math.round(totals.carbs   / n),
    avgFat:          Math.round(totals.fat     / n),
    proteinHitDays:  days.filter(d => targets.protein > 0 && d.protein >= targets.protein * 0.9).length,
  }
}

export function analyzeWeekScans(history: ScanHistoryEntry[], today: string): ScanWeekSummary {
  const weekStart = new Date(today + 'T00:00:00').getTime() - 6 * 24 * 60 * 60 * 1000
  const week = history.filter(s => s.scannedAt >= weekStart)
  return {
    total:   week.length,
    healthy: week.filter(s => s.grade === 'A' || s.grade === 'B').length,
    poor:    week.filter(s => s.grade === 'D' || s.grade === 'E').length,
  }
}

export function getHabitAlerts(
  nutrition: WeekNutritionSummary,
  scans: ScanWeekSummary,
  todayProtein: number,
  targets: { protein: number; kcal: number },
): HabitAlert[] {
  const alerts: HabitAlert[] = []

  if (scans.poor >= 4) {
    alerts.push({ id: 'poor-scans', severity: 'warn', message: `${scans.poor} low-quality products scanned this week` })
  }

  if (nutrition.daysLogged >= 3 && targets.protein > 0 && nutrition.avgProtein < targets.protein * 0.75) {
    alerts.push({ id: 'low-protein', severity: 'warn', message: 'Protein consistently below target this week' })
  }

  const proteinPct = targets.protein > 0 ? todayProtein / targets.protein : 0
  if (proteinPct >= 0.8 && proteinPct < 1.0) {
    alerts.push({ id: 'protein-close', severity: 'info', message: `${Math.round(proteinPct * 100)}% of today's protein target` })
  }

  if (nutrition.daysLogged >= 5 && nutrition.proteinHitDays >= 5) {
    alerts.push({ id: 'protein-streak', severity: 'success', message: `Protein goal hit ${nutrition.proteinHitDays} days this week` })
  }

  if (scans.total >= 3 && scans.healthy / scans.total >= 0.8) {
    alerts.push({ id: 'scan-score', severity: 'success', message: 'Excellent scanner choices this week' })
  }

  return alerts
}
