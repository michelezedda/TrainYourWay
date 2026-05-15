import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { HiChevronDown, HiLockOpen } from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import type { Components } from 'react-markdown'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { sanitizePlan, transformExercises, WorkoutProgressContext } from '@/lib/planComponents'

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

// ── WorkoutCelebration ────────────────────────────────────────────────────────

interface CelebrationProps {
  exerciseCount: number
  startTime: number | null
  onDismiss: () => void
}

function WorkoutCelebration({ exerciseCount, startTime, onDismiss }: CelebrationProps) {
  const [elapsed, setElapsed] = useState(() =>
    startTime ? Math.floor((Date.now() - startTime) / 1000) : 0
  )

  useEffect(() => {
    const t = setInterval(() =>
      setElapsed(startTime ? Math.floor((Date.now() - startTime) / 1000) : 0), 1000
    )
    return () => clearInterval(t)
  }, [startTime])

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  const estKcal = Math.round((elapsed / 60) * 6)

  const stats = [
    { value: String(exerciseCount), label: 'Exercises', color: 'rgba(168,85,247,', border: 'rgba(168,85,247,0.2)' },
    { value: elapsed > 0 ? durationStr : '-', label: 'Duration', color: 'rgba(34,211,238,', border: 'rgba(34,211,238,0.18)' },
    { value: estKcal > 0 ? `~${estKcal}` : '-', label: 'kcal', color: 'rgba(251,146,60,', border: 'rgba(251,146,60,0.18)' },
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

      <div className="relative px-6 pt-8 pb-6 text-center">
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
          You crushed all {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} today
        </motion.p>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="grid grid-cols-3 gap-2.5 mb-6"
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

        {/* Dismiss */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.42 }}
          onClick={onDismiss}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          Continue
        </motion.button>
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
}: {
  plan: string
  planComponents: Components
  blockedDays?: string[]
  dayWorkoutOverrides?: Record<string, string>
  onUnblockDay?: (day: string) => void
  onGenerateDayWorkout?: (day: string) => Promise<void>
}) {
  const sanitized   = useMemo(() => sanitizePlan(plan), [plan])
  const schedule    = useMemo(() => parseWeeklySchedule(sanitized), [sanitized])
  const dayChunks   = useMemo(() => parseDayChunks(sanitized), [sanitized])
  const overview    = useMemo(() => parseSectionContent(sanitized, 'Overview'), [sanitized])
  const progression = useMemo(() => parseSectionContent(sanitized, 'Progression Plan'), [sanitized])
  const nutrition   = useMemo(() => parseSectionContent(sanitized, 'Nutrition Tips'), [sanitized])

  const [selectedDay, setSelectedDay]                         = useState(0)
  const [showingUnblockOptions, setShowingUnblockOptions]     = useState(false)
  const [isGeneratingWorkout, setIsGeneratingWorkout]         = useState(false)

  // Workout completion tracking
  const [doneMap, setDoneMap]           = useState<Record<string, boolean>>({})
  const [showCelebration, setShowCelebration] = useState(false)
  const startTimeRef = useRef<number | null>(null)

  const handleExerciseDone = useCallback((key: string, done: boolean) => {
    if (done && !startTimeRef.current) {
      startTimeRef.current = Date.now()
    }
    setDoneMap(prev => {
      if (prev[key] === done) return prev
      return { ...prev, [key]: done }
    })
  }, [])

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
  const selectedLabel  = schedule[currentDayName] ?? ''
  const hasOverride    = !!(dayWorkoutOverrides?.[currentDayName])
  const isRest         = !hasOverride && (!selectedLabel || /rest/i.test(selectedLabel))
  const isBlocked      = (blockedDays?.includes(currentDayName) ?? false) && !hasOverride
  const chunkIdx       = dayToChunkIdx[selectedDay]
  const rawChunk       = chunkIdx !== undefined ? (dayChunks[chunkIdx] ?? '') : ''
  const dayBody        = dayWorkoutOverrides?.[currentDayName]
    ?? rawChunk.replace(/^### Day \d+:[^\n]*\n?/, '').trim()

  const parsedDay = useMemo(
    () => transformExercises(sanitizePlan(dayBody)),
    [dayBody],
  )

  // Extract exercise keys from raw day body for completion tracking
  const exerciseKeys = useMemo(() => extractExerciseKeys(dayBody), [dayBody])

  const allDone = exerciseKeys.length > 0 && exerciseKeys.every(k => doneMap[k] === true)

  // Show celebration when all exercises are done
  useEffect(() => {
    if (allDone && !showCelebration) {
      setShowCelebration(true)
    }
  }, [allDone, showCelebration])

  // Reset tracking when day content changes
  useEffect(() => {
    setDoneMap({})
    setShowCelebration(false)
    startTimeRef.current = null
  }, [dayBody])

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
      <WorkoutProgressContext.Provider value={{ onExerciseDone: handleExerciseDone }}>
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
    <WorkoutProgressContext.Provider value={{ onExerciseDone: handleExerciseDone }}>
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
                  {Object.values(doneMap).filter(Boolean).length}/{exerciseKeys.length}
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
              <div className="prose prose-invert max-w-none">
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
              startTime={startTimeRef.current}
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
