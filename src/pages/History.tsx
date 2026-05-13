import { useState, useMemo } from 'react'
import { HiPencil, HiUpload, HiRefresh, HiChevronDown } from 'react-icons/hi'
import { Link, useNavigate } from 'react-router-dom'
import LoadingSpinner from '@/components/LoadingSpinner'
import ExerciseModal from '@/components/ExerciseModal'
import { WorkoutDayView } from '@/components/PlanView'
import { buildPlanComponents } from '@/lib/planComponents'
import { generateDayWorkout } from '@/lib/gemini'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'

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

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function parseList(json: string): string[] {
  try { return JSON.parse(json) as string[] } catch { return [] }
}

const levelColor: Record<string, { bg: string; color: string; border: string }> = {
  beginner: { bg: 'rgba(34,197,94,0.12)', color: '#86efac', border: 'rgba(34,197,94,0.3)' },
  intermediate: { bg: 'rgba(234,179,8,0.12)', color: '#fde68a', border: 'rgba(234,179,8,0.3)' },
  advanced: { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
}

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

function InteractivePlan({ planId, planText, blockedDays, dayOverrides, onExerciseClick, onUnblockDay, onGenerateDayWorkout }: {
  planId: string; planText: string; blockedDays: string[]; dayOverrides: Record<string, string>
  onExerciseClick: (name: string) => void; onUnblockDay: (day: string) => void; onGenerateDayWorkout: (day: string) => Promise<void>
}) {
  const [weights, setWeightsState] = useState<Record<string, string>>(() => getWeights(planId))
  const handleWeightChange = useMemo(() => (exercise: string, value: string) => {
    setWeightsState(prev => ({ ...prev, [exercise]: value }))
    setWeight(planId, exercise, value)
  }, [planId])
  const components = useMemo(
    () => buildPlanComponents(onExerciseClick, planId, weights, handleWeightChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, onExerciseClick, handleWeightChange],
  )
  return (
    <div className="px-4 pb-5">
      <p className="text-white/35 text-xs pt-4 pb-3 flex items-center gap-1.5">
        <span className="text-purple-400">▶</span>
        Tap any exercise for a guide. Log weights below.
      </p>
      <WorkoutDayView plan={planText} planComponents={components} blockedDays={blockedDays}
        dayWorkoutOverrides={dayOverrides} onUnblockDay={onUnblockDay} onGenerateDayWorkout={onGenerateDayWorkout} />
    </div>
  )
}

function ReadOnlyPlan({ planId, planText, onExerciseClick }: {
  planId: string; planText: string; onExerciseClick: (name: string) => void
}) {
  const [weights, setWeightsState] = useState<Record<string, string>>(() => getWeights(planId))
  const handleWeightChange = useMemo(() => (exercise: string, value: string) => {
    setWeightsState(prev => ({ ...prev, [exercise]: value }))
    setWeight(planId, exercise, value)
  }, [planId])
  const components = useMemo(
    () => buildPlanComponents(onExerciseClick, planId, weights, handleWeightChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, onExerciseClick, handleWeightChange],
  )
  return (
    <div className="px-4 pb-5 pt-4">
      <WorkoutDayView plan={planText} planComponents={components} />
    </div>
  )
}

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

  const chain = useMemo(() => {
    const roots = plans.filter(p => !p.parentPlanId || p.parentPlanId === '')
    if (roots.length === 0) return []
    const root = roots.sort((a, b) => b.createdAt - a.createdAt)[0]
    const result = [root]
    let current = root
    while (true) { // eslint-disable-line no-constant-condition
      const child = plans.find(p => p.parentPlanId === current.id)
      if (!child) break
      result.push(child)
      current = child
    }
    return result
  }, [plans])

  const latestPlan = chain[chain.length - 1]
  const previousVersions = chain.slice(0, -1).reverse()
  const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false
  const daysUntilEvolve = latestPlan && !canEvolve
    ? Math.ceil((FOUR_WEEKS_MS - (Date.now() - latestPlan.createdAt)) / (24 * 60 * 60 * 1000))
    : 0

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

  if (chain.length === 0) {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 py-16 animate-fade-in">
        <div
          className="rounded-3xl overflow-hidden text-center"
          style={{ border: '1px solid rgba(168,85,247,0.22)' }}
        >
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

  const goals = parseList(latestPlan.goals ?? '[]')
  const dayOverrides = (() => { try { return JSON.parse(latestPlan.dayOverrides ?? '{}') as Record<string, string> } catch { return {} } })()
  const lvl = levelColor[latestPlan.fitnessLevel] ?? null

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      {selectedExercise && <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight gradient-text">My Plan</h1>
          <p className="text-white/40 text-sm mt-1 font-medium">
            {chain.length > 1 ? `${chain.length - 1} evolution${chain.length > 2 ? 's' : ''} from original` : 'Original plan'}
          </p>
        </div>
        <Link
          to="/import"
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.6)' }}
        >
          <HiUpload className="w-3.5 h-3.5" />
          Import
        </Link>
      </div>

      {/* Current plan card */}
      <div className="glass-card p-0 mb-4 overflow-hidden">
        <div className="p-5">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2">
            {chain.length > 1 ? `Evolution ${chain.length - 1}` : 'Current Plan'}
          </p>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <PlanName planId={latestPlan.id} name={latestPlan.userName} />
              <p className="text-white/35 text-xs mt-1">{formatDate(latestPlan.createdAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <button
                onClick={handleEvolve}
                disabled={!canEvolve}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97]"
                style={canEvolve
                  ? { background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'not-allowed' }
                }
                title={canEvolve ? 'Evolve your plan' : `Unlocks in ${daysUntilEvolve} days`}
              >
                <HiRefresh className="w-3.5 h-3.5" />
                {canEvolve ? 'Evolve' : `${daysUntilEvolve}d`}
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {lvl && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                style={{ background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.border}` }}>
                {latestPlan.fitnessLevel}
              </span>
            )}
            {goals.map(g => (
              <span key={g} className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* Toggle */}
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
            <InteractivePlan
              planId={latestPlan.id}
              planText={latestPlan.plan}
              blockedDays={parseList(latestPlan.unavailableDays ?? '[]')}
              dayOverrides={dayOverrides}
              onExerciseClick={setSelectedExercise}
              onUnblockDay={day => {
                const current = parseList(latestPlan.unavailableDays ?? '[]')
                void db.transact(db.tx.workoutPlans[latestPlan.id].update({
                  unavailableDays: JSON.stringify(current.filter(d => d !== day)),
                }))
              }}
              onGenerateDayWorkout={async day => {
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
      </div>

      {/* Version history */}
      {previousVersions.length > 0 && (
        <div className="mb-5">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-3">Version History</p>
          <div className="space-y-2">
            {previousVersions.map((version, i) => {
              const isExpanded = expandedVersionId === version.id
              const isOriginal = i === previousVersions.length - 1
              const label = isOriginal ? 'Original Plan' : `Evolution ${previousVersions.length - 1 - i}`
              return (
                <div key={version.id} className="glass-card p-0 overflow-hidden">
                  <button
                    onClick={() => setExpandedVersionId(isExpanded ? null : version.id)}
                    className="w-full flex items-center gap-3 px-4 py-4 text-left transition-all active:bg-white/[0.02]"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isOriginal ? 'bg-white/20' : 'bg-purple-400/50'}`} />
                    <span className="text-white/60 text-sm font-medium flex-1">{label}</span>
                    <span className="text-white/25 text-xs mr-2">{formatDate(version.createdAt)}</span>
                    <HiChevronDown className={`w-4 h-4 text-white/25 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && version.plan && (
                    <div className="border-t border-white/[0.07]">
                      <ReadOnlyPlan planId={version.id} planText={version.plan} onExerciseClick={setSelectedExercise} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Start over */}
      <div className="pt-4 border-t border-white/[0.08] pb-10">
        {!confirmStartOver ? (
          <button
            onClick={() => setConfirmStartOver(true)}
            className="text-sm text-white/25 transition-colors hover:text-white/45"
          >
            Start over with a new plan
          </button>
        ) : (
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-sm text-white/65 leading-relaxed">
              This permanently deletes your current plan{chain.length > 1 ? ` and all ${chain.length} versions` : ''}. Cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleStartOver()}
                disabled={startingOver}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
              >
                {startingOver ? 'Deleting...' : 'Yes, start over'}
              </button>
              <button
                onClick={() => setConfirmStartOver(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
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
