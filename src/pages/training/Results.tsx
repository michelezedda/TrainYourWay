import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import {
  HiChevronDown, HiArrowNarrowRight, HiChevronLeft,
} from 'react-icons/hi'
import {
  parseAnalysisSections,
  SECTION_ICONS,
} from '@/components/PlanView'
import { sanitizePlan } from '@/lib/planComponents'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { formatWeight, formatHeight, kgToLbs } from '@/lib/units'
import { useLocale } from '@/context/LocaleContext'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { markOnboardingSeen } from '@/lib/onboarding'
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

// ── Transformation timeline data ──────────────────────────────────────────────

const TIMELINE: Record<string, { t1: string; t2: string; t3: string }> = {
  'Weight Loss': { t1: 'Energy improves, routine clicks', t2: 'First visible changes, clothes fit differently', t3: 'Significant body composition shift' },
  'Muscle Gain': { t1: 'Strength baselines set, soreness fades', t2: 'Noticeable strength jump, shape emerging', t3: 'Real muscle development, visible definition' },
  'Body Recomposition': { t1: 'Body starts prioritising protein, energy levels up', t2: 'Fat shifts, muscle firms up', t3: 'Leaner and stronger at the same weight' },
  'Strength': { t1: 'CNS adapts, lifts feel smoother', t2: 'Measurable PRs, form sharpens', t3: 'Baseline strength 20-30% higher than day one' },
  'Endurance': { t1: 'Cardiovascular efficiency building fast', t2: 'Pace improves, recovery speeds up', t3: 'Stamina transformation you will feel everywhere' },
  'Athletic Performance': { t1: 'Movement patterns refined, power base builds', t2: 'Speed and agility measurably improved', t3: 'Peak performance window opening up' },
  'Flexibility': { t1: 'Joint mobility increases, tension releases', t2: 'Range of motion visibly improved', t3: 'Full movement freedom unlocked' },
  'General Fitness': { t1: 'Energy and mood lift within the first week', t2: 'Stamina improves, daily movement gets easier', t3: 'A fitter, stronger version of you' },
  'Stress Relief': { t1: 'Post-workout calm kicks in from session one', t2: 'Sleep improves, stress response softens', t3: 'Movement becomes your most reliable mood reset' },
}

// ══════════════════════════════════════════════════════════════════════════════
// IMMERSIVE REVEAL SLIDES
// ══════════════════════════════════════════════════════════════════════════════

// Slide layout wrapper - reserves space above the sticky nav
function SlideWrap({ children }: { children: React.ReactNode }) {
  return <div className="pb-52" style={{ minHeight: '72vh' }}>{children}</div>
}

// ── Sticky bottom navigation ───────────────────────────────────────────────────

