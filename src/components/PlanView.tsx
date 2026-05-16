import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { HiChevronDown, HiLockOpen } from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import type { Components } from 'react-markdown'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { sanitizePlan, transformExercises, WorkoutProgressContext } from '@/lib/planComponents'
import { useLocale } from '@/context/LocaleContext'
import { convertPlanUnits, getUnit } from '@/lib/units'

// ── Day constants ─────────────────────────────────────────────────────────────

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Parsing utilities ─────────────────────────────────────────────────────────

export function parseAnalysisSections(text: string) {
  const sections: { title: string; content: string }[] = []
  let current: { title: string; lines: string[] } | null = null
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) {
        const content = current.lines.join('\n').trim()
        if (content) sections.push({ title: current.title, content })
      }
      current = { title: line.slice(3).trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) {
    const content = current.lines.join('\n').trim()
    if (content) sections.push({ title: current.title, content })
  }
  return sections
}

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

// ── Workout day count (shared with Dashboard + Workout pages) ─────────────────

export function getWeeklyWorkoutDays(planText: string): number {
  const section = planText.match(/## Weekly Schedule([\s\S]*?)(?=\n## )/)?.[1] ?? ''
  if (section) {
    let count = 0
    for (const day of DAY_NAMES) {
      const m = section.match(new RegExp(`\\*\\*${day}:?\\*\\*:?\\s*([^\\n·]+)`, 'i'))
      if (m && !/rest|recovery/i.test(m[1])) count++
    }
    if (count > 0) return count
  }
  const dayHeaders = planText.match(/### Day \d+:[^\n]*/gi) ?? []
  const count = dayHeaders.filter(h => !/rest|recovery/i.test(h)).length
  return count > 0 ? count : 0
}

// ── localStorage persistence helpers ─────────────────────────────────────────

// Compute the Monday (or Sunday) that starts the current week.
// Reads the unit preference directly from localStorage so this can be called
// outside React (in useState lazy initializers and useRef initializers) without
// needing the LocaleContext to be mounted first.
function computeWeekKey(): string {
  const weekStart = getUnit() === 'imperial' ? 0 : 1
  const d = new Date()
  const diff = (d.getDay() - weekStart + 7) % 7
  d.setDate(d.getDate() - diff)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Read helpers — always use the computed current-week key so initialization
// is correct even when tyw-workout-week hasn't been written yet (first visit)
// or still holds the previous week's key (week-boundary transition).
function readDoneMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`tyw-done-map-${computeWeekKey()}`)
    return raw ? JSON.parse(raw) as Record<string, boolean> : {}
  } catch { return {} }
}

function readSetsMap(): Record<string, boolean[]> {
  try {
    const raw = localStorage.getItem(`tyw-sets-map-${computeWeekKey()}`)
    return raw ? JSON.parse(raw) as Record<string, boolean[]> : {}
  } catch { return {} }
}

function readFiredMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`tyw-fired-${computeWeekKey()}`)
    return raw ? JSON.parse(raw) as Record<string, boolean> : {}
  } catch { return {} }
}

// Write helpers — symmetric to the read helpers above.
function writeDoneMap(map: Record<string, boolean>): void {
  try { localStorage.setItem(`tyw-done-map-${computeWeekKey()}`, JSON.stringify(map)) } catch {}
}

function writeSetsMap(map: Record<string, boolean[]>): void {
  try { localStorage.setItem(`tyw-sets-map-${computeWeekKey()}`, JSON.stringify(map)) } catch {}
}

function writeFiredMap(map: Record<string, boolean>): void {
  try { localStorage.setItem(`tyw-fired-${computeWeekKey()}`, JSON.stringify(map)) } catch {}
}

// Wipe all three current-week keys atomically (used when the plan changes).
function clearWeekPersistence(): void {
  const wk = computeWeekKey()
  try {
    localStorage.removeItem(`tyw-done-map-${wk}`)
    localStorage.removeItem(`tyw-sets-map-${wk}`)
    localStorage.removeItem(`tyw-fired-${wk}`)
  } catch {}
}

