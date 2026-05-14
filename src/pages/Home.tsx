import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { HiArrowNarrowRight, HiArrowNarrowLeft, HiCheck } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'
import type { WorkoutFormData } from '@/lib/gemini'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOALS = [
  { id: 'Muscle Gain', label: 'Build Muscle', icon: '💪', color: 'from-violet-500', desc: 'Bigger, stronger, more defined', suggested: true },
  { id: 'Weight Loss', label: 'Lose Weight', icon: '🔥', color: 'from-orange-500', desc: 'Burn fat, transform your body', suggested: true },
  { id: 'Body Recomposition', label: 'Recomposition', icon: '⚖️', color: 'from-cyan-500', desc: 'Lose fat and gain muscle at once', suggested: false },
  { id: 'Strength', label: 'Get Stronger', icon: '🏋️', color: 'from-red-500', desc: 'Lift heavier, build raw power', suggested: false },
  { id: 'Endurance', label: 'Endurance', icon: '🏃', color: 'from-emerald-500', desc: 'Run farther, last longer', suggested: false },
  { id: 'General Fitness', label: 'General Fitness', icon: '⚡', color: 'from-yellow-500', desc: 'Feel great, stay active', suggested: false },
]

const LEVELS = [
  { id: 'beginner' as const, label: 'Beginner', icon: '🌱', sub: 'Under 1 year', desc: 'New to training or getting back into it' },
  { id: 'intermediate' as const, label: 'Intermediate', icon: '🏋️', sub: '1-3 years', desc: 'Consistent training, know the fundamentals' },
  { id: 'advanced' as const, label: 'Advanced', icon: '🔥', sub: '3+ years', desc: 'Serious athlete, ready to push limits' },
]

const DURATIONS = [
  { id: '30', label: '30 min', emoji: '⚡', desc: 'Quick and efficient' },
  { id: '45', label: '45 min', emoji: '🎯', desc: 'Focused and effective' },
  { id: '60', label: '60 min', emoji: '💪', desc: 'Full session' },
  { id: '90', label: '90+ min', emoji: '🏆', desc: 'No rush, go deep' },
]

const EQUIPMENT_OPTIONS = [
  { id: 'Full Gym', icon: '🏢', desc: 'All machines and free weights' },
  { id: 'Dumbbells', icon: '🏋️', desc: 'Fixed or adjustable set' },
  { id: 'Barbell & Rack', icon: '🔩', desc: 'Power rack or squat stand' },
  { id: 'Resistance Bands', icon: '🎽', desc: 'Various tensions' },
  { id: 'Kettlebells', icon: '⚙️', desc: 'One or more kettlebells' },
  { id: 'Pull-up Bar', icon: '🙆', desc: 'Doorframe or freestanding' },
  { id: 'No Equipment', icon: '🤸', desc: 'Bodyweight only' },
]

const LIMITATION_OPTIONS = [
  { id: 'Lower Back', icon: '🦴' },
  { id: 'Knees', icon: '🦵' },
  { id: 'Shoulders', icon: '💆' },
  { id: 'Wrists', icon: '🤚' },
  { id: 'Hips', icon: '🦴' },
  { id: 'Neck', icon: '🧏' },
]

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const GOAL_TAGLINES: Record<string, string> = {
  'Muscle Gain': 'A structured program built to pack on lean muscle with progressive overload and smart recovery.',
  'Weight Loss': 'High-efficiency training around your schedule to maximize fat burn and keep your energy high.',
  'Body Recomposition': 'A dual-focus program to shed fat and build muscle simultaneously - the hardest goal, done right.',
  'Strength': 'Heavy compounds, strategic loading, and enough recovery to hit new PRs every single week.',
  'Endurance': 'Cardio-focused sessions with conditioning work to build your aerobic base and mental toughness.',
  'General Fitness': 'A balanced program to feel stronger, look better, and move better - built around your real life.',
}

