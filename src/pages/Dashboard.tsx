import { useState, useMemo, useEffect } from 'react'
import { HiArrowNarrowRight } from 'react-icons/hi'
import { Link, useNavigate } from 'react-router-dom'
import { id } from '@instantdb/react'
import ExerciseModal from '@/components/ExerciseModal'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'

const DAILY_GOAL = 8
const ML_PER_GLASS = 250
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getGreeting(name: string | undefined): string {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const first = name?.trim().split(' ')[0]
  return first ? `Good ${period}, ${first}!` : `Good ${period}!`
}

function getWeeklyWorkoutDays(planText: string): number {
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  const lines = planText.split('\n')
  let workoutDays = 0
  let inSection = false
  let sectionIsRest = false

  const commitSection = () => {
    if (inSection && !sectionIsRest) workoutDays++
    inSection = false
    sectionIsRest = false
  }

  for (const line of lines) {
    const lower = line.toLowerCase()
    const isHeading = line.startsWith('#') || /^\*\*Day \d+/i.test(line.trim())
    const hasWeekday = weekdays.some(d => lower.includes(d))

    if (isHeading && hasWeekday) {
      commitSection()
      inSection = true
      sectionIsRest = /\brest\b/.test(lower) || lower.includes('recovery')
    } else if (inSection) {
      if (isHeading && !hasWeekday) {
        commitSection()
      } else if (lower.includes('rest day') || lower.includes('active recovery')) {
        sectionIsRest = true
      }
    }
  }
  commitSection()

  return workoutDays > 0 ? workoutDays : 5
}

function getTodayWorkout(planText: string): { dayName: string; exercises: string[] } | null {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = weekdays[new Date().getDay()]
  const lines = planText.split('\n')
  let inSection = false
  const exercises: string[] = []
  let dayName = ''

  for (const line of lines) {
    const lower = line.toLowerCase()
    const isHeading = line.startsWith('#') || /^\*\*Day \d+/i.test(line.trim())
    if (isHeading && lower.includes(todayName)) {
      inSection = true
      dayName = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/Day \d+[:\s-]*/i, '').trim()
      continue
    }
    if (inSection) {
      if (isHeading && !lower.includes(todayName)) break
      if (lower.includes('rest day') || lower.includes('active recovery')) {
        exercises.push('Rest Day')
        break
      }
      const m = line.match(/^\*\*\d+\.\s*(.+?)(\*|$)/)
      if (m) exercises.push(m[1].trim())
    }
  }

  return dayName ? { dayName, exercises: exercises.slice(0, 4) } : null
}

interface MiniRingProps {
  pct: number
  title: string
  subtitle: string
  ringId: string
  color1: string
  color2: string
}

function MiniRing({ pct, title, subtitle, ringId, color1, color2 }: MiniRingProps) {
  const SIZE = 72
  const STROKE = 7
  const r = (SIZE - STROKE) / 2
  const circ = 2 * Math.PI * r
  const [animPct, setAnimPct] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(Math.min(1, pct)), 80)
    return () => clearTimeout(t)
  }, [pct])

  const filled = circ * animPct

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={ringId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color1} />
              <stop offset="100%" stopColor={color2} />
            </linearGradient>
          </defs>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none"
            stroke={`url(#${ringId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={{
              strokeDasharray: `${filled} ${circ}`,
              transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.2,0.64,1)',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[13px] font-black text-white tabular-nums leading-none">
            {Math.round(animPct * 100)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-white/65 leading-none">{title}</p>
        <p className="text-[10px] text-white/30 mt-0.5 leading-none">{subtitle}</p>
      </div>
    </div>
  )
}

function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const remaining = Math.max(0, target - eaten)
  const pct = Math.min(1, eaten / Math.max(1, target))
  const cx = 60, cy = 60, r = 50
  const startAngle = 135
  const sweepDeg = 270
  const toRad = (d: number) => (d * Math.PI) / 180
  const arcPath = (start: number, sweep: number) => {
    const end = start + sweep
    const x1 = cx + r * Math.cos(toRad(start))
    const y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(end))
    const y2 = cy + r * Math.sin(toRad(end))
    const large = sweep > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-xl font-black text-white tabular-nums">{eaten.toLocaleString()}</p>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">Eaten</p>
      </div>
      <div className="relative flex-shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
          <path d={arcPath(startAngle, sweepDeg)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" strokeLinecap="round" />
          {pct > 0.005 && (
            <path d={arcPath(startAngle, sweepDeg * pct)} fill="none" stroke="url(#calGrad)" strokeWidth="11" strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[22px] font-black text-white leading-none tabular-nums">{remaining.toLocaleString()}</p>
          <p className="text-[10px] text-white/38 font-medium mt-1">kcal left</p>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xl font-black text-white tabular-nums">0</p>
        <p className="text-[11px] text-white/40 font-medium mt-0.5">Burned</p>
      </div>
    </div>
  )
}

function MacroBar({ label, current, max, gradient }: { label: string; current: number; max: number; gradient: string }) {
  const pct = Math.min(1, current / Math.max(1, max))
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-white/38 font-medium text-center mb-1.5">{label}</p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct * 100}%`, background: gradient }} />
      </div>
      <p className="text-[10px] text-white/35 text-center mt-1.5 tabular-nums">{Math.round(current)} / {max}g</p>
    </div>
  )
}

