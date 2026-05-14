import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { markOnboardingSeen } from '@/lib/onboarding'
import type { WorkoutFormData } from '@/lib/gemini'

// ── Helpers ───────────────────────────────────────────────────────────────────

const GOAL_EMOJIS: Record<string, string> = {
  'Muscle Gain': '💪',
  'Weight Loss': '🔥',
  'Body Recomposition': '⚖️',
  'Strength': '🏋️',
  'Endurance': '🏃',
  'General Fitness': '⚡',
  'Athletic Performance': '🏆',
  'Flexibility': '🧘',
  'Stress Relief': '🌿',
}

const GOAL_SPLITS: Record<string, (days: number) => string> = {
  'Muscle Gain': d => d <= 3 ? 'Full Body' : d === 4 ? 'Upper / Lower' : 'Push / Pull / Legs',
  'Strength': d => d <= 3 ? 'Full Body Powerlifting' : 'Squat / Bench / Deadlift',
  'Weight Loss': d => d <= 3 ? 'Full Body + Cardio' : 'Circuit + HIIT',
  'General Fitness': d => d <= 3 ? 'Full Body + Cardio' : 'Circuit + HIIT',
  'Body Recomposition': d => d <= 3 ? 'Full Body' : 'Upper / Lower + Cardio',
  'Endurance': () => 'Cardio + Conditioning',
  'Athletic Performance': () => 'Sport-Specific Training',
  'Flexibility': () => 'Mobility + Stretch',
  'Stress Relief': () => 'Mindful Movement',
}

function getSplit(goal: string, days: number): string {
  return GOAL_SPLITS[goal]?.(days) ?? 'Custom Program'
}

function parseConstraints(raw: string) {
  const days = raw.match(/(\d+)d\/wk/)?.[1]
  const mins = raw.match(/(\d+)min/)?.[1]
  return { days: days ? parseInt(days, 10) : 4, mins: mins ?? '60' }
}

// ── Slide variants ─────────────────────────────────────────────────────────────

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '55%' : '-55%', opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-55%' : '55%', opacity: 0, scale: 0.96 }),
}
const spring = { type: 'spring' as const, stiffness: 340, damping: 30 }

// ── Progress dots ─────────────────────────────────────────────────────────────

function Dots({ total, current, onDot }: { total: number; current: number; onDot: (i: number) => void }) {
  return (
    <div className="flex gap-1.5 items-center justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDot(i)}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 7,
            height: 7,
            background: i === current
              ? 'linear-gradient(90deg, #A855F7, #22D3EE)'
              : i < current
                ? 'rgba(168,85,247,0.35)'
                : 'rgba(255,255,255,0.12)',
          }}
        />
      ))}
    </div>
  )
}

// ── MacroBar ──────────────────────────────────────────────────────────────────

