import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import ExerciseModal from '@/components/ExerciseModal'
import {
  HiChevronDown, HiArrowNarrowRight, HiChevronRight, HiChevronLeft,
  HiLightningBolt,
} from 'react-icons/hi'
import {
  parseAnalysisSections,
  SECTION_ICONS,
  WorkoutDayView,
} from '@/components/PlanView'
import { buildPlanComponents, sanitizePlan } from '@/lib/planComponents'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { getUnit, formatWeight, formatHeight, kgToLbs } from '@/lib/units'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { generateDayWorkout } from '@/lib/gemini'
import type { Components } from 'react-markdown'
import type { WorkoutFormData, ReevaluationData } from '@/lib/gemini'

// ── Design tokens ─────────────────────────────────────────────────────────────

const GOAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Weight Loss': { color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30', icon: '🔥' },
  'Muscle Gain': { color: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30', icon: '💪' },
  'Body Recomposition': { color: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', icon: '⚡' },
  'Strength': { color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/30', icon: '🏋️' },
  'Endurance': { color: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', icon: '🏃' },
  'Athletic Performance': { color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: '🏆' },
  'Flexibility': { color: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-500/30', icon: '🧘' },
  'General Fitness': { color: 'text-green-300', bg: 'bg-green-500/15', border: 'border-green-500/30', icon: '💚' },
  'Stress Relief': { color: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-500/30', icon: '🌿' },
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
}

// Contextual theme per AI section
const SECTION_THEME: Record<string, { icon: string; label: string; accentColor: string }> = {
  'Profile Assessment': { icon: '📊', label: 'Profile breakdown', accentColor: '#A855F7' },
  'Workout Space Analysis': { icon: '🏠', label: 'Space analysis', accentColor: '#22D3EE' },
  'Space Recommendations': { icon: '💡', label: 'Pro recommendations', accentColor: '#f59e0b' },
  'Dietary Assessment': { icon: '🥗', label: 'Nutrition strategy', accentColor: '#10b981' },
  'What to Expect': { icon: '🎯', label: 'Your roadmap', accentColor: '#ec4899' },
  'Your Progress': { icon: '📈', label: 'Progress snapshot', accentColor: '#A855F7' },
  'Training Assessment': { icon: '🏋️', label: 'Training review', accentColor: '#ef4444' },
  'What Changes in This Phase': { icon: '🔄', label: 'Phase evolution', accentColor: '#22D3EE' },
}

const DID_YOU_KNOW: Record<string, string> = {
  'Profile Assessment': 'Consistency beats intensity every time. Showing up is 80% of the result.',
  'Workout Space Analysis': 'Home workouts are just as effective as gym sessions when the programming is right.',
  'Space Recommendations': 'Adding just one or two pieces of equipment unlocks dozens of exercise variations.',
  'Dietary Assessment': 'Nutrition drives up to 70% of body composition results. What you eat is not secondary.',
  'What to Expect': 'Most people see visible changes within 4-6 weeks. The first 2 weeks are about building the habit.',
}

const TRAINING_MOTIVATION: Record<string, string> = {
  '2': 'Two focused sessions a week is enough to build real progress. Quality over quantity.',
  '3': 'Three sessions per week is the science-backed sweet spot for sustainable adaptation.',
  '4': 'Four days hits the ideal balance between training stimulus and recovery. Smart call.',
  '5': 'Five sessions shows serious commitment. Recovery is built in. You have got this.',
  '6': 'Six training days. Elite dedication. Sleep and nutrition now carry equal weight.',
  '7': 'Seven days. Make sure your plan includes active recovery. Intensity varies by design.',
}

const NUTRITION_INSIGHT: Record<string, string> = {
  'Weight Loss': 'Protein keeps you full while the deficit burns fat. Hit your target every day.',
  'Muscle Gain': 'A calorie surplus fuels muscle synthesis. These targets give you the edge.',
  'Body Recomposition': 'Near-maintenance intake with high protein is the recomp formula.',
  'Strength': 'Strength requires fuel. Eat enough to train hard and recover completely.',
  'Endurance': 'Carbs are your endurance engine. Do not fear them.',
  'Athletic Performance': 'Peak performance runs on consistent, precise nutrition. Every macro counts.',
}

const GOAL_TAGLINE: Record<string, string> = {
  'Weight Loss': 'Every rep burns. Every session compounds. The results you want are built in the reps you do not skip.',
  'Muscle Gain': 'Muscle is earned one rep at a time. Train hard, sleep harder, eat consistently.',
  'Body Recomposition': 'Losing fat while building muscle takes patience and precision. Your plan delivers both.',
  'Strength': 'Every lift makes you harder to stop. This is where real strength gets built.',
  'Endurance': 'Your lungs and legs will adapt faster than you think. Keep moving.',
  'Athletic Performance': 'Great athletes are built in training sessions like these. This is where it starts.',
  'Flexibility': 'Flexibility is freedom. Every session unlocks a little more range.',
  'General Fitness': 'Consistent beats perfect. Every single time. Show up.',
  'Stress Relief': 'Movement is the best medicine. Your plan is the prescription.',
}

// ── Enhanced markdown components (richer than the shared analysisComponents) ─────

const enhancedAnalysisComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-white mt-5 mb-2 first:mt-0 flex items-center gap-2">
      <span className="w-1 h-4 rounded-full flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, #A855F7, #22D3EE)' }} />
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="leading-[1.8] mb-4" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15 }}>{children}</p>
  ),
  ul: ({ children }) => <ul className="space-y-3 mb-4">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15 }}>
      <span className="w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0" style={{ background: '#A855F7' }} />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
}

