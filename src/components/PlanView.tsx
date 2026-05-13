import { useState, useEffect, useMemo } from 'react'
import { HiChevronDown, HiLockOpen } from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { sanitizePlan, transformExercises } from '@/lib/planComponents'

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
    // Handles both **Monday:** (colon inside bold) and **Monday**: (colon after bold)
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
  const today = (new Date().getDay() + 6) % 7  // Mon=0 … Sun=6
  const todayLabel = schedule[DAY_NAMES[today]] ?? ''
  if (todayLabel && !/rest/i.test(todayLabel)) return today
  for (let i = 1; i <= 6; i++) {
    const idx = (today + i) % 7
    const label = schedule[DAY_NAMES[idx]] ?? ''
    if (label && !/rest/i.test(label)) return idx
  }
  return today
}

// ── Shared markdown components ────────────────────────────────────────────────

export const SECTION_ICONS: Record<string, string> = {
  'Profile Assessment':    '📊',
  'Workout Space Analysis':'🏠',
  'Space Recommendations': '💡',
  'Dietary Assessment':    '🥗',
  'What to Expect':        '🎯',
  // Reevaluation sections
  'Your Progress':         '📈',
  'Training Assessment':   '🏋️',
  'What Changes in This Phase': '🔄',
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
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
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

  const [selectedDay, setSelectedDay]           = useState(0)
  const [showingUnblockOptions, setShowingUnblockOptions] = useState(false)
  const [isGeneratingWorkout, setIsGeneratingWorkout]     = useState(false)

  useEffect(() => {
    setSelectedDay(getDefaultDayIdx(schedule))
  }, [schedule])

  useEffect(() => {
    setShowingUnblockOptions(false)
    setIsGeneratingWorkout(false)
  }, [selectedDay])

  // Map day-of-week index (0=Mon) to chunk index (skipping rest days)
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

  // Fallback: no ### Day N: structure found — render the full plan
  if (dayChunks.length === 0) {
    return (
      <GlassCard padding={false} className="overflow-hidden">
        <div className="p-6 sm:p-8 prose prose-invert max-w-none">
          <ReactMarkdown components={planComponents}>
            {transformExercises(sanitized)}
          </ReactMarkdown>
        </div>
      </GlassCard>
    )
  }

  return (
    <div>
      {/* Plan overview */}
      {overview && (
        <div
          className="mb-5 px-5 py-4 rounded-2xl border border-white/8"
          style={{ background: 'rgba(255,255,255,0.025)' }}
        >
          <ReactMarkdown components={analysisComponents}>{overview}</ReactMarkdown>
        </div>
      )}

      {/* Day selector - horizontal scroll pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
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
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3.5 rounded-2xl border transition-all duration-200 min-w-[72px] active:scale-95 ${
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
              <span className={`text-[10px] leading-tight text-center max-w-[64px] truncate ${
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

      {/* Selected day card */}
      <GlassCard padding={false} className="overflow-hidden mb-4">
        <div
          className={`flex items-center justify-between px-5 py-4 border-b ${isBlocked ? 'border-red-500/20' : 'border-white/8'}`}
          style={{ background: isBlocked ? 'rgba(239,68,68,0.06)' : isRest ? 'rgba(255,255,255,0.02)' : 'rgba(168,85,247,0.05)' }}
        >
          <div>
            <span className="text-white font-bold text-xl">{currentDayName}</span>
            {!isRest && !isBlocked && selectedLabel && (
              <p className="text-white/40 text-xs mt-0.5">{selectedLabel}</p>
            )}
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
            isBlocked
              ? 'text-red-300 border-red-500/35 bg-red-500/12'
              : isRest
              ? 'text-white/30 border-white/8'
              : 'text-purple-200 border-purple-500/35 bg-purple-500/12'
          }`}>
            {isBlocked ? 'Blocked' : isRest ? 'Rest Day' : 'Active'}
          </span>
        </div>

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

      {progression && <CollapsibleSection title="Progression Plan" icon="📈" content={progression} />}
      {nutrition    && <CollapsibleSection title="Nutrition Tips"   icon="🥗" content={nutrition} />}
    </div>
  )
}