const GOAL_MILESTONES: Record<string, Array<{ week: string; text: string }>> = {
  'Muscle Gain': [
    { week: 'Week 1', text: 'Master your movements and start activating the right muscle groups' },
    { week: 'Week 4', text: 'Noticeable pump, strength gains, and muscle fullness kicking in' },
    { week: 'Week 12', text: 'Visible muscle growth and a measurably stronger, fuller physique' },
  ],
  'Weight Loss': [
    { week: 'Week 1', text: 'Kickstart your metabolism and lock in the exercise habit' },
    { week: 'Week 4', text: 'First visible changes - energy up, waistline down' },
    { week: 'Week 12', text: 'Major body transformation with sustainable habits formed for life' },
  ],
  'Body Recomposition': [
    { week: 'Week 1', text: 'Establish your baseline and calibrate training intensity precisely' },
    { week: 'Week 4', text: 'Clothes fitting differently - fat dropping as muscle begins to build' },
    { week: 'Week 12', text: 'Noticeably leaner and stronger physique from every angle' },
  ],
  'Strength': [
    { week: 'Week 1', text: 'Lock in technique and establish your working numbers' },
    { week: 'Week 4', text: 'First PRs - weights climbing consistently every session' },
    { week: 'Week 12', text: 'Significantly heavier lifts and a visibly more powerful frame' },
  ],
  'Endurance': [
    { week: 'Week 1', text: 'Build the aerobic base with controlled, progressive effort sessions' },
    { week: 'Week 4', text: 'Breathing easier and recovering faster between every interval' },
    { week: 'Week 12', text: 'Running farther and faster than you thought possible' },
  ],
  'General Fitness': [
    { week: 'Week 1', text: 'Feel the shift - more energy, better sleep, moving with purpose' },
    { week: 'Week 4', text: 'Strength and stamina climbing together, week over week' },
    { week: 'Week 12', text: 'A genuinely fitter, healthier version of you - inside and out' },
  ],
}

// ── State shape ───────────────────────────────────────────────────────────────

type Unit = 'metric' | 'imperial'

interface OState {
  name: string
  goal: string
  level: '' | 'beginner' | 'intermediate' | 'advanced'
  daysPerWeek: number
  unavailableDays: string[]
  sessionDuration: string
  equipment: string[]
  sex: '' | 'male' | 'female'
  birthday: string
  weight: string
  height: string
  heightIn: string
  unit: Unit
  limitations: string[]
  customLimitation: string
  hasNoLimitations: boolean
}

const INITIAL: OState = {
  name: '',
  goal: '',
  level: '',
  daysPerWeek: 4,
  unavailableDays: [],
  sessionDuration: '60',
  equipment: [],
  sex: '',
  birthday: '',
  weight: '',
  height: '',
  heightIn: '',
  unit: 'metric',
  limitations: [],
  customLimitation: '',
  hasNoLimitations: false,
}

const TOTAL_STEPS = 9 // steps 0-8

// ── Helpers ───────────────────────────────────────────────────────────────────

function toKg(w: string, unit: Unit): string {
  if (!w) return ''
  return unit === 'metric' ? w : (parseFloat(w) / 2.2046).toFixed(1)
}

function toCm(h: string, hIn: string, unit: Unit): string {
  if (!h) return ''
  if (unit === 'metric') return h
  const ft = parseFloat(h) || 0
  const inches = parseFloat(hIn) || 0
  return ((ft * 12 + inches) * 2.54).toFixed(0)
}

function buildPayload(s: OState): WorkoutFormData {
  const limStr = s.hasNoLimitations
    ? 'None'
    : [...s.limitations, s.customLimitation].filter(Boolean).join(', ') || 'None'

  return {
    planName: s.name.trim() || 'My Plan',
    age: computeAge(s.birthday),
    sex: s.sex || undefined,
    weight: toKg(s.weight, s.unit),
    height: toCm(s.height, s.heightIn, s.unit),
    fitnessLevel: s.level || 'beginner',
    goals: [s.goal],
    equipment: s.equipment.length ? s.equipment : ['No Equipment'],
    equipmentNotes: '',
    injuries: limStr,
    daysPerWeek: String(s.daysPerWeek),
    sessionDuration: s.sessionDuration,
    unavailableDays: s.unavailableDays,
    images: [],
    dietType: 'Balanced',
    allergies: [],
    mealsPerDay: '3',
  }
}

function getSplit(s: OState): string {
  const d = s.daysPerWeek
  switch (s.goal) {
    case 'Muscle Gain':
      return d <= 3 ? 'Full Body' : d === 4 ? 'Upper / Lower' : 'Push / Pull / Legs'
    case 'Strength':
      return d <= 3 ? 'Full Body Powerlifting' : 'Squat / Bench / Deadlift / OHP'
    case 'Weight Loss':
    case 'General Fitness':
      return d <= 3 ? 'Full Body + Cardio' : 'Circuit Training + HIIT'
    case 'Endurance':
      return 'Cardio + Conditioning'
    case 'Body Recomposition':
      return d <= 3 ? 'Full Body' : 'Upper / Lower + Cardio'
    default:
      return 'Custom Program'
  }
}

// ── Birthday helpers ──────────────────────────────────────────────────────────

function computeAge(birthday: string): string {
  if (!birthday) return ''
  const today = new Date()
  const dob = new Date(birthday)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return String(age)
}

function isBirthday(birthday: string): boolean {
  if (!birthday) return false
  const today = new Date()
  const dob = new Date(birthday)
  return today.getMonth() === dob.getMonth() && today.getDate() === dob.getDate()
}

