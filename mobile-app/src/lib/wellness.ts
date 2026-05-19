import { storageGetAsync, storageSetAsync } from './storage'

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

async function load<T>(key: string): Promise<T[]> {
  try {
    const raw = await storageGetAsync(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

async function save<T>(key: string, data: T[]): Promise<void> {
  try { await storageSetAsync(key, JSON.stringify(data)) } catch { /* quota */ }
}

export async function getMoods(): Promise<MoodLog[]> {
  return load<MoodLog>(KEYS.moods)
}

export async function getTodayMood(): Promise<MoodLog | null> {
  const t = todayStr()
  const moods = await getMoods()
  return moods.find(m => m.date === t) ?? null
}

export async function saveMood(mood: 1 | 2 | 3 | 4 | 5, energy: 1 | 2 | 3): Promise<void> {
  const all = (await getMoods()).filter(m => m.date !== todayStr())
  all.push({ date: todayStr(), mood, energy, timestamp: Date.now() })
  await save(KEYS.moods, all.slice(-90))
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
  const entries = await load<JournalEntry>(KEYS.journal)
  return entries.sort((a, b) => b.timestamp - a.timestamp)
}

export async function saveJournalEntry(entry: Omit<JournalEntry, 'id' | 'timestamp'>): Promise<void> {
  const all = await getJournalEntries()
  const newEntry: JournalEntry = { ...entry, id: Date.now().toString(), timestamp: Date.now() }
  await save(KEYS.journal, [newEntry, ...all].slice(0, 100))
}

export async function getSessions(): Promise<WellnessSession[]> {
  const sessions = await load<WellnessSession>(KEYS.sessions)
  return sessions.sort((a, b) => b.timestamp - a.timestamp)
}

export async function saveSession(type: WellnessSession['type'], duration: number): Promise<void> {
  const all = await getSessions()
  const session: WellnessSession = {
    id: Date.now().toString(),
    type,
    duration,
    date: todayStr(),
    timestamp: Date.now(),
  }
  await save(KEYS.sessions, [session, ...all].slice(0, 200))
}

export async function getStreak(): Promise<number> {
  const sessions = await getSessions()
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

export async function getWeekSessions(): Promise<WellnessSession[]> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const cutoff = weekAgo.toISOString().slice(0, 10)
  const sessions = await getSessions()
  return sessions.filter(s => s.date >= cutoff)
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.round(seconds / 60)
  return `${m} min`
}
