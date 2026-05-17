import { useState, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HiPencil, HiUpload, HiRefresh, HiChevronDown, HiLockClosed } from 'react-icons/hi'
import { Link, useNavigate } from 'react-router-dom'
import { id } from '@instantdb/react'
import LoadingSpinner from '@/components/LoadingSpinner'
import ExerciseModal from '@/components/ExerciseModal'
import InjuryTriage from '@/components/InjuryTriage'
import { WorkoutDayView, getWeeklyWorkoutDays, readFiredMap } from '@/components/PlanView'
import { buildPlanComponents } from '@/lib/planComponents'
import { generateDayWorkout } from '@/lib/gemini'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { type InjuryState, getInjuryState, saveInjuryState, clearInjuryState, getInjuryAdvice } from '@/lib/injuryStore'
import { useLocale } from '@/context/LocaleContext'
import { calcWeeklyStreak } from '@/lib/streaks'

// ── Types ──────────────────────────────────────────────────────────────────────

type Plan = {
  id: string; plan: string; userName: string; fitnessLevel: string
  goals: string; equipment: string; constraints: string; createdAt: number
  parentPlanId?: string; workoutDays?: string; dayOverrides?: string
}
type Completion = { id: string; date: string; createdAt: number }
type LeaderboardEntry = { id: string; workoutStreak: number; mealStreak: number; nickname: string; updatedAt: number }

// ── Constants ──────────────────────────────────────────────────────────────────

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

const ALL_WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const LEVEL_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  beginner: { bg: 'rgba(34,197,94,0.12)', color: '#86efac', border: 'rgba(34,197,94,0.3)' },
  intermediate: { bg: 'rgba(234,179,8,0.12)', color: '#fde68a', border: 'rgba(234,179,8,0.3)' },
  advanced: { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
}

// ── Utils ──────────────────────────────────────────────────────────────────────

function parseList(json: string): string[] {
  try { return JSON.parse(json) as string[] } catch { return [] }
}

function parseRecord(json: string): Record<string, string> {
  try { return JSON.parse(json) as Record<string, string> } catch { return {} }
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Walks the parentPlanId chain to return plans in chronological order (root first). */
function buildPlanChain(plans: Plan[]): Plan[] {
  const roots = plans.filter(p => !p.parentPlanId || p.parentPlanId === '')
  if (roots.length === 0) return []
  const root = roots.sort((a, b) => b.createdAt - a.createdAt)[0]
  const chain = [root]
  let current = root
  for (; ;) {
    const child = plans.find(p => p.parentPlanId === current.id)
    if (!child) break
    chain.push(child)
    current = child
  }
  return chain
}

/** Days that are NOT in the user's stored schedule (shown as blocked in the UI). */
function getBlockedDays(workoutDays: string | undefined): string[] {
  const stored = parseList(workoutDays ?? '[]')
  if (stored.length === 0) return []
  return ALL_WEEK_DAYS.filter(d => !stored.includes(d))
}

// ── Hook: plan weights ─────────────────────────────────────────────────────────

function usePlanWeights(planId: string, onExerciseClick: (name: string) => void) {
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
    // weights excluded: changes don't require new component instances
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, onExerciseClick, handleWeightChange],
  )

  return components
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PlanName({ planId, name }: { planId: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const save = async () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) {
      await db.transact(db.tx.workoutPlans[planId].update({ userName: trimmed }))
    } else {
      setDraft(name)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={e => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') { setDraft(name); setEditing(false) }
        }}
        className="font-bold text-white text-base bg-white/5 border border-purple-500/50 rounded-xl
                   px-3 py-1.5 outline-none focus:ring-1 focus:ring-purple-500/50 w-full"
        style={{ fontSize: 16 }}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(name); setEditing(true) }}
      className="font-bold text-white text-base text-left flex items-center gap-1.5 group active:scale-[0.98] transition-transform"
    >
      <span>{name}</span>
      <HiPencil className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0" />
    </button>
  )
}

