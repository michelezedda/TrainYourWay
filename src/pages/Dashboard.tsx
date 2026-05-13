import { useState, useMemo } from 'react'
import { HiChevronDown, HiChevronRight, HiArrowNarrowRight } from 'react-icons/hi'
import { Link, useNavigate } from 'react-router-dom'
import { id } from '@instantdb/react'
import GlassCard from '@/components/GlassCard'
import ExerciseModal from '@/components/ExerciseModal'
import { WorkoutDayView } from '@/components/PlanView'
import { buildPlanComponents } from '@/lib/planComponents'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { calcStreak } from '@/lib/streaks'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'

const DAILY_GOAL = 8

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getGreeting(name: string | undefined): string {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const first = name?.trim().split(' ')[0]
  return first ? `Good ${period}, ${first}!` : `Good ${period}!`
}

interface MiniStreakCardProps {
  label: string
  emoji: string
  streak: number
  gradient: string
}

function MiniStreakCard({ label, emoji, streak, gradient }: MiniStreakCardProps) {
  const alive = streak > 0
  return (
    <div className="flex flex-col items-center gap-1 py-3.5">
      <span className="text-base leading-none mb-0.5">{emoji}</span>
      <span
        className="text-2xl font-black tabular-nums leading-none"
        style={
          alive
            ? { background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
            : { color: 'rgba(255,255,255,0.18)' }
        }
      >
        {streak}
      </span>
      <span className="text-[9px] text-white/30 font-medium uppercase tracking-wide leading-none mt-0.5">
        {label}
      </span>
    </div>
  )
}

function GlassIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="17" height="24" viewBox="0 0 17 24" fill="none">
      <path
        d="M2 2 L15 2 L12.5 21 L4.5 21 Z"
        fill={filled ? 'rgba(34,211,238,0.28)' : 'rgba(255,255,255,0.04)'}
        stroke={filled ? 'rgba(34,211,238,0.65)' : 'rgba(255,255,255,0.13)'}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <line
        x1="2" y1="2" x2="15" y2="2"
        stroke={filled ? 'rgba(34,211,238,0.9)' : 'rgba(255,255,255,0.2)'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlanPreview({
  planId, planText, onExerciseClick,
}: {
  planId: string
  planText: string
  onExerciseClick: (name: string) => void
}) {
  const [weights, setWeightsState] = useState<Record<string, string>>(() => getWeights(planId))

  const handleWeightChange = useMemo(
    () => (exercise: string, value: string) => {
      setWeightsState(prev => ({ ...prev, [exercise]: value }))
      setWeight(planId, exercise, value)
    },
    [planId],
  )

  const components = useMemo(
    () => buildPlanComponents(onExerciseClick, planId, weights, handleWeightChange),
    // weights intentionally omitted — ExerciseTableCard uses local state after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, onExerciseClick, handleWeightChange],
  )

  return (
    <WorkoutDayView
      plan={planText}
      planComponents={components}
    />
  )
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

export default function Dashboard() {
  const today = toDateStr(new Date())
  const userId = getUserId()
  const navigate = useNavigate()

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [planExpanded, setPlanExpanded] = useState(true)

  const { data } = db.useQuery({
    workoutPlans: { $: { where: { userId } } },
    mealEntries: { $: { where: { userId } } },
    workoutCompletions: { $: { where: { userId } } },
    waterLogs: { $: { where: { userId } } },
    userProfiles: { $: { where: { userId } } },
  })

  const allPlans = (data?.workoutPlans ?? []) as Array<{ id: string; plan: string; userName: string; fitnessLevel: string; goals: string; equipment: string; createdAt: number }>
  const mealEntries = (data?.mealEntries ?? []) as Array<{ date: string; protein?: number }>
  const completions = (data?.workoutCompletions ?? []) as Array<{ date: string }>
  const waterLogs = (data?.waterLogs ?? []) as Array<{ id: string; date: string; glasses: number }>
  const userProfile = ((data?.userProfiles ?? []) as Array<{ id: string; name?: string }>)[0]

  const latestPlan = useMemo(
    () => [...allPlans].sort((a, b) => b.createdAt - a.createdAt)[0],
    [allPlans],
  )

  const parsedGoals = useMemo(() => {
    try { return JSON.parse(latestPlan?.goals ?? '[]') as string[] }
    catch { return [] }
  }, [latestPlan?.goals])

  const mealDates = useMemo(() => [...new Set(mealEntries.map(e => e.date))], [mealEntries])
  const workoutDates = useMemo(() => [...new Set(completions.map(e => e.date))], [completions])

  const hydratedDates = useMemo(
    () => [...new Set(waterLogs.filter(w => w.glasses >= DAILY_GOAL).map(w => w.date))],
    [waterLogs],
  )

  const nutritionProfile = useMemo(() => getNutritionProfile(), [])
  const targets = useMemo(
    () => nutritionProfile ? calculateTargets(nutritionProfile) : { kcal: 2000, protein: 150, carbs: 200, fat: 65 },
    [nutritionProfile],
  )

  const proteinHitDates = useMemo(() => {
    const byDate = new Map<string, number>()
    mealEntries.forEach(e => byDate.set(e.date, (byDate.get(e.date) ?? 0) + (e.protein ?? 0)))
    return [...new Set(
      [...byDate.entries()]
        .filter(([, g]) => targets.protein > 0 && g >= targets.protein * 0.9)
        .map(([d]) => d),
    )]
  }, [mealEntries, targets.protein])

  const mealStreak = calcStreak(mealDates, today)
  const workoutStreak = calcStreak(workoutDates, today)
  const hydrationStreak = calcStreak(hydratedDates, today)
  const proteinStreak = calcStreak(proteinHitDates, today)

  const todayWaterLog = waterLogs.find(w => w.date === today)
  const glasses = todayWaterLog?.glasses ?? 0
  const alreadyLoggedToday = workoutDates.includes(today)

  const setGlasses = async (next: number) => {
    const clamped = Math.max(0, Math.min(next, 16))
    if (todayWaterLog) {
      await db.transact(db.tx.waterLogs[todayWaterLog.id].update({ glasses: clamped }))
    } else if (clamped > 0) {
      await db.transact(db.tx.waterLogs[id()].update({ userId, date: today, glasses: clamped, createdAt: Date.now() }))
    }
  }

  const logWorkout = async () => {
    if (alreadyLoggedToday) return
    await db.transact(db.tx.workoutCompletions[id()].update({ userId, date: today, createdAt: Date.now() }))
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {selectedExercise && (
        <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">{getGreeting(userProfile?.name)}</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {latestPlan ? "Here's your day at a glance." : "Let's get you started."}
        </p>
      </div>

      {latestPlan ? (
        <div className="space-y-3">
          {/* Plan hero */}
          <GlassCard padding={false}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">Current Plan</p>
                <span className="text-[10px] text-white/25 flex-shrink-0">
                  {new Date(latestPlan.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <p className="text-base font-bold text-white/85 capitalize mb-3">{latestPlan.fitnessLevel} level</p>
              {parsedGoals.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {parsedGoals.map(g => (
                    <span
                      key={g}
                      className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                      style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {(() => {
                const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false
                const daysUntilEvolve = latestPlan && !canEvolve
                  ? Math.ceil((FOUR_WEEKS_MS - (Date.now() - latestPlan.createdAt)) / (24 * 60 * 60 * 1000))
                  : 0
                return (
                  <div className="flex gap-2">
                    <Link
                      to="/history"
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-center transition-all active:scale-[0.97]"
                      style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
                    >
                      View Plan
                    </Link>
                    <button
                      onClick={() => {
                        if (!canEvolve || !latestPlan) { return }
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
                      title={canEvolve ? 'Evolve your plan' : `Evolve unlocks in ${daysUntilEvolve} day${daysUntilEvolve !== 1 ? 's' : ''}`}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-center transition-all active:scale-[0.97]"
                      style={canEvolve
                        ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.09)' }
                        : { background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed' }
                      }
                    >
                      {canEvolve ? 'Evolve' : `Evolve (${daysUntilEvolve}d)`}
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* Plan expand/collapse toggle */}
            <button
              onClick={() => setPlanExpanded(e => !e)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.07)', color: planExpanded ? 'rgba(255,255,255,0.35)' : 'rgba(168,85,247,0.7)' }}
            >
              <HiChevronDown
                className={`w-3 h-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`}
              />
              <span className="text-[11px] font-medium">
                {planExpanded ? 'Collapse plan' : 'Show plan'}
              </span>
            </button>
          </GlassCard>

          {/* Inline plan content */}
          {planExpanded && latestPlan.plan && (
            <GlassCard>
              <p className="text-white/30 text-xs mb-4 flex items-center gap-1.5">
                <span className="text-purple-400">▶</span>
                Tap any exercise for a guide. Log your weights below.
              </p>
              <PlanPreview
                planId={latestPlan.id}
                planText={latestPlan.plan}
                onExerciseClick={setSelectedExercise}
              />
            </GlassCard>
          )}

          {/* 4-streak grid */}
          <GlassCard padding={false}>
            <div className="grid grid-cols-4 divide-x divide-white/[0.07]">
              <MiniStreakCard label="Meals" emoji="🍽️" streak={mealStreak} gradient="linear-gradient(135deg,#A855F7,#ec4899)" />
              <MiniStreakCard label="Workouts" emoji="⚡" streak={workoutStreak} gradient="linear-gradient(135deg,#22D3EE,#34d399)" />
              <MiniStreakCard label="Water" emoji="💧" streak={hydrationStreak} gradient="linear-gradient(135deg,#22D3EE,#06b6d4)" />
              <MiniStreakCard label="Protein" emoji="🔥" streak={proteinStreak} gradient="linear-gradient(135deg,#f97316,#facc15)" />
            </div>
          </GlassCard>

          {/* Today row: workout + water */}
          <GlassCard padding={false}>
            <div className="divide-y divide-white/[0.07]">
              {/* Workout log */}
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">🏋️</span>
                  <span className="text-sm font-medium text-white/70">Workout</span>
                </div>
                <button
                  onClick={() => void logWorkout()}
                  disabled={alreadyLoggedToday}
                  className="text-xs font-semibold px-4 py-1.5 rounded-xl transition-all active:scale-[0.97] disabled:cursor-not-allowed"
                  style={alreadyLoggedToday
                    ? { background: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                    : { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }
                  }
                >
                  {alreadyLoggedToday ? '✓ Logged today' : 'Log workout'}
                </button>
              </div>

              {/* Water tracker - glass icons */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">💧</span>
                    <span className="text-sm font-medium text-white/70">Water</span>
                  </div>
                  <span
                    className="text-xs tabular-nums font-semibold"
                    style={glasses >= DAILY_GOAL
                      ? { background: 'linear-gradient(135deg,#22D3EE,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                      : { color: 'rgba(255,255,255,0.3)' }
                    }
                  >
                    {glasses}/{DAILY_GOAL} glasses
                  </span>
                </div>
                <div className="flex items-end gap-1.5">
                  {Array.from({ length: DAILY_GOAL }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => void setGlasses(glasses === i + 1 ? i : i + 1)}
                      className="transition-all duration-150 active:scale-90 hover:scale-105"
                      aria-label={`Set ${i + 1} glass${i > 0 ? 'es' : ''}`}
                    >
                      <GlassIcon filled={i < glasses} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Quick links */}
          <GlassCard padding={false}>
            <div className="divide-y divide-white/[0.07]">
              {[
                { to: '/diet', emoji: '🍽️', label: 'Diet Log', sub: 'Track meals and macros' },
                { to: '/machine', emoji: '🏋️', label: 'Machine Guide', sub: 'Photo any gym machine' },
                { to: '/community', emoji: '🏆', label: 'Community', sub: 'Leaderboard and finds' },
                { to: '/chat', emoji: '🤖', label: 'Ask Kai', sub: 'Your AI fitness coach' },
              ].map(({ to, emoji, label, sub }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between px-4 py-3.5 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-white/80">{label}</p>
                      <p className="text-[11px] text-white/35">{sub}</p>
                    </div>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : (
        <div className="space-y-3">
          {/* No-plan primary CTA */}
          <div
            className="rounded-3xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(34,211,238,0.05) 100%)', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            <div className="text-4xl mb-3">🏋️</div>
            <h2 className="text-lg font-bold text-white/90 mb-1">Build your first plan</h2>
            <p className="text-sm text-white/45 leading-relaxed mb-5 max-w-xs mx-auto">
              Answer a few questions about your goals and equipment. Get a personalised workout and nutrition plan in seconds.
            </p>
            <Link
              to="/questionnaire"
              className="btn-primary w-full flex items-center justify-center gap-2 mb-3"
            >
              Generate My Plan
              <HiArrowNarrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/import"
              className="block w-full py-2.5 rounded-2xl text-sm font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              Import an existing plan
            </Link>
          </div>

          {/* Kai intro */}
          <GlassCard padding={false}>
            <div className="p-4 flex items-start gap-3">
              <img src="/kai-avatar.svg" alt="Kai" className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/80 mb-1">Meet Kai, your AI coach</p>
                <p className="text-xs text-white/45 leading-relaxed mb-3">
                  Ask anything about training, nutrition, or recovery. Available any time.
                </p>
                <Link
                  to="/chat"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
                >
                  Chat with Kai
                  <HiChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </GlassCard>

          {/* Feature highlights */}
          <GlassCard padding={false}>
            <div className="divide-y divide-white/[0.07]">
              {[
                { to: '/diet', emoji: '🥗', label: 'Nutrition tracking', sub: 'Log meals, scan barcodes, hit macros' },
                { to: '/machine', emoji: '🏋️', label: 'Machine Guide', sub: 'Photo any gym machine for instructions' },
                { to: '/scanner', emoji: '📷', label: 'Food scanner', sub: 'Scan any product for nutrition info' },
              ].map(({ to, emoji, label, sub }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between px-4 py-3.5 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-white/80">{label}</p>
                      <p className="text-[11px] text-white/35">{sub}</p>
                    </div>
                  </div>
                  <HiChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </main>
  )
}