function StickyNav({
  slideIdx, total, isFirst, isLast, nextLabel, doneLabel, onNext, onBack, onDone,
}: {
  slideIdx: number; total: number; isFirst: boolean; isLast: boolean
  nextLabel: string; doneLabel?: string; onNext: () => void; onBack: () => void; onDone: () => void
}) {
  return (
    <div
      className="fixed inset-x-0 md:left-56 z-40 px-4 md:px-8 bottom-28 md:bottom-6"
    >
      <div className="max-w-lg mx-auto">
        <div
          className="rounded-3xl px-4 pt-3 pb-4"
          style={{
            background: 'rgba(3,0,20,0.92)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(168,85,247,0.07)',
          }}
        >
          {/* Progress pill-dots */}
          <div className="flex justify-center gap-1 mb-3">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === slideIdx ? 20 : 5,
                  height: 5,
                  background: i === slideIdx
                    ? 'linear-gradient(90deg, #A855F7, #22D3EE)'
                    : i < slideIdx
                      ? 'rgba(168,85,247,0.42)'
                      : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst ? (
              <button
                onClick={onBack}
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
              >
                <HiChevronLeft className="w-5 h-5" />
              </button>
            ) : null}

            {isLast ? (
              <button
                onClick={onDone}
                className="flex-1 h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                  color: '#fff',
                  boxShadow: '0 4px 24px rgba(168,85,247,0.5)',
                }}
              >
                {doneLabel ?? 'View My Full Plan'}
                <HiArrowNarrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onNext}
                className="flex-1 h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
              >
                {nextLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Slide 0: Celebration ──────────────────────────────────────────────────────

function CelebrationSlide({ formData, userName }: { formData: WorkoutFormData; userName: string }) {
  const goals = formData.goals ?? []
  const primaryGoal = goals[0] ?? 'General Fitness'
  const goalMeta = GOAL_META[primaryGoal]

  return (
    <SlideWrap>
      <div className="flex flex-col items-center text-center space-y-8 pt-2">
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.06 }}
          className="w-32 h-32 rounded-3xl flex items-center justify-center mt-2"
          style={{
            fontSize: 64,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.18))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 80px rgba(168,85,247,0.38), 0 0 130px rgba(168,85,247,0.14)',
          }}
        >
          {goalMeta?.icon ?? '🏋️'}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#A855F7' }}>
            Your plan is ready
          </p>
          <h1 className="font-black text-white tracking-tight leading-[1.06] mb-4"
            style={{ fontSize: 'clamp(2.4rem, 10vw, 4.2rem)' }}>
            {userName ? (
              <>{userName},<br />you're all set.</>
            ) : (
              <>Your results<br />are in.</>
            )}
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-[260px] mx-auto">
            {formData.planName || 'Custom Program'} - built around you.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="flex flex-wrap gap-2 justify-center">
          {goals.map(g => {
            const m = GOAL_META[g]
            return (
              <span key={g}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold border ${m?.bg ?? 'bg-white/8'} ${m?.color ?? 'text-white/70'} ${m?.border ?? 'border-white/15'}`}>
                {m?.icon} {g}
              </span>
            )
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="flex gap-4 items-center">
          {[
            { label: 'Days/wk', value: String(formData.workoutDays.length) },
            { label: 'Per session', value: `${formData.sessionDuration}m` },
            { label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel },
          ].map(({ label, value }, i) => (
            <div key={label} className={`text-center ${i > 0 ? 'border-l border-white/[0.08] pl-4' : ''}`}>
              <p className="font-black text-white leading-none" style={{ fontSize: 'clamp(1.15rem, 4.5vw, 1.6rem)' }}>{value}</p>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </SlideWrap >
  )
}

// ── Slide: Profile Stats ──────────────────────────────────────────────────────

function ProfileStatsSlide({ formData }: { formData: WorkoutFormData }) {
  const profile = getNutritionProfile() as (null | { weight?: number; height?: number; goals: string[] })
  const bmi = (profile?.weight && profile?.height) ? (() => {
    const h = profile.height! / 100
    const v = profile.weight! / (h * h)
    const cat = v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy' : v < 30 ? 'Overweight' : 'High'
    return { value: +(v.toFixed(1)), cat }
  })() : null

  const levelColors: Record<string, string> = {
    beginner: '#22D3EE', intermediate: '#A855F7', advanced: '#f59e0b',
  }
  const lc = levelColors[formData.fitnessLevel] ?? '#A855F7'
  const bmiColor = bmi?.cat === 'Healthy' ? '#22D3EE' : bmi?.cat === 'Underweight' ? '#A855F7' : '#f59e0b'
  const bmiPct = bmi ? Math.min(bmi.value / 40, 1) : 0

  return (
    <SlideWrap>
      <div className="space-y-7">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#ec4899' }}>
            Your profile
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(2.8rem, 11vw, 4.5rem)' }}>
            Built for<br />your body.
          </motion.h2>
        </div>

        {bmi && (
          <motion.div initial={{ opacity: 0, scale: 0.91 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22, type: 'spring', stiffness: 200, damping: 18 }}
            className="flex items-center gap-6 rounded-3xl px-6 py-6"
            style={{ background: `linear-gradient(135deg, ${bmiColor}14, ${bmiColor}07)`, border: `1px solid ${bmiColor}2e` }}>
            <MacroRing pct={bmiPct} color={bmiColor} size={108} stroke={9}>
              <div className="text-center">
                <p className="font-black text-white" style={{ fontSize: 22 }}>{bmi.value}</p>
                <p className="text-white/40 text-[9px] uppercase tracking-wider">BMI</p>
              </div>
            </MacroRing>
            <div>
              <p className="font-black text-2xl leading-tight" style={{ color: bmiColor }}>{bmi.cat}</p>
              <p className="text-white/45 text-sm mt-1">Body Mass Index</p>
              <p className="text-white/30 text-xs mt-2 leading-relaxed max-w-[180px]">
                {bmi.cat === 'Healthy' ? 'Right in the target zone. Your plan builds on this.' : 'Your plan is calibrated to move you toward your optimal range.'}
              </p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
          className="grid grid-cols-3 gap-2">
          {[
            { label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel, color: lc },
            { label: 'Sessions', value: `${formData.workoutDays.length}x / wk`, color: '#A855F7' },
            { label: 'Per Session', value: `${formData.sessionDuration}m`, color: '#22D3EE' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl px-2.5 py-3.5 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="font-bold text-sm leading-none mb-1.5 truncate" style={{ color }}>{value}</p>
              <p className="text-white/30 text-[9px] uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="flex gap-3 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(236,72,153,0.07)', border: '1px solid rgba(236,72,153,0.2)' }}>
          <span className="text-lg flex-shrink-0">🎯</span>
          <p className="text-white/60 text-sm leading-relaxed">
            Every set, rep, and rest period in your plan is calculated for your exact fitness level and schedule.
          </p>
        </motion.div>
      </div>
    </SlideWrap>
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
    <SlideWrap>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
            style={{
              background: `linear-gradient(135deg, ${theme.accentColor}28, ${theme.accentColor}10)`,
              border: `1px solid ${theme.accentColor}38`,
            }}>
            {theme.icon}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-2" style={{ color: theme.accentColor }}>
            {theme.label}
          </p>
          <h2 className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(2rem, 8vw, 3.2rem)' }}>
            {section.title}
          </h2>
        </motion.div>

        {section.title === 'Workout Space Analysis' && formData.images.length > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}
            className={`grid gap-2 ${formData.images.length === 1 ? 'grid-cols-1 max-w-[150px]' : formData.images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {formData.images.map((src, i) => (
              <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-2xl border border-white/10" />
            ))}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-5">
            <ReactMarkdown components={enhancedAnalysisComponents}>{section.content}</ReactMarkdown>
          </div>
        </motion.div>

        {didYouKnow && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
            className="flex gap-3 px-4 py-4 rounded-2xl"
            style={{ background: `${theme.accentColor}0e`, border: `1px solid ${theme.accentColor}2e` }}>
            <span className="text-lg flex-shrink-0">💡</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: theme.accentColor }}>
                Did you know?
              </p>
              <p className="text-white/65 text-sm leading-relaxed">{didYouKnow}</p>
            </div>
          </motion.div>
        )}
      </div>
    </SlideWrap>
  )
}

