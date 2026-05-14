import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { saveMood as saveWellnessMood } from '@/lib/wellness'

export const MOODS = [
  { emoji: '😔', label: 'Low', anim: 'mood-anim-low', dur: '0.7s' },
  { emoji: '😐', label: 'Meh', anim: 'mood-anim-meh', dur: '0.5s' },
  { emoji: '🙂', label: 'OK', anim: 'mood-anim-ok', dur: '0.5s' },
  { emoji: '😊', label: 'Good', anim: 'mood-anim-good', dur: '0.6s' },
  { emoji: '🤩', label: 'Great', anim: 'mood-anim-great', dur: '0.65s' },
]

function todayKey(): string {
  const d = new Date()
  return `mood_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readPersistedMood(): number | null {
  try { return JSON.parse(localStorage.getItem(todayKey()) ?? 'null') as number | null }
  catch { return null }
}

interface MoodContextValue {
  mood: number | null
  selectMood: (idx: number) => void
}

const MoodContext = createContext<MoodContextValue>({ mood: null, selectMood: () => {} })

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<number | null>(readPersistedMood)

  const selectMood = useCallback((idx: number) => {
    setMood(idx)
    localStorage.setItem(todayKey(), JSON.stringify(idx))
    saveWellnessMood((idx + 1) as 1 | 2 | 3 | 4 | 5, 2)
  }, [])

  return <MoodContext.Provider value={{ mood, selectMood }}>{children}</MoodContext.Provider>
}

export function useMood() { return useContext(MoodContext) }
