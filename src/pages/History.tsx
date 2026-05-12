import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import ExerciseModal from '@/components/ExerciseModal'
import { WorkoutDayView } from '@/components/PlanView'
import { buildPlanComponents } from '@/lib/planComponents'
import { generateDayWorkout } from '@/lib/gemini'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') { setDraft(name); setEditing(false) }
        }}
        className="font-semibold text-white text-lg bg-white/5 border border-purple-500/50 rounded-lg
                   px-2 py-0.5 outline-none focus:ring-1 focus:ring-purple-500/50 w-full max-w-[240px]"
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(name); setEditing(true) }}
      className="font-semibold text-white text-lg hover:text-purple-300 transition-colors text-left
                 flex items-center gap-1.5 group"
      title="Click to rename"
    >
      <span>{name}</span>
      <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })
}

function parseList(json: string): string[] {
  try { return JSON.parse(json) as string[] } catch { return [] }
}

const levelColor: Record<string, string> = {
  beginner:     'bg-green-500/15 text-green-300 border-green-500/30',
  intermediate: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  advanced:     'bg-red-500/15 text-red-300 border-red-500/30',
}

const goalColor: Record<string, string> = {
  'Weight Loss':          'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Muscle Gain':          'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Body Recomposition':   'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  'Strength':             'bg-red-500/15 text-red-300 border-red-500/30',
  'Endurance':            'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  'Athletic Performance': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Flexibility':          'bg-violet-500/15 text-violet-300 border-violet-500/30',
  'General Fitness':      'bg-green-500/15 text-green-300 border-green-500/30',
  'Stress Relief':        'bg-pink-500/15 text-pink-300 border-pink-500/30',
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

// ── Plan viewer components ────────────────────────────────────────────────────

function InteractivePlan({ planId, planText, blockedDays, dayOverrides, onExerciseClick, onUnblockDay, onGenerateDayWorkout }: {
  planId: string
  planText: string
  blockedDays: string[]
  dayOverrides: Record<string, string>
  onExerciseClick: (name: string) => void
  onUnblockDay: (day: string) => void
  onGenerateDayWorkout: (day: string) => Promise<void>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, onExerciseClick, handleWeightChange],
  )

  return (
    <div className="px-4 pb-6 sm:px-6">
      <p className="text-white/35 text-sm pt-4 pb-4 flex items-center gap-1.5">
        <span className="text-purple-400">▶</span>
        Click any exercise for a guide. Log your weights below each one.
      </p>
      <WorkoutDayView
        plan={planText}
        planComponents={components}
        blockedDays={blockedDays}
        dayWorkoutOverrides={dayOverrides}
        onUnblockDay={onUnblockDay}
        onGenerateDayWorkout={onGenerateDayWorkout}
      />
    </div>
  )
}

