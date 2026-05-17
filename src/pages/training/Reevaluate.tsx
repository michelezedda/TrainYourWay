import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { type ReevaluationData } from '@/lib/gemini'
import { getUnit, saveUnit, lbsToKg, kgToLbs, cmToFtIn, ftInToCm, type Unit } from '@/lib/units'
import { HiArrowNarrowLeft, HiArrowNarrowRight } from 'react-icons/hi'
import { parseJsonList } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────────────────

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const NEW_GOAL_OPTIONS = [
  { label: 'Weight Loss',          icon: '🔥' },
  { label: 'Muscle Gain',          icon: '💪' },
  { label: 'Strength',             icon: '🏋️' },
  { label: 'Endurance',            icon: '🏃' },
  { label: 'Body Recomposition',   icon: '⚖️' },
  { label: 'Flexibility',          icon: '🧘' },
  { label: 'Athletic Performance', icon: '🏆' },
  { label: 'General Fitness',      icon: '⚡' },
  { label: 'Stress Relief',        icon: '🌿' },
]

const GOAL_ICON_MAP: Record<string, string> = {
  'Weight Loss': '🔥', 'Muscle Gain': '💪', 'Strength': '🏋️',
  'Endurance': '🏃', 'Body Recomposition': '⚖️', 'Flexibility': '🧘',
  'Athletic Performance': '🏆', 'General Fitness': '⚡', 'Stress Relief': '🌿',
}

const LEVEL_COLOR: Record<string, string> = {
  beginner: '#4ade80', intermediate: '#facc15', advanced: '#f87171',
}

// Steps 2,3,4,5,7,8,9,10,11 are question steps with a progress bar.
// Steps 0,1,6,12 are cinematic/transition slides.
const QUESTION_STEPS = [2, 3, 4, 5, 7, 8, 9, 10, 11]
const SECTION_LABELS: Record<number, string> = {
  2: 'Time Check',
  3: 'Consistency',
  4: 'Physical Report',
  5: 'Difficulty',
  7: 'Body Update',
  8: 'Schedule',
  9: 'Adjustments',
  10: 'Limitations',
  11: 'Goals',
}

// ── Animations ─────────────────────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -18 : 18, scale: 0.98 }),
}
const stepTransition = { duration: 0.24, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }

// ── Helpers ────────────────────────────────────────────────────────────────────


function parseStatsFromPlan(plan: string): { weight: string; height: string } {
  const m = plan.match(/\*\*Body Metrics:\*\*\s*Weight\s+([\d.]+)\s*kg\s*\|\s*Height\s+([\d.]+)\s*cm/)
  return m ? { weight: m[1], height: m[2] } : { weight: '', height: '' }
}

interface InsightData { icon: string; tag: string; headline: string; sub: string; stat: string; statLabel: string; color: string }

function buildInsight(adherence: string, difficulty: string, physicalFeel: string): InsightData {
  const adherencePct: Record<string, number> = {
    'Every session': 100, 'Most sessions': 80, 'About half': 50, 'Rarely': 25,
  }
  const pct = adherencePct[adherence] ?? 70

  if (difficulty === 'Too easy' && (adherence === 'Every session' || adherence === 'Most sessions')) {
    return { icon: '🚀', tag: 'Level Up Signal', headline: "You've outgrown this plan.", sub: "Perfect consistency and barely breaking a sweat - that's a clear upgrade signal. Your next plan will demand more.", stat: `${pct}%`, statLabel: 'Consistency rate', color: '#22D3EE' }
  }
  if (physicalFeel === 'Much stronger' && difficulty !== 'Too hard') {
    return { icon: '💪', tag: 'Growth Confirmed', headline: "Real, measurable progress.", sub: "You're physically stronger than when you started. Your plan needs to match who you've become - not who you were.", stat: `${pct}%`, statLabel: 'Sessions hit', color: '#A855F7' }
  }
  if (adherence === 'Every session' && difficulty === 'Just right') {
    return { icon: '🔥', tag: 'Elite Consistency', headline: "You didn't miss a single session.", sub: "That's the rarest form of discipline. Your evolved plan will honour that commitment and push you to the next tier.", stat: '100%', statLabel: 'Attendance rate', color: '#f97316' }
  }
  if (difficulty === 'Too hard' || physicalFeel === 'More fatigued') {
    return { icon: '🔄', tag: 'Recovery First', headline: "Pushing through has limits.", sub: "Sustainable progress beats intense burnout every time. We're dialling back the intensity so you can build properly.", stat: `${pct}%`, statLabel: 'Sessions completed', color: '#10b981' }
  }
  if (adherence === 'About half' || adherence === 'Rarely') {
    return { icon: '⚡', tag: 'Adapting Your Plan', headline: "Real life happens. Let's adapt.", sub: "Your evolved plan will match your actual schedule - not an ideal one. Realistic training beats abandoned perfect plans.", stat: `${pct}%`, statLabel: 'Training rate', color: '#f59e0b' }
  }
  if (physicalFeel === 'Slightly improved') {
    return { icon: '📈', tag: 'Upward Trend', headline: "Progress is progress.", sub: "Every improvement - however small - compounds. Your new plan builds on exactly what's been working.", stat: `${pct}%`, statLabel: 'Consistency rate', color: '#A855F7' }
  }
  return { icon: '✨', tag: 'Foundation Built', headline: "Solid base. Time to build higher.", sub: "You've put in the sessions. Your evolved plan takes everything learned and raises the ceiling.", stat: `${pct}%`, statLabel: 'Sessions completed', color: '#A855F7' }
}