/** Renders a plan with weight logging and workout-day interaction. */
function PlanDisplay({
  planId, planText, interactive = false,
  blockedDays, dayOverrides,
  onExerciseClick, onUnblockDay, onGenerateDayWorkout, onWorkoutComplete,
  weekStreak, weekWorkouts, weeklyTarget,
}: {
  planId: string
  planText: string
  interactive?: boolean
  blockedDays?: string[]
  dayOverrides?: Record<string, string>
  onExerciseClick: (name: string) => void
  onUnblockDay?: (day: string) => void
  onGenerateDayWorkout?: (day: string) => Promise<void>
  onWorkoutComplete?: (dayName: string, exerciseCount: number, setsCount: number) => void
  weekStreak?: number
  weekWorkouts?: number
  weeklyTarget?: number
}) {
  const components = usePlanWeights(planId, onExerciseClick)

  return (
    <div className={interactive ? 'px-4 pb-5' : 'px-4 pb-5 pt-4'}>
      {interactive && (
        <p className="text-white/35 text-xs pt-4 pb-3 flex items-center gap-1.5">
          <span className="text-purple-400">▶</span>
          Tap any exercise for a guide. Log weights below.
        </p>
      )}
      <WorkoutDayView
        plan={planText}
        planComponents={components}
        blockedDays={interactive ? blockedDays : undefined}
        dayWorkoutOverrides={interactive ? dayOverrides : undefined}
        onUnblockDay={interactive ? onUnblockDay : undefined}
        onGenerateDayWorkout={interactive ? onGenerateDayWorkout : undefined}
        onWorkoutComplete={interactive ? onWorkoutComplete : undefined}
        weekStreak={interactive ? weekStreak : undefined}
        weekWorkouts={interactive ? weekWorkouts : undefined}
        weeklyTarget={interactive ? weeklyTarget : undefined}
      />
    </div>
  )
}

