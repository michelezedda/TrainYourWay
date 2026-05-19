import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { saveMood as saveWellnessMood } from '@/lib/wellness'
import { storageGetAsync, storageSetAsync, storagePrefillCache } from '@/lib/storage'

export const MOODS = [
  { emoji: '😔', label: 'Low' },
  { emoji: '😐', label: 'Meh' },
  { emoji: '🙂', label: 'OK' },
  { emoji: '😊', label: 'Good' },
  { emoji: '🤩', label: 'Great' },
]

function todayKey(): string {
  const d = new Date()
  return `mood_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface MoodContextValue {
  mood: number | null
  selectMood: (idx: number) => void
  loaded: boolean
}

const MoodContext = createContext<MoodContextValue>({ mood: null, selectMood: () => {}, loaded: false })

export function MoodProvider({ children }: { children: ReactNode }) {
  const [mood, setMood] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    storageGetAsync(todayKey()).then(raw => {
      if (raw !== null) {
        const parsed = JSON.parse(raw) as number | null
        setMood(parsed)
        storagePrefillCache(todayKey(), raw)
      }
      setLoaded(true)
    })
  }, [])

  const selectMood = useCallback((idx: number) => {
    setMood(idx)
    void storageSetAsync(todayKey(), JSON.stringify(idx))
    void saveWellnessMood((idx + 1) as 1 | 2 | 3 | 4 | 5, 2)
  }, [])

  return <MoodContext.Provider value={{ mood, selectMood, loaded }}>{children}</MoodContext.Provider>
}

export function useMood() { return useContext(MoodContext) }