const CONFETTI_PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  emoji: (['🎂', '🎉', '🎈', '✨', '🌟', '💫', '🎊', '🥳'] as const)[i % 8],
  left: [5, 12, 20, 28, 35, 43, 50, 58, 65, 72, 80, 87, 8, 17, 32, 47, 61, 75, 90, 24][i],
  delay: [0, 0.4, 0.8, 0.2, 1.0, 0.6, 1.4, 0.3, 0.9, 0.5, 1.2, 0.1, 0.7, 1.1, 0.35, 0.85, 1.3, 0.55, 0.15, 0.95][i],
  dur: [3.5, 4.2, 3.8, 4.6, 3.3, 4.0, 3.7, 4.4, 3.2, 4.8, 3.6, 4.1, 3.9, 4.3, 3.4, 4.7, 3.1, 4.5, 3.8, 4.0][i],
  size: [20, 24, 18, 22, 26, 20, 24, 18, 22, 20, 26, 18, 22, 24, 20, 26, 18, 22, 20, 24][i],
}))

function BirthdayConfetti() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 200 }}>
      {CONFETTI_PARTICLES.map(p => (
        <motion.div
          key={p.id}
          style={{ position: 'absolute', left: `${p.left}%`, top: '-5%', fontSize: p.size }}
          animate={{ y: '115vh', rotate: [0, 180, 360], opacity: [0, 1, 1, 1, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'linear', repeat: Infinity, repeatDelay: 0.8 }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  )
}

// ── Animation ─────────────────────────────────────────────────────────────────

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '55%' : '-55%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-55%' : '55%', opacity: 0 }),
}
const spring = { type: 'spring' as const, stiffness: 320, damping: 32 }

// ── Sub-components ────────────────────────────────────────────────────────────

function OptionCard({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-3xl border transition-all duration-200 active:scale-[0.97]"
      style={selected ? {
        background: 'rgba(168,85,247,0.15)',
        borderColor: 'rgba(168,85,247,0.55)',
        boxShadow: '0 0 0 1px rgba(168,85,247,0.25)',
      } : {
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </button>
  )
}

function CheckBadge({ show }: { show: boolean }) {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
      style={show ? {
        background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
      } : {
        background: 'rgba(255,255,255,0.08)',
        border: '1.5px solid rgba(255,255,255,0.15)',
      }}
    >
      {show && <HiCheck className="w-3.5 h-3.5 text-white" />}
    </div>
  )
}

function StepHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-7">
      {eyebrow && <p className="text-purple-400/70 text-xs font-semibold uppercase tracking-widest mb-2">{eyebrow}</p>}
      <h2 className="text-3xl font-black text-white tracking-tight leading-tight">{title}</h2>
      {sub && <p className="text-white/40 text-sm mt-2 leading-relaxed">{sub}</p>}
    </div>
  )
}