// ── Training Week Slide ───────────────────────────────────────────────────────

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL_RESULTS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function parseTrainingDaysFromPlan(plan: string): Set<number> {
  const result = new Set<number>()

  // Primary: parse the "## Weekly Schedule" section which has **DayName:** activity
  const scheduleSection = plan.match(/## Weekly Schedule([\s\S]*?)(?=\n## |$)/i)?.[1] ?? ''
  if (scheduleSection) {
    DAY_FULL_RESULTS.forEach((day, i) => {
      const m = scheduleSection.match(new RegExp(`\\*\\*${day}:?\\*\\*:?\\s*([^\\n]+)`, 'i'))
      if (!m) return
      const activity = m[1].replace(/·.*$/, '').trim()
      if (!/\brest\b/i.test(activity)) result.add(i)
    })
    if (result.size > 0) return result
  }

  // Fallback: scan ### Day N: DayName lines (Day-by-Day section)
  for (const line of plan.split('\n')) {
    const trimmed = line.trimStart()
    if (!/^#{2,3}\s/.test(trimmed)) continue
    const dayIdx = DAY_FULL_RESULTS.findIndex(d => new RegExp(`\\b${d}\\b`, 'i').test(trimmed))
    if (dayIdx === -1) continue
    if (/\brest\b/i.test(trimmed)) continue
    result.add(dayIdx)
  }

  return result
}

function TrainingWeekSlide({ formData, plan }: { formData: WorkoutFormData; plan?: string }) {
  const days = formData.workoutDays.length
  const mins = parseInt(formData.sessionDuration, 10)
  const totalMins = days * mins
  const totalStr = totalMins >= 90 ? `${Math.round((totalMins / 60) * 10) / 10}h` : `${totalMins}m`
  const motivation = TRAINING_MOTIVATION[String(days)] ?? 'Your schedule is built for consistent forward progress.'

  const trainingIndices = useMemo<Set<number>>(() => {
    if (plan) {
      const parsed = parseTrainingDaysFromPlan(plan)
      if (parsed.size > 0) return parsed
    }
    // Fallback: use the user's explicitly chosen workout days
    const fallback = new Set<number>()
    for (const d of formData.workoutDays) {
      const idx = DAY_FULL_RESULTS.indexOf(d)
      if (idx >= 0) fallback.add(idx)
    }
    return fallback
  }, [plan, formData.workoutDays])

  return (
    <SlideWrap>
      <div className="space-y-7">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#22D3EE' }}>
            Training structure
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(3.5rem, 14vw, 5.5rem)' }}>
            {days}
            <span className="text-white/25 ml-2" style={{ fontSize: '0.42em', verticalAlign: 'middle' }}>
              sessions<br />per week
            </span>
          </motion.h2>
        </div>

        <div className="flex gap-2">
          {DAY_LABELS.map((label, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.18 + i * 0.07, type: 'spring', stiffness: 380, damping: 22 }}
              className="flex-1 h-14 rounded-xl flex items-center justify-center font-black text-sm"
              style={trainingIndices.has(i) ? {
                background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                color: '#fff',
                boxShadow: '0 0 22px rgba(168,85,247,0.42)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {label}
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }}
          className="grid grid-cols-2 gap-3">
          {[
            { label: 'Per session', value: `${formData.sessionDuration === '90' ? '90+' : formData.sessionDuration} min`, color: '#A855F7' },
            { label: 'Total per week', value: totalStr, color: '#22D3EE' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl px-4 py-7 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="font-black tabular-nums leading-none mb-2" style={{ color, fontSize: 'clamp(1.8rem, 7vw, 2.6rem)' }}>{value}</p>
              <p className="text-white/35 text-xs uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </motion.div>

        {formData.equipment.length > 0 && (() => {
          const customEquip = formData.equipment.filter(eq => eq !== 'Full Gym Access')
          if (!customEquip.length) return null
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.68 }}>
              <p className="text-white/30 text-[10px] uppercase tracking-wider mb-2.5">Your equipment</p>
              <div className="flex flex-wrap gap-2">
                {customEquip.slice(0, 6).map(eq => (
                  <span key={eq} className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-white/55">{eq}</span>
                ))}
                {customEquip.length > 6 && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold border border-white/10 bg-white/5 text-white/55">+{customEquip.length - 6} more</span>
                )}
              </div>
            </motion.div>
          )
        })()}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.78 }}
          className="flex gap-3 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.2)' }}>
          <span className="text-lg flex-shrink-0">⚡</span>
          <p className="text-white/65 text-sm leading-relaxed">{motivation}</p>
        </motion.div>
      </div>
    </SlideWrap>
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
    <SlideWrap>
      <div className="space-y-6">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#10b981' }}>
            Daily nutrition
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(3rem, 12vw, 5rem)' }}>
            Your fuel<br />
            <span className="text-white/22" style={{ fontSize: 'clamp(3rem, 12vw, 5rem)' }}>locked in.</span>
          </motion.h2>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22, type: 'spring', stiffness: 200, damping: 18 }}
          className="rounded-3xl px-6 py-8 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(34,211,238,0.08))', border: '1px solid rgba(16,185,129,0.3)' }}>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Daily calorie target</p>
          <p className="font-black tabular-nums leading-none"
            style={{
              fontSize: 'clamp(4rem, 16vw, 6.5rem)',
              background: 'linear-gradient(135deg, #10b981, #22D3EE)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
            <AnimatedNumber value={t.kcal} />
          </p>
          <p className="text-white/35 text-sm mt-3">kcal per day</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="space-y-5 rounded-3xl px-5 py-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {macros.map(({ label, value, color, pct }, i) => (
            <div key={label}>
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="text-white/70 text-sm font-bold">{label}</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-xl tabular-nums" style={{ color }}>
                    <AnimatedNumber value={value} delay={0.45 + i * 0.1} />
                  </span>
                  <span className="text-white/35 text-xs">g - {pct}%</span>
                </div>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div className="h-full rounded-full" style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.1, delay: 0.55 + i * 0.1, ease: 'easeOut' }} />
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.72 }}
          className="flex gap-3 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)' }}>
          <span className="text-lg flex-shrink-0">🥗</span>
          <p className="text-white/65 text-sm leading-relaxed">{insight}</p>
        </motion.div>
      </div>
    </SlideWrap>
  )
}

