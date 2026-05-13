import { useState, useRef, useEffect } from 'react'
import { HiInformationCircle, HiChevronDown } from 'react-icons/hi'
import type { Components } from 'react-markdown'
import type React from 'react'

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

const SCHEDULE_DAY = /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
const META_LINE    = /^Sets:/i

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

// ── Exercise card ──────────────────────────────────────────────────────────────

interface ExerciseTableCardProps {
  name: string
  meta: string
  tip: string
  exerciseKey: string
  weight: string
  onWeightChange: (value: string) => void
  onGuideClick: (name: string) => void
}

function parseRestSeconds(restStr: string): number {
  const minMatch = restStr.match(/(\d+)\s*min/i)
  if (minMatch) return parseInt(minMatch[1], 10) * 60
  const numMatch = restStr.match(/\d+/)
  return numMatch ? parseInt(numMatch[0], 10) : 60
}

function ExerciseTableCard({
  name, meta, tip, exerciseKey, weight, onWeightChange, onGuideClick,
}: ExerciseTableCardProps) {
  const [localWeight, setLocalWeight] = useState(weight)
  const [isDone, setIsDone] = useState(false)
  const [restActive, setRestActive] = useState(false)
  const [restSecsLeft, setRestSecsLeft] = useState(0)
  const [showTip, setShowTip] = useState(false)
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

  const tipText = tip.replace(/^Form tip:\s*/i, '').trim()

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

  const handleDoneToggle = () => {
    const next = !isDone
    setIsDone(next)
    if (next && metaParts['rest'] && !restActive) {
      startRestTimer(parseRestSeconds(metaParts['rest']))
    } else if (!next) {
      skipRest()
    }
  }

  const restPct = restTotalRef.current > 0 ? restSecsLeft / restTotalRef.current : 0
  const restMins = Math.floor(restSecsLeft / 60)
  const restSecs = restSecsLeft % 60

  return (
    <div
      className={`my-4 rounded-2xl border overflow-hidden transition-all duration-300 ${
        isDone ? 'border-green-500/25' : 'border-white/10'
      }`}
      style={{ background: isDone ? 'rgba(34,197,94,0.04)' : 'rgba(255,255,255,0.025)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ background: isDone ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.04)' }}
      >
        <button
          onClick={handleDoneToggle}
          className="flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90"
          style={isDone
            ? { background: 'linear-gradient(135deg, #22C55E, #16A34A)', borderColor: '#22C55E' }
            : { borderColor: 'rgba(255,255,255,0.20)' }}
          aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        >
          {isDone && <span className="text-white text-xs font-bold leading-none">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-base font-black flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {num}.
            </span>
            <span className={`font-bold text-base leading-tight transition-all duration-200 ${isDone ? 'text-white/35 line-through decoration-white/20' : 'text-white'}`}>
              {displayName}
            </span>
            {isNew && (
              <span className="flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold uppercase tracking-wide">
                new
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => onGuideClick(exerciseKey)}
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95"
          style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.22)' }}
          aria-label="Exercise guide"
        >
          <HiInformationCircle className="w-4 h-4 text-purple-400" />
        </button>
      </div>

      {/* Stats chips */}
      {(metaParts['sets'] || metaParts['rest'] || metaParts['weight']) && (
        <div className="flex gap-2 px-4 pb-3 pt-1 flex-wrap">
          {metaParts['sets'] && (
            <div
              className="flex-1 min-w-[80px] px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.22)' }}
            >
              <p className="text-purple-300/70 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Sets</p>
              <p className="text-purple-100 text-sm font-bold">{metaParts['sets']}</p>
            </div>
          )}
          {metaParts['rest'] && (
            <button
              onClick={() => startRestTimer(parseRestSeconds(metaParts['rest']))}
              className="flex-1 min-w-[80px] px-3 py-2.5 rounded-xl text-left transition-all duration-200 active:scale-95"
              style={{
                background: restActive ? 'rgba(34,211,238,0.18)' : 'rgba(34,211,238,0.08)',
                border: `1px solid ${restActive ? 'rgba(34,211,238,0.4)' : 'rgba(34,211,238,0.22)'}`,
              }}
            >
              <p className="text-cyan-300/70 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Rest</p>
              <p className="text-cyan-100 text-sm font-bold">
                {restActive
                  ? `${restMins > 0 ? `${restMins}:` : ''}${String(restSecs).padStart(2, '0')}s`
                  : metaParts['rest']}
              </p>
            </button>
          )}
          {metaParts['weight'] && (
            <div
              className="flex-1 min-w-[80px] px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.22)' }}
            >
              <p className="text-orange-300/70 text-[9px] uppercase tracking-wider font-semibold mb-0.5">Suggested</p>
              <p className="text-orange-100 text-sm font-bold">{metaParts['weight']}</p>
            </div>
          )}
        </div>
      )}

      {/* Rest timer progress bar */}
      {restActive && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-cyan-300 text-xs font-semibold">
              Resting - {restMins > 0 ? `${restMins}m ` : ''}{String(restSecs).padStart(2, '0')}s left
            </span>
            <button
              onClick={skipRest}
              className="text-white/35 text-xs hover:text-white/60 transition-colors"
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

      {/* My weight input */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-t border-white/8"
        style={{ background: 'rgba(168,85,247,0.03)' }}
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

      {/* Form tip collapsible */}
      {tipText && (
        <div className="border-t border-white/8">
          <button
            onClick={() => setShowTip(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors"
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

// ── Main export ───────────────────────────────────────────────────────────────

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