const MOODS = [
  { emoji: '😔', label: 'Low', anim: 'mood-anim-low', dur: '0.7s' },
  { emoji: '😐', label: 'Meh', anim: 'mood-anim-meh', dur: '0.5s' },
  { emoji: '🙂', label: 'OK', anim: 'mood-anim-ok', dur: '0.5s' },
  { emoji: '😊', label: 'Good', anim: 'mood-anim-good', dur: '0.6s' },
  { emoji: '🤩', label: 'Great', anim: 'mood-anim-great', dur: '0.65s' },
]

function GlassIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
      <path
        d="M3.5 3 L18.5 3 L15.8 26.5 L6.2 26.5 Z"
        fill={filled ? 'rgba(34,211,238,0.22)' : 'rgba(255,255,255,0.04)'}
        stroke={filled ? 'rgba(34,211,238,0.65)' : 'rgba(255,255,255,0.11)'}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <line x1="3.5" y1="3" x2="18.5" y2="3"
        stroke={filled ? 'rgba(34,211,238,0.9)' : 'rgba(255,255,255,0.18)'}
        strokeWidth="1.8" strokeLinecap="round" />
      {filled && (
        <path d="M6.8 22.5 L15.2 22.5" stroke="rgba(34,211,238,0.25)" strokeWidth="1.2" strokeLinecap="round" />
      )}
    </svg>
  )
}