// ── Transformation Timeline Slide ─────────────────────────────────────────────

function TransformationSlide({ goals }: { goals: string[] }) {
  const primaryGoal = goals[0] ?? 'General Fitness'
  const tl = TIMELINE[primaryGoal] ?? { t1: 'Building momentum', t2: 'Visible progress', t3: 'Transformation complete' }

  const milestones = [
    { week: 'Week 1-2', label: 'Momentum', desc: tl.t1, color: '#22D3EE', pct: 15 },
    { week: 'Month 1', label: 'Progress', desc: tl.t2, color: '#A855F7', pct: 48 },
    { week: 'Month 3', label: 'Transformation', desc: tl.t3, color: '#f59e0b', pct: 90 },
  ]

  return (
    <SlideWrap>
      <div className="space-y-7">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#f59e0b' }}>
            What to expect
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(2.8rem, 11vw, 4.5rem)' }}>
            Your<br />roadmap.
          </motion.h2>
        </div>

        <div className="space-y-3">
          {milestones.map(({ week, label, desc, color, pct }, i) => (
            <motion.div
              key={week}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.14 }}
              className="rounded-2xl px-4 py-4"
              style={{ background: `${color}0d`, border: `1px solid ${color}24` }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{week}</p>
                </div>
                <p className="text-white font-black text-sm">{label}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div className="h-full rounded-full" style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.3, delay: 0.35 + i * 0.18, ease: 'easeOut' }} />
              </div>
              <p className="text-white/55 text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="flex gap-3 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <span className="text-lg flex-shrink-0">📈</span>
          <p className="text-white/60 text-sm leading-relaxed">
            Most people see their first real shift around week 3-4. Stay consistent - the compounding effect is real.
          </p>
        </motion.div>
      </div>
    </SlideWrap>
  )
}