// ── Animated counter ──────────────────────────────────────────────────────────

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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ - animPct * circ} style={{ transition: 'none' }} />
      </svg>
      <div className="relative z-10 text-center">{children}</div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// IMMERSIVE REVEAL SLIDES
// ══════════════════════════════════════════════════════════════════════════════

// ── Slide 0: Celebration ──────────────────────────────────────────────────────

function CelebrationSlide({ formData, userName }: { formData: WorkoutFormData; userName: string }) {
  const goals = formData.goals ?? []
  const primaryGoal = goals[0] ?? 'General Fitness'
  const goalMeta = GOAL_META[primaryGoal]

  return (
    <div className="flex flex-col items-center text-center pt-8 pb-10 space-y-7"
      style={{ minHeight: '72vh' }}>

      {/* Icon */}
      <motion.div
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 16, delay: 0.08 }}
        className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))',
          border: '1px solid rgba(168,85,247,0.4)',
          boxShadow: '0 0 60px rgba(168,85,247,0.3)',
        }}
      >
        {goalMeta?.icon ?? '🏋️'}
      </motion.div>

      {/* Headline */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#A855F7' }}>
          Your new plan is ready
        </p>
        <h1 className="text-[2.6rem] font-black text-white tracking-tight leading-[1.1] mb-3">
          {userName
            ? <>{userName},<br />your results<br />are in.</>
            : <>Your personalized<br />results are in.</>}
        </h1>
        <p className="text-white/45 text-base leading-relaxed max-w-[260px] mx-auto">
          {formData.planName || 'Custom Program'} - built around your goals, schedule, and body.
        </p>
      </motion.div>

      {/* Goal badges */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
        className="flex flex-wrap gap-2 justify-center">
        {goals.map(g => {
          const m = GOAL_META[g]
          return (
            <span key={g}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border ${m?.bg ?? 'bg-white/8'} ${m?.color ?? 'text-white/70'} ${m?.border ?? 'border-white/15'}`}>
              {m?.icon} {g}
            </span>
          )
        })}
      </motion.div>

      {/* Stats chips */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="flex gap-5 items-center">
        {[
          { label: 'Days/wk', value: formData.daysPerWeek },
          { label: 'Per session', value: `${formData.sessionDuration}m` },
          { label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel },
        ].map(({ label, value }, i) => (
          <div key={label} className={`text-center ${i > 0 ? 'border-l border-white/10 pl-5' : ''}`}>
            <p className="text-white font-black text-2xl leading-none">{value}</p>
            <p className="text-white/35 text-[10px] uppercase tracking-wider mt-1.5">{label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ── AI Analysis Section Slide ─────────────────────────────────────────────────

function AnalysisSectionSlide({
  section, formData,
}: {
  section: { title: string; content: string }
  formData: WorkoutFormData
}) {
  const theme = SECTION_THEME[section.title] ?? { icon: '📋', label: 'Insight', accentColor: '#A855F7' }
  const didYouKnow = DID_YOU_KNOW[section.title]

  return (
    <div className="py-2 space-y-5">
      {/* Section header */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${theme.accentColor}28, ${theme.accentColor}12)`,
            border: `1px solid ${theme.accentColor}38`,
          }}>
          {theme.icon}
        </div>
        <div className="pt-0.5">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-1"
            style={{ color: theme.accentColor }}>
            {theme.label}
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
            {section.title}
          </h2>
        </div>
      </motion.div>

      {/* Workout space photos */}
      {section.title === 'Workout Space Analysis' && formData.images.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}
          className={`grid gap-2 ${formData.images.length === 1 ? 'grid-cols-1 max-w-[150px]' : formData.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {formData.images.map((src, i) => (
            <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-2xl border border-white/10" />
          ))}
        </motion.div>
      )}

      {/* Content card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-5">
          <ReactMarkdown components={enhancedAnalysisComponents}>{section.content}</ReactMarkdown>
        </div>
      </motion.div>

      {/* Did you know callout */}
      {didYouKnow && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex gap-3 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <span className="text-lg flex-shrink-0">💡</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#c084fc' }}>
              Did you know?
            </p>
            <p className="text-white/65 text-sm leading-relaxed">{didYouKnow}</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Training Week Slide ───────────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function TrainingWeekSlide({ formData }: { formData: WorkoutFormData }) {
  const days = parseInt(formData.daysPerWeek, 10)
  const mins = parseInt(formData.sessionDuration, 10)
  const totalMins = days * mins
  const totalStr = totalMins >= 90
    ? `${Math.round((totalMins / 60) * 10) / 10}h`
    : `${totalMins}m`
  const motivation = TRAINING_MOTIVATION[formData.daysPerWeek] ?? 'Your schedule is built for consistent forward progress.'

  return (
    <div className="py-4 space-y-7">
      {/* Headline */}
      <div>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#22D3EE' }}>
          Your training week
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="text-[2.8rem] font-black text-white tracking-tight leading-tight">
          {days} sessions
          <span className="text-white/30 text-2xl font-black ml-2">/ week</span>
        </motion.h2>
      </div>

      {/* Day pills */}
      <div className="flex gap-2">
        {DAY_LABELS.map((label, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.35, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.18 + i * 0.07, type: 'spring', stiffness: 380, damping: 22 }}
            className="flex-1 h-12 rounded-xl flex items-center justify-center font-black text-sm"
            style={i < days ? {
              background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
              color: '#fff',
              boxShadow: '0 0 18px rgba(168,85,247,0.35)',
            } : {
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {label}
          </motion.div>
        ))}
      </div>

      {/* Stat cards */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}
        className="grid grid-cols-2 gap-3">
        {[
          { label: 'Per session', value: `${formData.sessionDuration === '90' ? '90+' : formData.sessionDuration} min`, color: '#A855F7' },
          { label: 'Total per week', value: totalStr, color: '#22D3EE' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl px-4 py-5 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="font-black text-3xl tabular-nums leading-none mb-1.5" style={{ color }}>{value}</p>
            <p className="text-white/35 text-xs uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </motion.div>

      {/* Equipment tags */}
      {formData.equipment.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.68 }}>
          <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2.5">Your equipment</p>
          <div className="flex flex-wrap gap-2">
            {formData.equipment.slice(0, 6).map(eq => (
              <span key={eq}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-white/55">
                {eq}
              </span>
            ))}
            {formData.equipment.length > 6 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-white/55">
                +{formData.equipment.length - 6} more
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Motivation callout */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.78 }}
        className="flex gap-3 px-4 py-4 rounded-2xl"
        style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.2)' }}>
        <span className="text-lg flex-shrink-0">⚡</span>
        <p className="text-white/65 text-sm leading-relaxed">{motivation}</p>
      </motion.div>
    </div>
  )
}

// ── Nutrition Preview Slide ───────────────────────────────────────────────────

function NutritionPreviewSlide({ goals }: { goals: string[] }) {
  const profile = getNutritionProfile()
  if (!profile) return null

  const t = calculateTargets(profile)
  const primaryGoal = goals[0] ?? ''
  const insight = NUTRITION_INSIGHT[primaryGoal] ?? 'Hit your daily targets consistently and results will follow.'

  const macros = [
    { label: 'Protein', value: t.protein, color: '#22D3EE', pct: Math.round((t.protein * 4 / t.kcal) * 100) },
    { label: 'Carbs', value: t.carbs, color: '#A855F7', pct: Math.round((t.carbs * 4 / t.kcal) * 100) },
    { label: 'Fat', value: t.fat, color: '#f97316', pct: Math.round((t.fat * 9 / t.kcal) * 100) },
  ]

  return (
    <div className="py-4 space-y-6">
      {/* Headline */}
      <div>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#10b981' }}>
          Daily nutrition
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="text-[2.8rem] font-black text-white tracking-tight">
          Your fuel.
        </motion.h2>
      </div>

      {/* Calorie hero */}
      <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22 }}
        className="rounded-3xl px-6 py-7 text-center"
        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(34,211,238,0.08))', border: '1px solid rgba(16,185,129,0.3)' }}>
        <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Daily target</p>
        <p className="text-6xl font-black tabular-nums leading-none"
          style={{ background: 'linear-gradient(135deg, #10b981, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <AnimatedNumber value={t.kcal} />
        </p>
        <p className="text-white/35 text-sm mt-2">kcal per day</p>
      </motion.div>

      {/* Macro bars */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="space-y-4 rounded-3xl px-5 py-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {macros.map(({ label, value, color, pct }, i) => (
          <div key={label}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-white/70 text-sm font-semibold">{label}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-black text-lg tabular-nums" style={{ color }}>
                  <AnimatedNumber value={value} delay={0.45 + i * 0.1} />
                </span>
                <span className="text-white/35 text-xs">g &middot; {pct}%</span>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div className="h-full rounded-full" style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.1, delay: 0.55 + i * 0.1, ease: 'easeOut' }} />
            </div>
          </div>
        ))}
      </motion.div>

      {/* Insight callout */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}
        className="flex gap-3 px-4 py-4 rounded-2xl"
        style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)' }}>
        <span className="text-lg flex-shrink-0">🥗</span>
        <p className="text-white/65 text-sm leading-relaxed">{insight}</p>
      </motion.div>
    </div>
  )
}

// ── Final Ready Slide ─────────────────────────────────────────────────────────

function ReadySlide({ formData }: { formData: WorkoutFormData }) {
  const primaryGoal = formData.goals[0] ?? 'General Fitness'
  const tagline = GOAL_TAGLINE[primaryGoal] ?? 'Consistent effort beats perfect planning. Start now.'

  return (
    <div className="py-8 text-center space-y-8" style={{ minHeight: '60vh' }}>
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.08 }}
        className="w-28 h-28 rounded-full mx-auto flex items-center justify-center text-5xl"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.2))',
          border: '1px solid rgba(168,85,247,0.4)',
          boxShadow: '0 0 60px rgba(168,85,247,0.3)',
        }}
      >
        🚀
      </motion.div>

      {/* Headline */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#A855F7' }}>
          All set
        </p>
        <h2 className="text-[2.6rem] font-black text-white tracking-tight leading-[1.1] mb-4">
          Time to do<br />the work.
        </h2>
        <p className="text-white/50 text-base leading-relaxed max-w-[280px] mx-auto">
          {tagline}
        </p>
      </motion.div>

      {/* Feature grid */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
        className="grid grid-cols-2 gap-2.5">
        {[
          { icon: '📋', label: 'Full Workout Plan', color: '#A855F7' },
          { icon: '🤖', label: 'KAI AI Coach', color: '#22D3EE' },
          { icon: '🥗', label: 'Nutrition Tracker', color: '#10b981' },
          { icon: '📈', label: 'Progress History', color: '#f59e0b' },
        ].map(({ icon, label }) => (
          <div key={label}
            className="flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span className="text-xl flex-shrink-0">{icon}</span>
            <span className="text-white/65 text-xs font-semibold leading-tight">{label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ── ImmersiveReveal (orchestrator) ────────────────────────────────────────────

function ImmersiveReveal({
  analysis,
  formData,
  userName,
  onDone,
  planVisible,
}: {
  analysis: string
  formData: WorkoutFormData
  userName: string
  onDone: () => void
  planVisible: boolean
}) {
  const sections = useMemo(() => parseAnalysisSections(sanitizePlan(analysis)), [analysis])
  const hasNutrition = !!getNutritionProfile()

  const TRAINING_IDX = 1 + sections.length
  const NUTRITION_IDX = hasNutrition ? TRAINING_IDX + 1 : -1
  const READY_IDX = TRAINING_IDX + (hasNutrition ? 2 : 1)
  const TOTAL = READY_IDX + 1

  const [slideIdx, setSlideIdx] = useState(0)
  const [dir, setDir] = useState(1)

  function go(next: number) {
    setDir(next > slideIdx ? 1 : -1)
    setSlideIdx(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isFirst = slideIdx === 0
  const isLast = slideIdx === READY_IDX
  const isAISection = slideIdx >= 1 && slideIdx <= sections.length
  const currentSection = isAISection ? sections[slideIdx - 1] : null

  const nextLabel = (() => {
    if (isFirst) return 'See My Results'
    if (slideIdx === TRAINING_IDX) return hasNutrition ? 'Check Nutrition' : 'Almost Done'
    if (slideIdx === NUTRITION_IDX) return 'Almost Done'
    return 'Next'
  })()

  // After plan is revealed, show a compact summary bar
  if (planVisible) {
    const primaryGoal = formData.goals[0] ?? ''
    const goalMeta = GOAL_META[primaryGoal]
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-5 px-4 py-3.5 rounded-2xl flex items-center gap-3"
        style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)' }}
      >
        <span className="text-lg flex-shrink-0">{goalMeta?.icon ?? '🏋️'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white/75 text-sm font-semibold truncate">{formData.planName}</p>
          <p className="text-white/35 text-xs">Analysis complete. Your plan is ready below.</p>
        </div>
        <span className="text-green-400 text-xs font-bold">Done</span>
      </motion.div>
    )
  }

  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
          animate={{ width: `${((slideIdx + 1) / TOTAL) * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Slide counter + section icon */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs font-semibold text-white/25">{slideIdx + 1} of {TOTAL}</span>
        {isAISection && currentSection && (
          <span className="text-xl">{SECTION_ICONS[currentSection.title] ?? '📋'}</span>
        )}
      </div>

      {/* Slide content */}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={slideIdx}
          custom={dir}
          initial={{ opacity: 0, y: dir > 0 ? 28 : -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: dir > 0 ? -18 : 28 }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        >
          {slideIdx === 0 && (
            <CelebrationSlide formData={formData} userName={userName} />
          )}
          {isAISection && currentSection && (
            <AnalysisSectionSlide section={currentSection} formData={formData} />
          )}
          {slideIdx === TRAINING_IDX && (
            <TrainingWeekSlide formData={formData} />
          )}
          {hasNutrition && slideIdx === NUTRITION_IDX && (
            <NutritionPreviewSlide goals={formData.goals} />
          )}
          {slideIdx === READY_IDX && (
            <ReadySlide formData={formData} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-7">
        {!isFirst ? (
          <button
            onClick={() => go(slideIdx - 1)}
            className="px-5 py-3.5 rounded-2xl text-sm font-semibold border border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/70 transition-all active:scale-95 flex-shrink-0"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        {!isLast ? (
          <button
            onClick={() => go(slideIdx + 1)}
            className="flex-1 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
          >
            {nextLabel}
          </button>
        ) : (
          <button
            onClick={onDone}
            className="flex-1 py-4 rounded-2xl text-base font-black transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
          >
            View My Full Plan
          </button>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAN VIEW COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Plan Hero ─────────────────────────────────────────────────────────────────

function PlanHero({ formData }: { formData: WorkoutFormData }) {
  const goals = formData.goals ?? []
  const stats = [
    { icon: '📅', label: 'Days/week', value: formData.daysPerWeek },
    { icon: '⏱', label: 'Per session', value: `${formData.sessionDuration} min` },
    { icon: '📊', label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel },
    { icon: '🛠', label: 'Equipment', value: formData.equipment.length > 0 ? `${formData.equipment.length} items` : 'Bodyweight' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="mb-6 rounded-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(168,85,247,0.18) 0%, rgba(34,211,238,0.09) 100%)',
        border: '1px solid rgba(168,85,247,0.28)',
        boxShadow: '0 0 60px rgba(168,85,247,0.12)',
      }}
    >
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

// ── Nutrition Targets ─────────────────────────────────────────────────────────

const MACRO_COLORS = {
  Protein: '#22D3EE',
  Carbs: '#A855F7',
  Fat: '#ec4899',
}

function NutritionTargets() {
  const profile = getNutritionProfile()
  if (!profile) return null

  const t = calculateTargets(profile)
  const isWeightLoss = profile.goals.some(g => /weight.?loss/i.test(g))
  const isMuscleGain = profile.goals.some(g => /muscle/i.test(g))
  const adjustNote = isWeightLoss ? '400 kcal deficit' : isMuscleGain ? '200 kcal surplus' : 'Maintenance'

  const macros = [
    { label: 'Protein', value: t.protein, unit: 'g', pct: (t.protein * 4) / t.kcal, color: MACRO_COLORS.Protein, desc: 'muscle repair' },
    { label: 'Carbs', value: t.carbs, unit: 'g', pct: (t.carbs * 4) / t.kcal, color: MACRO_COLORS.Carbs, desc: 'fuel energy' },
    { label: 'Fat', value: t.fat, unit: 'g', pct: (t.fat * 9) / t.kcal, color: MACRO_COLORS.Fat, desc: 'hormones' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="mb-6 rounded-3xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-sm">Daily Nutrition</p>
          <p className="text-white/35 text-xs mt-0.5">{adjustNote} - track in Diet tab</p>
        </div>
        <div className="text-right">
          <p className="text-white font-black text-xl tabular-nums"><AnimatedNumber value={t.kcal} /></p>
          <p className="text-white/35 text-[10px] uppercase tracking-wider">kcal/day</p>
        </div>
      </div>
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
            <div className="w-12 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div className="h-full rounded-full" style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(pct * 100)}%` }}
                transition={{ duration: 1, delay: 0.4 + i * 0.1, ease: [0.4, 0, 0.2, 1] }} />
            </div>
            <span className="text-white/25 text-[10px]">{Math.round(pct * 100)}% of kcal</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// REEVALUATION COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

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
  const unit = getUnit()
  const prevBmi = computeBmi(data.originalWeight, data.originalHeight)
  const currBmi = computeBmi(data.currentWeight, data.currentHeight)
  const hasOriginal = !!(data.originalWeight && data.originalHeight)

  const wLabel = unit === 'imperial' ? 'lbs' : 'kg'
  const displayWeight = (kgStr: string) => formatWeight(parseFloat(kgStr), unit)
  const displayHeight = (cmStr: string) => formatHeight(parseFloat(cmStr), unit)
  const rawWeight = (kgStr: string) => unit === 'imperial' ? kgToLbs(parseFloat(kgStr)).toFixed(1) : kgStr

  const difficultyConfig = {
    'Too easy': { color: 'text-blue-300', bg: 'bg-blue-500/15 border-blue-500/30', icon: '😤' },
    'Too hard': { color: 'text-red-300', bg: 'bg-red-500/15 border-red-500/30', icon: '😰' },
    'Just right': { color: 'text-green-300', bg: 'bg-green-500/15 border-green-500/30', icon: '✅' },
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
              {hasOriginal ? (
                <div>
                  <p className="text-white/35 text-[10px] uppercase tracking-wider mb-3">Body Stats</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Weight', prev: displayWeight(data.originalWeight), curr: displayWeight(data.currentWeight), rawPrev: rawWeight(data.originalWeight), rawCurr: rawWeight(data.currentWeight), unit: wLabel, invertColor: true },
                      { label: 'Height', prev: displayHeight(data.originalHeight), curr: displayHeight(data.currentHeight), rawPrev: '', rawCurr: '', unit: '' },
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
                  {[['⚖️', 'Weight', displayWeight(data.currentWeight)], ['📏', 'Height', displayHeight(data.currentHeight)]].map(([icon, label, val]) => (
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

// ── Reevaluation Analysis Card ────────────────────────────────────────────────

const REEVAL_SLIDE_GRADIENTS: Record<string, string> = {
  'Your Progress': 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(99,102,241,0.18))',
  'Training Assessment': 'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(249,115,22,0.15))',
  'What Changes in This Phase': 'linear-gradient(135deg, rgba(34,211,238,0.22), rgba(99,102,241,0.18))',
}

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
  const theme = SECTION_THEME[current.title]
  const gradient = REEVAL_SLIDE_GRADIENTS[current.title] ?? 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(34,211,238,0.14))'

  function go(next: number) {
    setDir(next > idx ? 1 : -1)
    setIdx(next)
  }

  return (
    <div className="mb-8">
      {/* Progress */}
      <div className="flex gap-1.5 mb-4">
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

        {/* Header */}
        <div className="px-6 pt-6 pb-5" style={{ background: gradient }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {theme?.icon ?? SECTION_ICONS[current.title] ?? '📋'}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                  {idx + 1} of {sections.length}
                </p>
                <p className="text-[11px] font-semibold text-white/70">{theme?.label ?? 'Analysis'}</p>
              </div>
            </div>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">{current.title}</h2>
        </div>

        {/* Content */}
        <div className="overflow-hidden" style={{ minHeight: 160 }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={idx} custom={dir}
              initial={{ opacity: 0, x: dir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="px-6 pt-5 pb-2"
            >
              <ReactMarkdown components={enhancedAnalysisComponents}>{current.content}</ReactMarkdown>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer nav */}
        <div className="px-6 py-5 flex items-center justify-between border-t border-white/6">
          <button onClick={() => go(idx - 1)} disabled={idx === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/5 text-white/50 disabled:opacity-0 hover:bg-white/10 hover:text-white/80 transition-all active:scale-95">
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
      className="flex items-center justify-between mb-5"
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN RESULTS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function Results() {
  const location = useLocation()
  const userId = getUserId()

  const plan = location.state?.plan as string | undefined
  const planId = location.state?.planId as string | undefined
  const analysis = location.state?.analysis as string | undefined
  const formData = location.state?.formData as WorkoutFormData | undefined
  const reevalData = location.state?.reevalData as ReevaluationData | undefined
  const reevalAnalysis = location.state?.reevalAnalysis as string | undefined

  // Fetch user name for personalization
  const { data: profileData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })
  const userName = useMemo(() => {
    const profiles = (profileData?.userProfiles ?? []) as Array<{ name?: string }>
    return profiles[0]?.name?.split(' ')[0] ?? ''
  }, [profileData])

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
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
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
          <div className="px-6 pt-10 pb-8"
            style={{ background: 'linear-gradient(160deg, rgba(168,85,247,0.12) 0%, rgba(34,211,238,0.06) 100%)' }}>
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

      {/* Initial assessment - immersive reveal */}
      {analysis && formData && !reevalData && (
        <>
          <ImmersiveReveal
            analysis={analysis}
            formData={formData}
            userName={userName}
            onDone={handleViewPlan}
            planVisible={planVisible}
          />
          {planVisible && <PlanHero formData={formData} />}
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
