export interface MoodLog {
  date: string
  mood: 1 | 2 | 3 | 4 | 5
  energy: 1 | 2 | 3
  timestamp: number
}

export interface JournalEntry {
  id: string
  date: string
  prompt: string
  content: string
  moodTag: string
  timestamp: number
}

export interface WellnessSession {
  id: string
  type: 'breathing' | 'meditation' | 'sleep' | 'focus' | 'journal'
  duration: number
  date: string
  timestamp: number
}

const KEYS = {
  moods: 'wellness_moods',
  journal: 'wellness_journal',
  sessions: 'wellness_sessions',
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]): void {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
}

export function getMoods(): MoodLog[] {
  return load<MoodLog>(KEYS.moods)
}

export function getTodayMood(): MoodLog | null {
  const t = todayStr()
  return getMoods().find(m => m.date === t) ?? null
}

export function saveMood(mood: 1 | 2 | 3 | 4 | 5, energy: 1 | 2 | 3): void {
  const all = getMoods().filter(m => m.date !== todayStr())
  all.push({ date: todayStr(), mood, energy, timestamp: Date.now() })
  save(KEYS.moods, all.slice(-90))
}

export function getJournalEntries(): JournalEntry[] {
  return load<JournalEntry>(KEYS.journal).sort((a, b) => b.timestamp - a.timestamp)
}

export function saveJournalEntry(entry: Omit<JournalEntry, 'id' | 'timestamp'>): void {
  const all = getJournalEntries()
  const newEntry: JournalEntry = { ...entry, id: Date.now().toString(), timestamp: Date.now() }
  save(KEYS.journal, [newEntry, ...all].slice(0, 100))
}

export function getSessions(): WellnessSession[] {
  return load<WellnessSession>(KEYS.sessions).sort((a, b) => b.timestamp - a.timestamp)
}

export function saveSession(type: WellnessSession['type'], duration: number): void {
  const all = getSessions()
  const session: WellnessSession = {
    id: Date.now().toString(),
    type,
    duration,
    date: todayStr(),
    timestamp: Date.now(),
  }
  save(KEYS.sessions, [session, ...all].slice(0, 200))
}

export function getStreak(): number {
  const sessions = getSessions()
  if (!sessions.length) return 0
  const dates = [...new Set(sessions.map(s => s.date))].sort((a, b) => b.localeCompare(a))
  const t = todayStr()
  let streak = 0
  let expected = t
  for (const date of dates) {
    if (date === expected) {
      streak++
      const d = new Date(expected)
      d.setDate(d.getDate() - 1)
      expected = d.toISOString().slice(0, 10)
    } else if (date < expected) {
      break
    }
  }
  return streak
}

export function getWeekSessions(): WellnessSession[] {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const cutoff = weekAgo.toISOString().slice(0, 10)
  return getSessions().filter(s => s.date >= cutoff)
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.round(seconds / 60)
  return `${m} min`
}