function InjuryBanner({
  injuryState,
  advice,
  onRecovered,
}: {
  injuryState: InjuryState
  advice: ReturnType<typeof getInjuryAdvice> | null
  onRecovered: () => void
}) {
  if (!advice) return null

  return (
    <div className="mb-4 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
      <div className="px-4 pt-4 pb-3" style={{ background: 'rgba(245,158,11,0.07)' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{advice.intensity === 'rest' ? '🛑' : '⚠️'}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#fde68a' }}>Recovery Mode Active</p>
              <p className="text-xs text-white/40 capitalize">
                {injuryState.location} injury - {injuryState.severity} severity
              </p>
            </div>
          </div>
          <button
            onClick={onRecovered}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 flex-shrink-0"
            style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac' }}
          >
            I'm Recovered
          </button>
        </div>

        <p className="text-xs text-white/45 leading-relaxed mb-3">{advice.message}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-[10px] font-semibold text-red-400 mb-1.5 uppercase tracking-wider">Avoid</p>
            <ul className="space-y-0.5">
              {advice.avoid.slice(0, 3).map(item => (
                <li key={item} className="text-[11px] text-white/45 flex items-start gap-1">
                  <span className="text-red-400/60 flex-shrink-0">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
            <p className="text-[10px] font-semibold text-green-400 mb-1.5 uppercase tracking-wider">Focus</p>
            <ul className="space-y-0.5">
              {advice.focus.slice(0, 3).map(item => (
                <li key={item} className="text-[11px] text-white/45 flex items-start gap-1">
                  <span className="text-green-400/60 flex-shrink-0">✦</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function VersionHistoryList({
  versions, expandedId, onToggle, onExerciseClick, formatDateShort,
}: {
  versions: Plan[]
  expandedId: string | null
  onToggle: (id: string) => void
  onExerciseClick: (name: string) => void
  formatDateShort: (ts: number) => string
}) {
  if (versions.length === 0) return null

  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-3">Version History</p>
      <div className="space-y-2">
        {versions.map((version, i) => {
          const isExpanded = expandedId === version.id
          const isOriginal = i === versions.length - 1
          const label = isOriginal ? 'Original Plan' : `Evolution ${versions.length - 1 - i}`
          return (
            <div key={version.id} className="glass-card p-0 overflow-hidden">
              <button
                onClick={() => onToggle(version.id)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left transition-all active:bg-white/[0.02]"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOriginal ? 'bg-white/20' : 'bg-purple-400/50'}`} />
                <span className="text-white/60 text-sm font-medium flex-1">{label}</span>
                <span className="text-white/25 text-xs mr-2">{formatDateShort(version.createdAt)}</span>
                <HiChevronDown className={`w-4 h-4 text-white/25 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {isExpanded && version.plan && (
                <div className="border-t border-white/[0.07]">
                  <PlanDisplay planId={version.id} planText={version.plan} onExerciseClick={onExerciseClick} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StartOverSection({
  chainLength, confirming, loading, onRequest, onConfirm, onCancel,
}: {
  chainLength: number
  confirming: boolean
  loading: boolean
  onRequest: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!confirming) {
    return (
      <button onClick={onRequest} className="text-sm text-white/25 transition-colors hover:text-white/45">
        Start over with a new plan
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <p className="text-sm text-white/65 leading-relaxed">
        This permanently deletes your current plan{chainLength > 1 ? ` and all ${chainLength} versions` : ''}. Cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
          style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
        >
          {loading ? 'Deleting...' : 'Yes, start over'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function NoPlanState() {
  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 py-16 animate-fade-in">
      <div className="rounded-3xl overflow-hidden text-center" style={{ border: '1px solid rgba(168,85,247,0.22)' }}>
        <div
          className="px-6 pt-10 pb-8"
          style={{ background: 'linear-gradient(160deg, rgba(168,85,247,0.12) 0%, rgba(34,211,238,0.06) 100%)' }}
        >
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center text-4xl"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))', border: '1px solid rgba(168,85,247,0.3)' }}
          >
            📋
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight mb-2">No plan yet</h2>
          <p className="text-white/45 text-sm mb-7 leading-relaxed font-medium max-w-xs mx-auto">
            Create your first personalised workout plan to get started.
          </p>
          <Link to="/questionnaire" className="btn-primary inline-flex">Create My Plan</Link>
        </div>
      </div>
    </main>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function Workout() {
  const userId = getUserId()
  const navigate = useNavigate()
  const { formatDateShort, weekStart } = useLocale()

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [planExpanded, setPlanExpanded] = useState(true)
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [confirmStartOver, setConfirmStartOver] = useState(false)
  const [startingOver, setStartingOver] = useState(false)
  const [injuryState, setInjuryState] = useState<InjuryState | null>(() => getInjuryState())
  const [showTriage, setShowTriage] = useState(false)

  const { isLoading, error, data } = db.useQuery({
    workoutPlans: { $: { where: { userId }, order: { serverCreatedAt: 'desc' } } },
    workoutCompletions: { $: { where: { userId } } },
    leaderboardEntries: { $: { where: { userId } } },
  })

  const plans = (data?.workoutPlans ?? []) as Plan[]
  const completions = (data?.workoutCompletions ?? []) as Completion[]
  const leaderboardEntry = ((data?.leaderboardEntries ?? []) as LeaderboardEntry[])[0] ?? null

  const chain = useMemo(() => buildPlanChain(plans), [plans])
  const latestPlan = chain[chain.length - 1]
  const previousVersions = chain.slice(0, -1).reverse()

  const today = useMemo(todayString, [])

  const weekWorkouts = useMemo(() => Object.keys(readFiredMap()).length, [])

  const weeklyTarget = useMemo(() => {
    if (!latestPlan) return 0
    const days = parseList(latestPlan.workoutDays ?? '[]')
    return days.length > 0 ? days.length : getWeeklyWorkoutDays(latestPlan.plan)
  }, [latestPlan])

  const weekStreak = useMemo(
    () => calcWeeklyStreak(completions.map(c => c.date), weekStart, today),
    [completions, weekStart, today],
  )

  const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false
  const daysUntilEvolve = latestPlan && !canEvolve
    ? Math.ceil((FOUR_WEEKS_MS - (Date.now() - latestPlan.createdAt)) / (24 * 60 * 60 * 1000))
    : 0

  const handleWorkoutComplete = useCallback(async (_dayName: string, _exerciseCount: number, _setsCount: number) => {
    if (completions.some(c => c.date === today)) return
    const newDates = [...completions.map(c => c.date), today]
    const newStreak = calcWeeklyStreak(newDates, weekStart, today)
    const completionTx = db.tx.workoutCompletions[id()].update({ userId, date: today, createdAt: Date.now() })
    const txns = leaderboardEntry
      ? [completionTx, db.tx.leaderboardEntries[leaderboardEntry.id].update({ workoutStreak: newStreak, updatedAt: Date.now() })]
      : [completionTx]
    await db.transact(txns)
  }, [completions, today, userId, weekStart, leaderboardEntry])

  const handleEvolve = () => {
    if (!latestPlan || !canEvolve) return
    navigate('/reevaluate', {
      state: {
        planId: latestPlan.id, originalPlan: latestPlan.plan, userName: latestPlan.userName,
        fitnessLevel: latestPlan.fitnessLevel ?? '', goals: latestPlan.goals ?? '[]', equipment: latestPlan.equipment ?? '[]',
      },
    })
  }

  const handleStartOver = async () => {
    setStartingOver(true)
    try {
      if (plans.length > 0) await db.transact(plans.map(p => db.tx.workoutPlans[p.id].delete()))
      navigate('/questionnaire')
    } catch {
      setStartingOver(false)
      setConfirmStartOver(false)
    }
  }

  const handleActivateRecovery = (state: InjuryState) => {
    saveInjuryState(state)
    setInjuryState(state)
    setShowTriage(false)
  }

  const handleRecovered = () => {
    clearInjuryState()
    setInjuryState(null)
  }

  const toggleVersionExpanded = (versionId: string) =>
    setExpandedVersionId(prev => prev === versionId ? null : versionId)

  // ── Loading / error / empty ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 py-20 flex justify-center animate-fade-in">
        <LoadingSpinner size="lg" message="Loading your plan..." />
      </main>
    )
  }

  if (error) {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="glass-card p-8">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-300">Failed to load plan. Please try again later.</p>
        </div>
      </main>
    )
  }

  if (chain.length === 0) return <NoPlanState />

  // ── Derived from current plan ─────────────────────────────────────────────────

  const goals = parseList(latestPlan.goals ?? '[]')
  const dayOverrides = parseRecord(latestPlan.dayOverrides ?? '{}')
  const blockedDays = getBlockedDays(latestPlan.workoutDays)
  const lvl = LEVEL_STYLE[latestPlan.fitnessLevel] ?? null
  const injuryAdvice = injuryState ? getInjuryAdvice(injuryState) : null

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <AnimatePresence>
        {selectedExercise && (
          <ExerciseModal key={selectedExercise} name={selectedExercise} onClose={() => setSelectedExercise(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTriage && (
          <InjuryTriage onClose={() => setShowTriage(false)} onActivate={handleActivateRecovery} />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-5"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tight gradient-text">My Plan</h1>
          <p className="text-white/40 text-sm mt-1 font-medium">
            {chain.length > 1
              ? `${chain.length - 1} evolution${chain.length > 2 ? 's' : ''} from original`
              : 'Original plan'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTriage(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97]"
            style={injuryState?.active
              ? { background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.4)', color: '#fde68a' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.6)' }
            }
          >
            🩹 {injuryState?.active ? 'Injured' : 'Injured?'}
          </button>
          <Link
            to="/import"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.6)' }}
          >
            <HiUpload className="w-3.5 h-3.5" />
            Import
          </Link>
        </div>
      </motion.div>

      {injuryState?.active && (
        <InjuryBanner injuryState={injuryState} advice={injuryAdvice} onRecovered={handleRecovered} />
      )}

      {/* Current plan card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="glass-card p-0 mb-4 overflow-hidden"
      >
        <div className="p-5">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2">
            {chain.length > 1 ? `Evolution ${chain.length - 1}` : 'Current Plan'}
          </p>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <PlanName planId={latestPlan.id} name={latestPlan.userName} />
              <p className="text-white/35 text-xs mt-1">{formatDateShort(latestPlan.createdAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <button
                onClick={handleEvolve}
                disabled={!canEvolve}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97]"
                style={canEvolve
                  ? { background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'not-allowed', opacity: 0.55 }
                }
                title={canEvolve ? 'Evolve your plan' : `Unlocks in ${daysUntilEvolve} days`}
              >
                {canEvolve
                  ? <HiRefresh className="w-3.5 h-3.5" />
                  : <HiLockClosed className="w-3 h-3" />
                }
                Evolve
              </button>
              {!canEvolve && (
                <p className="text-[10px] text-white/25 text-right leading-tight">
                  Reactivates in {daysUntilEvolve}d
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {lvl && (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}
              >
                {latestPlan.fitnessLevel}
              </span>
            )}
            {goals.map(g => (
              <span
                key={g}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => setPlanExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1.5 py-3 border-t transition-colors"
          style={{ borderColor: 'rgba(255,255,255,0.07)', color: planExpanded ? 'rgba(255,255,255,0.35)' : 'rgba(168,85,247,0.7)' }}
        >
          <HiChevronDown className={`w-3.5 h-3.5 transition-transform ${planExpanded ? 'rotate-180' : ''}`} />
          <span className="text-xs font-medium">{planExpanded ? 'Collapse plan' : 'View plan'}</span>
        </button>

        {planExpanded && latestPlan.plan && (
          <div className="border-t border-white/[0.07]">
            <PlanDisplay
              planId={latestPlan.id}
              planText={latestPlan.plan}
              interactive
              blockedDays={blockedDays}
              dayOverrides={dayOverrides}
              onExerciseClick={setSelectedExercise}
              onUnblockDay={day => {
                const current = parseList(latestPlan.workoutDays ?? '[]')
                void db.transact(db.tx.workoutPlans[latestPlan.id].update({
                  workoutDays: JSON.stringify([...current.filter(d => d !== day), day]),
                }))
              }}
              onGenerateDayWorkout={async day => {
                const workoutText = await generateDayWorkout(latestPlan.plan, day)
                const newOverrides = { ...dayOverrides, [day]: workoutText }
                const current = parseList(latestPlan.workoutDays ?? '[]')
                void db.transact(db.tx.workoutPlans[latestPlan.id].update({
                  dayOverrides: JSON.stringify(newOverrides),
                  workoutDays: JSON.stringify([...current.filter(d => d !== day), day]),
                }))
              }}
              onWorkoutComplete={(dayName, exCount, sc) => void handleWorkoutComplete(dayName, exCount, sc)}
              weekStreak={weekStreak}
              weekWorkouts={weekWorkouts}
              weeklyTarget={weeklyTarget}
            />
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <VersionHistoryList
          versions={previousVersions}
          expandedId={expandedVersionId}
          onToggle={toggleVersionExpanded}
          onExerciseClick={setSelectedExercise}
          formatDateShort={formatDateShort}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.28 }}
        className="pt-4 border-t border-white/[0.08] pb-10"
      >
        <StartOverSection
          chainLength={chain.length}
          confirming={confirmStartOver}
          loading={startingOver}
          onRequest={() => setConfirmStartOver(true)}
          onConfirm={() => void handleStartOver()}
          onCancel={() => setConfirmStartOver(false)}
        />
      </motion.div>
    </main>
  )
}