function FeatureCard({ to, emoji, label, sub, accent }: { to: string; emoji: string; label: string; sub: string; accent: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-start gap-3 p-4 rounded-3xl transition-all active:scale-[0.95]"
      style={{
        background: `rgba(${accent},0.07)`,
        border: `1px solid rgba(${accent},0.18)`,
        minHeight: 120,
      }}
    >
      <span className="text-3xl leading-none">{emoji}</span>
      <div>
        <p className="text-sm font-bold text-white/85">{label}</p>
        <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const today = toDateStr(new Date())
  const userId = getUserId()
  const navigate = useNavigate()

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [mood, setMood] = useState<number | null>(() => {
    try { return JSON.parse(localStorage.getItem(`mood_${today}`) ?? 'null') as number | null }
    catch { return null }
  })
  const [moodAnim, setMoodAnim] = useState<{ idx: number; tick: number } | null>(null)
  const [waterCelebrating, setWaterCelebrating] = useState(false)

  const saveMood = (idx: number) => {
    if (mood === idx) return
    setMood(idx)
    localStorage.setItem(`mood_${today}`, JSON.stringify(idx))
  }

  const handleMoodClick = (i: number) => {
    if (mood === i) return
    setMoodAnim(prev => ({ idx: i, tick: (prev?.tick ?? 0) + 1 }))
    setTimeout(() => setMoodAnim(null), 700)
    saveMood(i)
  }

  const { data } = db.useQuery({
    workoutPlans: { $: { where: { userId } } },
    mealEntries: { $: { where: { userId } } },
    workoutCompletions: { $: { where: { userId } } },
    waterLogs: { $: { where: { userId } } },
    userProfiles: { $: { where: { userId } } },
  })

  const allPlans = (data?.workoutPlans ?? []) as Array<{ id: string; plan: string; userName: string; fitnessLevel: string; goals: string; equipment: string; createdAt: number }>
  const mealEntries = (data?.mealEntries ?? []) as Array<{ date: string; kcal?: number; protein?: number; carbs?: number; fat?: number }>
  const completions = (data?.workoutCompletions ?? []) as Array<{ date: string }>
  const waterLogs = (data?.waterLogs ?? []) as Array<{ id: string; date: string; glasses: number }>
  const userProfile = ((data?.userProfiles ?? []) as Array<{ id: string; name?: string }>)[0]

  const latestPlan = useMemo(() => [...allPlans].sort((a, b) => b.createdAt - a.createdAt)[0], [allPlans])

  const nutritionProfile = useMemo(() => getNutritionProfile(), [])
  const targets = useMemo(
    () => nutritionProfile ? calculateTargets(nutritionProfile) : { kcal: 2000, protein: 150, carbs: 200, fat: 65 },
    [nutritionProfile],
  )

  const todayMeals = useMemo(() => mealEntries.filter(e => e.date === today), [mealEntries, today])
  const todayKcal = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.kcal ?? 0), 0)), [todayMeals])
  const todayProtein = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.protein ?? 0), 0)), [todayMeals])
  const todayCarbs = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.carbs ?? 0), 0)), [todayMeals])
  const todayFat = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.fat ?? 0), 0)), [todayMeals])

  const workoutDates = useMemo(() => [...new Set(completions.map(e => e.date))], [completions])

  // Workouts done since Monday of this week
  const weekWorkouts = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    monday.setHours(0, 0, 0, 0)
    const mondayStr = toDateStr(monday)
    return workoutDates.filter(d => d >= mondayStr && d <= today).length
  }, [workoutDates, today])

  // Average macro completion (0-1) across protein, carbs, fat
  const macroScore = useMemo(() => {
    if (targets.protein <= 0) return 0
    return (
      Math.min(1, todayProtein / targets.protein) +
      Math.min(1, todayCarbs / targets.carbs) +
      Math.min(1, todayFat / targets.fat)
    ) / 3
  }, [todayProtein, todayCarbs, todayFat, targets])

  const todayWaterLog = waterLogs.find(w => w.date === today)
  const glasses = todayWaterLog?.glasses ?? 0
  const liters = ((glasses * ML_PER_GLASS) / 1000).toFixed(1)
  const alreadyLoggedToday = workoutDates.includes(today)

  const setGlasses = async (next: number) => {
    const clamped = Math.max(0, Math.min(next, 16))
    if (todayWaterLog) {
      await db.transact(db.tx.waterLogs[todayWaterLog.id].update({ glasses: clamped }))
    } else if (clamped > 0) {
      await db.transact(db.tx.waterLogs[id()].update({ userId, date: today, glasses: clamped, createdAt: Date.now() }))
    }
  }

  const handleGlassClick = (i: number) => {
    const next = glasses === i + 1 ? i : i + 1
    if (next >= DAILY_GOAL && glasses < DAILY_GOAL) {
      setWaterCelebrating(true)
      setTimeout(() => setWaterCelebrating(false), 1100)
    }
    void setGlasses(next)
  }

  const logWorkout = async () => {
    if (alreadyLoggedToday || todayIsRest) return
    await db.transact(db.tx.workoutCompletions[id()].update({ userId, date: today, createdAt: Date.now() }))
  }

  const todayWorkout = useMemo(
    () => latestPlan?.plan ? getTodayWorkout(latestPlan.plan) : null,
    [latestPlan?.plan],
  )

  const weeklyWorkoutDays = useMemo(
    () => latestPlan?.plan ? getWeeklyWorkoutDays(latestPlan.plan) : 5,
    [latestPlan?.plan],
  )

  const todayIsRest = !!latestPlan && (!todayWorkout || todayWorkout.exercises[0] === 'Rest Day')

  const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false

  return (
    <main className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto px-4 pt-6 pb-nav space-y-3.5 animate-fade-in">
      {selectedExercise && (
        <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      {/* Greeting */}
      <div className="mb-2">
        <h1 className="text-3xl font-black tracking-tight gradient-text">{getGreeting(userProfile?.name)}</h1>
        <p className="text-white/40 text-sm mt-1 font-medium">
          {latestPlan ? "Here's your day at a glance." : "Let's get you started."}
        </p>
      </div>

      {/* Daily progress rings */}
      <div className="glass-card p-4">
        <div className="flex justify-between items-start">
          <MiniRing
            ringId="ring-cal"
            pct={todayKcal / Math.max(1, targets.kcal)}
            title="Calories"
            subtitle={`${todayKcal} kcal`}
            color1="#A855F7"
            color2="#ec4899"
          />
          <MiniRing
            ringId="ring-week"
            pct={weekWorkouts / Math.max(1, weeklyWorkoutDays)}
            title="Workouts"
            subtitle={`${weekWorkouts}/${weeklyWorkoutDays} this week`}
            color1="#22D3EE"
            color2="#34d399"
          />
          <MiniRing
            ringId="ring-water"
            pct={glasses / DAILY_GOAL}
            title="Water"
            subtitle={`${liters}L today`}
            color1="#06b6d4"
            color2="#22D3EE"
          />
          <MiniRing
            ringId="ring-macro"
            pct={macroScore}
            title="Macros"
            subtitle="balance"
            color1="#f97316"
            color2="#facc15"
          />
        </div>
      </div>

      {/* Diet Summary Card */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Daily Calories</p>
          <Link to="/diet" className="text-xs font-semibold" style={{ color: '#c084fc' }}>Details</Link>
        </div>
        <CalorieRing eaten={todayKcal} target={targets.kcal} />
        <div className="flex gap-3 mt-5">
          <MacroBar label="Carbs" current={todayCarbs} max={targets.carbs} gradient="linear-gradient(90deg,#A855F7,#ec4899)" />
          <MacroBar label="Protein" current={todayProtein} max={targets.protein} gradient="linear-gradient(90deg,#22D3EE,#34d399)" />
          <MacroBar label="Fat" current={todayFat} max={targets.fat} gradient="linear-gradient(90deg,#f97316,#facc15)" />
        </div>
      </div>

      {/* Today's Workout Card */}
      {latestPlan ? (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Today's Workout</p>
          </div>
          {todayWorkout ? (
            <>
              <p className="text-sm font-bold text-white/85 mb-3">{todayWorkout.dayName}</p>
              {todayWorkout.exercises[0] === 'Rest Day' ? (
                <p className="text-sm text-white/38 mb-4">Active recovery or rest - recharge today.</p>
              ) : todayWorkout.exercises.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {todayWorkout.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: 'rgba(168,85,247,0.14)', color: '#c084fc' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm text-white/65">{ex}</span>
                    </div>
                  ))}
                  {todayWorkout.exercises.length === 4 && (
                    <p className="text-[11px] text-white/28 pl-7">+ more exercises in full plan</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/38 mb-4">Check the full plan for today's details.</p>
              )}
            </>
          ) : (
            <div className="mb-4">
              <p className="text-sm text-white/38">Rest day - recover and recharge.</p>
            </div>
          )}
          <div className="flex gap-2">
            <Link to="/history">
              <button
                onClick={() => {
                  if (!canEvolve || !latestPlan) return
                  navigate('/reevaluate', {
                    state: {
                      planId: latestPlan.id,
                      originalPlan: latestPlan.plan,
                      userName: latestPlan.userName,
                      fitnessLevel: latestPlan.fitnessLevel ?? '',
                      goals: latestPlan.goals ?? '[]',
                      equipment: latestPlan.equipment ?? '[]',
                    },
                  })
                }}
                className="px-4 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] text-[#c084fc]"
                style={
                  {
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.4)'
                  }
                }
              >
                View Plan
              </button>
            </Link>
            <button
              onClick={() => void logWorkout()}
              disabled={alreadyLoggedToday || todayIsRest}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed"
              style={alreadyLoggedToday
                ? { background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.22)' }
                : todayIsRest
                  ? { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.07)' }
                  : { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }
              }
            >
              {alreadyLoggedToday ? '✓ Logged today' : todayIsRest ? 'Rest day' : 'Log workout'}
            </button>
          </div>
        </div>
      ) : (
        /* No-plan CTA */
        <div className="rounded-3xl overflow-hidden" style={{ border: '1px solid rgba(168,85,247,0.22)' }}>
          <div
            className="px-6 pt-8 pb-6 text-center"
            style={{ background: 'linear-gradient(160deg, rgba(168,85,247,0.12) 0%, rgba(34,211,238,0.06) 100%)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))', border: '1px solid rgba(168,85,247,0.3)' }}
            >
              🏋️
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">Build your first plan</h2>
            <p className="text-sm text-white/45 leading-relaxed mb-6 max-w-xs mx-auto font-medium">
              Answer a few questions about your goals and equipment. Get a personalised plan in seconds.
            </p>
            <Link to="/questionnaire" className="btn-primary w-full flex items-center justify-center gap-2 mb-3">
              Generate My Plan
              <HiArrowNarrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/import"
              className="block w-full py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              Import an existing plan
            </Link>
          </div>
        </div>
      )}

      {/* Mood + Hydration: stacked on mobile, side-by-side on md */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">

        {/* Mood Tracker */}
        <div className="glass-card p-5">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">How are you feeling today?</p>
          <div className="flex gap-2">
            {MOODS.map((m, i) => {
              const isAnimating = moodAnim?.idx === i
              const isSelected = mood === i
              return (
                <button
                  key={isAnimating ? `${i}-${moodAnim!.tick}` : i}
                  onClick={() => handleMoodClick(i)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all duration-200"
                  style={{
                    background: isSelected ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                    border: isSelected ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    boxShadow: isSelected ? '0 0 16px rgba(168,85,247,0.15)' : 'none',
                    animation: isAnimating ? `mood-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both` : undefined,
                    transformOrigin: 'center bottom',
                    cursor: isSelected ? 'default' : 'pointer',
                  }}
                >
                  <span
                    className="text-2xl leading-none"
                    style={{
                      display: 'inline-block',
                      animation: isAnimating ? `${m.anim} ${m.dur} ease both` : undefined,
                    }}
                  >
                    {m.emoji}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: isSelected ? '#c084fc' : 'rgba(255,255,255,0.35)' }}>
                    {m.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Hydration Card */}
        <div
          className="glass-card p-5"
          style={{
            transition: 'box-shadow 0.35s ease',
            ...(waterCelebrating ? {
              boxShadow: '0 8px 32px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.13), inset 0 -1px 0 rgba(0,0,0,0.15), 0 0 0 1.5px rgba(34,211,238,0.55), 0 0 36px rgba(34,211,238,0.22)',
            } : {}),
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Hydration</p>
            <div className="flex items-baseline gap-1">
              <span
                className="text-base font-black tabular-nums"
                style={glasses >= DAILY_GOAL
                  ? { background: 'linear-gradient(135deg,#22D3EE,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                  : { color: 'rgba(255,255,255,0.55)' }
                }
              >
                {liters}L
              </span>
              <span className="text-xs text-white/25">/ 2.0L</span>
            </div>
          </div>
          <div className="flex justify-between gap-1">
            {Array.from({ length: DAILY_GOAL }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleGlassClick(i)}
                className="flex-1 flex justify-center py-1 active:scale-90 hover:scale-105"
                aria-label={`Set ${i + 1} glass${i > 0 ? 'es' : ''}`}
                style={{
                  animation: waterCelebrating
                    ? `glass-bounce 0.55s cubic-bezier(0.34,1.56,0.64,1) ${(i * 0.07).toFixed(2)}s both`
                    : undefined,
                }}
              >
                <GlassIcon filled={i < glasses} />
              </button>
            ))}
          </div>
          <div className="mt-3.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (glasses / DAILY_GOAL) * 100)}%`, background: 'linear-gradient(90deg,#22D3EE,#34d399)' }}
            />
          </div>
        </div>

      </div>{/* end mood+hydration grid */}

      {/* Feature Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-10">
        <FeatureCard to="/scanner" emoji="📷" label="Food Scan" sub="Scan barcodes" accent="168,85,247" />
        <FeatureCard to="/machine" emoji="🏋️" label="Machine Guide" sub="Photo any machine" accent="34,211,238" />
        <FeatureCard to="/community" emoji="🏆" label="Community" sub="Leaderboard" accent="249,115,22" />
        <FeatureCard to="/chat" emoji="🤖" label="Ask Kai" sub="Your AI coach" accent="52,211,153" />
      </div>
    </main>
  )
}
