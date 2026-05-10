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
