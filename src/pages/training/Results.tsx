import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import GlassCard from '@/components/GlassCard'
import ExerciseModal from '@/components/ExerciseModal'
import {
  HiChevronDown, HiArrowNarrowRight, HiChevronRight, HiChevronLeft,
  HiLightningBolt, HiFire, HiStar, HiCheck,
} from 'react-icons/hi'
import {
  parseAnalysisSections,
  SECTION_ICONS,
  analysisComponents,
  WorkoutDayView,
} from '@/components/PlanView'
import { buildPlanComponents, sanitizePlan } from '@/lib/planComponents'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { generateDayWorkout } from '@/lib/gemini'
import type { WorkoutFormData, ReevaluationData } from '@/lib/gemini'

// ── Design tokens ────────────────────────────────────────────────────────────

const GOAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Weight Loss':          { color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/30',  icon: '🔥' },
  'Muscle Gain':          { color: 'text-blue-300',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    icon: '💪' },
  'Body Recomposition':   { color: 'text-indigo-300',  bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  icon: '⚡' },
  'Strength':             { color: 'text-red-300',     bg: 'bg-red-500/15',     border: 'border-red-500/30',     icon: '🏋️' },
  'Endurance':            { color: 'text-cyan-300',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/30',    icon: '🏃' },
  'Athletic Performance': { color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   icon: '🏆' },
  'Flexibility':          { color: 'text-violet-300',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  icon: '🧘' },
  'General Fitness':      { color: 'text-green-300',   bg: 'bg-green-500/15',   border: 'border-green-500/30',   icon: '💚' },
  'Stress Relief':        { color: 'text-pink-300',    bg: 'bg-pink-500/15',    border: 'border-pink-500/30',    icon: '🌿' },
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
}

// ── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now()
      const duration = 1100
      const step = (now: number) => {
        const p = Math.min((now - start) / duration, 1)
        const e = 1 - Math.pow(1 - p, 3)
        setDisplayed(Math.round(e * value))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, delay * 1000)
    return () => clearTimeout(timeout)
  }, [value, delay])
  return <>{displayed.toLocaleString()}</>
}

// ── SVG Macro Ring ────────────────────────────────────────────────────────────

function MacroRing({
  pct, color, size = 72, stroke = 7, children,
}: {
  pct: number; color: string; size?: number; stroke?: number; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const [animPct, setAnimPct] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now()
      const dur = 1200
      const step = (now: number) => {
        const p = Math.min((now - start) / dur, 1)
        const e = 1 - Math.pow(1 - p, 3)
        setAnimPct(e * pct)
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 300)
    return () => clearTimeout(timeout)
  }, [pct])

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - animPct * circ}
          style={{ transition: 'none' }}
        />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  )
}

// ── Plan Hero ────────────────────────────────────────────────────────────────