// ── Recovery hint ──────────────────────────────────────────────────────────────
function getLongestConsecutiveStreak(selectedDays: string[]): number {
  if (selectedDays.length < 2) return selectedDays.length
  const idx = new Set(selectedDays.map(d => DAY_FULL.indexOf(d)).filter(i => i >= 0))
  let max = 0
  for (const start of idx) {
    let len = 0
    while (len < 7 && idx.has((start + len) % 7)) len++
    max = Math.max(max, len)
  }
  return max
}

function RecoveryHint({ streak, fitnessLevel }: { streak: number; fitnessLevel?: string }) {
  if (streak < 3) return null
  let message: string
  if (streak >= 6) {
    message = fitnessLevel === 'advanced'
      ? "At this volume, sleep and nutrition carry as much weight as the sessions themselves. Make it count."
      : "A schedule this dense works best with intentional recovery. Even a short walk on rest days beats no rest."
  } else if (streak >= 4) {
    message = fitnessLevel === 'beginner'
      ? "Four consecutive days is a real commitment. Rest days are where growth actually happens."
      : "Training this many days in a row is demanding. One rest day mid-week can lift performance across all sessions."
  } else {
    message = fitnessLevel === 'beginner'
      ? "As you're building your routine, a rest day between sessions helps your body adapt without overloading."
      : "A recovery day between sessions is where muscles repair and grow. You'll train harder for it."
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
      className="flex gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)' }}
    >
      <span className="text-base flex-shrink-0 mt-0.5">💡</span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(168,85,247,0.7)' }}>
          Coach tip
        </p>
        <p className="text-xs text-white/55 leading-relaxed">{message}</p>
      </div>
    </motion.div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepHeader({ tag, title, sub }: { tag?: string; title: string; sub?: string }) {
  return (
    <div className="mb-2">
      {tag && (
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#A855F7' }}
        >
          {tag}
        </motion.p>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="font-black text-white tracking-tight leading-tight"
        style={{ fontSize: 'clamp(2.4rem, 9.5vw, 3.6rem)' }}
      >
        {title}
      </motion.h2>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          className="text-white/45 text-sm mt-2.5 leading-relaxed"
        >
          {sub}
        </motion.p>
      )}
    </div>
  )
}

function SelectCard({
  icon, label, sublabel, selected, onClick, delay = 0,
}: { icon: string; label: string; sublabel?: string; selected: boolean; onClick: () => void; delay?: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onClick={onClick}
      className="flex items-center gap-4 w-full py-5 px-5 rounded-2xl border transition-all duration-200 active:scale-[0.97] text-left"
      style={selected ? {
        background: 'rgba(168,85,247,0.13)',
        borderColor: 'rgba(168,85,247,0.5)',
        boxShadow: '0 0 24px rgba(168,85,247,0.18)',
      } : {
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.09)',
      }}
    >
      <span className="text-3xl leading-none flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-base leading-tight ${selected ? 'text-white' : 'text-white/75'}`}>{label}</p>
        {sublabel && <p className="text-sm text-white/35 mt-0.5 leading-snug">{sublabel}</p>}
      </div>
      <div
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200"
        style={selected ? { background: 'linear-gradient(135deg,#A855F7,#22D3EE)', boxShadow: '0 0 10px rgba(168,85,247,0.4)' } : { border: '1.5px solid rgba(255,255,255,0.2)' }}
      >
        {selected && <span className="text-white text-[10px] font-black leading-none">✓</span>}
      </div>
    </motion.button>
  )
}

// Animated number count-up
function CountUp({ to, duration = 1.4 }: { to: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(ease * to))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [to, duration])
  return <>{val}</>
}

// ── Form types ─────────────────────────────────────────────────────────────────

interface RevalForm {
  unit: Unit
  timeOnPlan: string
  adherence: string
  currentWeight: string
  currentHeight: string
  currentHeightIn: string
  physicalFeel: string
  difficulty: string
  workoutDays: string[]
  exercisesToRemove: string
  newInjuries: string
  newGoals: string[]
}