// ── Final Ready Slide ─────────────────────────────────────────────────────────

function ReadySlide({ formData }: { formData: WorkoutFormData }) {
  const primaryGoal = formData.goals[0] ?? 'General Fitness'
  const tagline = GOAL_TAGLINE[primaryGoal] ?? 'Consistent effort beats perfect planning. Start now.'

  return (
    <SlideWrap>
      <div className="text-center space-y-8 pt-2">
        <motion.div
          initial={{ scale: 0.1, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.08 }}
          className="w-32 h-32 rounded-full mx-auto flex items-center justify-center"
          style={{
            fontSize: 60,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.2))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 80px rgba(168,85,247,0.42), 0 0 130px rgba(168,85,247,0.16)',
          }}
        >
          🚀
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#A855F7' }}>All set</p>
          <h2 className="font-black text-white tracking-tight leading-[1.06] mb-5"
            style={{ fontSize: 'clamp(2.8rem, 12vw, 4.8rem)' }}>
            Time to do<br />the work.
          </h2>
          <p className="text-white/50 text-base leading-relaxed max-w-[280px] mx-auto">{tagline}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
          className="grid grid-cols-2 gap-3">
          {[
            { icon: '📋', label: 'Full Workout Plan', desc: 'Your complete program', color: '#A855F7' },
            { icon: '🎯', label: 'Smart Coaching', desc: 'Tips built into every session', color: '#22D3EE' },
            { icon: '🥗', label: 'Nutrition Tracker', desc: 'Hit your macro targets', color: '#10b981' },
            { icon: '📈', label: 'Progress History', desc: 'Track every milestone', color: '#f59e0b' },
          ].map(({ icon, label, desc, color }) => (
            <div key={label}
              className="flex flex-col items-start gap-2 px-4 py-4 rounded-2xl text-left"
              style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-white font-bold text-xs">{label}</p>
                <p className="text-white/40 text-[10px] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </SlideWrap>
  )
}

// ── ImmersiveReveal (orchestrator) ────────────────────────────────────────────

function ImmersiveReveal({
  analysis,
  formData,
  plan,
  userName,
  onDone,
}: {
  analysis: string
  formData: WorkoutFormData
  plan?: string
  userName: string
  onDone: () => void
}) {
  const sections = useMemo(() => parseAnalysisSections(sanitizePlan(analysis)), [analysis])
  const hasNutrition = !!getNutritionProfile()

  // Slide index map
  const SLIDE_CELEBRATION = 0
  const SLIDE_PROFILE = 1
  const SLIDE_AI_START = 2
  const SLIDE_TRAINING = SLIDE_AI_START + sections.length
  const SLIDE_NUTRITION = hasNutrition ? SLIDE_TRAINING + 1 : -1
  const SLIDE_TRANSFORM = SLIDE_TRAINING + (hasNutrition ? 2 : 1)
  const SLIDE_READY = SLIDE_TRANSFORM + 1
  const TOTAL = SLIDE_READY + 1

  const [slideIdx, setSlideIdx] = useState(0)
  const [dir, setDir] = useState(1)

  function go(next: number) {
    setDir(next > slideIdx ? 1 : -1)
    setSlideIdx(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isFirst = slideIdx === 0
  const isLast = slideIdx === SLIDE_READY
  const isAI = slideIdx >= SLIDE_AI_START && slideIdx < SLIDE_TRAINING
  const currentSection = isAI ? sections[slideIdx - SLIDE_AI_START] : null

  const nextLabel = (() => {
    if (isFirst) return 'See My Results'
    if (slideIdx === SLIDE_PROFILE) return sections.length ? 'View Analysis' : 'Training Split'
    if (slideIdx === SLIDE_TRAINING) return hasNutrition ? 'Check Nutrition' : 'What to Expect'
    if (slideIdx === SLIDE_NUTRITION) return 'What to Expect'
    if (slideIdx === SLIDE_TRANSFORM) return 'Ready'
    return 'Next'
  })()

  return (
    <>
      <StickyNav
        slideIdx={slideIdx}
        total={TOTAL}
        isFirst={isFirst}
        isLast={isLast}
        nextLabel={nextLabel}
        onNext={() => go(slideIdx + 1)}
        onBack={() => go(slideIdx - 1)}
        onDone={onDone}
      />

      <div className="mb-8">
        {/* Top progress bar */}
        <div className="h-0.5 rounded-full overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
            animate={{ width: `${((slideIdx + 1) / TOTAL) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Counter */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-[11px] font-semibold text-white/20 uppercase tracking-wider">
            {slideIdx + 1} / {TOTAL}
          </span>
          {isAI && currentSection && (
            <span className="text-xl">{SECTION_ICONS[currentSection.title] ?? '📋'}</span>
          )}
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slideIdx}
            custom={dir}
            initial={{ opacity: 0, y: dir > 0 ? 32 : -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir > 0 ? -20 : 32 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            {slideIdx === SLIDE_CELEBRATION && (
              <CelebrationSlide formData={formData} userName={userName} />
            )}
            {slideIdx === SLIDE_PROFILE && (
              <ProfileStatsSlide formData={formData} />
            )}
            {isAI && currentSection && (
              <AnalysisSectionSlide section={currentSection} formData={formData} />
            )}
            {slideIdx === SLIDE_TRAINING && (
              <TrainingWeekSlide formData={formData} plan={plan} />
            )}
            {hasNutrition && slideIdx === SLIDE_NUTRITION && (
              <NutritionPreviewSlide goals={formData.goals} />
            )}
            {slideIdx === SLIDE_TRANSFORM && (
              <TransformationSlide goals={formData.goals} />
            )}
            {slideIdx === SLIDE_READY && (
              <ReadySlide formData={formData} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAN VIEW COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════


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
  const { unit } = useLocale()
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

// ── Reevaluation Immersive Reveal ─────────────────────────────────────────────

function ReevalCelebrationSlide({ data, userName }: { data: ReevaluationData; userName: string }) {
  const goals = data.newGoals.length > 0 ? data.newGoals : data.goals

  return (
    <SlideWrap>
      <div className="flex flex-col items-center text-center space-y-8 pt-2">
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.06 }}
          className="w-32 h-32 rounded-3xl flex items-center justify-center mt-2 relative"
          style={{
            fontSize: 64,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.18))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 80px rgba(168,85,247,0.38), 0 0 130px rgba(168,85,247,0.14)',
          }}
        >
          🔄
          <motion.div
            className="absolute inset-0 rounded-3xl"
            animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.16, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ border: '1px solid rgba(168,85,247,0.5)' }}
          />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#A855F7' }}>
            Evolution complete
          </p>
          <h1 className="font-black text-white tracking-tight leading-[1.06] mb-4"
            style={{ fontSize: 'clamp(2.4rem, 10vw, 4.2rem)' }}>
            {userName ? (
              <>{userName},<br />you've leveled up.</>
            ) : (
              <>Your plan<br />has evolved.</>
            )}
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-[260px] mx-auto">
            Phase 2 is built and ready. Let's see what changed.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="flex flex-wrap gap-2 justify-center">
          {goals.slice(0, 3).map(g => {
            const m = GOAL_META[g]
            return (
              <span key={g}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold border ${m?.bg ?? 'bg-white/8'} ${m?.color ?? 'text-white/70'} ${m?.border ?? 'border-white/15'}`}>
                {m?.icon} {g}
              </span>
            )
          })}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="flex gap-4 items-center">
          {[
            { label: 'Time on plan', value: data.timeOnPlan },
            { label: 'Adherence', value: data.adherence },
            { label: 'Progress', value: data.physicalFeel },
          ].map(({ label, value }, i) => (
            <div key={label} className={`text-center ${i > 0 ? 'border-l border-white/[0.08] pl-4' : ''}`}>
              <p className="font-black text-white leading-none truncate max-w-[80px]" style={{ fontSize: 'clamp(0.75rem, 3vw, 0.95rem)' }}>{value}</p>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </SlideWrap>
  )
}

function ReevalProgressSlide({ data }: { data: ReevaluationData }) {
  const adherencePct: Record<string, number> = {
    'Every session': 100, 'Most sessions': 80, 'About half': 50, 'Rarely': 25,
  }
  const pct = adherencePct[data.adherence] ?? 70

  const difficultyConfig: Record<string, { color: string; icon: string }> = {
    'Too easy': { color: '#22D3EE', icon: '😴' },
    'Just right': { color: '#10b981', icon: '✅' },
    'Too hard': { color: '#f87171', icon: '😤' },
  }
  const dc = difficultyConfig[data.difficulty] ?? { color: '#A855F7', icon: '💬' }

  return (
    <SlideWrap>
      <div className="space-y-6">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: '#A855F7' }}>
            Progress report
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(2.4rem, 9.5vw, 3.6rem)' }}>
            How the last<br />phase went.
          </motion.h2>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.22, type: 'spring', stiffness: 200, damping: 18 }}
          className="rounded-3xl px-6 py-6 text-center"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)' }}>
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Session consistency</p>
          <p className="font-black tabular-nums leading-none mb-2"
            style={{ fontSize: 'clamp(4rem, 16vw, 6.5rem)', background: 'linear-gradient(135deg,#A855F7,#22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {pct}%
          </p>
          <p className="text-white/55 text-base font-semibold">{data.adherence}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
          className="grid grid-cols-2 gap-3">
          {[
            { label: 'Physical feel', value: data.physicalFeel, color: '#A855F7', icon: '💪' },
            { label: 'Time on plan', value: data.timeOnPlan, color: '#22D3EE', icon: '📅' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="rounded-2xl px-4 py-5 text-center"
              style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
              <span className="text-2xl mb-2 block">{icon}</span>
              <p className="font-bold text-white text-sm leading-tight">{value}</p>
              <p className="text-white/35 text-[10px] uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="flex gap-3 px-4 py-4 rounded-2xl items-center"
          style={{ background: `${dc.color}0d`, border: `1px solid ${dc.color}22` }}>
          <span className="text-2xl flex-shrink-0">{dc.icon}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: dc.color }}>Plan difficulty</p>
            <p className="text-white font-bold text-sm">{data.difficulty}</p>
          </div>
        </motion.div>
      </div>
    </SlideWrap>
  )
}

function ReevalReadySlide() {
  return (
    <SlideWrap>
      <div className="text-center space-y-8 pt-2">
        <motion.div
          initial={{ scale: 0.1, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.08 }}
          className="w-32 h-32 rounded-full mx-auto flex items-center justify-center"
          style={{
            fontSize: 60,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.2))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 80px rgba(168,85,247,0.42), 0 0 130px rgba(168,85,247,0.16)',
          }}
        >
          🚀
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#A855F7' }}>Next phase</p>
          <h2 className="font-black text-white tracking-tight leading-[1.06] mb-5"
            style={{ fontSize: 'clamp(2.8rem, 12vw, 4.8rem)' }}>
            Next phase<br />starts now.
          </h2>
          <p className="text-white/50 text-base leading-relaxed max-w-[280px] mx-auto">
            Your evolved plan is built around who you are today. Time to put it to work.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
          className="grid grid-cols-2 gap-3">
          {[
            { icon: '📋', label: 'Evolved Plan', desc: 'Rebuilt from your feedback', color: '#A855F7' },
            { icon: '🎯', label: 'Smart Coaching', desc: 'Tips built into every session', color: '#22D3EE' },
            { icon: '📈', label: 'Progress History', desc: 'Track every milestone', color: '#f59e0b' },
            { icon: '🔄', label: 'Phase System', desc: 'Evolve again when ready', color: '#10b981' },
          ].map(({ icon, label, desc, color }) => (
            <div key={label}
              className="flex flex-col items-start gap-2 px-4 py-4 rounded-2xl text-left"
              style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-white font-bold text-xs">{label}</p>
                <p className="text-white/40 text-[10px] mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </SlideWrap>
  )
}

function ReevalImmersiveReveal({
  analysis,
  data,
  userName,
  onDone,
}: {
  analysis: string
  data: ReevaluationData
  userName: string
  onDone: () => void
}) {
  const sections = useMemo(() => parseAnalysisSections(sanitizePlan(analysis)), [analysis])

  const SLIDE_CELEBRATION = 0
  const SLIDE_PROGRESS = 1
  const SLIDE_AI_START = 2
  const SLIDE_READY = SLIDE_AI_START + sections.length
  const TOTAL = SLIDE_READY + 1

  const [slideIdx, setSlideIdx] = useState(0)
  const [dir, setDir] = useState(1)

  function go(next: number) {
    setDir(next > slideIdx ? 1 : -1)
    setSlideIdx(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isFirst = slideIdx === 0
  const isLast = slideIdx === SLIDE_READY
  const isAI = slideIdx >= SLIDE_AI_START && slideIdx < SLIDE_READY
  const currentSection = isAI ? sections[slideIdx - SLIDE_AI_START] : null

  const nextLabel = (() => {
    if (isFirst) return 'See Progress Report'
    if (slideIdx === SLIDE_PROGRESS) return sections.length ? 'View Analysis' : "What's Next"
    if (slideIdx === SLIDE_READY - 1) return "What's Next"
    return 'Next'
  })()

  return (
    <>
      <StickyNav
        slideIdx={slideIdx}
        total={TOTAL}
        isFirst={isFirst}
        isLast={isLast}
        nextLabel={nextLabel}
        doneLabel="Start Training"
        onNext={() => go(slideIdx + 1)}
        onBack={() => go(slideIdx - 1)}
        onDone={onDone}
      />

      <div className="mb-8">
        <div className="h-0.5 rounded-full overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
            animate={{ width: `${((slideIdx + 1) / TOTAL) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <div className="flex items-center justify-between mb-5">
          <span className="text-[11px] font-semibold text-white/20 uppercase tracking-wider">
            {slideIdx + 1} / {TOTAL}
          </span>
          {isAI && currentSection && (
            <span className="text-xl">{SECTION_ICONS[currentSection.title] ?? '📋'}</span>
          )}
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={slideIdx}
            custom={dir}
            initial={{ opacity: 0, y: dir > 0 ? 32 : -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir > 0 ? -20 : 32 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            {slideIdx === SLIDE_CELEBRATION && (
              <ReevalCelebrationSlide data={data} userName={userName} />
            )}
            {slideIdx === SLIDE_PROGRESS && (
              <ReevalProgressSlide data={data} />
            )}
            {isAI && currentSection && (
              <AnalysisSectionSlide
                section={currentSection}
                formData={{
                  goals: data.goals, equipment: data.equipment ?? [],
                  workoutDays: data.workoutDays ?? [], sessionDuration: '',
                  fitnessLevel: data.fitnessLevel, images: [], planName: '',
                } as unknown as import('@/lib/gemini').WorkoutFormData}
              />
            )}
            {slideIdx === SLIDE_READY && (
              <ReevalReadySlide />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN RESULTS PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()
  const userId = getUserId()

  const plan = location.state?.plan as string | undefined
  const analysis = location.state?.analysis as string | undefined
  const formData = location.state?.formData as WorkoutFormData | undefined
  const reevalData = location.state?.reevalData as ReevaluationData | undefined
  const reevalAnalysis = location.state?.reevalAnalysis as string | undefined

  const { data: profileData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })
  const userName = useMemo(() => {
    const profiles = (profileData?.userProfiles ?? []) as Array<{ name?: string }>
    return profiles[0]?.name?.split(' ')[0] ?? ''
  }, [profileData])

  const handleViewPlan = () => {
    markOnboardingSeen(userId)
    navigate('/workout', { replace: true })
  }

  const handleViewEvolvedPlan = () => {
    markOnboardingSeen(userId)
    navigate('/workout', { replace: true })
  }

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
      {/* Initial assessment - immersive reveal */}
      {analysis && formData && !reevalData && (
        <ImmersiveReveal
          analysis={analysis}
          formData={formData}
          plan={plan}
          userName={userName}
          onDone={handleViewPlan}
        />
      )}

      {/* Reevaluation flow */}
      {reevalData && reevalAnalysis && (
        <ReevalImmersiveReveal
          analysis={reevalAnalysis}
          data={reevalData}
          userName={userName}
          onDone={handleViewEvolvedPlan}
        />
      )}
      {reevalData && !reevalAnalysis && <ReevalSummary data={reevalData} />}
    </main>
  )
}
