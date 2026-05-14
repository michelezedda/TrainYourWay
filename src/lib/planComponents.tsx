import { useState, useRef, useEffect, useContext, createContext } from 'react'
import { HiInformationCircle, HiChevronDown } from 'react-icons/hi'
import type { Components } from 'react-markdown'
import type React from 'react'

// ── Workout progress context ──────────────────────────────────────────────────
// Allows ExerciseTableCard to report completion up to WorkoutDayView without
// prop-drilling through the react-markdown component tree.

export const WorkoutProgressContext = createContext<{
  onExerciseDone?: (key: string, done: boolean) => void
}>({})

// ── Plan text utilities ───────────────────────────────────────────────────────

export function sanitizePlan(text: string): string {
  return text
    .replace(/\s*—\s*/g, ' - ')
    .replace(/–/g, '-')
}

export function transformExercises(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (/^\*\*\d+\./.test(trimmed)) {
      const name = trimmed.replace(/^\*\*/, '').replace(/\*+$/, '').trim()
      const nextTrimmed = lines[i + 1]?.trim() ?? ''

      if (/^Sets:/i.test(nextTrimmed)) {
        const meta = nextTrimmed
        const after = lines[i + 2]?.trim() ?? ''
        const isTip = after.startsWith('*') && !after.startsWith('**') && after.endsWith('*')
        const tip = isTip ? after.slice(1, -1).trim() : ''

        result.push('```exercise')
        result.push(name)
        result.push(meta)
        if (tip) result.push(tip)
        result.push('```')
        i += isTip ? 3 : 2
        continue
      }
    }

    result.push(lines[i])
    i++
  }

  return result.join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(node: unknown): string {
  if (typeof node === 'string') return node.trim()
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return (node as unknown[]).map(extractText).join('').trim()
  if (typeof node === 'object' && 'props' in (node as object)) {
    return extractText((node as { props: { children?: unknown } }).props.children)
  }
  return ''
}

function parseSetsInfo(setsStr: string): { count: number; reps: string } {
  const s = setsStr.trim()
  // "3 x 12 reps", "3 sets x 8-12", "4x10", "3 x AMRAP"
  const xMatch = s.match(/^(\d+)(?:-\d+)?\s*(?:sets?)?\s*[x×]\s*(.+?)(?:\s*reps?)?$/i)
  if (xMatch) {
    const count = parseInt(xMatch[1], 10)
    const reps = xMatch[2].replace(/\s*reps?$/i, '').trim()
    return { count: Math.max(1, Math.min(count, 10)), reps }
  }
  const numMatch = s.match(/^(\d+)/)
  if (numMatch) {
    return { count: Math.max(1, Math.min(parseInt(numMatch[1], 10), 10)), reps: '' }
  }
  return { count: 3, reps: '' }
}

function parseRestSeconds(restStr: string): number {
  const minMatch = restStr.match(/(\d+)\s*min/i)
  if (minMatch) return parseInt(minMatch[1], 10) * 60
  const numMatch = restStr.match(/\d+/)
  return numMatch ? parseInt(numMatch[0], 10) : 60
}

const SCHEDULE_DAY = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
const META_LINE    = /^Sets:/i

// ── Inline components ─────────────────────────────────────────────────────────

function MetaChips({ text }: { text: string }) {
  const parts = text.split('|').map(s => s.trim()).filter(Boolean)
  return (
    <div className="flex flex-wrap gap-2 mt-1 mb-3">
      {parts.map((part, i) => {
        const colonIdx = part.indexOf(':')
        if (colonIdx === -1) {
          return (
            <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60">
              {part}
            </span>
          )
        }
        const label = part.slice(0, colonIdx).trim()
        const value = part.slice(colonIdx + 1).trim()
        return (
          <span key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="text-purple-300/70 font-semibold uppercase tracking-wide text-[9px]">{label}</span>
            <span className="text-white/85 font-medium">{value}</span>
          </span>
        )
      })}
    </div>
  )
}

const staticCard = (children: unknown) => (
  <div
    className="flex gap-3 px-4 py-3 rounded-2xl border border-white/8"
    style={{ background: 'rgba(255,255,255,0.03)' }}
  >
    <span className="text-white/30 flex-shrink-0 text-xs mt-1">·</span>
    <span className="text-white/70">{children as React.ReactNode}</span>
  </div>
)