const INITIAL: RevalForm = {
  unit: 'metric', timeOnPlan: '', adherence: '', currentWeight: '',
  currentHeight: '', currentHeightIn: '', physicalFeel: '', difficulty: '',
  workoutDays: [], exercisesToRemove: '', newInjuries: '', newGoals: [],
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReevaluateQuestionnaire() {
  const navigate  = useNavigate()
  const location  = useLocation()

  const original = location.state as {
    planId: string; originalPlan: string; userName: string
    fitnessLevel: string; goals: string; equipment: string
  } | null

  const [step, setStep] = useState(0)
  const [dir,  setDir]  = useState(1)
  const [form, setForm] = useState<RevalForm>(() => ({ ...INITIAL, unit: getUnit() }))

  if (!original) { navigate('/workout', { replace: true }); return null }

  const goals     = parseJsonList(original.goals)
  const equipment = parseJsonList(original.equipment)
  const firstName = original.userName.split(' ')[0]

  const goToStep = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  // Auto-advance on transition slides (no Skip/Back — purely cinematic)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (step === 1) { const t = setTimeout(() => goToStep(2), 3600); return () => clearTimeout(t) }
    if (step === 6) { const t = setTimeout(() => goToStep(7), 3200); return () => clearTimeout(t) }
  }, [step])

  const update = (patch: Partial<RevalForm>) => setForm(p => ({ ...p, ...patch }))

  const pick = (key: keyof RevalForm, value: string) =>
    setForm(p => ({ ...p, [key]: (p[key] as string) === value ? '' : value }))

  const switchUnit = (next: Unit) => {
    if (next === form.unit) return
    let weight = '', height = '', heightIn = ''
    const w = parseFloat(form.currentWeight), h = parseFloat(form.currentHeight)
    if (next === 'imperial') {
      if (!isNaN(w)) weight = kgToLbs(w).toFixed(1)
      if (!isNaN(h)) { const { ft, inches } = cmToFtIn(h); height = String(ft); heightIn = String(inches) }
    } else {
      if (!isNaN(w)) weight = lbsToKg(w).toFixed(1)
      const ft = parseFloat(form.currentHeight), inches = parseFloat(form.currentHeightIn || '0')
      if (!isNaN(ft)) height = ftInToCm(ft, isNaN(inches) ? 0 : inches).toFixed(0)
    }
    saveUnit(next)
    setForm(p => ({ ...p, unit: next, currentWeight: weight, currentHeight: height, currentHeightIn: heightIn }))
  }

  const toggleGoal = (goal: string) =>
    setForm(p => ({ ...p, newGoals: p.newGoals.includes(goal) ? p.newGoals.filter(g => g !== goal) : [...p.newGoals, goal] }))

  const toggleDay = (day: string) =>
    setForm(p => ({ ...p, workoutDays: p.workoutDays.includes(day) ? p.workoutDays.filter(d => d !== day) : [...p.workoutDays, day] }))

  // ── Validation ───────────────────────────────────────────────────────────────

  const wNum = parseFloat(form.currentWeight)
  const weightInvalid = form.currentWeight.trim() !== '' && (
    isNaN(wNum) || (form.unit === 'metric' ? wNum < 30 || wNum > 300 : wNum < 66 || wNum > 661)
  )
  const ftNum = parseInt(form.currentHeight, 10)
  const inNum = parseInt(form.currentHeightIn || '0', 10)
  const hNum  = parseFloat(form.currentHeight)
  const heightInvalid = form.currentHeight.trim() !== '' && (
    form.unit === 'metric'
      ? isNaN(hNum) || hNum < 100 || hNum > 250
      : isNaN(ftNum) || ftNum < 3 || ftNum > 8 || isNaN(inNum) || inNum < 0 || inNum > 11
  )
  const weightKg = form.unit === 'metric' ? parseFloat(form.currentWeight) : lbsToKg(parseFloat(form.currentWeight))
  const heightCm = form.unit === 'metric'
    ? parseFloat(form.currentHeight)
    : ftInToCm(parseFloat(form.currentHeight) || 0, parseFloat(form.currentHeightIn) || 0)

  const canAdvance = (): boolean => {
    if (step === 2) return !!form.timeOnPlan
    if (step === 3) return !!form.adherence
    if (step === 4) return !!form.physicalFeel
    if (step === 5) return !!form.difficulty
    if (step === 7) return !!(form.currentWeight.trim() && !weightInvalid && form.currentHeight.trim() && !heightInvalid)
    return true
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  const handleBack = () => {
    if (step === 0) navigate('/workout')
    else if (step === 2) goToStep(0)   // skip cinematic step 1
    else if (step === 7) goToStep(5)   // skip cinematic step 6
    else goToStep(step - 1)
  }

  const handleNext = () => {
    if (step < 12) goToStep(step + 1)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    const stats = parseStatsFromPlan(original.originalPlan)
    const reevaluation: ReevaluationData = {
      originalPlanId: original.planId,
      originalPlan:   original.originalPlan,
      userName:       original.userName,
      fitnessLevel:   original.fitnessLevel,
      goals:          goals,
      equipment:      equipment,
      timeOnPlan:     form.timeOnPlan,
      adherence:      form.adherence,
      originalWeight: stats.weight,
      originalHeight: stats.height,
      currentWeight:  isNaN(weightKg) ? '' : weightKg.toFixed(1),
      currentHeight:  isNaN(heightCm) ? '' : heightCm.toFixed(0),
      physicalFeel:   form.physicalFeel,
      difficulty:     form.difficulty,
      workoutDays:    [...form.workoutDays].sort((a, b) => DAY_FULL.indexOf(a) - DAY_FULL.indexOf(b)),
      exercisesToRemove: form.exercisesToRemove,
      newInjuries:    form.newInjuries,
      newGoals:       form.newGoals,
      unit:           form.unit,
    }
    navigate('/generating', { state: { reevaluation } })
  }

  // ── Derived UI state ─────────────────────────────────────────────────────────

  const qIdx            = QUESTION_STEPS.indexOf(step)
  const showProgressBar = qIdx !== -1
  const progressPct     = showProgressBar ? ((qIdx + 1) / QUESTION_STEPS.length) * 100 : 0
  const insight         = buildInsight(form.adherence, form.difficulty, form.physicalFeel)
  const levelColor      = LEVEL_COLOR[original.fitnessLevel] ?? '#c084fc'

  // ── Summary chips for launch slide ──────────────────────────────────────────

  const summaryItems = [
    form.timeOnPlan && { icon: '📅', label: form.timeOnPlan },
    form.adherence  && { icon: '🎯', label: form.adherence },
    form.physicalFeel && { icon: '💪', label: form.physicalFeel },
    form.difficulty && { icon: form.difficulty === 'Too easy' ? '😴' : form.difficulty === 'Just right' ? '✅' : '😤', label: form.difficulty },
    form.workoutDays.length > 0 && { icon: '📆', label: `${form.workoutDays.length} training days` },
    form.newGoals.length > 0 && { icon: '🔄', label: 'Goal shift added' },
  ].filter(Boolean) as Array<{ icon: string; label: string }>

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">

      {/* Progress bar (question steps only) */}
      {showProgressBar && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-7">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{SECTION_LABELS[step]}</p>
            <p className="text-xs text-white/25">{Math.round(progressPct)}%</p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ background: 'linear-gradient(90deg,#A855F7,#22D3EE)' }}
            />
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
        >

          {/* ── Step 0: Cinematic welcome back ─────────────────────────────── */}
          {step === 0 && (
            <div className="min-h-[calc(100svh-6rem)] flex flex-col items-center justify-center text-center py-10 space-y-8">

              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                className="relative w-28 h-28 rounded-3xl flex items-center justify-center text-5xl"
                style={{
                  background: 'linear-gradient(135deg,rgba(168,85,247,0.25),rgba(34,211,238,0.15))',
                  border: '1px solid rgba(168,85,247,0.38)',
                  boxShadow: '0 0 48px rgba(168,85,247,0.25), 0 0 96px rgba(168,85,247,0.1)',
                }}
              >
                🔄
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.18, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ border: '1px solid rgba(168,85,247,0.5)' }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap justify-center gap-2"
              >
                {goals.slice(0, 3).map((g, i) => (
                  <motion.span
                    key={g}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.26 + i * 0.07 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
                  >
                    {GOAL_ICON_MAP[g] ?? '⚡'} {g}
                  </motion.span>
                ))}
              </motion.div>

              <div className="space-y-3 max-w-xs">
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  className="text-xs font-bold uppercase tracking-widest" style={{ color: '#A855F7' }}
                >
                  Evolution begins
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                  className="font-black text-white tracking-tight leading-tight"
                  style={{ fontSize: 'clamp(2.4rem, 9.5vw, 3.6rem)' }}
                >
                  Ready for Phase 2,{' '}
                  <span style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {firstName}?
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
                  className="text-white/45 text-base leading-relaxed"
                >
                  Your plan has run its course. Time to evolve it around the person you are today, not who you were when you started.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
                className="flex flex-col items-center gap-3 w-full max-w-xs"
              >
                <button onClick={() => goToStep(1)} className="btn-primary w-full !justify-center py-4 text-base">
                  Begin Evolution
                  <HiArrowNarrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate('/workout')}
                  className="text-white/25 text-sm hover:text-white/50 transition-colors"
                >
                  Back to plan
                </button>
              </motion.div>
            </div>
          )}

          {/* ── Step 1: Journey story (auto-advance, no controls) ──────────── */}
          {step === 1 && (
            <div className="min-h-[calc(100svh-6rem)] flex flex-col justify-center py-8 space-y-6">

              <div className="text-center space-y-2">
                <motion.p
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                  className="text-xs font-bold uppercase tracking-widest" style={{ color: '#22D3EE' }}
                >
                  Your last plan
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
                  className="font-black text-white tracking-tight leading-tight"
                  style={{ fontSize: 'clamp(2.2rem, 8.5vw, 3.2rem)' }}
                >
                  Here's what you built with.
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}
                  className="text-white/40 text-sm"
                >
                  Now let's see where you are today.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                className="rounded-3xl p-5"
                style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.16)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(168,85,247,0.6)' }}>
                  Training goals
                </p>
                <div className="flex flex-wrap gap-2">
                  {goals.map((g, i) => (
                    <motion.span
                      key={g}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.34 + i * 0.07 }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold"
                      style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c084fc' }}
                    >
                      {GOAL_ICON_MAP[g] ?? '⚡'} {g}
                    </motion.span>
                  ))}
                </div>
              </motion.div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: original.fitnessLevel, label: 'Level', color: levelColor },
                  { value: String(equipment.length), label: 'Equipment', color: '#22D3EE' },
                  { value: String(goals.length), label: 'Goals', color: '#c084fc' },
                ].map(({ value, label, color }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.46 + i * 0.07 }}
                    className="rounded-2xl p-3.5 text-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <p className="text-xl font-black capitalize" style={{ color }}>{value}</p>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{label}</p>
                  </motion.div>
                ))}
              </div>

              {equipment.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                  className="flex flex-wrap gap-2"
                >
                  {equipment.slice(0, 6).map(e => (
                    <span
                      key={e}
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.15)', color: 'rgba(34,211,238,0.75)' }}
                    >
                      {e}
                    </span>
                  ))}
                  {equipment.length > 6 && (
                    <span className="px-2.5 py-1 rounded-full text-xs text-white/30">+{equipment.length - 6} more</span>
                  )}
                </motion.div>
              )}

              {/* Auto-advance bar only - no skip/back controls */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="flex flex-col items-center pt-2"
              >
                <div className="w-52 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.3, delay: 0.75, ease: 'linear' }}
                    style={{ background: 'linear-gradient(90deg,#A855F7,#22D3EE)' }}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* ── Question steps inside GlassCard ──────────────────────────── */}
          {QUESTION_STEPS.includes(step) && (
            <div
              className="rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.11)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.13)',
              }}
            >
              <div className="p-6 sm:p-8">

                {/* ── Step 2: Time on plan ──────────────────────────────── */}
                {step === 2 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Progress Check"
                      title="Time on this plan?"
                      sub="How long have you been following this program?"
                    />
                    <div className="space-y-3">
                      {[
                        { v: '1 Month',   icon: '📅', sub: 'One full cycle done' },
                        { v: '2 Months',  icon: '📆', sub: 'Solid foundation built' },
                        { v: '3 Months',  icon: '🏆', sub: 'Full quarter completed' },
                        { v: '4+ Months', icon: '🌟', sub: 'Long-term commitment' },
                      ].map(({ v, icon, sub }, i) => (
                        <SelectCard
                          key={v} icon={icon} label={v} sublabel={sub}
                          selected={form.timeOnPlan === v} onClick={() => pick('timeOnPlan', v)}
                          delay={0.2 + i * 0.06}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step 3: Session consistency ───────────────────────── */}
                {step === 3 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Consistency"
                      title="How often did you train?"
                      sub="Be honest - this shapes how we evolve the plan."
                    />
                    <div className="space-y-3">
                      {[
                        { v: 'Every session', icon: '🔥', sub: 'Never missed a single one' },
                        { v: 'Most sessions', icon: '✅', sub: 'Hit roughly 3 out of 4' },
                        { v: 'About half',    icon: '⚡', sub: 'Life got in the way sometimes' },
                        { v: 'Rarely',        icon: '🔄', sub: 'Struggled to show up regularly' },
                      ].map(({ v, icon, sub }, i) => (
                        <SelectCard
                          key={v} icon={icon} label={v} sublabel={sub}
                          selected={form.adherence === v} onClick={() => pick('adherence', v)}
                          delay={0.2 + i * 0.06}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step 4: Physical progress ─────────────────────────── */}
                {step === 4 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Physical Report"
                      title="How did your body respond?"
                      sub="Your honest assessment shapes the difficulty of your next plan."
                    />
                    <div className="space-y-3">
                      {[
                        { v: 'Much stronger',    icon: '💪', sub: 'Significantly more powerful and capable' },
                        { v: 'Slightly improved',icon: '📈', sub: 'Noticeable but modest improvement' },
                        { v: 'About the same',   icon: '🤷', sub: 'Maintaining, not much change' },
                        { v: 'More fatigued',    icon: '😴', sub: 'Running low on energy and drive' },
                      ].map(({ v, icon, sub }, i) => (
                        <SelectCard
                          key={v} icon={icon} label={v} sublabel={sub}
                          selected={form.physicalFeel === v} onClick={() => pick('physicalFeel', v)}
                          delay={0.2 + i * 0.06}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step 5: Difficulty ────────────────────────────────── */}
                {step === 5 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Difficulty"
                      title="How hard was the plan?"
                      sub="Overall intensity across all your sessions."
                    />
                    <div className="space-y-3">
                      {[
                        { v: 'Too easy',   icon: '😴', label: 'Too Easy',  sub: 'Need a harder challenge' },
                        { v: 'Just right', icon: '✅', label: 'Just Right', sub: 'Hit the perfect sweet spot' },
                        { v: 'Too hard',   icon: '😤', label: 'Too Hard',   sub: 'Regularly overwhelmed' },
                      ].map(({ v, icon, label, sub }, i) => (
                        <SelectCard
                          key={v} icon={icon} label={label} sublabel={sub}
                          selected={form.difficulty === v} onClick={() => pick('difficulty', v)}
                          delay={0.2 + i * 0.07}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Step 7: Body update ───────────────────────────────── */}
                {step === 7 && (
                  <div className="space-y-7">
                    <div className="flex items-start justify-between gap-4">
                      <StepHeader
                        tag="Body Update"
                        title="Where are you now?"
                        sub="Updated stats help fine-tune load, volume, and intensity."
                      />
                      <div className="flex rounded-xl overflow-hidden border border-white/10 flex-shrink-0 mt-1">
                        {(['metric', 'imperial'] as const).map((u, i) => (
                          <button
                            key={u} onClick={() => switchUnit(u)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${form.unit === u ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/40 hover:text-white/70'} ${i === 0 ? 'border-r border-white/10' : ''}`}
                          >
                            {u === 'metric' ? 'Metric' : 'Imperial'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className={`grid gap-4 ${form.unit === 'imperial' ? 'grid-cols-3' : 'grid-cols-2'}`}
                    >
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
                          Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})
                        </label>
                        <input
                          className="input-glass text-lg font-semibold"
                          type="number"
                          placeholder={form.unit === 'metric' ? 'e.g. 73' : 'e.g. 161'}
                          value={form.currentWeight}
                          onChange={e => update({ currentWeight: e.target.value })}
                        />
                        {weightInvalid && <p className="mt-1 text-xs text-red-400">{form.unit === 'metric' ? '30-300 kg' : '66-661 lbs'}</p>}
                      </div>

                      {form.unit === 'metric' ? (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
                            Height (cm)
                          </label>
                          <input
                            className="input-glass text-lg font-semibold"
                            type="number" placeholder="e.g. 175"
                            value={form.currentHeight}
                            onChange={e => update({ currentHeight: e.target.value })}
                          />
                          {heightInvalid && <p className="mt-1 text-xs text-red-400">100-250 cm</p>}
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Feet</label>
                            <input className="input-glass text-lg font-semibold" type="number" placeholder="5" min="3" max="8" value={form.currentHeight} onChange={e => update({ currentHeight: e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-white/40 mb-2">Inches</label>
                            <input className="input-glass text-lg font-semibold" type="number" placeholder="11" min="0" max="11" value={form.currentHeightIn} onChange={e => update({ currentHeightIn: e.target.value })} />
                          </div>
                          {heightInvalid && <p className="col-span-3 text-xs text-red-400">Feet: 3-8, Inches: 0-11.</p>}
                        </>
                      )}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.34 }}
                      className="rounded-2xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.13)' }}
                    >
                      <span className="text-lg mt-0.5">📊</span>
                      <p className="text-xs text-white/40 leading-relaxed">
                        Your original plan used the stats from your first questionnaire. Updated numbers let the AI recalculate your ideal load, recovery, and caloric targets.
                      </p>
                    </motion.div>
                  </div>
                )}

                {/* ── Step 8: Schedule ──────────────────────────────────── */}
                {step === 8 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Schedule"
                      title="Update your training week."
                      sub="Leave blank to keep your current days. Select to change them."
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    >
                      <div className="grid grid-cols-7 gap-1.5 mb-3">
                        {DAY_OPTIONS.map((day, i) => {
                          const sel = form.workoutDays.includes(DAY_FULL[i])
                          return (
                            <button
                              key={day}
                              onClick={() => toggleDay(DAY_FULL[i])}
                              className="flex flex-col items-center py-3 rounded-2xl border transition-all duration-200 active:scale-[0.95]"
                              style={sel ? {
                                background: 'rgba(168,85,247,0.15)',
                                borderColor: 'rgba(168,85,247,0.55)',
                                boxShadow: '0 0 12px rgba(168,85,247,0.2)',
                              } : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }}
                            >
                              <span className={`text-[11px] font-black uppercase tracking-wide ${sel ? 'text-white' : 'text-white/50'}`}>{day}</span>
                              <span className="text-[9px] mt-0.5" style={{ color: sel ? '#A855F7' : 'transparent' }}>✓</span>
                            </button>
                          )
                        })}
                      </div>
                      {form.workoutDays.length > 0 ? (
                        <p className="text-xs text-white/40">
                          {form.workoutDays.length} day{form.workoutDays.length !== 1 ? 's' : ''} selected: {form.workoutDays.map(d => d.slice(0, 3)).join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-white/25 italic">Keeping current schedule</p>
                      )}
                      <AnimatePresence>
                        {getLongestConsecutiveStreak(form.workoutDays) >= 3 && (
                          <div className="mt-2.5">
                            <RecoveryHint
                              streak={getLongestConsecutiveStreak(form.workoutDays)}
                              fitnessLevel={original.fitnessLevel}
                            />
                          </div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
                      className="rounded-2xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.12)' }}
                    >
                      <span className="text-lg mt-0.5">📆</span>
                      <p className="text-xs text-white/40 leading-relaxed">
                        Your session length and rest day placement stay the same unless you specify otherwise.
                      </p>
                    </motion.div>
                  </div>
                )}

                {/* ── Step 9: Exercises to remove ───────────────────────── */}
                {step === 9 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Adjustments"
                      title="Exercises to swap out?"
                      sub="Optional. Name anything you want removed or replaced."
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="space-y-2"
                    >
                      <textarea
                        className="input-glass resize-none"
                        rows={5}
                        placeholder="e.g. Burpees - too intense on knees, Plank - need variety..."
                        value={form.exercisesToRemove}
                        onChange={e => update({ exercisesToRemove: e.target.value })}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
                      className="rounded-2xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.13)' }}
                    >
                      <span className="text-lg mt-0.5">✏️</span>
                      <p className="text-xs text-white/40 leading-relaxed">
                        Leave blank if you are happy with your current exercise selection.
                      </p>
                    </motion.div>
                  </div>
                )}

                {/* ── Step 10: New injuries ─────────────────────────────── */}
                {step === 10 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Limitations"
                      title="Any new injuries?"
                      sub="Optional. The AI will work around any physical limitations."
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="space-y-2"
                    >
                      <textarea
                        className="input-glass resize-none"
                        rows={4}
                        placeholder="e.g. Shoulder strain - avoid overhead pressing..."
                        value={form.newInjuries}
                        onChange={e => update({ newInjuries: e.target.value })}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
                      className="rounded-2xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.13)' }}
                    >
                      <span className="text-lg mt-0.5">🩹</span>
                      <p className="text-xs text-white/40 leading-relaxed">
                        Leave blank if you have no new physical limitations since your last plan.
                      </p>
                    </motion.div>
                  </div>
                )}

                {/* ── Step 11: Goal shift ───────────────────────────────── */}
                {step === 11 && (
                  <div className="space-y-7">
                    <StepHeader
                      tag="Goals"
                      title="Shifting your focus?"
                      sub="Optional. Select new goals to add or change your training direction."
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="flex flex-wrap gap-2.5"
                    >
                      {NEW_GOAL_OPTIONS.map(({ label, icon }, i) => {
                        const active = form.newGoals.includes(label)
                        return (
                          <motion.button
                            key={label}
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.24 + i * 0.04 }}
                            onClick={() => toggleGoal(label)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all duration-200 active:scale-[0.97]"
                            style={active ? {
                              background: 'rgba(168,85,247,0.15)',
                              borderColor: 'rgba(168,85,247,0.5)',
                              color: '#e9d5ff',
                              boxShadow: '0 0 14px rgba(168,85,247,0.18)',
                            } : {
                              background: 'rgba(255,255,255,0.05)',
                              borderColor: 'rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.55)',
                            }}
                          >
                            <span className="text-base">{icon}</span> {label}
                          </motion.button>
                        )
                      })}
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                      className="rounded-2xl px-4 py-3 flex items-start gap-3"
                      style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.13)' }}
                    >
                      <span className="text-lg mt-0.5">🎯</span>
                      <p className="text-xs text-white/40 leading-relaxed">
                        Your original goals are kept unless you select replacements here.
                      </p>
                    </motion.div>
                  </div>
                )}

              </div>

              {/* GlassCard nav */}
              <div
                className="flex items-center justify-between px-6 sm:px-8 py-5 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                <button onClick={handleBack} className="btn-ghost">
                  <HiArrowNarrowLeft className="w-4 h-4" />
                  Back
                </button>
                {step < 11 ? (
                  <button
                    onClick={handleNext}
                    disabled={!canAdvance()}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    Continue
                    <HiArrowNarrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button onClick={() => goToStep(12)} className="btn-primary">
                    Review
                    <HiArrowNarrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 6: Personalized AI Insight (auto-advance, no controls) ── */}
          {step === 6 && (
            <div className="min-h-[calc(100svh-6rem)] flex flex-col items-center justify-center py-10 space-y-8">

              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.05 }}
                className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
                style={{
                  background: `radial-gradient(circle at 40% 40%, ${insight.color}22, ${insight.color}08)`,
                  border: `1px solid ${insight.color}30`,
                  boxShadow: `0 0 40px ${insight.color}20`,
                }}
              >
                {insight.icon}
              </motion.div>

              <div className="text-center space-y-3 max-w-sm px-4">
                <motion.p
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: insight.color }}
                >
                  {insight.tag}
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
                  className="font-black tracking-tight leading-tight"
                  style={{
                    fontSize: 'clamp(2.2rem, 8.5vw, 3.2rem)',
                    background: `linear-gradient(135deg,#fff 50%,${insight.color})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {insight.headline}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
                  className="text-white/50 text-sm leading-relaxed"
                >
                  {insight.sub}
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.44, type: 'spring', stiffness: 300, damping: 20 }}
                className="rounded-2xl px-8 py-5 text-center"
                style={{
                  background: `${insight.color}10`,
                  border: `1px solid ${insight.color}22`,
                }}
              >
                <p className="text-4xl font-black tabular-nums" style={{ color: insight.color }}>
                  <CountUp to={parseInt(insight.stat, 10)} duration={1.4} />{insight.stat.includes('%') ? '%' : ''}
                </p>
                <p className="text-xs text-white/35 uppercase tracking-widest mt-1">{insight.statLabel}</p>
              </motion.div>

              {/* Auto-advance bar only - no skip/back controls */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}
                className="flex flex-col items-center"
              >
                <div className="w-44 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.0, delay: 0.65, ease: 'linear' }}
                    style={{ background: `linear-gradient(90deg,${insight.color},#A855F7)` }}
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* ── Step 12: Launch screen ────────────────────────────────────── */}
          {step === 12 && (
            <div className="min-h-[calc(100svh-6rem)] flex flex-col justify-center py-10 space-y-7">

              <div className="text-center space-y-2">
                <motion.p
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
                  className="text-xs font-bold uppercase tracking-widest" style={{ color: '#A855F7' }}
                >
                  Ready to evolve
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
                  className="font-black tracking-tight leading-tight"
                  style={{ fontSize: 'clamp(2.4rem, 9.5vw, 3.6rem)' }}
                >
                  Everything the AI{' '}
                  <span style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    needs to know.
                  </span>
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
                  className="text-white/40 text-sm"
                >
                  Here's a summary of what you reported.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                className="rounded-3xl p-5 space-y-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Your report</p>
                <div className="flex flex-wrap gap-2">
                  {summaryItems.map(({ icon, label }, i) => (
                    <motion.span
                      key={label}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.34 + i * 0.06 }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.22)', color: '#d8b4fe' }}
                    >
                      <span>{icon}</span> {label}
                    </motion.span>
                  ))}
                  {summaryItems.length === 0 && (
                    <p className="text-white/30 text-sm">All set - ready to generate.</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
                className="rounded-2xl p-4 flex items-start gap-3"
                style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.13)' }}
              >
                <span className="text-xl mt-0.5 flex-shrink-0">🤖</span>
                <div>
                  <p className="text-sm font-semibold text-white/80 mb-1">What your AI coach will update</p>
                  <p className="text-xs text-white/40 leading-relaxed">
                    Exercise selection, sets, reps, rest periods, weekly structure, and progression targets - all rebuilt around who you are today.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}
                className="space-y-3"
              >
                <button onClick={handleSubmit} className="btn-primary w-full !justify-center py-4 text-base">
                  Evolve My Plan ✨
                </button>
                <div className="text-center">
                  <button onClick={handleBack} className="text-white/25 text-sm hover:text-white/50 transition-colors">
                    Go back
                  </button>
                </div>
              </motion.div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </main>
  )
}