function MacroBar({ label, value, max, color, unit = 'g' }: { label: string; value: number; max: number; color: string; unit?: string }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100)
  return (
    <div className="flex-1">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-black tabular-nums" style={{ color }}>{value}{unit}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

// ── Day pill ───────────────────────────────────────────────────────────────────

function DayPill({ label, active, delay }: { label: string; active: boolean; delay: number }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 20 }}
      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black"
      style={active
        ? { background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff', boxShadow: '0 0 16px rgba(168,85,247,0.4)' }
        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)' }
      }
    >
      {label}
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingSummary() {
  const navigate = useNavigate()
  const location = useLocation()
  const userId = getUserId()

  const statePlan = location.state?.plan as string | undefined
  const stateFormData = location.state?.formData as WorkoutFormData | undefined

  const { data } = db.useQuery({
    workoutPlans: { $: { where: { userId } } },
    userProfiles: { $: { where: { userId } } },
  })

  const [slideIdx, setSlideIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [countdown, setCountdown] = useState<number | null>(null)

  useEffect(() => {
    markOnboardingSeen(userId)
  }, [userId])

  const latestPlan = useMemo(() => {
    const plans = (data?.workoutPlans ?? []) as Array<{ id: string; plan: string; goals: string; constraints: string; createdAt: number; userName: string }>
    return [...plans].sort((a, b) => b.createdAt - a.createdAt)[0]
  }, [data?.workoutPlans])

  const planText = statePlan ?? latestPlan?.plan ?? ''
  const rawGoal = stateFormData?.goals?.[0] ?? (() => {
    try { return JSON.parse(latestPlan?.goals ?? '[]')[0] ?? 'General Fitness' }
    catch { return 'General Fitness' }
  })()

  const userName = useMemo(() => {
    const profiles = (data?.userProfiles ?? []) as Array<{ name?: string }>
    return profiles[0]?.name?.split(' ')[0] ?? 'Champion'
  }, [data?.userProfiles])

  const { days, mins } = useMemo(() => {
    if (stateFormData?.daysPerWeek && stateFormData?.sessionDuration) {
      return { days: parseInt(stateFormData.daysPerWeek, 10), mins: stateFormData.sessionDuration }
    }
    return parseConstraints(latestPlan?.constraints ?? '')
  }, [stateFormData, latestPlan])

  const nutritionProfile = getNutritionProfile()
  const targets = nutritionProfile ? calculateTargets(nutritionProfile) : null

  const totalMinutes = days * parseInt(mins, 10)
  const split = getSplit(rawGoal, days)
  const goalEmoji = GOAL_EMOJIS[rawGoal] ?? '🏋️'

  // Auto-advance on last slide
  const TOTAL_SLIDES = 4
  const isLast = slideIdx === TOTAL_SLIDES - 1

  useEffect(() => {
    if (isLast) setCountdown(4)
  }, [isLast])

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      navigate('/history', { replace: true })
      return
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, navigate])

  const goTo = (idx: number) => {
    if (idx === slideIdx) return
    setDir(idx > slideIdx ? 1 : -1)
    setSlideIdx(idx)
    if (idx !== TOTAL_SLIDES - 1) setCountdown(null)
  }

  const next = () => { if (slideIdx < TOTAL_SLIDES - 1) goTo(slideIdx + 1) }
  const prev = () => { if (slideIdx > 0) goTo(slideIdx - 1) }

  // Show spinner while DB loads (only if we need it - no state data)
  if (!stateFormData && !statePlan && data === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
      </div>
    )
  }

  // If no plan data at all, skip to dashboard
  if (!stateFormData && !statePlan && !latestPlan) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <main className="relative min-h-screen bg-[#030014] flex flex-col overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 65%)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.1) 0%, transparent 65%)', filter: 'blur(80px)' }} />
      </div>

      <div className="relative z-10 flex flex-col flex-1 max-w-lg mx-auto w-full px-6 pt-12 pb-10">

        {/* Slide area */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={slideIdx}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring}
              className="absolute inset-0 flex flex-col justify-center"
            >

              {/* ── Slide 0: Welcome ───────────────────────────────────── */}
              {slideIdx === 0 && (
                <div className="text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-5xl"
                    style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))', border: '1px solid rgba(168,85,247,0.4)' }}
                  >
                    {goalEmoji}
                  </motion.div>

                  <div>
                    <motion.p
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                      className="text-xs font-bold uppercase tracking-widest mb-2"
                      style={{ color: '#A855F7' }}
                    >
                      Your plan is live
                    </motion.p>
                    <motion.h1
                      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                      className="text-4xl font-black text-white tracking-tight leading-tight mb-3"
                    >
                      {userName !== 'Champion' ? `Welcome,\n${userName}.` : 'Welcome\naboard.'}
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                      className="text-white/45 text-base leading-relaxed"
                    >
                      Your <span className="text-white/80 font-semibold">{rawGoal}</span> program is ready. Built around your goals, schedule, and equipment.
                    </motion.p>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl mx-auto"
                    style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}
                  >
                    <span className="text-lg">{goalEmoji}</span>
                    <span className="text-white font-bold text-sm">{rawGoal} Plan</span>
                    <span className="text-white/35 text-xs">-</span>
                    <span className="text-white/55 text-xs">{split}</span>
                  </motion.div>
                </div>
              )}

              {/* ── Slide 1: Training week ─────────────────────────────── */}
              {slideIdx === 1 && (
                <div className="space-y-8">
                  <div>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                      className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#22D3EE' }}>
                      Your training week
                    </motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                      className="text-4xl font-black text-white tracking-tight">
                      {days} sessions<br />
                      <span className="text-white/40 text-2xl">per week</span>
                    </motion.h2>
                  </div>

                  <div className="flex justify-between gap-1.5">
                    {DAY_LABELS.map((label, i) => (
                      <DayPill key={i} label={label} active={i < days} delay={0.1 + i * 0.07} />
                    ))}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {[
                      { label: 'Per session', value: `${mins === '90' ? '90+' : mins} min`, color: '#A855F7' },
                      { label: 'Per week', value: `~${totalMinutes >= 90 ? Math.round(totalMinutes / 60 * 10) / 10 + 'h' : totalMinutes + 'm'}`, color: '#22D3EE' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-2xl px-4 py-4 text-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <p className="font-black text-2xl tabular-nums leading-none mb-1" style={{ color }}>{value}</p>
                        <p className="text-white/35 text-xs">{label}</p>
                      </div>
                    ))}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)' }}
                  >
                    <span className="text-xl">📋</span>
                    <div>
                      <p className="text-white/80 text-sm font-semibold">{split}</p>
                      <p className="text-white/35 text-xs">your training split</p>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* ── Slide 2: Nutrition ─────────────────────────────────── */}
              {slideIdx === 2 && (
                <div className="space-y-6">
                  <div>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                      className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>
                      Daily nutrition
                    </motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                      className="text-4xl font-black text-white tracking-tight">
                      Targets set.
                    </motion.h2>
                  </div>

                  {targets ? (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                        className="rounded-3xl px-5 py-5 text-center"
                        style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.14), rgba(34,211,238,0.08))', border: '1px solid rgba(168,85,247,0.3)' }}
                      >
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Daily calories</p>
                        <p className="text-5xl font-black tabular-nums"
                          style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                          {targets.kcal.toLocaleString()}
                        </p>
                        <p className="text-white/30 text-xs mt-1">kcal</p>
                      </motion.div>

                      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                        className="flex gap-4">
                        <MacroBar label="Protein" value={targets.protein} max={targets.protein} color="#22D3EE" />
                        <MacroBar label="Carbs" value={targets.carbs} max={targets.carbs} color="#A855F7" />
                        <MacroBar label="Fat" value={targets.fat} max={targets.fat} color="#f97316" />
                      </motion.div>

                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="text-white/30 text-xs text-center">
                        Track your intake in the Diet section to hit these targets daily.
                      </motion.p>
                    </>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="space-y-3">
                      {[
                        { icon: '📊', text: 'Calorie and macro targets', desc: 'Calculated from your profile' },
                        { icon: '📷', text: 'Food scanner', desc: 'Log meals with your camera' },
                        { icon: '📈', text: 'Daily tracking', desc: 'Stay on top of your nutrition' },
                      ].map(({ icon, text, desc }) => (
                        <div key={text} className="flex items-center gap-4 px-4 py-3.5 rounded-2xl"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span className="text-xl">{icon}</span>
                          <div>
                            <p className="text-white/75 text-sm font-semibold">{text}</p>
                            <p className="text-white/35 text-xs">{desc}</p>
                          </div>
                        </div>
                      ))}
                      <p className="text-white/25 text-xs text-center pt-1">Set up your nutrition targets in the Diet section.</p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── Slide 3: Ready ─────────────────────────────────────── */}
              {slideIdx === 3 && (
                <div className="text-center space-y-7">
                  <motion.div
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 16 }}
                    className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-5xl"
                    style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(168,85,247,0.2))', border: '1px solid rgba(34,211,238,0.4)', boxShadow: '0 0 40px rgba(34,211,238,0.2)' }}
                  >
                    🚀
                  </motion.div>

                  <div>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                      className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#22D3EE' }}>
                      You're set
                    </motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                      className="text-4xl font-black text-white tracking-tight mb-3">
                      Time to train.
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}
                      className="text-white/40 text-base leading-relaxed">
                      Your workout plan, AI coach, and nutrition tracker are ready. Let's make it count.
                    </motion.p>
                  </div>

                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                    className="grid grid-cols-2 gap-2.5">
                    {[
                      { icon: '📋', label: 'Workout Plan' },
                      { icon: '🤖', label: 'KAI Coach' },
                      { icon: '🥗', label: 'Nutrition' },
                      { icon: '📈', label: 'Progress' },
                    ].map(({ icon, label }) => (
                      <div key={label} className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-lg">{icon}</span>
                        <span className="text-white/65 text-sm font-medium">{label}</span>
                      </div>
                    ))}
                  </motion.div>

                  {countdown !== null && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                      <button
                        onClick={() => navigate('/history', { replace: true })}
                        className="w-full py-4 rounded-2xl text-base font-black transition-all active:scale-[0.97]"
                        style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
                      >
                        {countdown > 0 ? `Starting in ${countdown}...` : "Let's go"}
                      </button>
                    </motion.div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation footer */}
        <div className="pt-8 space-y-5">
          <Dots total={TOTAL_SLIDES} current={slideIdx} onDot={goTo} />

          {!isLast && (
            <div className="flex gap-3">
              {slideIdx > 0 && (
                <button
                  onClick={prev}
                  className="px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  Back
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
              >
                {slideIdx === 0 ? 'See your plan' : slideIdx === 1 ? 'Check nutrition' : 'Almost there'}
              </button>
            </div>
          )}

          {isLast && slideIdx === TOTAL_SLIDES - 1 && countdown === null && (
            <button
              onClick={() => navigate('/history', { replace: true })}
              className="w-full py-4 rounded-2xl text-base font-black transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
            >
              Open My Plan
            </button>
          )}
        </div>

      </div>
    </main>
  )
}