function ReadOnlyPlan({ planId, planText, onExerciseClick }: {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, onExerciseClick, handleWeightChange],
  )

  return (
    <div className="px-4 pb-6 sm:px-6 pt-4">
      <WorkoutDayView plan={planText} planComponents={components} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function History() {
  const userId = getUserId()
  const navigate = useNavigate()

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [planExpanded, setPlanExpanded] = useState(true)
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [confirmStartOver, setConfirmStartOver] = useState(false)
  const [startingOver, setStartingOver] = useState(false)

  const { isLoading, error, data } = db.useQuery({
    workoutPlans: { $: { where: { userId }, order: { serverCreatedAt: 'desc' } } },
  })

  const plans = (data?.workoutPlans ?? []) as Array<{
    id: string; plan: string; userName: string; fitnessLevel: string
    goals: string; equipment: string; constraints: string; createdAt: number
    parentPlanId?: string; unavailableDays?: string; dayOverrides?: string
  }>

  // Build the linear evolution chain: [original, evo1, evo2, ..., latest]
  const chain = useMemo(() => {
    const roots = plans.filter(p => !p.parentPlanId || p.parentPlanId === '')
    if (roots.length === 0) return []
    const root = roots.sort((a, b) => b.createdAt - a.createdAt)[0]
    const result = [root]
    let current = root
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const child = plans.find(p => p.parentPlanId === current.id)
      if (!child) break
      result.push(child)
      current = child
    }
    return result
  }, [plans])

  const latestPlan = chain[chain.length - 1]
  const previousVersions = chain.slice(0, -1).reverse() // newest-first, excluding current

  const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false
  const daysUntilEvolve = latestPlan && !canEvolve
    ? Math.ceil((FOUR_WEEKS_MS - (Date.now() - latestPlan.createdAt)) / (24 * 60 * 60 * 1000))
    : 0

  const handleEvolve = () => {
    if (!latestPlan || !canEvolve) return
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
  }

  const handleStartOver = async () => {
    setStartingOver(true)
    try {
      if (plans.length > 0) {
        await db.transact(plans.map(p => db.tx.workoutPlans[p.id].delete()))
      }
      navigate('/questionnaire')
    } catch {
      setStartingOver(false)
      setConfirmStartOver(false)
    }
  }

  // ── Loading / error / empty ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 flex justify-center animate-fade-in">
        <LoadingSpinner size="lg" message="Loading your plan..." />
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
        <GlassCard>
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-300">Failed to load plan. Please try again later.</p>
        </GlassCard>
      </main>
    )
  }

  if (chain.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
        <GlassCard>
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-white mb-2">No plan yet</h2>
          <p className="text-white/50 mb-6">Create your first personalized workout plan to get started.</p>
          <Link to="/questionnaire" className="btn-primary">Create My Plan</Link>
        </GlassCard>
      </main>
    )
  }

  const goals = parseList(latestPlan.goals ?? '[]')
  const dayOverrides = (() => {
    try { return JSON.parse(latestPlan.dayOverrides ?? '{}') as Record<string, string> } catch { return {} }
  })()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      {selectedExercise && (
        <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold gradient-text">My Plan</h1>
          <p className="text-white/40 text-sm mt-1">
            {chain.length > 1
              ? `${chain.length - 1} evolution${chain.length > 2 ? 's' : ''} from original`
              : 'Original plan'}
          </p>
        </div>
        <Link to="/import" className="btn-ghost !px-4 !py-2.5 !text-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import
        </Link>
      </div>

      {/* Current plan card */}
      <GlassCard padding={false} className="mb-6 overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-purple-400/70 uppercase tracking-wider mb-1">
                {chain.length > 1 ? `Evolution ${chain.length - 1} - Current` : 'Current Plan'}
              </p>
              <PlanName planId={latestPlan.id} name={latestPlan.userName} />
              <p className="text-white/40 text-sm mt-1">{formatDate(latestPlan.createdAt)}</p>
            </div>

            {/* Evolve button */}
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <button
                onClick={handleEvolve}
                disabled={!canEvolve}
                title={canEvolve
                  ? 'Evolve your plan to the next phase'
                  : `Evolve unlocks in ${daysUntilEvolve} day${daysUntilEvolve !== 1 ? 's' : ''} (requires 4 weeks)`}
                className={`btn-primary !px-4 !py-2 !text-sm flex items-center gap-1.5 ${!canEvolve ? 'opacity-40 cursor-not-allowed !shadow-none' : ''}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Evolve
              </button>
              {!canEvolve && (
                <span className="text-[9px] text-white/25 leading-none whitespace-nowrap">
                  in {daysUntilEvolve}d
                </span>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {latestPlan.fitnessLevel && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${levelColor[latestPlan.fitnessLevel] ?? 'bg-white/10 text-white/60 border-white/10'}`}>
                {latestPlan.fitnessLevel}
              </span>
            )}
            {goals.map(g => (
              <span key={g} className={`px-3 py-0.5 rounded-full text-xs font-medium border ${goalColor[g] ?? 'bg-white/5 text-white/60 border-white/10'}`}>
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Collapse / expand toggle */}
        <button
          onClick={() => setPlanExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-white/8 text-white/35 hover:text-white/60 transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-xs font-medium">{planExpanded ? 'Collapse plan' : 'View plan'}</span>
        </button>

        {/* Plan content */}
        {planExpanded && latestPlan.plan && (
          <div className="border-t border-white/8">
            <InteractivePlan
              planId={latestPlan.id}
              planText={latestPlan.plan}
              blockedDays={parseList(latestPlan.unavailableDays ?? '[]')}
              dayOverrides={dayOverrides}
              onExerciseClick={setSelectedExercise}
              onUnblockDay={(day) => {
                const current = parseList(latestPlan.unavailableDays ?? '[]')
                void db.transact(db.tx.workoutPlans[latestPlan.id].update({
                  unavailableDays: JSON.stringify(current.filter(d => d !== day)),
                }))
              }}
              onGenerateDayWorkout={async (day) => {
                const workoutText = await generateDayWorkout(latestPlan.plan, day)
                const newOverrides = { ...dayOverrides, [day]: workoutText }
                const currentBlocked = parseList(latestPlan.unavailableDays ?? '[]')
                void db.transact(db.tx.workoutPlans[latestPlan.id].update({
                  dayOverrides: JSON.stringify(newOverrides),
                  unavailableDays: JSON.stringify(currentBlocked.filter(d => d !== day)),
                }))
              }}
            />
          </div>
        )}
      </GlassCard>

      {/* Previous versions */}
      {previousVersions.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-white/35 uppercase tracking-wider mb-3">Version History</h2>
          <div className="space-y-2">
            {previousVersions.map((version, i) => {
              const isExpanded = expandedVersionId === version.id
              const isOriginal = i === previousVersions.length - 1
              const label = isOriginal ? 'Original Plan' : `Evolution ${previousVersions.length - 1 - i}`
              return (
                <GlassCard key={version.id} padding={false} className="overflow-hidden">
                  <button
                    onClick={() => setExpandedVersionId(isExpanded ? null : version.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/3 transition-colors text-left"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOriginal ? 'bg-white/20' : 'bg-purple-400/50'}`} />
                    <span className="text-white/60 text-sm font-medium flex-1">{label}</span>
                    <span className="text-white/30 text-xs mr-2">{formatDate(version.createdAt)}</span>
                    <svg className={`w-4 h-4 text-white/25 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && version.plan && (
                    <div className="border-t border-white/8">
                      <ReadOnlyPlan
                        planId={version.id}
                        planText={version.plan}
                        onExerciseClick={setSelectedExercise}
                      />
                    </div>
                  )}
                </GlassCard>
              )
            })}
          </div>
        </div>
      )}

      {/* Start Over */}
      <div className="pt-4 border-t border-white/8">
        {!confirmStartOver ? (
          <button
            onClick={() => setConfirmStartOver(true)}
            className="text-sm text-white/25 hover:text-white/50 transition-colors"
          >
            Start over with a completely new plan
          </button>
        ) : (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-4 space-y-3">
            <p className="text-sm text-white/65 leading-relaxed">
              This will permanently delete your current plan
              {chain.length > 1 ? ` and all ${chain.length} versions` : ''}.
              This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleStartOver()}
                disabled={startingOver}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/20 border border-red-500/40
                           text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {startingOver ? 'Deleting...' : 'Yes, start over'}
              </button>
              <button
                onClick={() => setConfirmStartOver(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 border border-white/10
                           text-white/50 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