const scheduleCard = (
  label: React.ReactNode,
  exerciseName: string,
  onClick: (name: string) => void,
) => (
  <button
    onClick={() => onClick(exerciseName)}
    className="w-full flex gap-3 px-4 py-3 rounded-2xl border border-white/8
               transition-colors hover:bg-white/5 text-left group"
    style={{ background: 'rgba(255,255,255,0.03)' }}
  >
    <span className="text-purple-400 flex-shrink-0 text-xs mt-1">▶</span>
    <span className="text-white/70 flex-1">{label}</span>
    <span
      className="text-[10px] px-2.5 py-0.5 rounded-full font-medium text-purple-300
                 border border-purple-500/40 bg-purple-500/10 self-center flex-shrink-0
                 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
    >
      See guide
    </span>
  </button>
)

// ── SetRow ────────────────────────────────────────────────────────────────────

interface SetRowProps {
  idx: number
  reps: string
  done: boolean
  onToggle: () => void
}

function SetRow({ idx, reps, done, onToggle }: SetRowProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-200 active:scale-[0.97] text-left"
      style={{
        background: done ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
        border: done ? '1px solid rgba(34,197,94,0.28)' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 transition-all duration-200"
        style={{
          background: done ? 'rgba(34,197,94,0.22)' : 'rgba(168,85,247,0.18)',
          color: done ? '#4ade80' : '#c084fc',
        }}
      >
        {idx + 1}
      </div>
      <span
        className="flex-1 text-sm font-medium transition-colors duration-200"
        style={{ color: done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.78)' }}
      >
        {reps ? `${reps} reps` : 'Complete set'}
      </span>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={
          done
            ? { background: 'linear-gradient(135deg, #22C55E, #16A34A)', boxShadow: '0 0 8px rgba(34,197,94,0.4)' }
            : { border: '1.5px solid rgba(255,255,255,0.2)' }
        }
      >
        {done && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
      </div>
    </button>
  )
}

// ── ExerciseTableCard ─────────────────────────────────────────────────────────

interface ExerciseTableCardProps {
  name: string
  meta: string
  tip: string
  exerciseKey: string
  weight: string
  onWeightChange: (value: string) => void
  onGuideClick: (name: string) => void
}

function ExerciseTableCard({
  name, meta, tip, exerciseKey, weight, onWeightChange, onGuideClick,
}: ExerciseTableCardProps) {
  const { onExerciseDone } = useContext(WorkoutProgressContext)

  const [localWeight, setLocalWeight] = useState(weight)
  const [showTip, setShowTip] = useState(false)
  const [restActive, setRestActive] = useState(false)
  const [restSecsLeft, setRestSecsLeft] = useState(0)
  const restTotalRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const num = name.match(/^(\d+)\./)?.[1] ?? ''
  const displayName = name.replace(/^\d+\.\s*/, '').replace(/\s*\*+\([^)]+\)\*+\s*/g, '').trim()
  const isNew = /\*+\(new\)\*+/.test(name)

  const metaParts: Record<string, string> = {}
  for (const part of meta.split('|')) {
    const colon = part.indexOf(':')
    if (colon !== -1) {
      metaParts[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).trim()
    }
  }

  const { count: setsCount, reps } = metaParts['sets']
    ? parseSetsInfo(metaParts['sets'])
    : { count: 0, reps: '' }

  const [setsDone, setSetsDone] = useState<boolean[]>(() => Array(Math.max(setsCount, 0)).fill(false))
  const [manualDone, setManualDone] = useState(false)

  const allSetsDone = setsCount > 0 && setsDone.every(Boolean)
  const isDone = manualDone || allSetsDone
  const completedCount = setsDone.filter(Boolean).length

  const tipText = tip.replace(/^Form tip:\s*/i, '').trim()

  // Report done state via context whenever it changes
  useEffect(() => {
    onExerciseDone?.(exerciseKey, isDone)
  }, [isDone, exerciseKey, onExerciseDone])

  const startRestTimer = (totalSecs: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    restTotalRef.current = totalSecs
    setRestSecsLeft(totalSecs)
    setRestActive(true)
    timerRef.current = setInterval(() => {
      setRestSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          setRestActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const skipRest = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRestActive(false)
    setRestSecsLeft(0)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const toggleSet = (idx: number) => {
    const wasCompleted = setsDone[idx]
    const next = setsDone.map((v, i) => i === idx ? !v : v)
    const nowAllDone = next.every(Boolean)
    setSetsDone(next)

    if (!wasCompleted) {
      if (nowAllDone) {
        // Last set done: exercise complete, no rest needed
        skipRest()
      } else if (metaParts['rest']) {
        // More sets remain: start inter-set rest timer
        startRestTimer(parseRestSeconds(metaParts['rest']))
      }
    } else {
      // Un-completing a set: stop any running timer
      skipRest()
    }
  }

  const toggleManualDone = () => {
    if (isDone) {
      setManualDone(false)
      setSetsDone(Array(setsCount).fill(false))
      skipRest()
    } else {
      setManualDone(true)
      if (setsCount > 0) setSetsDone(Array(setsCount).fill(true))
      skipRest()
    }
  }

  const restPct = restTotalRef.current > 0 ? restSecsLeft / restTotalRef.current : 0
  const restMins = Math.floor(restSecsLeft / 60)
  const restSecs = restSecsLeft % 60

  return (
    <div
      className="my-3 rounded-3xl overflow-hidden transition-all duration-400"
      style={{
        background: isDone
          ? 'linear-gradient(145deg, rgba(22,163,74,0.14) 0%, rgba(5,5,20,0.92) 100%)'
          : 'linear-gradient(145deg, rgba(168,85,247,0.09) 0%, rgba(5,5,20,0.92) 100%)',
        border: isDone
          ? '1px solid rgba(34,197,94,0.28)'
          : '1px solid rgba(168,85,247,0.22)',
        boxShadow: isDone
          ? '0 6px 28px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(34,197,94,0.15), inset 0 1px 0 rgba(34,197,94,0.1)'
          : '0 6px 28px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(168,85,247,0.08), inset 0 1px 0 rgba(168,85,247,0.1)',
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* Exercise number badge */}
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 transition-all duration-300"
          style={
            isDone
              ? {
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                color: '#fff',
                boxShadow: '0 0 20px rgba(34,197,94,0.4)',
              }
              : {
                background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                color: '#fff',
                boxShadow: '0 0 20px rgba(168,85,247,0.35)',
              }
          }
        >
          {isDone ? '✓' : num}
        </div>

        {/* Name + meta badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-bold text-base leading-tight transition-all duration-300"
              style={{ color: isDone ? 'rgba(255,255,255,0.42)' : '#fff' }}
            >
              {displayName}
            </span>
            {isNew && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold uppercase tracking-wide flex-shrink-0">
                new
              </span>
            )}
          </div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {metaParts['rest'] && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(34,211,238,0.1)',
                  color: 'rgba(34,211,238,0.75)',
                  border: '1px solid rgba(34,211,238,0.18)',
                }}
              >
                {metaParts['rest']} rest
              </span>
            )}
            {metaParts['weight'] && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(251,146,60,0.1)',
                  color: 'rgba(251,146,60,0.75)',
                  border: '1px solid rgba(251,146,60,0.18)',
                }}
              >
                {metaParts['weight']}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onGuideClick(exerciseKey)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.22)' }}
            aria-label="Exercise guide"
          >
            <HiInformationCircle className="w-4 h-4 text-purple-400" />
          </button>
          <button
            onClick={toggleManualDone}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 border-2"
            style={
              isDone
                ? { background: 'linear-gradient(135deg, #22C55E, #16A34A)', borderColor: '#22C55E', boxShadow: '0 0 12px rgba(34,197,94,0.35)' }
                : { borderColor: 'rgba(255,255,255,0.2)' }
            }
            aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
          >
            {isDone && <span className="text-white text-xs font-bold leading-none">✓</span>}
          </button>
        </div>
      </div>

      {/* ── Sets progress bar + rows ── */}
      {setsCount > 0 && (
        <div className="px-4 pb-4">
          {/* Progress header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Sets
            </span>
            <span
              className="text-[11px] font-bold tabular-nums transition-colors duration-300"
              style={{ color: completedCount === setsCount ? '#4ade80' : 'rgba(255,255,255,0.4)' }}
            >
              {completedCount}/{setsCount}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${setsCount > 0 ? (completedCount / setsCount) * 100 : 0}%`,
                background: isDone
                  ? 'linear-gradient(90deg, #22C55E, #4ade80)'
                  : 'linear-gradient(90deg, #A855F7, #22D3EE)',
              }}
            />
          </div>

          {/* Individual set rows */}
          <div className="space-y-2">
            {setsDone.map((done, idx) => (
              <SetRow
                key={idx}
                idx={idx}
                reps={reps}
                done={done}
                onToggle={() => toggleSet(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Rest timer ── */}
      {restActive && (
        <div
          className="mx-4 mb-4 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-cyan-300 text-xs font-bold">
              Rest {restMins > 0 ? `${restMins}m ` : ''}{String(restSecs).padStart(2, '0')}s
            </span>
            <button
              onClick={skipRest}
              className="text-white/35 text-xs hover:text-white/65 transition-colors font-medium"
            >
              Skip
            </button>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${restPct * 100}%`, background: 'linear-gradient(90deg, #22D3EE, #A855F7)' }}
            />
          </div>
        </div>
      )}

      {/* ── Weight input ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(168,85,247,0.03)' }}
      >
        <span className="text-purple-400/60 text-[9px] uppercase tracking-wider whitespace-nowrap font-semibold">
          My weight
        </span>
        <input
          className="flex-1 bg-transparent border-none outline-none placeholder-white/20 min-w-0"
          style={{ fontSize: 16, color: localWeight ? 'rgba(255,255,255,0.9)' : undefined }}
          placeholder="e.g. 12 kg, bodyweight..."
          value={localWeight}
          onChange={e => { setLocalWeight(e.target.value); onWeightChange(e.target.value) }}
        />
        {localWeight && (
          <button
            onClick={() => { setLocalWeight(''); onWeightChange('') }}
            className="flex-shrink-0 text-white/20 hover:text-white/50 transition-colors text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* ── Form tip ── */}
      {tipText && (
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => setShowTip(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <span className="text-white/40 text-xs font-medium">Form tip</span>
            <HiChevronDown
              className={`w-3.5 h-3.5 text-white/25 transition-transform duration-200 ${showTip ? '' : '-rotate-90'}`}
            />
          </button>
          {showTip && (
            <div className="px-4 pb-3.5">
              <p className="text-white/50 text-xs italic leading-relaxed">{tipText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Public exports ────────────────────────────────────────────────────────────

export function buildPlanComponents(
  setSelectedExercise: (name: string) => void,
  _planId?: string,
  weights?: Record<string, string>,
  onWeightChange?: (exercise: string, value: string) => void,
): Components {
  return {
    h1: ({ children }) => (
      <h1 className="text-2xl sm:text-3xl font-black gradient-text mb-4 leading-tight">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-bold text-white/90 mt-8 mb-3 pb-2 border-b border-white/10">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-bold text-white mt-8 mb-3 flex items-center gap-2">
        <span
          className="w-1 h-5 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(180deg, #A855F7, #22D3EE)' }}
        />
        {children}
      </h3>
    ),
    p: ({ children }) => {
      const text = extractText(children)
      if (META_LINE.test(text) && text.includes('|')) {
        return <MetaChips text={text} />
      }
      return <div className="text-white/65 leading-relaxed mb-4">{children}</div>
    },
    ul: ({ children }) => <ul className="space-y-2 mb-5">{children}</ul>,
    ol: ({ children }) => <ol className="space-y-4 mb-5">{children}</ol>,
    li: ({ children }) => {
      const text = extractText(children)
      const isDay = SCHEDULE_DAY.test(text)
      return (
        <li className="list-none">
          {isDay ? staticCard(children) : scheduleCard(children, text, setSelectedExercise)}
        </li>
      )
    },
    strong: ({ children }) => (
      <strong className="text-white font-semibold">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="text-cyan-300 not-italic text-sm block mt-1 pl-1">{children}</em>
    ),
    hr: () => (
      <div className="my-8 flex items-center gap-3">
        <div className="flex-1 h-px bg-white/8" />
        <div className="w-2 h-2 rounded-full" style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)' }} />
        <div className="flex-1 h-px bg-white/8" />
      </div>
    ),
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      if (String(className ?? '').includes('language-exercise')) {
        const contentLines = String(children).trim().split('\n')
        const name = contentLines[0] ?? ''
        const meta = contentLines[1] ?? ''
        const tip = contentLines.slice(2).join(' ')
        const exerciseKey = name.replace(/^\d+\.\s*/, '').replace(/\s*\*+[^*]+\*+\s*/g, '').trim()

        return (
          <ExerciseTableCard
            name={name}
            meta={meta}
            tip={tip}
            exerciseKey={exerciseKey}
            weight={weights?.[exerciseKey] ?? ''}
            onWeightChange={(value) => onWeightChange?.(exerciseKey, value)}
            onGuideClick={setSelectedExercise}
          />
        )
      }
      return (
        <code className="bg-white/10 px-2 py-0.5 rounded-lg text-sm font-mono text-purple-300">
          {children}
        </code>
      )
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-purple-500/50 pl-4 my-4 text-white/50 italic">
        {children}
      </blockquote>
    ),
  }
}