function ContinueBtn({ label = 'Continue', onClick, disabled, icon }: {
  label?: string; onClick: () => void; disabled?: boolean; icon?: React.ReactNode
}) {
  return (
    <div className="pt-4 pb-2">
      <button
        onClick={onClick}
        disabled={disabled}
        className="btn-primary w-full justify-center text-base py-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
      >
        {label}
        {icon ?? <HiArrowNarrowRight className="w-5 h-5" />}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { isLoading, user } = db.useAuth()
  const [step, setStep] = useState(-1)
  const [dir, setDir] = useState(1)
  const [s, setS] = useState<OState>(INITIAL)

  if (isLoading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const upd = (patch: Partial<OState>) => setS(p => ({ ...p, ...patch }))

  const next = () => { setDir(1); setStep(n => n + 1) }
  const back = () => { setDir(-1); setStep(n => n - 1) }

  function autoNext(patch: Partial<OState>) {
    upd(patch)
    setTimeout(() => { setDir(1); setStep(n => n + 1) }, 260)
  }

  const progress = step >= 0 ? ((step + 1) / TOTAL_STEPS) * 100 : 0

  const handleGenerate = () => {
    const payload = buildPayload(s)
    sessionStorage.setItem('pendingPlan', JSON.stringify(payload))
    navigate('/auth', { state: { from: { pathname: '/generating' } } })
  }

  // ── Splash ─────────────────────────────────────────────────────────────────

  if (step === -1) {
    return (
      <main className="relative min-h-screen bg-[#030014] flex flex-col overflow-hidden">
        {/* Orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 65%)', filter: 'blur(60px)' }} />
          <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.13) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        </div>

        <div className="relative z-10 max-w-lg mx-auto w-full px-6 pt-16 pb-12 flex flex-col flex-1">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-12">
            <h1 className="text-[3.5rem] font-black tracking-tight leading-none gradient-text">UPLIFT</h1>
            <p className="text-white/40 text-base mt-2 font-medium">  Premium fitness plans designed to grow with you.</p>
          </motion.div>

          {/* Features */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }} className="space-y-3 mb-10">
            {[
              { icon: '🏋️', title: 'Personalized Workout Plans', desc: 'Built around your goals, equipment, and schedule' },
              { icon: '🤖', title: 'KAI - Your AI Coach', desc: 'Ask anything, get expert-level answers anytime' },
              { icon: '📈', title: 'Auto-Evolving Plans', desc: 'Your plan adapts every 4 weeks as you progress' },
              { icon: '🥗', title: 'Nutrition Tracking', desc: 'Macros, calories, food scanner, and daily insights' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="text-2xl flex-shrink-0 mt-0.5">{icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-auto space-y-3">
            <button
              onClick={() => { setDir(1); setStep(0) }}
              className="btn-primary w-full justify-center text-lg py-5"
            >
              Build My Plan
              <HiArrowNarrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-3.5 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
            >
              Already have an account?{' '}
              <span style={{ color: '#c084fc' }}>Log in</span>
            </button>
          </motion.div>
        </div>
      </main>
    )
  }

  // ── Step screens ───────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen bg-[#030014] flex flex-col overflow-hidden">
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-0 -right-32 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 max-w-lg mx-auto w-full px-6 pt-8 pb-3 flex items-center gap-3">
        <button
          onClick={step === 0 ? () => setStep(-1) : back}
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <HiArrowNarrowLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
          />
        </div>
        <span className="text-white/30 text-xs font-medium flex-shrink-0 w-10 text-right tabular-nums">
          {step + 1}/{TOTAL_STEPS}
        </span>
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            className="flex-1 flex flex-col max-w-lg mx-auto w-full px-6 pt-6 pb-8"
          >
            {/* ── Step 0: Name ─────────────────────────────────────────── */}
            {step === 0 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">👋</div>
                <StepHeading
                  eyebrow="Let's get started"
                  title="What should we call you?"
                  sub="Your name makes your plan feel personal and your progress feel real."
                />
                <input
                  className="input-glass text-xl font-semibold mb-3"
                  type="text"
                  placeholder="Your first name"
                  autoFocus
                  autoComplete="given-name"
                  style={{ fontSize: 18 }}
                  value={s.name}
                  onChange={e => upd({ name: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter' && s.name.trim().length >= 2) next() }}
                />
                <p className="text-white/25 text-xs mb-8">Used to personalize your plan and progress messages.</p>
                <div className="mt-auto">
                  <ContinueBtn onClick={next} disabled={s.name.trim().length < 2} />
                </div>
              </div>
            )}

            {/* ── Step 1: Goal ─────────────────────────────────────────── */}
            {step === 1 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">🎯</div>
                <StepHeading
                  eyebrow={`Nice to meet you, ${s.name.split(' ')[0] || 'you'}!`}
                  title="What's your main goal?"
                  sub="We'll build your entire plan around this. You can always refine later."
                />
                <div className="space-y-3 flex-1">
                  {GOALS.map(g => (
                    <OptionCard key={g.id} selected={s.goal === g.id} onClick={() => autoNext({ goal: g.id })}>
                      <div className="flex items-center gap-4 p-4">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${g.color} to-transparent flex items-center justify-center text-2xl flex-shrink-0`}>
                          {g.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-white font-bold text-base">{g.label}</p>
                            {g.suggested && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-white/40 text-sm mt-0.5">{g.desc}</p>
                        </div>
                        <CheckBadge show={s.goal === g.id} />
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Level ─────────────────────────────────────────── */}
            {step === 2 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">📊</div>
                <StepHeading
                  eyebrow="Training experience"
                  title="How long have you been training?"
                  sub="Honest answers give you a better starting plan. You can always move up."
                />
                <div className="space-y-3 flex-1">
                  {LEVELS.map(l => (
                    <OptionCard key={l.id} selected={s.level === l.id} onClick={() => autoNext({ level: l.id })}>
                      <div className="flex items-center gap-4 p-5">
                        <span className="text-3xl flex-shrink-0">{l.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-white font-bold text-base">{l.label}</p>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
                              {l.sub}
                            </span>
                          </div>
                          <p className="text-white/40 text-sm">{l.desc}</p>
                        </div>
                        <CheckBadge show={s.level === l.id} />
                      </div>
                    </OptionCard>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3: Schedule ──────────────────────────────────────── */}
            {step === 3 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">📅</div>
                <StepHeading
                  eyebrow="Weekly schedule"
                  title="How many days can you train?"
                  sub="We'll schedule rest days automatically for recovery."
                />

                {/* Days slider */}
                <div className="glass-card p-5 mb-5">
                  <div className="flex items-end justify-between mb-5">
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Training days</p>
                      <p className="text-white font-black text-4xl tabular-nums leading-none">{s.daysPerWeek}</p>
                      <p className="text-white/40 text-sm mt-0.5">days per week</p>
                    </div>
                    <p className="text-white/25 text-xs text-right leading-relaxed">
                      {s.daysPerWeek <= 3 ? 'Great for beginners' : s.daysPerWeek <= 5 ? 'Optimal for most goals' : 'High commitment'}
                    </p>
                  </div>
                  <input
                    type="range" min="2" max="7" value={s.daysPerWeek}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10)
                      const maxBlocked = 7 - val
                      upd({
                        daysPerWeek: val,
                        unavailableDays: s.unavailableDays.slice(0, maxBlocked),
                      })
                    }}
                    className="w-full accent-purple-500 h-2 rounded-full"
                  />
                  <div className="flex justify-between text-[10px] text-white/25 mt-1.5">
                    {[2, 3, 4, 5, 6, 7].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>

                {/* Day blocker */}
                <div className="mb-5">
                  <p className="text-white/50 text-sm font-medium mb-3">Which days can't you train? <span className="text-white/25 font-normal">(optional)</span></p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAY_SHORT.map((day, i) => {
                      const blocked = s.unavailableDays.includes(DAY_FULL[i])
                      const maxBlocked = 7 - s.daysPerWeek
                      const atLimit = !blocked && s.unavailableDays.length >= maxBlocked
                      return (
                        <button
                          key={day}
                          disabled={atLimit}
                          onClick={() => {
                            const full = DAY_FULL[i]
                            upd({
                              unavailableDays: blocked
                                ? s.unavailableDays.filter(d => d !== full)
                                : [...s.unavailableDays, full],
                            })
                          }}
                          className="flex flex-col items-center py-3 rounded-2xl border transition-all"
                          style={blocked ? {
                            background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#fca5a5',
                          } : atLimit ? {
                            background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)',
                          } : {
                            background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
                          }}
                        >
                          <span className="text-[11px] font-bold uppercase">{day}</span>
                          {blocked && <span className="text-[9px] mt-0.5">✕</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-auto">
                  <ContinueBtn onClick={next} />
                </div>
              </div>
            )}

            {/* ── Step 4: Duration ──────────────────────────────────────── */}
            {step === 4 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">⏱️</div>
                <StepHeading
                  eyebrow="Session length"
                  title="How long per session?"
                  sub="We'll pack exactly the right amount of work into your time."
                />
                <div className="space-y-3 flex-1">
                  {DURATIONS.map(d => (
                    <OptionCard key={d.id} selected={s.sessionDuration === d.id} onClick={() => upd({ sessionDuration: d.id })}>
                      <div className="flex items-center gap-4 p-5">
                        <span className="text-3xl flex-shrink-0">{d.emoji}</span>
                        <div className="flex-1">
                          <p className="text-white font-bold text-lg">{d.label}</p>
                          <p className="text-white/40 text-sm">{d.desc}</p>
                        </div>
                        <CheckBadge show={s.sessionDuration === d.id} />
                      </div>
                    </OptionCard>
                  ))}
                </div>
                <div className="mt-4">
                  <ContinueBtn onClick={next} disabled={!s.sessionDuration} />
                </div>
              </div>
            )}

            {/* ── Step 5: Equipment ─────────────────────────────────────── */}
            {step === 5 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">🏋️</div>
                <StepHeading
                  eyebrow="Equipment"
                  title="What do you have access to?"
                  sub="Select everything available. Your plan will be built around what you have."
                />
                <div className="space-y-2.5 flex-1">
                  {EQUIPMENT_OPTIONS.map(e => {
                    const selected = s.equipment.includes(e.id)
                    const isNone = e.id === 'No Equipment'
                    return (
                      <OptionCard
                        key={e.id}
                        selected={selected}
                        onClick={() => {
                          if (isNone) {
                            upd({ equipment: selected ? [] : ['No Equipment'] })
                          } else {
                            const base = s.equipment.filter(x => x !== 'No Equipment')
                            upd({ equipment: selected ? base.filter(x => x !== e.id) : [...base, e.id] })
                          }
                        }}
                      >
                        <div className="flex items-center gap-4 px-4 py-3.5">
                          <span className="text-2xl flex-shrink-0">{e.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm">{e.id}</p>
                            <p className="text-white/35 text-xs mt-0.5">{e.desc}</p>
                          </div>
                          <CheckBadge show={selected} />
                        </div>
                      </OptionCard>
                    )
                  })}
                </div>
                <div className="mt-4">
                  <ContinueBtn onClick={next} disabled={s.equipment.length === 0} />
                </div>
              </div>
            )}

            {/* ── Step 6: Body Stats ────────────────────────────────────── */}
            {step === 6 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">📏</div>
                <StepHeading
                  eyebrow="Calibrate your plan"
                  title="A few personal details"
                  sub="Used to calculate your training load, intensity, and nutrition targets."
                />

                {/* Unit toggle */}
                <div className="flex rounded-2xl overflow-hidden border border-white/10 mb-5 self-start">
                  {(['metric', 'imperial'] as const).map((u, i) => (
                    <button
                      key={u}
                      onClick={() => upd({ unit: u })}
                      className="px-4 py-2 text-sm font-medium transition-all"
                      style={s.unit === u
                        ? { background: 'rgba(168,85,247,0.2)', color: '#c084fc' }
                        : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : undefined }}
                    >
                      {u === 'metric' ? 'Metric' : 'Imperial'}
                    </button>
                  ))}
                </div>

                {/* Gender */}
                <div className="mb-4">
                  <p className="text-white/50 text-sm font-medium mb-2.5">Biological sex <span className="text-white/25 font-normal">(optional)</span></p>
                  <div className="flex gap-2.5">
                    {[{ id: 'male' as const, label: 'Male', icon: '♂️' }, { id: 'female' as const, label: 'Female', icon: '♀️' }].map(g => (
                      <button
                        key={g.id}
                        onClick={() => upd({ sex: s.sex === g.id ? '' : g.id })}
                        className="flex-1 py-3.5 rounded-2xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all"
                        style={s.sex === g.id ? {
                          background: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.5)', color: '#c084fc',
                        } : {
                          background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
                        }}
                      >
                        <span>{g.icon}</span> {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Birthday */}
                <div className="mb-4">
                  <p className="text-white/50 text-sm font-medium mb-2">Date of birth</p>
                  <input
                    className="input-glass"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    style={{ fontSize: 16, colorScheme: 'dark' }}
                    value={s.birthday}
                    onChange={e => upd({ birthday: e.target.value })}
                  />
                  {s.birthday && (() => {
                    const a = parseInt(computeAge(s.birthday), 10)
                    if (isNaN(a) || a < 0) return (
                      <p className="text-xs text-red-400 mt-1.5">Time travel detected. Enter a real birthdate.</p>
                    )
                    if (a < 14) return (
                      <p className="text-xs text-red-400 mt-1.5">You're too young to be this serious. Come back in a few years!</p>
                    )
                    if (a > 79) return (
                      <p className="text-xs text-red-400 mt-1.5">Respect. But we're not certified for legends quite yet.</p>
                    )
                    return (
                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                          {a} years old
                        </span>
                        {isBirthday(s.birthday) && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>
                            🎂 Happy Birthday!
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Birthday celebration card */}
                {s.birthday && isBirthday(s.birthday) && (() => {
                  const a = parseInt(computeAge(s.birthday), 10)
                  if (isNaN(a) || a < 14 || a > 79) return null
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="rounded-3xl px-5 py-5 mb-4"
                      style={{
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(168,85,247,0.1) 100%)',
                        border: '1px solid rgba(251,191,36,0.3)',
                      }}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#FBBF24' }}>Happy Birthday!</p>
                      <p className="text-white font-bold text-base leading-snug mb-1.5">
                        {s.name.split(' ')[0] || 'You'}, today is your day 🎂
                      </p>
                      <p className="text-white/50 text-sm leading-relaxed">
                        Starting your fitness journey on your birthday? That's the most powerful gift you can give yourself.
                      </p>
                    </motion.div>
                  )
                })()}

                {/* Weight + Height */}
                {(() => {
                  const w = parseFloat(s.weight)
                  const weightInvalid = s.weight !== '' && (isNaN(w) || (s.unit === 'metric' ? w < 30 || w > 300 : w < 66 || w > 660))
                  const ft = parseFloat(s.height)
                  const inches = parseFloat(s.heightIn || '0')
                  const h = parseFloat(s.height)
                  const heightInvalid = s.height !== '' && (s.unit === 'metric'
                    ? isNaN(h) || h < 100 || h > 250
                    : isNaN(ft) || ft < 3 || ft > 8 || isNaN(inches) || inches < 0 || inches > 11)
                  const bdAge = s.birthday ? parseInt(computeAge(s.birthday), 10) : null
                  const ageInvalid = !s.birthday || bdAge === null || isNaN(bdAge) || bdAge < 14 || bdAge > 79
                  return (
                    <>
                      <div className={`grid gap-3 mb-1 ${s.unit === 'imperial' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <div>
                          <p className="text-white/50 text-sm font-medium mb-2">Weight ({s.unit === 'metric' ? 'kg' : 'lbs'})</p>
                          <input className="input-glass" type="number" style={{ fontSize: 16 }}
                            placeholder={s.unit === 'metric' ? 'e.g. 75' : 'e.g. 165'}
                            value={s.weight} onChange={e => upd({ weight: e.target.value })} />
                          {weightInvalid && (
                            <p className="text-xs text-red-400 mt-1">
                              {s.unit === 'metric'
                                ? w < 30 ? "You'd blow away in the gym. Double-check that." : "Our servers can't handle that much muscle."
                                : w < 66 ? "You'd blow away in the gym. Double-check that." : "Our servers can't handle that much muscle."}
                            </p>
                          )}
                        </div>
                        {s.unit === 'metric' ? (
                          <div>
                            <p className="text-white/50 text-sm font-medium mb-2">Height (cm)</p>
                            <input className="input-glass" type="number" style={{ fontSize: 16 }}
                              placeholder="e.g. 178"
                              value={s.height} onChange={e => upd({ height: e.target.value })} />
                            {heightInvalid && (
                              <p className="text-xs text-red-400 mt-1">
                                {h < 100 ? "That's Hobbit territory. Check your cm vs inches?" : "Easy there, Goliath. That can't be right."}
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-white/50 text-sm font-medium mb-2">Feet</p>
                              <input className="input-glass" type="number" style={{ fontSize: 16 }}
                                placeholder="5" min="3" max="8"
                                value={s.height} onChange={e => upd({ height: e.target.value })} />
                            </div>
                            <div>
                              <p className="text-white/50 text-sm font-medium mb-2">Inches</p>
                              <input className="input-glass" type="number" style={{ fontSize: 16 }}
                                placeholder="10" min="0" max="11"
                                value={s.heightIn} onChange={e => upd({ heightIn: e.target.value })} />
                            </div>
                          </>
                        )}
                      </div>
                      {s.unit === 'imperial' && heightInvalid && (
                        <p className="text-xs text-red-400 mb-3">
                          {ft < 3 ? "That's Hobbit territory. Check your feet vs inches?" : ft > 8 ? "Easy there, Goliath. That can't be right." : "Inches go 0-11, not 12+. That's just called a foot."}
                        </p>
                      )}

                      <div className="mt-auto">
                        <ContinueBtn
                          onClick={next}
                          disabled={ageInvalid || weightInvalid || heightInvalid}
                        />
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* ── Step 7: Limitations ───────────────────────────────────── */}
            {step === 7 && (
              <div className="flex flex-col flex-1">
                <div className="text-4xl mb-5">🩺</div>
                <StepHeading
                  eyebrow="Health & safety"
                  title="Any injuries or limitations?"
                  sub="We'll completely work around anything that's off-limits. No guessing."
                />

                {/* None button */}
                <button
                  onClick={() => upd({ hasNoLimitations: !s.hasNoLimitations, limitations: [] })}
                  className="w-full flex items-center gap-4 px-5 py-4 rounded-3xl border mb-3 transition-all"
                  style={s.hasNoLimitations ? {
                    background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)',
                  } : {
                    background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <span className="text-2xl">✅</span>
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">No limitations</p>
                    <p className="text-white/35 text-xs">I can train without restrictions</p>
                  </div>
                  <CheckBadge show={s.hasNoLimitations} />
                </button>

                {!s.hasNoLimitations && (
                  <>
                    <p className="text-white/35 text-xs mb-3">Or select areas to work around:</p>
                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                      {LIMITATION_OPTIONS.map(l => {
                        const sel = s.limitations.includes(l.id)
                        return (
                          <button
                            key={l.id}
                            onClick={() => upd({
                              limitations: sel
                                ? s.limitations.filter(x => x !== l.id)
                                : [...s.limitations, l.id],
                            })}
                            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all"
                            style={sel ? {
                              background: 'rgba(168,85,247,0.12)', borderColor: 'rgba(168,85,247,0.4)', color: '#c084fc',
                            } : {
                              background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)',
                            }}
                          >
                            <span className="text-lg">{l.icon}</span>
                            <span className="text-sm font-medium">{l.id}</span>
                          </button>
                        )
                      })}
                    </div>

                    <input
                      className="input-glass mb-2"
                      type="text"
                      placeholder="Other (e.g. recovering from surgery...)"
                      style={{ fontSize: 16 }}
                      value={s.customLimitation}
                      onChange={e => upd({ customLimitation: e.target.value })}
                    />
                  </>
                )}

                <div className="mt-auto">
                  <ContinueBtn
                    label="Almost there"
                    onClick={next}
                    disabled={!s.hasNoLimitations && s.limitations.length === 0 && !s.customLimitation.trim()}
                  />
                </div>
              </div>
            )}

            {/* ── Step 8: Personalized outcome + CTA ───────────────────── */}
            {step === 8 && (
              <div className="flex-1 overflow-y-auto">

                {/* Birthday confetti overlay */}
                {isBirthday(s.birthday) && <BirthdayConfetti />}

                {/* Hero */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
                  {isBirthday(s.birthday) ? (
                    <>
                      <div className="text-5xl mb-4">🎂</div>
                      <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#FBBF24' }}>
                        Happy Birthday, {s.name.split(' ')[0] || 'you'}!
                      </p>
                      <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-3"
                        style={{ background: 'linear-gradient(135deg, #FBBF24, #A855F7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Best birthday gift ever.
                      </h2>
                      <p className="text-white/50 text-sm leading-relaxed mb-3">
                        You're starting your transformation on your birthday. That's not a coincidence — that's intention. Let's make it count.
                      </p>
                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold"
                        style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24' }}>
                        🎊 {GOAL_TAGLINES[s.goal]?.split('.')[0] ?? 'A plan built just for you'}.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl mb-5">🎊</div>
                      <p className="text-purple-400/70 text-xs font-semibold uppercase tracking-widest mb-2">Built for you</p>
                      <h2 className="text-3xl font-black text-white tracking-tight leading-tight mb-3">
                        {s.name.split(' ')[0] || 'You'}, this is your plan.
                      </h2>
                      <p className="text-white/50 text-sm leading-relaxed">
                        {GOAL_TAGLINES[s.goal] ?? 'A personalized program built around every answer you gave.'}
                      </p>
                    </>
                  )}
                </motion.div>

                {/* Stats trio */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mb-5">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Days / week', value: String(s.daysPerWeek) },
                      { label: 'Min / session', value: s.sessionDuration === '90' ? '90+' : s.sessionDuration },
                      {
                        label: 'Mins / week',
                        value: s.sessionDuration === '90'
                          ? `${s.daysPerWeek * 90}+`
                          : String(s.daysPerWeek * parseInt(s.sessionDuration, 10)),
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-2xl px-2 py-4 text-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="text-white font-black text-2xl tabular-nums leading-none mb-1.5">{value}</p>
                        <p className="text-white/35 text-[10px] leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Plan identity card */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-5">
                  <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(34,211,238,0.08) 100%)', border: '1px solid rgba(168,85,247,0.3)' }}>
                    <div className="px-5 py-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(34,211,238,0.2))' }}>
                        {GOALS.find(g => g.id === s.goal)?.icon ?? '🏋️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm">{s.goal || 'Your Goal'} Plan</p>
                        <p className="text-white/40 text-xs mt-0.5">{getSplit(s)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>
                          {s.level ? s.level[0].toUpperCase() + s.level.slice(1) : 'Beginner'}
                        </span>
                        <span className="text-white/35 text-[10px]">
                          {s.equipment.length === 0 ? 'Bodyweight' : s.equipment.length === 1 ? s.equipment[0] : `${s.equipment.length} equipment types`}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Transformation roadmap */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="mb-5">
                  <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Your transformation roadmap</p>
                  <div className="rounded-3xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {(GOAL_MILESTONES[s.goal] ?? GOAL_MILESTONES['General Fitness']).map((m, i, arr) => (
                      <div key={i} className="flex items-start gap-4 px-5 py-4"
                        style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5"
                          style={i === 0
                            ? { background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: 'white' }
                            : i === arr.length - 1
                              ? { background: 'rgba(34,211,238,0.15)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.3)' }
                              : { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider mb-1"
                            style={{ color: i === 0 ? '#c084fc' : i === arr.length - 1 ? '#22D3EE' : 'rgba(192,132,252,0.6)' }}>
                            {m.week}
                          </p>
                          <p className="text-white/60 text-sm leading-relaxed">{m.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* What's included */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }} className="mb-5">
                  <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">What's included</p>
                  <div className="space-y-2">
                    {[
                      { icon: '📋', text: 'Full week-by-week workout program' },
                      { icon: '🤖', text: 'KAI coaching and exercise guidance' },
                      { icon: '📊', text: 'Personalized nutrition targets' },
                      { icon: '📈', text: 'Auto-evolution after 4 weeks' },
                    ].map(({ icon, text }) => (
                      <div key={text} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-lg">{icon}</span>
                        <p className="text-white/70 text-sm">{text}</p>
                        <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(34,211,238,0.15)' }}>
                          <HiCheck className="w-3 h-3 text-cyan-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* CTA */}
                <div className="overflow-hidden">
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
                    <button
                      onClick={handleGenerate}
                      className="btn-primary w-full justify-center text-sm font-medium py-5 mb-3 scale-[0.97] hover:scale-100 transition-all duration-200 mt-5"
                    >
                      Generate My Plan
                      <HiArrowNarrowRight className="w-5 h-5" />
                    </button>
                    <p className="text-center text-white/25 text-xs leading-relaxed pb-6">
                      Built for real, lasting results. Your plan is ready in seconds.
                    </p>
                  </motion.div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main >
  )
}
