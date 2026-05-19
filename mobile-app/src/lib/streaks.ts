export function calcStreak(dates: string[], today: string): number {
  const dateSet = new Set(dates)

  const shiftBack = (s: string, n: number): string => {
    const d = new Date(s + 'T12:00:00')
    d.setDate(d.getDate() - n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const yesterday = shiftBack(today, 1)
  if (!dateSet.has(today) && !dateSet.has(yesterday)) return 0

  let cursor = dateSet.has(today) ? today : yesterday
  let count = 0
  while (dateSet.has(cursor)) { count++; cursor = shiftBack(cursor, 1) }
  return count
}

export function calcWeeklyStreak(dates: string[], weekStart: 0 | 1, today: string): number {
  const dateSet = new Set(dates)

  const toStr = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const getWeekStartStr = (dateStr: string): string => {
    const d = new Date(dateStr + 'T12:00:00')
    const diff = (d.getDay() - weekStart + 7) % 7
    d.setDate(d.getDate() - diff)
    return toStr(d)
  }

  const prevWeekStr = (weekStartStr: string): string => {
    const d = new Date(weekStartStr + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    return toStr(d)
  }

  const hasActivityInWeek = (weekStartStr: string): boolean => {
    const d = new Date(weekStartStr + 'T12:00:00')
    for (let i = 0; i < 7; i++) {
      if (dateSet.has(toStr(d))) return true
      d.setDate(d.getDate() + 1)
    }
    return false
  }

  const currentWeek = getWeekStartStr(today)
  const lastWeek = prevWeekStr(currentWeek)

  if (!hasActivityInWeek(currentWeek) && !hasActivityInWeek(lastWeek)) return 0

  let cursor = hasActivityInWeek(currentWeek) ? currentWeek : lastWeek
  let count = 0
  while (hasActivityInWeek(cursor)) {
    count++
    cursor = prevWeekStr(cursor)
  }
  return count
}