// Extract exercise keys from raw day body (before transformExercises).
// Must produce the same key format that ExerciseTableCard derives internally.
function extractExerciseKeys(rawText: string): string[] {
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

// ── Shared markdown components ────────────────────────────────────────────────

export const SECTION_ICONS: Record<string, string> = {
  'Profile Assessment':          '📊',
  'Workout Space Analysis':      '🏠',
  'Space Recommendations':       '💡',
  'Dietary Assessment':          '🥗',
  'What to Expect':              '🎯',
  'Your Progress':               '📈',
  'Training Assessment':         '🏋️',
  'What Changes in This Phase':  '🔄',
}

export const analysisComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-base font-bold text-white mt-6 mb-2 flex items-center gap-2 first:mt-0">
      <span className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(180deg, #A855F7, #22D3EE)' }} />
      {children}
    </h2>
  ),
  p:      ({ children }) => <p className="text-white/65 leading-relaxed mb-3">{children}</p>,
  ul:     ({ children }) => <ul className="space-y-2 mb-4">{children}</ul>,
  li:     ({ children }) => (
    <li className="flex gap-2.5 text-white/65 leading-relaxed">
      <span className="text-purple-400/70 flex-shrink-0 mt-1 text-xs">-</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
  em:     ({ children }) => <em className="text-cyan-300/80 not-italic">{children}</em>,
}

// ── CollapsibleSection ────────────────────────────────────────────────────────

export function CollapsibleSection({ title, icon, content }: { title: string; icon: string; content: string }) {
  const [open, setOpen] = useState(false)
  return (
    <GlassCard padding={false} className="mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <span className="text-white font-semibold text-sm">{title}</span>
        </div>
        <HiChevronDown
          className={`w-4 h-4 text-white/30 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 border-t border-white/6">
          <ReactMarkdown components={analysisComponents}>{content}</ReactMarkdown>
        </div>
      )}
    </GlassCard>
  )
}

function countTotalSets(dayBody: string): number {
  let total = 0
  for (const line of dayBody.split('\n')) {
    const m = line.match(/Sets:\s*(\d+)/i)
    if (m) total += parseInt(m[1], 10)
  }
  return total
}

// ── WorkoutCelebration ────────────────────────────────────────────────────────

const RECOVERY_TIPS = [
  'Stretch for 5-10 min to reduce next-day soreness.',
  'A protein-rich meal in the next hour supports muscle repair.',
  'Stay hydrated today - aim for at least 2L of water.',
  'Sleep is when muscles grow - prioritise 8 hours tonight.',
  'Light mobility work tomorrow will speed up recovery.',
]

interface CelebrationProps {
  exerciseCount: number
  setsCount: number
  weekStreak: number
  weekWorkouts: number
  weeklyTarget: number
  dayFocus?: string
  onDismiss: () => void
}

function WorkoutCelebration({ exerciseCount, setsCount, weekStreak, weekWorkouts, weeklyTarget, dayFocus, onDismiss }: CelebrationProps) {
  const recoveryTip = RECOVERY_TIPS[(exerciseCount + setsCount) % RECOVERY_TIPS.length]
  const weekProgress = weeklyTarget > 0 ? Math.min(weekWorkouts / weeklyTarget, 1) : 0

  const stats = [
    { value: String(exerciseCount), label: 'Exercises', color: 'rgba(168,85,247,', border: 'rgba(168,85,247,0.2)' },
    { value: setsCount > 0 ? String(setsCount) : '-', label: 'Sets', color: 'rgba(34,211,238,', border: 'rgba(34,211,238,0.18)' },
    { value: weekStreak > 0 ? `${weekStreak}w` : '-', label: 'Streak', color: 'rgba(251,146,60,', border: 'rgba(251,146,60,0.18)' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="my-4 rounded-3xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(145deg, rgba(168,85,247,0.16) 0%, rgba(10,10,30,0.95) 55%, rgba(34,197,94,0.1) 100%)',
        border: '1px solid rgba(168,85,247,0.35)',
        boxShadow: '0 0 60px rgba(168,85,247,0.18), 0 12px 48px rgba(0,0,0,0.5)',
      }}
    >
      {/* Ambient glow orbs */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 65%)', filter: 'blur(28px)' }}
      />
      <div
        className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.25) 0%, transparent 65%)', filter: 'blur(28px)' }}
      />

      <div className="relative px-6 pt-8 pb-7 text-center">
        {/* Dismiss */}
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}
        >
          <span className="text-base leading-none">×</span>
        </button>

        {/* Trophy */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.06, type: 'spring', stiffness: 300, damping: 18 }}
          className="text-6xl mb-4 leading-none"
        >
          🏆
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="text-2xl font-black tracking-tight mb-1"
          style={{
            background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Workout Complete!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
          className="text-white/52 text-sm mb-6"
        >
          {dayFocus ? dayFocus : `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} done`}
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="grid grid-cols-3 gap-2.5 mb-4"
        >
          {stats.map(({ value, label, color, border }) => (
            <div
              key={label}
              className="rounded-2xl py-3 px-2"
              style={{ background: `${color}0.1)`, border: `1px solid ${border}` }}
            >
              <p className="text-xl font-black text-white tabular-nums">{value}</p>
              <p className="text-[10px] text-white/38 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Week progress */}
        {weeklyTarget > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38 }}
            className="mb-5"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-white/35 font-medium">This week</span>
              <span className="text-[11px] text-white/50 tabular-nums">{weekWorkouts}/{weeklyTarget} sessions</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${weekProgress * 100}%` }}
                transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
              />
            </div>
          </motion.div>
        )}

        {/* Recovery tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.44 }}
          className="text-[11px] text-white/28 leading-relaxed italic"
        >
          {recoveryTip}
        </motion.p>
      </div>
    </motion.div>
  )
}

// ── WorkoutDayView ────────────────────────────────────────────────────────────

export function WorkoutDayView({
  plan,
  planComponents,
  blockedDays,
  dayWorkoutOverrides,
  onUnblockDay,
  onGenerateDayWorkout,
  onWorkoutComplete,
  weekStreak,
  weekWorkouts,
  weeklyTarget,
}: {
  plan: string
  planComponents: Components
  blockedDays?: string[]
  dayWorkoutOverrides?: Record<string, string>
  onUnblockDay?: (day: string) => void
  onGenerateDayWorkout?: (day: string) => Promise<void>
  onWorkoutComplete?: (dayName: string, exerciseCount: number, setsCount: number) => void
  weekStreak?: number
  weekWorkouts?: number
  weeklyTarget?: number
}) {
  const { unit } = useLocale()
  const sanitized   = useMemo(() => convertPlanUnits(sanitizePlan(plan), unit), [plan, unit])
  const schedule    = useMemo(() => parseWeeklySchedule(sanitized), [sanitized])
  const dayChunks   = useMemo(() => parseDayChunks(sanitized), [sanitized])
  const overview    = useMemo(() => parseSectionContent(sanitized, 'Overview'), [sanitized])
  const progression = useMemo(() => parseSectionContent(sanitized, 'Progression Plan'), [sanitized])
  const nutrition   = useMemo(() => parseSectionContent(sanitized, 'Nutrition Tips'), [sanitized])

  const [selectedDay, setSelectedDay]                         = useState(0)
  const [showingUnblockOptions, setShowingUnblockOptions]     = useState(false)
  const [isGeneratingWorkout, setIsGeneratingWorkout]         = useState(false)

  // Workout completion tracking — doneMap keyed as "DayName:exerciseKey" to prevent
  // cross-day contamination when exercises share the same name across days.
  // readDoneMap() computes the current week key directly so hydration is always
  // correct regardless of whether tyw-workout-week has been written yet.
  const [doneMap, setDoneMap]               = useState<Record<string, boolean>>(readDoneMap)
  // Ref mirrors doneMap so stable callbacks can read the latest value without deps.
  const doneMapRef = useRef(doneMap)
  doneMapRef.current = doneMap

  // Per-exercise per-set completion: "DayName:exerciseKey" → boolean[]
  // Persists individual set states so partial progress survives page navigation.
  const [setsMap, setSetsMap] = useState<Record<string, boolean[]>>(readSetsMap)
  const setsMapRef = useRef(setsMap)
  setsMapRef.current = setsMap
  const [showCelebration, setShowCelebration] = useState(false)
  // Holds the optimistic week count shown in the celebration modal (+1 vs DB, which
  // hasn't updated yet when the modal opens).
  const [celebrationWeekWorkouts, setCelebrationWeekWorkouts] = useState(0)
  // Incremented whenever a day's content is replaced (override generated), forcing
  // the content subtree to remount so exercise cards start with fresh local state.
  const [contentKey, setContentKey] = useState(0)
  // Restored from localStorage so celebration doesn't re-fire after a reload.
  const completionFiredRef   = useRef<Record<string, boolean>>(readFiredMap())
  const dayBodySnapshotRef   = useRef<Record<string, string>>({})
  // Updated each render so stable callbacks can read the current day name.
  const currentDayNameRef    = useRef('')
  // Stores the previous plan text so the [plan] effect can detect real changes.
  // Using a value ref instead of a boolean mount-guard means StrictMode's
  // double-effect invocation is safe: the second run sees the same plan string
  // (ref was set in the first run) and correctly skips the reset.
  const prevPlanRef          = useRef<string | null>(null)

  const handleExerciseDone = useCallback((key: string, done: boolean) => {
    const fullKey = `${currentDayNameRef.current}:${key}`
    setDoneMap(prev => {
      if (prev[fullKey] === done) return prev
      return { ...prev, [fullKey]: done }
    })
  }, [])

  // Stable getter used by ExerciseTableCard to hydrate its initial state from
  // the parent's doneMap when it mounts (after a day switch or content reset).
  const getInitialDone = useCallback((key: string) => {
    return doneMapRef.current[`${currentDayNameRef.current}:${key}`] === true
  }, [])

  // Called by ExerciseTableCard whenever its setsDone array changes.
  const handleSetsDone = useCallback((key: string, setsDone: boolean[]) => {
    const fullKey = `${currentDayNameRef.current}:${key}`
    setSetsMap(prev => {
      const existing = prev[fullKey]
      if (existing && existing.length === setsDone.length && existing.every((v, i) => v === setsDone[i])) return prev
      return { ...prev, [fullKey]: setsDone }
    })
  }, [])

  // Stable getter for per-exercise set states — returns undefined if no entry yet.
  const getInitialSetsDone = useCallback((key: string): boolean[] | undefined => {
    return setsMapRef.current[`${currentDayNameRef.current}:${key}`]
  }, [])

  // Memoized context value: all callbacks are stable so this never changes,
  // preventing ExerciseTableCard instances from re-rendering on map updates.
  const contextValue = useMemo(() => ({
    onExerciseDone: handleExerciseDone,
    getInitialDone,
    onSetsDone: handleSetsDone,
    getInitialSetsDone,
  }), [handleExerciseDone, getInitialDone, handleSetsDone, getInitialSetsDone])

  useEffect(() => {
    setSelectedDay(getDefaultDayIdx(schedule))
  }, [schedule])

  useEffect(() => {
    setShowingUnblockOptions(false)
    setIsGeneratingWorkout(false)
  }, [selectedDay])

  const dayToChunkIdx = useMemo(() => {
    const map: Record<number, number> = {}
    let ci = 0
    for (let i = 0; i < 7; i++) {
      const label = schedule[DAY_NAMES[i]] ?? ''
      if (label && !/rest/i.test(label)) map[i] = ci++
    }
    return map
  }, [schedule])

  const currentDayName = DAY_NAMES[selectedDay]
  currentDayNameRef.current = currentDayName  // keep ref in sync every render
  const selectedLabel  = schedule[currentDayName] ?? ''
  const hasOverride    = !!(dayWorkoutOverrides?.[currentDayName])
  const isRest         = !hasOverride && (!selectedLabel || /rest/i.test(selectedLabel))
  const isBlocked      = (blockedDays?.includes(currentDayName) ?? false) && !hasOverride
  const chunkIdx       = dayToChunkIdx[selectedDay]
  const rawChunk       = chunkIdx !== undefined ? (dayChunks[chunkIdx] ?? '') : ''
  const dayBody        = dayWorkoutOverrides?.[currentDayName]
    ?? rawChunk.replace(/^### Day \d+:[^\n]*\n?/, '').trim()

  const parsedDay = useMemo(
    () => transformExercises(sanitizePlan(convertPlanUnits(dayBody, unit))),
    [dayBody, unit],
  )

  // Extract exercise keys from raw day body for completion tracking
  const exerciseKeys = useMemo(() => extractExerciseKeys(dayBody), [dayBody])
  const setsCount    = useMemo(() => countTotalSets(dayBody), [dayBody])

  // All exercises for the CURRENT day are done (day-scoped keys prevent false positives).
  const allDone  = exerciseKeys.length > 0 && exerciseKeys.every(k => doneMap[`${currentDayName}:${k}`] === true)
  const doneCount = Object.entries(doneMap).filter(([k, v]) => k.startsWith(`${currentDayName}:`) && v).length

  // Fire celebration exactly once per day per week.
  // completionFiredRef is restored from localStorage so the modal never re-fires
  // after a page refresh or navigation.
  useEffect(() => {
    if (allDone && !completionFiredRef.current[currentDayName]) {
      completionFiredRef.current[currentDayName] = true
      writeFiredMap(completionFiredRef.current)
      // +1 optimistically: the DB write hasn't resolved yet when the modal opens.
      setCelebrationWeekWorkouts((weekWorkouts ?? 0) + 1)
      setShowCelebration(true)
      onWorkoutComplete?.(currentDayName, exerciseKeys.length, setsCount)
    }
  }, [allDone, currentDayName, exerciseKeys.length, setsCount, onWorkoutComplete, weekWorkouts])

  // When a day's body content changes (override generated), reset only that day's state
  // and bump contentKey to force the exercise subtree to remount with fresh local state.
  // On a plain day-switch, snapshot shows the same body so nothing is cleared.
  useEffect(() => {
    const prev = dayBodySnapshotRef.current[currentDayName]
    dayBodySnapshotRef.current[currentDayName] = dayBody
    if (prev !== undefined && prev !== dayBody) {
      const prefix = `${currentDayName}:`
      setDoneMap(cur =>
        Object.fromEntries(Object.entries(cur).filter(([k]) => !k.startsWith(prefix)))
      )
      setSetsMap(cur =>
        Object.fromEntries(Object.entries(cur).filter(([k]) => !k.startsWith(prefix)))
      )
      delete completionFiredRef.current[currentDayName]
      setContentKey(k => k + 1)
    }
    setShowCelebration(false)
  }, [dayBody, currentDayName])

  // Hard-reset when the plan text is replaced (user evolved / imported a new plan).
  // prevPlanRef holds the plan value from the previous effect run. On the very
  // first run (null) we just store the value. On StrictMode's second invocation
  // the ref already holds the same plan string, so we skip — no false clear.
  useEffect(() => {
    const prev = prevPlanRef.current
    prevPlanRef.current = plan
    if (prev === null || prev === plan) return
    setDoneMap({})
    setSetsMap({})
    setShowCelebration(false)
    completionFiredRef.current = {}
    dayBodySnapshotRef.current = {}
    clearWeekPersistence()
  }, [plan])

  // Weekly reset: evict previous-week localStorage keys when the week rolls over.
  // State is already correctly initialized — readDoneMap/readSetsMap/readFiredMap
  // compute the current week key independently, so they return {} for any new week
  // before any data has been written. No setDoneMap({}) call needed here.
  useEffect(() => {
    const currentWk = computeWeekKey()
    const storedWk  = localStorage.getItem('tyw-workout-week')
    if (storedWk !== currentWk) {
      if (storedWk) {
        localStorage.removeItem(`tyw-done-map-${storedWk}`)
        localStorage.removeItem(`tyw-sets-map-${storedWk}`)
        localStorage.removeItem(`tyw-fired-${storedWk}`)
      }
      localStorage.setItem('tyw-workout-week', currentWk)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount-only: fired once; next load after week boundary uses fresh key

  // Persist exercise completion state across page navigation (same week).
  // writeDoneMap computes the week key directly so the write is never blocked by
  // tyw-workout-week being unset (first visit) or stale (week-boundary transition).
  useEffect(() => { writeDoneMap(doneMap) }, [doneMap])

  // Persist individual set states across page navigation (same week).
  useEffect(() => { writeSetsMap(setsMap) }, [setsMap])

  const handleGenerateWorkout = async () => {
    if (!onGenerateDayWorkout) return
    setIsGeneratingWorkout(true)
    try {
      await onGenerateDayWorkout(currentDayName)
    } finally {
      setIsGeneratingWorkout(false)
      setShowingUnblockOptions(false)
    }
  }

  // Fallback: no ### Day N: structure
  if (dayChunks.length === 0) {
    return (
      <WorkoutProgressContext.Provider value={contextValue}>
        <GlassCard padding={false} className="overflow-hidden">
          <div className="p-6 sm:p-8 prose prose-invert max-w-none">
            <ReactMarkdown components={planComponents}>
              {transformExercises(sanitized)}
            </ReactMarkdown>
          </div>
        </GlassCard>
      </WorkoutProgressContext.Provider>
    )
  }

  return (
    <WorkoutProgressContext.Provider value={contextValue}>
      <div>
        {/* ── Day selector: mobile (horizontal scroll, unchanged) ── */}
        <div className="flex md:hidden gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
          {DAY_NAMES.map((day, i) => {
            const label        = schedule[day] ?? ''
            const isRestDay    = !label || /rest/i.test(label)
            const hasOvr       = !!(dayWorkoutOverrides?.[day])
            const isDayBlocked = (blockedDays?.includes(day) ?? false) && !hasOvr
            const isSel        = selectedDay === i
            const shortLabel   = hasOvr ? 'Custom' : isRestDay ? 'Rest' : isDayBlocked ? 'Off' : label.split(/[-,]/)[0].trim().slice(0, 10)
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`w-[76px] flex-shrink-0 flex flex-col items-center gap-1 py-4 rounded-2xl border transition-all duration-200 active:scale-95 ${
                  isSel && isDayBlocked
                    ? 'border-red-500/60 bg-red-500/20'
                    : isSel && isRestDay && !hasOvr
                    ? 'border-white/20 bg-white/8'
                    : isSel
                    ? 'border-purple-500/50 bg-purple-500/15'
                    : isDayBlocked
                    ? 'border-red-500/30 bg-red-500/8'
                    : isRestDay && !hasOvr
                    ? 'border-white/6 bg-transparent'
                    : 'border-white/14 bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-wide ${
                  isSel && isDayBlocked      ? 'text-red-200'
                  : isSel && isRestDay       ? 'text-white/50'
                  : isSel                    ? 'text-purple-200'
                  : isDayBlocked             ? 'text-red-400/80'
                  : isRestDay && !hasOvr     ? 'text-white/25'
                                             : 'text-white/75'
                }`}>
                  {DAY_SHORT[i]}
                </span>
                <span className={`text-[10px] leading-tight text-center w-full px-1.5 truncate ${
                  isSel && isDayBlocked  ? 'text-red-300/70'
                  : isSel && isRestDay   ? 'text-white/30'
                  : isSel                ? 'text-purple-300/80'
                  : isDayBlocked         ? 'text-red-400/50'
                  : isRestDay && !hasOvr ? 'text-white/18'
                                         : 'text-white/40'
                }`}>
                  {shortLabel}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                  isSel && isDayBlocked    ? 'bg-red-400'
                  : isSel && isRestDay     ? 'bg-white/35'
                  : isSel                  ? 'bg-purple-400'
                  : isDayBlocked           ? 'bg-red-500/40'
                  : isRestDay && !hasOvr   ? 'bg-white/10'
                                           : 'bg-white/30'
                }`} />
              </button>
            )
          })}
        </div>

        {/* ── Day selector: desktop/tablet (2-row grid, 4 cols) ── */}
        <div className="hidden md:grid md:grid-cols-4 gap-3 mb-5">
          {DAY_NAMES.map((day, i) => {
            const label        = schedule[day] ?? ''
            const isRestDay    = !label || /rest/i.test(label)
            const hasOvr       = !!(dayWorkoutOverrides?.[day])
            const isDayBlocked = (blockedDays?.includes(day) ?? false) && !hasOvr
            const isSel        = selectedDay === i
            const shortLabel   = hasOvr ? 'Custom' : isRestDay ? 'Rest' : isDayBlocked ? 'Off' : label.split(/[-,]/)[0].trim().slice(0, 16)
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`flex flex-col items-center gap-1.5 py-5 rounded-2xl border transition-all duration-200 active:scale-[0.97] ${
                  !isSel
                    ? isDayBlocked
                      ? 'border-red-500/30 bg-red-500/8'
                      : isRestDay && !hasOvr
                      ? 'border-white/6 bg-transparent hover:bg-white/[0.03]'
                      : 'border-white/14 bg-white/5 hover:bg-white/10'
                    : 'border-transparent'
                }`}
                style={isSel ? (
                  isDayBlocked
                    ? { background: 'rgba(239,68,68,0.18)', borderColor: 'rgba(239,68,68,0.55)', boxShadow: '0 0 14px rgba(239,68,68,0.12)' }
                    : isRestDay && !hasOvr
                    ? { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.18)' }
                    : {
                        background: 'linear-gradient(135deg,rgba(168,85,247,0.22),rgba(34,211,238,0.13))',
                        borderColor: 'rgba(168,85,247,0.5)',
                        boxShadow: '0 0 22px rgba(168,85,247,0.18)',
                      }
                ) : {}}
              >
                <span className={`text-sm font-black uppercase tracking-wider ${
                  isSel && isDayBlocked      ? 'text-red-200'
                  : isSel && isRestDay       ? 'text-white/55'
                  : isSel                    ? 'text-purple-100'
                  : isDayBlocked             ? 'text-red-400/70'
                  : isRestDay && !hasOvr     ? 'text-white/25'
                                             : 'text-white/80'
                }`}>
                  {DAY_SHORT[i]}
                </span>
                <span className={`text-xs leading-snug text-center px-2 truncate w-full ${
                  isSel && isDayBlocked  ? 'text-red-300/70'
                  : isSel && isRestDay   ? 'text-white/30'
                  : isSel                ? 'text-purple-200/90'
                  : isDayBlocked         ? 'text-red-400/50'
                  : isRestDay && !hasOvr ? 'text-white/20'
                                         : 'text-white/50'
                }`}>
                  {shortLabel}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isSel && isDayBlocked    ? 'bg-red-400'
                  : isSel && isRestDay     ? 'bg-white/35'
                  : isSel                  ? 'bg-purple-400'
                  : isDayBlocked           ? 'bg-red-500/40'
                  : isRestDay && !hasOvr   ? 'bg-white/10'
                                           : 'bg-white/25'
                }`} />
              </button>
            )
          })}
        </div>

        {/* ── Day card ── */}
        <GlassCard padding={false} className="overflow-hidden mb-4">
          {/* Day header */}
          <div
            className={`flex items-center justify-between px-5 py-4 border-b ${isBlocked ? 'border-red-500/20' : 'border-white/8'}`}
            style={{
              background: isBlocked
                ? 'rgba(239,68,68,0.06)'
                : isRest
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(168,85,247,0.05)',
            }}
          >
            <div>
              <span className="text-white font-bold text-xl">{currentDayName}</span>
              {!isRest && !isBlocked && selectedLabel && (
                <p className="text-white/40 text-xs mt-0.5">{selectedLabel}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Exercise progress chip */}
              {exerciseKeys.length > 0 && !isRest && !isBlocked && (
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full tabular-nums transition-all duration-300"
                  style={
                    allDone
                      ? { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }
                      : { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }
                  }
                >
                  {doneCount}/{exerciseKeys.length}
                </span>
              )}
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                isBlocked
                  ? 'text-red-300 border-red-500/35 bg-red-500/12'
                  : isRest
                  ? 'text-white/30 border-white/8'
                  : allDone
                  ? 'text-green-300 border-green-500/35 bg-green-500/12'
                  : 'text-purple-200 border-purple-500/35 bg-purple-500/12'
              }`}>
                {isBlocked ? 'Blocked' : isRest ? 'Rest Day' : allDone ? 'Complete' : 'Active'}
              </span>
            </div>
          </div>

          {/* Day content */}
          <div className="p-5 sm:p-6">
            {isBlocked ? (
              isGeneratingWorkout ? (
                <div className="py-10 text-center">
                  <div className="flex justify-center mb-4"><LoadingSpinner size="md" /></div>
                  <p className="text-white font-medium mb-1">Generating your workout</p>
                  <p className="text-white/40 text-sm">Building a session that fits your plan...</p>
                </div>
              ) : showingUnblockOptions ? (
                <div className="py-6">
                  <p className="text-white font-medium text-center mb-1">
                    What would you like to do on {currentDayName}?
                  </p>
                  <p className="text-white/40 text-sm text-center mb-6 leading-relaxed">
                    You originally blocked this day. Choose how you want to use it now.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => { onUnblockDay?.(currentDayName); setShowingUnblockOptions(false) }}
                      className="flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-white/12
                                 bg-white/3 hover:bg-white/7 transition-all duration-200 text-left"
                    >
                      <span className="text-3xl">😴</span>
                      <span className="text-white font-medium text-sm">Keep as Rest Day</span>
                      <span className="text-white/35 text-xs text-center leading-relaxed">
                        Remove the block. This day stays as a recovery day.
                      </span>
                    </button>
                    {onGenerateDayWorkout && (
                      <button
                        onClick={() => void handleGenerateWorkout()}
                        className="flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border border-purple-500/35
                                   bg-purple-500/10 hover:bg-purple-500/18 transition-all duration-200 text-left"
                      >
                        <span className="text-3xl">💪</span>
                        <span className="text-white font-medium text-sm">Generate a Workout</span>
                        <span className="text-white/35 text-xs text-center leading-relaxed">
                          AI builds a session that follows your plan's style and equipment.
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setShowingUnblockOptions(false)}
                      className="text-white/25 text-xs hover:text-white/45 transition-colors"
                    >
                      Cancel, keep it blocked
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="text-4xl mb-3">🚫</div>
                  <p className="text-white font-medium mb-1">Blocked Day</p>
                  <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto mb-6">
                    You chose not to train on {currentDayName}s during setup. This day is reserved for rest.
                  </p>
                  {(onUnblockDay || onGenerateDayWorkout) && (
                    <button
                      onClick={() => setShowingUnblockOptions(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                                 border border-white/15 bg-white/5 text-white/60
                                 hover:bg-white/10 hover:text-white/80 transition-all duration-200"
                    >
                      <HiLockOpen className="w-3.5 h-3.5" />
                      Changed your mind? Unblock this day
                    </button>
                  )}
                </div>
              )
            ) : isRest ? (
              <div className="py-10 text-center">
                <div className="text-4xl mb-3">😴</div>
                <p className="text-white font-medium mb-1">Rest Day</p>
                <p className="text-white/40 text-sm leading-relaxed">
                  Recovery is part of the programme. Prioritise sleep and hydration today.
                </p>
              </div>
            ) : dayBody ? (
              <div key={`${currentDayName}:${contentKey}`} className="prose prose-invert max-w-none">
                <ReactMarkdown components={planComponents}>{parsedDay}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-white/30 text-sm text-center py-10">No workout content found for this day.</p>
            )}
          </div>
        </GlassCard>

        {/* ── Workout celebration ── */}
        <AnimatePresence>
          {showCelebration && exerciseKeys.length > 0 && !isRest && !isBlocked && (
            <WorkoutCelebration
              exerciseCount={exerciseKeys.length}
              setsCount={setsCount}
              weekStreak={weekStreak ?? 0}
              weekWorkouts={celebrationWeekWorkouts}
              weeklyTarget={weeklyTarget ?? 0}
              dayFocus={selectedLabel || undefined}
              onDismiss={() => setShowCelebration(false)}
            />
          )}
        </AnimatePresence>

        {/* ── Summary sections (moved to bottom) ── */}
        {overview    && <CollapsibleSection title="Plan Overview"    icon="📋" content={overview} />}
        {progression && <CollapsibleSection title="Progression Plan" icon="📈" content={progression} />}
        {nutrition   && <CollapsibleSection title="Nutrition Tips"   icon="🥗" content={nutrition} />}
      </div>
    </WorkoutProgressContext.Provider>
  )
}