function PlanHero({ formData }: { formData: WorkoutFormData }) {
  const goals = formData.goals ?? []
  const primaryGoal = goals[0]
  const meta = GOAL_META[primaryGoal]

  const stats = [
    { icon: '📅', label: 'Days/week', value: formData.daysPerWeek },
    { icon: '⏱', label: 'Per session', value: `${formData.sessionDuration} min` },
    { icon: '📊', label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel },
    { icon: '🛠', label: 'Equipment', value: formData.equipment.length > 0 ? `${formData.equipment.length} items` : 'Bodyweight' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="mb-6 rounded-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(168,85,247,0.18) 0%, rgba(34,211,238,0.09) 100%)',
        border: '1px solid rgba(168,85,247,0.28)',
        boxShadow: '0 0 60px rgba(168,85,247,0.12)',
      }}
    >
      {/* Top strip */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-purple-400/70">Your plan is ready</span>
          <span className="text-purple-400/40">·</span>
          <span className="text-xs text-white/30 uppercase tracking-wider">{formData.planName || 'Custom Plan'}</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight leading-tight mb-4">
          Built for your<br />
          <span className="gradient-text">exact goals</span>
        </h1>

        {/* Goal badges */}
        <div className="flex flex-wrap gap-2">
          {goals.map(g => {
            const m = GOAL_META[g]
            return (
              <span key={g}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${m?.bg ?? 'bg-white/8'} ${m?.color ?? 'text-white/70'} ${m?.border ?? 'border-white/15'}`}>
                <span>{m?.icon ?? '🎯'}</span>
                {g}
              </span>
            )
          })}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 divide-x divide-white/8 border-t border-white/8">
        {stats.map(({ icon, label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1 px-2 py-4">
            <span className="text-lg leading-none">{icon}</span>
            <span className="text-white font-bold text-sm leading-none">{value}</span>
            <span className="text-white/35 text-[10px] uppercase tracking-wider leading-none">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Analysis Slides (redesigned) ──────────────────────────────────────────────

const SLIDE_GRADIENTS: Record<string, string> = {
  'Profile Assessment':     'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(99,102,241,0.2))',
  'Workout Space Analysis': 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(59,130,246,0.18))',
  'Space Recommendations':  'linear-gradient(135deg, rgba(251,191,36,0.25), rgba(249,115,22,0.18))',
  'Dietary Assessment':     'linear-gradient(135deg, rgba(52,211,153,0.25), rgba(16,185,129,0.18))',
  'What to Expect':         'linear-gradient(135deg, rgba(236,72,153,0.25), rgba(168,85,247,0.2))',
  'Your Progress':          'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))',
  'Training Assessment':    'linear-gradient(135deg, rgba(239,68,68,0.25), rgba(249,115,22,0.18))',
  'What Changes in This Phase': 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(99,102,241,0.2))',
}

function AnalysisSlides({
  analysis,
  formData,
  onDone,
}: {
  analysis: string
  formData: WorkoutFormData
  onDone: () => void
}) {
  const sections = useMemo(() => parseAnalysisSections(sanitizePlan(analysis)), [analysis])
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)

  if (!sections.length) {
    return (
      <div className="mb-8">
        <button onClick={onDone} className="btn-primary w-full justify-center">View My Workout Plan</button>
      </div>
    )
  }

  const current = sections[idx]
  const isLast = idx === sections.length - 1
  const progress = (idx + 1) / sections.length

  function go(next: number) {
    setDir(next > idx ? 1 : -1)
    setIdx(next)
  }

  const gradient = SLIDE_GRADIENTS[current.title] ?? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))'

  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="flex gap-1.5 mb-3">
        {sections.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            className="h-1 flex-1 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
              initial={{ width: 0 }}
              animate={{ width: i < idx ? '100%' : i === idx ? '100%' : '0%' }}
              transition={{ duration: i === idx ? 0.4 : 0, ease: 'easeOut' }}
            />
          </button>
        ))}
      </div>

      <div className="rounded-3xl overflow-hidden"
        style={{ border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(255,255,255,0.03)' }}>

        {/* Slide header */}
        <div className="px-6 pt-6 pb-5" style={{ background: gradient }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">
              {idx + 1} of {sections.length}
            </span>
            <span className="text-2xl">{SECTION_ICONS[current.title] ?? '📋'}</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">{current.title}</h2>
        </div>

        {/* Space photos on first slide */}
        {idx === 0 && formData.images.length > 0 && (
          <div className="px-6 pt-5">
            <p className="text-white/35 text-[10px] uppercase tracking-wider mb-3">Your workout space</p>
            <div className={`grid gap-2 ${formData.images.length === 1 ? 'grid-cols-1 max-w-[160px]' : formData.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {formData.images.map((src, i) => (
                <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-2xl border border-white/10" />
              ))}
            </div>
          </div>
        )}

        {/* Slide content with AnimatePresence */}
        <div className="overflow-hidden" style={{ minHeight: 180 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={idx}
              custom={dir}
              initial={{ opacity: 0, x: dir * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="px-6 pt-5 pb-2"
            >
              <ReactMarkdown components={analysisComponents}>{current.content}</ReactMarkdown>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 flex items-center justify-between border-t border-white/6">
          <button
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium
                       border border-white/10 bg-white/5 text-white/50 disabled:opacity-0
                       hover:bg-white/10 hover:text-white/80 transition-all duration-200 active:scale-95"
          >
            <HiChevronLeft className="w-4 h-4" />
            Back
          </button>

          {isLast ? (
            <button onClick={onDone}
              className="btn-primary !px-6 !py-2.5 !text-sm">
              View My Plan
              <HiArrowNarrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => go(idx + 1)}
              className="btn-primary !px-6 !py-2.5 !text-sm">
              Next
              <HiChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Nutrition Targets (redesigned) ────────────────────────────────────────────

const MACRO_COLORS = {
  Calories: '#A855F7',
  Protein:  '#22D3EE',
  Carbs:    '#f59e0b',
  Fat:      '#ec4899',
}

function NutritionTargets() {
  const profile = getNutritionProfile()
  if (!profile) return null

  const t = calculateTargets(profile)
  const isWeightLoss = profile.goals.some(g => /weight.?loss/i.test(g))
  const isMuscleGain = profile.goals.some(g => /muscle/i.test(g))

  const adjustNote = isWeightLoss ? '400 kcal deficit' : isMuscleGain ? '200 kcal surplus' : 'Maintenance'

  const macros = [
    { label: 'Protein',  value: t.protein, unit: 'g', pct: (t.protein * 4) / t.kcal,  color: MACRO_COLORS.Protein,  desc: 'muscle repair' },
    { label: 'Carbs',    value: t.carbs,   unit: 'g', pct: (t.carbs * 4) / t.kcal,    color: MACRO_COLORS.Carbs,    desc: 'fuel energy' },
    { label: 'Fat',      value: t.fat,     unit: 'g', pct: (t.fat * 9) / t.kcal,      color: MACRO_COLORS.Fat,      desc: 'hormones' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="mb-6 rounded-3xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">Daily Nutrition</p>
          <p className="text-white/35 text-xs mt-0.5">{adjustNote} - track in Diet tab</p>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-xl tabular-nums">
            <AnimatedNumber value={t.kcal} />
          </p>
          <p className="text-white/35 text-[10px] uppercase tracking-wider">kcal/day</p>
        </div>
      </div>

      {/* Macro rings */}
      <div className="grid grid-cols-3 divide-x divide-white/6 py-2">
        {macros.map(({ label, value, unit, pct, color, desc }, i) => (
          <div key={label} className="flex flex-col items-center py-4 gap-2">
            <MacroRing pct={pct} color={color} size={68} stroke={6}>
              <span className="text-white font-black text-sm tabular-nums leading-none">
                <AnimatedNumber value={value} delay={0.2 + i * 0.1} />
              </span>
              <span className="text-white/40 text-[9px] leading-none">{unit}</span>
            </MacroRing>
            <div className="text-center">
              <p className="text-white/80 font-semibold text-xs">{label}</p>
              <p className="text-white/30 text-[10px]">{desc}</p>
            </div>
            {/* Bar */}
            <div className="w-12 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(pct * 100)}%` }}
                transition={{ duration: 1, delay: 0.4 + i * 0.1, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
            <span className="text-white/25 text-[10px]">{Math.round(pct * 100)}% of kcal</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Reevaluation: Progress card (redesigned) ──────────────────────────────────

function computeBmi(weight: string, height: string) {
  const w = parseFloat(weight), h = parseFloat(height) / 100
  if (!w || !h || w < 20 || h < 1) return null
  const val = w / (h * h)
  if (val < 10 || val > 60) return null
  const cat = val < 18.5 ? 'Underweight' : val < 25 ? 'Normal weight' : val < 30 ? 'Overweight' : 'Obese'
  return { value: val.toFixed(1), category: cat }
}

function DiffBadge({ prev, curr, unit = 'kg', invertColor = false }: { prev: string; curr: string; unit?: string; invertColor?: boolean }) {
  const p = parseFloat(prev), c = parseFloat(curr)
  if (isNaN(p) || isNaN(c) || !p) return null
  const diff = c - p
  if (Math.abs(diff) < 0.05) return <span className="text-white/30 text-xs">(unchanged)</span>
  const isPositive = diff > 0
  const isGood = invertColor ? !isPositive : isPositive
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isGood ? 'text-green-300 bg-green-500/15' : 'text-orange-300 bg-orange-500/15'}`}>
      {diff > 0 ? '+' : ''}{diff.toFixed(1)} {unit}
    </span>
  )
}

function ReevalSummary({ data }: { data: ReevaluationData }) {
  const [open, setOpen] = useState(true)
  const prevBmi = computeBmi(data.originalWeight, data.originalHeight)
  const currBmi = computeBmi(data.currentWeight, data.currentHeight)
  const hasOriginal = !!(data.originalWeight && data.originalHeight)

  const difficultyConfig = {
    'Too easy': { color: 'text-blue-300', bg: 'bg-blue-500/15 border-blue-500/30', icon: '😤' },
    'Too hard':  { color: 'text-red-300',  bg: 'bg-red-500/15 border-red-500/30',   icon: '😰' },
    'Just right':{ color: 'text-green-300',bg: 'bg-green-500/15 border-green-500/30',icon: '✅' },
  }[data.difficulty] ?? { color: 'text-white/60', bg: 'bg-white/8 border-white/10', icon: '💬' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 rounded-3xl overflow-hidden"
      style={{ border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.04)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))', border: '1px solid rgba(168,85,247,0.3)' }}>
            📈
          </div>
          <span className="text-white font-bold text-sm">Progress Report</span>
        </div>
        <HiChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-6 pt-1 space-y-5 border-t border-white/6">
              {/* Body stats comparison */}
              {hasOriginal ? (
                <div>
                  <p className="text-white/35 text-[10px] uppercase tracking-wider mb-3">Body Stats</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Weight', prev: `${data.originalWeight} kg`, curr: `${data.currentWeight} kg`, rawPrev: data.originalWeight, rawCurr: data.currentWeight, unit: 'kg', invertColor: true },
                      { label: 'Height', prev: `${data.originalHeight} cm`, curr: `${data.currentHeight} cm`, rawPrev: '', rawCurr: '', unit: 'cm' },
                      ...(prevBmi && currBmi ? [{ label: 'BMI', prev: prevBmi.value, curr: currBmi.value, rawPrev: prevBmi.value, rawCurr: currBmi.value, unit: '', invertColor: true }] : []),
                    ].map(({ label, prev, curr, rawPrev, rawCurr, unit, invertColor }) => (
                      <div key={label} className="rounded-2xl overflow-hidden border border-white/8">
                        <div className="px-3 py-2 border-b border-white/6" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <p className="text-white/35 text-[10px] uppercase tracking-wider">{label}</p>
                        </div>
                        <div className="px-3 py-3 flex flex-col gap-2">
                          <div>
                            <p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">Before</p>
                            <p className="text-white/55 font-semibold text-sm">{prev}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-white/25 uppercase tracking-wider mb-0.5">Now</p>
                            <p className="text-white font-bold text-sm">{curr}</p>
                          </div>
                          {rawPrev && rawCurr && (
                            <DiffBadge prev={rawPrev} curr={rawCurr} unit={unit} invertColor={invertColor} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[['⚖️', 'Weight', `${data.currentWeight} kg`], ['📏', 'Height', `${data.currentHeight} cm`]].map(([icon, label, val]) => (
                    <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <span className="text-xl">{icon}</span>
                      <div>
                        <p className="text-white/35 text-[10px] uppercase tracking-wider">{label}</p>
                        <p className="text-white font-semibold text-sm">{val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Time on plan', value: data.timeOnPlan, icon: '⏳' },
                  { label: 'Adherence', value: data.adherence, icon: '📊' },
                  { label: 'Physical feel', value: data.physicalFeel, icon: '💪' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span>{icon}</span>
                    <div>
                      <p className="text-white/35 text-[10px] uppercase tracking-wider">{label}</p>
                      <p className="text-white font-semibold text-sm">{value}</p>
                    </div>
                  </div>
                ))}
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${difficultyConfig.bg}`}>
                  <span>{difficultyConfig.icon}</span>
                  <div>
                    <p className="text-white/35 text-[10px] uppercase tracking-wider">Difficulty</p>
                    <p className={`font-semibold text-sm ${difficultyConfig.color}`}>{data.difficulty}</p>
                  </div>
                </div>
              </div>

              {/* New focus areas */}
              {data.newGoals.length > 0 && (
                <div>
                  <p className="text-white/35 text-[10px] uppercase tracking-wider mb-2.5">New focus areas</p>
                  <div className="flex flex-wrap gap-2">
                    {data.newGoals.map(g => {
                      const m = GOAL_META[g]
                      return (
                        <span key={g} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${m?.bg ?? 'bg-white/5'} ${m?.color ?? 'text-white/60'} ${m?.border ?? 'border-white/10'}`}>
                          {m?.icon} {g}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Swapped + Limitations */}
              {data.exercisesToRemove?.trim() && (
                <div className="px-4 py-3 rounded-2xl border border-orange-500/20" style={{ background: 'rgba(249,115,22,0.06)' }}>
                  <p className="text-orange-300/70 text-[10px] uppercase tracking-wider mb-1">Swapped out</p>
                  <p className="text-white/65 text-sm">{data.exercisesToRemove}</p>
                </div>
              )}
              {data.newInjuries?.trim() && (
                <div className="px-4 py-3 rounded-2xl border border-red-500/20" style={{ background: 'rgba(239,68,68,0.06)' }}>
                  <p className="text-red-300/70 text-[10px] uppercase tracking-wider mb-1">New limitations</p>
                  <p className="text-white/65 text-sm">{data.newInjuries}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Reevaluation Analysis Card (redesigned) ───────────────────────────────────

function ReevalAnalysisCard({ analysis, onViewPlan }: { analysis: string; onViewPlan: () => void }) {
  const sections = useMemo(() => parseAnalysisSections(sanitizePlan(analysis)), [analysis])
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)

  if (!sections.length) {
    return (
      <div className="mb-8">
        <button onClick={onViewPlan} className="btn-primary w-full justify-center">
          View My Evolved Plan <HiArrowNarrowRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const current = sections[idx]
  const isLast = idx === sections.length - 1

  function go(next: number) {
    setDir(next > idx ? 1 : -1)
    setIdx(next)
  }

  const gradient = SLIDE_GRADIENTS[current.title] ?? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))'

  return (
    <div className="mb-8">
      <div className="flex gap-1.5 mb-3">
        {sections.map((_, i) => (
          <button key={i} onClick={() => go(i)}
            className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
              initial={{ width: 0 }}
              animate={{ width: i <= idx ? '100%' : '0%' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </button>
        ))}
      </div>

      <div className="rounded-3xl overflow-hidden"
        style={{ border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(255,255,255,0.03)' }}>
        <div className="px-6 pt-6 pb-5" style={{ background: gradient }}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">{idx + 1} of {sections.length}</span>
            <span className="text-2xl">{SECTION_ICONS[current.title] ?? '📋'}</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">{current.title}</h2>
        </div>

        <div className="overflow-hidden" style={{ minHeight: 160 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={idx} custom={dir}
              initial={{ opacity: 0, x: dir * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="px-6 pt-5 pb-2"
            >
              <ReactMarkdown components={analysisComponents}>{current.content}</ReactMarkdown>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-6 py-5 flex items-center justify-between border-t border-white/6">
          <button onClick={() => go(idx - 1)} disabled={idx === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium
                       border border-white/10 bg-white/5 text-white/50 disabled:opacity-0
                       hover:bg-white/10 hover:text-white/80 transition-all duration-200 active:scale-95">
            <HiChevronLeft className="w-4 h-4" /> Back
          </button>
          {isLast ? (
            <button onClick={onViewPlan} className="btn-primary !px-6 !py-2.5 !text-sm">
              View My Evolved Plan <HiArrowNarrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => go(idx + 1)} className="btn-primary !px-6 !py-2.5 !text-sm">
              Next <HiChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Plan Section Header ───────────────────────────────────────────────────────

function PlanSectionHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between mb-4"
    >
      <div>
        <h2 className="text-xl font-black text-white tracking-tight">Your Workouts</h2>
        <p className="text-white/35 text-xs mt-0.5">Tap any exercise for step-by-step instructions</p>
      </div>
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))', border: '1px solid rgba(168,85,247,0.3)' }}>
        <HiLightningBolt className="w-4 h-4 text-purple-300" />
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Results() {
  const location = useLocation()

  const plan        = location.state?.plan as string | undefined
  const planId      = location.state?.planId as string | undefined
  const analysis    = location.state?.analysis as string | undefined
  const formData    = location.state?.formData as WorkoutFormData | undefined
  const reevalData  = location.state?.reevalData as ReevaluationData | undefined
  const reevalAnalysis = location.state?.reevalAnalysis as string | undefined

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [planVisible, setPlanVisible] = useState(!(analysis || reevalAnalysis))
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    planId ? getWeights(planId) : {}
  )
  const [blockedDays, setBlockedDays] = useState<string[]>(formData?.unavailableDays ?? [])
  const [dayOverrides, setDayOverrides] = useState<Record<string, string>>({})

  const planRef = useRef<HTMLDivElement>(null)

  const handleWeightChange = useCallback((exercise: string, value: string) => {
    setWeights(prev => ({ ...prev, [exercise]: value }))
    if (planId) setWeight(planId, exercise, value)
  }, [planId])

  const handleViewPlan = useCallback(() => {
    setPlanVisible(true)
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [])

  const handleUnblockDay = useCallback((day: string) => {
    const newDays = blockedDays.filter(d => d !== day)
    setBlockedDays(newDays)
    if (planId) {
      void db.transact(db.tx.workoutPlans[planId].update({ unavailableDays: JSON.stringify(newDays) }))
    }
  }, [blockedDays, planId])

  const handleGenerateDayWorkout = useCallback(async (day: string) => {
    if (!plan) return
    const workoutText = await generateDayWorkout(plan, day)
    const newOverrides = { ...dayOverrides, [day]: workoutText }
    const newBlocked = blockedDays.filter(d => d !== day)
    setDayOverrides(newOverrides)
    setBlockedDays(newBlocked)
    if (planId) {
      void db.transact(db.tx.workoutPlans[planId].update({
        dayOverrides: JSON.stringify(newOverrides),
        unavailableDays: JSON.stringify(newBlocked),
      }))
    }
  }, [plan, dayOverrides, blockedDays, planId])

  const planComponents = useMemo(
    () => buildPlanComponents(setSelectedExercise, planId, weights, handleWeightChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, handleWeightChange],
  )

  if (!plan) {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-16 pb-nav text-center animate-fade-in">
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(168,85,247,0.22)' }}>
          <div className="px-6 pt-10 pb-8" style={{ background: 'linear-gradient(160deg, rgba(168,85,247,0.12) 0%, rgba(34,211,238,0.06) 100%)' }}>
            <div className="text-4xl mb-4">🤔</div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">No plan found</h2>
            <p className="text-white/50 text-sm mb-6">Let's create your personalized workout plan.</p>
            <Link to="/questionnaire" className="btn-primary">Create a Plan</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="w-full md:max-w-2xl lg:max-w-3xl md:mx-auto px-4 pt-6 pb-nav">
      {selectedExercise && (
        <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      {/* Initial assessment flow */}
      {analysis && formData && !reevalData && (
        <>
          <AnalysisSlides analysis={analysis} formData={formData} onDone={handleViewPlan} />
          {planVisible && formData && <PlanHero formData={formData} />}
        </>
      )}

      {/* Reevaluation flow */}
      {reevalData && <ReevalSummary data={reevalData} />}
      {reevalData && reevalAnalysis && (
        <ReevalAnalysisCard analysis={reevalAnalysis} onViewPlan={handleViewPlan} />
      )}

      {/* No analysis - show hero immediately */}
      {!analysis && !reevalData && formData && <PlanHero formData={formData} />}

      {/* Workout plan */}
      {planVisible && (
        <div ref={planRef}>
          <NutritionTargets />
          <PlanSectionHeader />
          <WorkoutDayView
            plan={plan}
            planComponents={planComponents}
            blockedDays={blockedDays}
            dayWorkoutOverrides={dayOverrides}
            onUnblockDay={handleUnblockDay}
            onGenerateDayWorkout={handleGenerateDayWorkout}
          />
        </div>
      )}
    </main>
  )
}
