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

function DeleteButton({ planId }: { planId: string }) {
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    await db.transact(db.tx.workoutPlans[planId].delete())
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-white/50 text-xs">Delete?</span>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/20 border border-red-500/40
                     text-red-300 hover:bg-red-500/30 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10
                     text-white/50 hover:bg-white/10 transition-colors"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                 text-white/25 hover:text-red-400 hover:bg-red-500/10 border border-transparent
                 hover:border-red-500/20 transition-all duration-200"
      aria-label="Delete plan"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void save()
    if (e.key === 'Escape') { setDraft(name); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={handleKeyDown}
        className="font-semibold text-white text-lg bg-white/5 border border-purple-500/50 rounded-lg
                   px-2 py-0.5 outline-none focus:ring-1 focus:ring-purple-500/50 w-full max-w-[220px]"
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
      <svg
        className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400 transition-colors flex-shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function parseList(json: string): string[] {
  try {
    return JSON.parse(json) as string[]
  } catch {
    return []
  }
}

const levelColor: Record<string, string> = {
  beginner: 'bg-green-500/15 text-green-300 border-green-500/30',
  intermediate: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  advanced: 'bg-red-500/15 text-red-300 border-red-500/30',
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

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000

function ExpandedPlan({ planId, planText, blockedDays, dayOverrides, onExerciseClick, onUnblockDay, onGenerateDayWorkout }: {
  planId: string
  planText: string
  blockedDays: string[]
  dayOverrides: Record<string, string>
  onExerciseClick: (name: string) => void
  onUnblockDay: (day: string) => void
  onGenerateDayWorkout: (day: string) => Promise<void>
}) {
  const [weights, setWeights] = useState<Record<string, string>>(() => getWeights(planId))

  const handleWeightChange = useMemo(
    () => (exercise: string, value: string) => {
      setWeights(prev => ({ ...prev, [exercise]: value }))
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

export default function History() {
  const userId = getUserId()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [evolutionId, setEvolutionId] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  const { isLoading, error, data } = db.useQuery({
    workoutPlans: {
      $: {
        where: { userId },
        order: { serverCreatedAt: 'desc' },
      },
    },
  })

  const plans = data?.workoutPlans ?? []

  const childrenMap = useMemo(() => {
    const map = new Map<string, typeof plans>()
    for (const p of plans) {
      const parent = p.parentPlanId ?? ''
      if (parent) {
        if (!map.has(parent)) map.set(parent, [])
        map.get(parent)!.push(p)
      }
    }
    return map
  }, [plans])

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 flex justify-center animate-fade-in">
        <LoadingSpinner size="lg" message="Loading your plans..." />
      </main>
    )
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
        <GlassCard>
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-red-300">Failed to load plans. Please try again later.</p>
        </GlassCard>
      </main>
    )
  }

  if (plans.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center animate-fade-in">
        <GlassCard>
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-white mb-2">No plans yet</h2>
          <p className="text-white/50 mb-6">Create your first personalized workout plan to get started.</p>
          <Link to="/questionnaire" className="btn-primary">
            Create My First Plan
          </Link>
        </GlassCard>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      {selectedExercise && (
        <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Plan History</h1>
          <p className="text-white/40 text-sm mt-1">{plans.length} plan{plans.length !== 1 ? 's' : ''} generated</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/import" className="btn-ghost !px-4 !py-2.5 !text-sm flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </Link>
          <Link to="/questionnaire" className="btn-primary !px-5 !py-2.5 !text-sm">
            New Plan ✨
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => {
          const goals = parseList(plan.goals ?? '[]')
          const isExpanded = expandedId === plan.id
          const isDueForReview = Date.now() - plan.createdAt >= TWO_WEEKS_MS

          const handleReevaluate = () => {
            navigate('/reevaluate', {
              state: {
                planId: plan.id,
                originalPlan: plan.plan,
                userName: plan.userName,
                fitnessLevel: plan.fitnessLevel ?? '',
                goals: plan.goals ?? '[]',
                equipment: plan.equipment ?? '[]',
              },
            })
          }

          const evolutions = (childrenMap.get(plan.id) ?? [])
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt)
          const isEvolutionExpanded = evolutionId === plan.id

          return (
            <GlassCard key={plan.id} padding={false} className="overflow-hidden">
              {/* Card header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <PlanName planId={plan.id} name={plan.userName} />
                      {plan.fitnessLevel && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${
                            levelColor[plan.fitnessLevel] ?? 'bg-white/10 text-white/60 border-white/10'
                          }`}
                        >
                          {plan.fitnessLevel}
                        </span>
                      )}
                      {evolutions.length > 0 && (
                        <button
                          onClick={() => setEvolutionId(isEvolutionExpanded ? null : plan.id)}
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                            isEvolutionExpanded
                              ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                              : 'bg-white/5 border-white/10 text-white/50 hover:border-purple-500/30 hover:text-purple-300'
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Evolved {evolutions.length}×
                        </button>
                      )}
                    </div>
                    <p className="text-white/40 text-sm">{formatDate(plan.createdAt)}</p>
                  </div>
                  <DeleteButton planId={plan.id} />
                </div>
              </div>

              {/* Evolution timeline */}
              {isEvolutionExpanded && (
                <div className="mx-5 mb-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-purple-500/15 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-purple-300 uppercase tracking-wider">
                      Evolution History
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-0">
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
                      <span className="text-white/40 text-xs flex-1">Original plan</span>
                      <span className="text-white/30 text-xs">{formatDate(plan.createdAt)}</span>
                    </div>
                    {evolutions.map((evo, i) => (
                      <div key={evo.id} className="flex items-center gap-3 py-2 border-t border-white/5">
                        <div className="w-2 h-2 rounded-full bg-purple-400/60 flex-shrink-0" />
                        <span className="text-white/65 text-xs flex-1">Evolution {i + 1}</span>
                        <span className="text-white/40 text-xs">{formatDate(evo.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom row: goal chips left, buttons right */}
              <div className="px-5 pb-4 flex items-center justify-between gap-3">
                <div className="flex gap-2 flex-wrap">
                  {goals.map((g) => (
                    <span
                      key={g}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        goalColor[g] ?? 'bg-white/5 text-white/60 border-white/10'
                      }`}
                    >
                      {g}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleReevaluate}
                    title={isDueForReview ? 'Due for review. Re-evaluate your plan now.' : 'Re-evaluate plan (recommended every 2 weeks)'}
                    className="relative btn-ghost !px-3 !py-2 !text-sm flex items-center gap-1.5"
                  >
                    {isDueForReview && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                    )}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Evolve
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                    className="btn-ghost !px-4 !py-2 !text-sm"
                  >
                    {isExpanded ? 'Collapse' : 'View Plan'}
                  </button>
                </div>
              </div>

              {/* Expanded plan */}
              {isExpanded && plan.plan && (
                <div className="border-t border-white/8 overflow-hidden">
                  <ExpandedPlan
                    planId={plan.id}
                    planText={plan.plan ?? ''}
                    blockedDays={parseList(plan.unavailableDays ?? '[]')}
                    dayOverrides={(() => { try { return JSON.parse(plan.dayOverrides ?? '{}') as Record<string, string> } catch { return {} } })()}
                    onExerciseClick={setSelectedExercise}
                    onUnblockDay={(day: string) => {
                      const current = parseList(plan.unavailableDays ?? '[]')
                      const newDays = current.filter(d => d !== day)
                      void db.transact(db.tx.workoutPlans[plan.id].update({ unavailableDays: JSON.stringify(newDays) }))
                    }}
                    onGenerateDayWorkout={async (day: string) => {
                      const workoutText = await generateDayWorkout(plan.plan ?? '', day)
                      const current = (() => { try { return JSON.parse(plan.dayOverrides ?? '{}') as Record<string, string> } catch { return {} } })()
                      const newOverrides = { ...current, [day]: workoutText }
                      const currentBlocked = parseList(plan.unavailableDays ?? '[]')
                      const newBlocked = currentBlocked.filter(d => d !== day)
                      void db.transact(db.tx.workoutPlans[plan.id].update({
                        dayOverrides:    JSON.stringify(newOverrides),
                        unavailableDays: JSON.stringify(newBlocked),
                      }))
                    }}
                  />
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>
    </main>
  )
}
