import { useState } from 'react'
import type { Components } from 'react-markdown'
import type React from 'react'

export function sanitizePlan(text: string): string {
  return text
    .replace(/\s*—\s*/g, ' - ')
    .replace(/–/g, '-')
}

// Convert numbered exercise blocks into fenced ```exercise code blocks so they
// can be rendered as table cards without markdown interpreting inner asterisks.
export function transformExercises(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    // Detect: **N. Exercise name** (possibly ending ***)
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

// ── Exercise table card ───────────────────────────────────────────────────────

interface ExerciseTableCardProps {
  name: string   // e.g. "1. Dumbbell Curl *(new)*"
  meta: string   // e.g. "Sets: 3 × 12 | Rest: 60s | Weight: 10-12 kg"
  tip: string    // e.g. "Form tip: Keep elbows tucked."
  exerciseKey: string
  weight: string
  onWeightChange: (value: string) => void
  onGuideClick: (name: string) => void
}

function ExerciseTableCard({
  name, meta, tip, exerciseKey, weight, onWeightChange, onGuideClick,
}: ExerciseTableCardProps) {
  const [localWeight, setLocalWeight] = useState(weight)
  const num = name.match(/^(\d+)\./)?.[1] ?? ''
  const displayName = name.replace(/^\d+\.\s*/, '').replace(/\s*\*+\([^)]+\)\*+\s*/g, '').trim()
  const isNew = /\*+\(new\)\*+/.test(name)

  // Parse "Sets: 3 × 12 | Rest: 60s | Weight: 10-12 kg"
  const metaParts: Record<string, string> = {}
  for (const part of meta.split('|')) {
    const colon = part.indexOf(':')
    if (colon !== -1) {
      metaParts[part.slice(0, colon).trim().toLowerCase()] = part.slice(colon + 1).trim()
    }
  }

  const tipText = tip.replace(/^Form tip:\s*/i, '').trim()

  return (
    <div className="my-4 rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            {num}.
          </span>
          <span className="text-white font-semibold text-sm truncate">{displayName}</span>
          {isNew && (
            <span className="flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-semibold uppercase tracking-wide">
              new
            </span>
          )}
        </div>
        <button
          onClick={() => onGuideClick(exerciseKey)}
          className="flex-shrink-0 flex items-center gap-1 text-xs text-purple-400/70 hover:text-purple-300 transition-colors ml-3"
        >
          Guide
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
        {metaParts['sets'] && (
          <div className="px-3 py-2.5">
            <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">Sets</p>
            <p className="text-white/85 text-xs font-semibold leading-snug">{metaParts['sets']}</p>
          </div>
        )}
        {metaParts['rest'] && (
          <div className="px-3 py-2.5">
            <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">Rest</p>
            <p className="text-white/85 text-xs font-semibold leading-snug">{metaParts['rest']}</p>
          </div>
        )}
        {metaParts['weight'] && (
          <div className="px-3 py-2.5">
            <p className="text-white/35 text-[9px] uppercase tracking-wider mb-1">Suggested</p>
            <p className="text-white/85 text-xs font-semibold leading-snug">{metaParts['weight']}</p>
          </div>
        )}
      </div>

      {/* My weight input */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8" style={{ background: 'rgba(168,85,247,0.03)' }}>
        <span className="text-purple-400/60 text-[9px] uppercase tracking-wider whitespace-nowrap font-semibold">
          My weight
        </span>
        <input
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder-white/20 min-w-0"
          style={{ color: localWeight ? 'rgba(255,255,255,0.9)' : undefined }}
          placeholder="e.g. 12 kg, bodyweight..."
          value={localWeight}
          onChange={(e) => { setLocalWeight(e.target.value); onWeightChange(e.target.value) }}
        />
        {localWeight && (
          <button
            onClick={() => { setLocalWeight(''); onWeightChange('') }}
            className="flex-shrink-0 text-white/20 hover:text-white/50 transition-colors text-base leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Form tip */}
      {tipText && (
        <div className="px-4 py-2.5">
          <p className="text-white/40 text-xs italic leading-relaxed">{tipText}</p>
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
    // Strip <pre> wrapper so exercise cards render without a code block frame
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
