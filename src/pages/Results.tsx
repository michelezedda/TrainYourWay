import { useState, useRef, useCallback, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import GlassCard from '@/components/GlassCard'
import ExerciseModal from '@/components/ExerciseModal'
import {
  parseAnalysisSections,
  SECTION_ICONS,
  analysisComponents,
  WorkoutDayView,
} from '@/components/PlanView'
import { buildPlanComponents, sanitizePlan } from '@/lib/planComponents'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { getWeights, setWeight } from '@/lib/exerciseWeights'
import { db } from '@/lib/db'
import { generateDayWorkout } from '@/lib/gemini'
import type { WorkoutFormData, ReevaluationData } from '@/lib/gemini'

// ── Reevaluation helpers ──────────────────────────────────────────────────────

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

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col px-4 py-3 rounded-2xl bg-white/3 border border-white/8">
      <span className="text-white/40 text-[10px] uppercase tracking-wider mb-1">{label}</span>
      <span className="text-white font-medium text-sm">{value}</span>
    </div>
  )
}

function computeBmi(weight: string, height: string) {
  const w = parseFloat(weight)
  const h = parseFloat(height) / 100
  if (!w || !h || w < 20 || h < 1) return null
  const val = w / (h * h)
  if (val < 10 || val > 60) return null
  const cat = val < 18.5 ? 'Underweight' : val < 25 ? 'Normal weight' : val < 30 ? 'Overweight' : 'Obese'
  return { value: val.toFixed(1), category: cat }
}

function DiffBadge({ prev, curr, unit = 'kg' }: { prev: string; curr: string; unit?: string }) {
  const p = parseFloat(prev), c = parseFloat(curr)
  if (isNaN(p) || isNaN(c) || !p) return null
  const diff = c - p
  if (Math.abs(diff) < 0.05) return <span className="text-white/30 text-xs ml-1">(no change)</span>
  const color = diff < 0 ? 'text-green-400' : 'text-orange-400'
  return <span className={`text-xs ml-1 font-medium ${color}`}>({diff > 0 ? '+' : ''}{diff.toFixed(1)} {unit})</span>
}

function ReevalSummary({ data }: { data: ReevaluationData }) {
  const [open, setOpen] = useState(true)
  const difficultyColor =
    data.difficulty === 'Too easy' ? 'text-blue-300' :
    data.difficulty === 'Too hard' ? 'text-red-300'  : 'text-green-300'

  const prevBmi = computeBmi(data.originalWeight, data.originalHeight)
  const currBmi = computeBmi(data.currentWeight, data.currentHeight)
  const hasOriginal = !!(data.originalWeight && data.originalHeight)

  return (
    <GlassCard padding={false} className="mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span className="text-white font-semibold text-sm">Progress Report</span>
        </div>
        <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-5 border-t border-white/5 pt-5">
          {hasOriginal ? (
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-3">Body stats: before vs now</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Before</p>
                  {[['Weight', `${data.originalWeight} kg`], ['Height', `${data.originalHeight} cm`]].map(([l, v]) => (
                    <div key={l} className="flex flex-col px-3 py-2.5 rounded-xl bg-white/3 border border-white/8">
                      <span className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{l}</span>
                      <span className="text-white/70 font-medium text-sm">{v}</span>
                    </div>
                  ))}
                  {prevBmi && (
                    <div className="flex flex-col px-3 py-2.5 rounded-xl bg-white/3 border border-white/8">
                      <span className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">BMI</span>
                      <span className="text-white/70 font-medium text-sm">{prevBmi.value}</span>
                      <span className="text-white/35 text-[10px]">{prevBmi.category}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Now</p>
                  <div className="flex flex-col px-3 py-2.5 rounded-xl bg-white/5 border border-purple-500/20">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Weight</span>
                    <span className="text-white font-medium text-sm flex items-baseline gap-1">
                      {data.currentWeight} kg <DiffBadge prev={data.originalWeight} curr={data.currentWeight} />
                    </span>
                  </div>
                  <div className="flex flex-col px-3 py-2.5 rounded-xl bg-white/5 border border-purple-500/20">
                    <span className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Height</span>
                    <span className="text-white font-medium text-sm">{data.currentHeight} cm</span>
                  </div>
                  {currBmi && (
                    <div className="flex flex-col px-3 py-2.5 rounded-xl bg-white/5 border border-purple-500/20">
                      <span className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">BMI</span>
                      <span className="text-white font-medium text-sm flex items-baseline gap-1">
                        {currBmi.value}
                        {prevBmi && <DiffBadge prev={prevBmi.value} curr={currBmi.value} unit="" />}
                      </span>
                      <span className="text-white/35 text-[10px]">{currBmi.category}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="Weight" value={`${data.currentWeight} kg`} />
              <StatPill label="Height" value={`${data.currentHeight} cm`} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Time on plan" value={data.timeOnPlan} />
            <StatPill label="Adherence"    value={data.adherence} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Physical feel" value={data.physicalFeel} />
            <div className="flex flex-col px-4 py-3 rounded-2xl bg-white/3 border border-white/8">
              <span className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Difficulty</span>
              <span className={`font-medium text-sm ${difficultyColor}`}>{data.difficulty}</span>
            </div>
          </div>
          {data.newGoals.length > 0 && (
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2.5">New focus areas</p>
              <div className="flex flex-wrap gap-2">
                {data.newGoals.map(g => (
                  <span key={g} className={`px-3 py-1 rounded-full text-xs font-medium border ${goalColor[g] ?? 'bg-white/5 text-white/60 border-white/10'}`}>{g}</span>
                ))}
              </div>
            </div>
          )}
          {data.exercisesToRemove?.trim() && (
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1.5">Swapped out</p>
              <p className="text-white/60 text-sm">{data.exercisesToRemove}</p>
            </div>
          )}
          {data.newInjuries?.trim() && (
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1.5">New limitations</p>
              <p className="text-white/60 text-sm">{data.newInjuries}</p>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

function ReevalAnalysisCard({ analysis, onViewPlan }: { analysis: string; onViewPlan: () => void }) {
  return (
    <GlassCard padding={false} className="mb-8 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))', border: '1px solid rgba(168,85,247,0.3)' }}>
          <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-white font-semibold text-sm">Progress Analysis</h2>
          <p className="text-white/35 text-xs">Trainer assessment before your next phase</p>
        </div>
      </div>
      <div className="px-6 pt-5 pb-2">
        <ReactMarkdown components={analysisComponents}>{sanitizePlan(analysis)}</ReactMarkdown>
      </div>
      <div className="px-6 pb-6 pt-3 border-t border-white/8 mt-2">
        <button onClick={onViewPlan} className="btn-primary w-full justify-center">
          View My Evolved Plan
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </GlassCard>
  )
}

// ── Analysis Slides ───────────────────────────────────────────────────────────

function AnalysisSlides({
  analysis,
  formData,
  onDone,
}: {
  analysis: string
  formData: WorkoutFormData
  onDone: () => void
}) {
  const sections = useMemo(() => parseAnalysisSections(sanitizePlan(analysis)), [analysis])
  const [idx, setIdx] = useState(0)

  if (!sections.length) {
    return (
      <div className="mb-8">
        <button onClick={onDone} className="btn-primary w-full justify-center">View My Workout Plan</button>
      </div>
    )
  }

  const current = sections[idx]
  const isLast  = idx === sections.length - 1

  return (
    <GlassCard padding={false} className="mb-8 overflow-hidden animate-fade-in">
      {/* Space photos — first slide only */}
      {idx === 0 && formData.images.length > 0 && (
        <div className="px-6 pt-5">
          <p className="text-white/35 text-[10px] uppercase tracking-wider mb-3">Your workout space</p>
          <div className={`grid gap-3 mb-1 ${
            formData.images.length === 1 ? 'grid-cols-1 max-w-[200px]'
            : formData.images.length === 2 ? 'grid-cols-2'
            : 'grid-cols-3'
          }`}>
            {formData.images.map((src, i) => (
              <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-2xl border border-white/10" />
            ))}
          </div>
        </div>
      )}

      {/* Slide body */}
      <div className="px-6 pt-6 pb-4" style={{ minHeight: '200px' }}>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl leading-none">{SECTION_ICONS[current.title] ?? '📋'}</span>
          <div>
            <p className="text-white/35 text-[10px] uppercase tracking-widest mb-0.5">
              {idx + 1} / {sections.length}
            </p>
            <h2 className="text-white font-bold text-lg leading-tight">{current.title}</h2>
          </div>
        </div>
        <ReactMarkdown components={analysisComponents}>{current.content}</ReactMarkdown>
      </div>

      {/* Footer: dots + nav */}
      <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between">
        <div className="flex gap-1.5 items-center">
          {sections.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`rounded-full transition-all duration-200 ${
                i === idx     ? 'w-4 h-1.5 bg-purple-400'
                : i < idx    ? 'w-1.5 h-1.5 bg-purple-500/40'
                               : 'w-1.5 h-1.5 bg-white/15 hover:bg-white/30'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {idx > 0 && (
            <button onClick={() => setIdx(i => i - 1)} className="btn-ghost !px-4 !py-2 !text-sm">
              Back
            </button>
          )}
          {isLast ? (
            <button onClick={onDone} className="btn-primary !px-5 !py-2 !text-sm">
              View My Plan
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          ) : (
            <button onClick={() => setIdx(i => i + 1)} className="btn-primary !px-5 !py-2 !text-sm">
              Next
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

// ── Nutrition targets ─────────────────────────────────────────────────────────

function NutritionTargets() {
  const profile = getNutritionProfile()
  if (!profile) return null

  const t = calculateTargets(profile)
  const isWeightLoss = profile.goals.some(g => /weight.?loss/i.test(g))
  const isMuscleGain = profile.goals.some(g => /muscle/i.test(g))
  const tdee = Math.round(t.kcal + (isWeightLoss ? 400 : isMuscleGain ? -200 : 0))

  const adjustNote = isWeightLoss
    ? '400 kcal deficit for fat loss'
    : isMuscleGain
    ? '200 kcal surplus for muscle gain'
    : 'set at maintenance'

  const macros = [
    { value: t.kcal,    label: 'Calories', unit: 'kcal', color: '#A855F7', pct: 1 },
    { value: t.protein, label: 'Protein',  unit: 'g',    color: '#22D3EE', pct: (t.protein * 4) / t.kcal },
    { value: t.carbs,   label: 'Carbs',    unit: 'g',    color: '#f59e0b', pct: (t.carbs * 4) / t.kcal },
    { value: t.fat,     label: 'Fat',      unit: 'g',    color: '#ec4899', pct: (t.fat * 9) / t.kcal },
  ]

  return (
    <div className="mb-5 rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="px-5 py-4 border-b border-white/6 flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(34,211,238,0.12))', border: '1px solid rgba(168,85,247,0.25)' }}
        >
          <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Daily Nutrition Targets</p>
          <p className="text-white/35 text-xs mt-0.5">
            Maintenance TDEE: {tdee.toLocaleString()} kcal, {adjustNote}. Track your intake in the Diet tab.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 divide-x divide-white/5">
        {macros.map(({ value, label, unit, color, pct }) => (
          <div key={label} className="px-4 py-4 flex flex-col gap-1">
            <span
              className="text-white font-bold tabular-nums leading-none"
              style={{ fontSize: value >= 1000 ? '18px' : '20px' }}
            >
              {value.toLocaleString()}
            </span>
            <span className="text-white/35 text-[10px]">{unit}</span>
            <div className="mt-2.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: color, opacity: 0.8 }} />
            </div>
            <span className="text-white/40 text-[10px] uppercase tracking-wider mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Results() {
  const location = useLocation()
  const navigate = useNavigate()

  const plan         = location.state?.plan         as string           | undefined
  const planId       = location.state?.planId       as string           | undefined
  const analysis     = location.state?.analysis     as string           | undefined
  const formData     = location.state?.formData     as WorkoutFormData  | undefined
  const reevalData   = location.state?.reevalData   as ReevaluationData | undefined
  const reevalAnalysis = location.state?.reevalAnalysis as string       | undefined

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [planVisible, setPlanVisible] = useState(!(analysis || reevalAnalysis))
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    planId ? getWeights(planId) : {}
  )
  const [blockedDays, setBlockedDays]   = useState<string[]>(formData?.unavailableDays ?? [])
  const [dayOverrides, setDayOverrides] = useState<Record<string, string>>({})

  const planRef = useRef<HTMLDivElement>(null)

  const handleWeightChange = useCallback((exercise: string, value: string) => {
    setWeights(prev => ({ ...prev, [exercise]: value }))
    if (planId) setWeight(planId, exercise, value)
  }, [planId])

  const handleViewPlan = useCallback(() => {
    setPlanVisible(true)
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [])

  const handleUnblockDay = useCallback((day: string) => {
    const newDays = blockedDays.filter(d => d !== day)
    setBlockedDays(newDays)
    if (planId) {
      void db.transact(db.tx.workoutPlans[planId].update({ unavailableDays: JSON.stringify(newDays) }))
    }
  }, [blockedDays, planId])

  const handleGenerateDayWorkout = useCallback(async (day: string) => {
    if (!plan) return
    const workoutText = await generateDayWorkout(plan, day)
    const newOverrides = { ...dayOverrides, [day]: workoutText }
    const newBlocked   = blockedDays.filter(d => d !== day)
    setDayOverrides(newOverrides)
    setBlockedDays(newBlocked)
    if (planId) {
      void db.transact(db.tx.workoutPlans[planId].update({
        dayOverrides:    JSON.stringify(newOverrides),
        unavailableDays: JSON.stringify(newBlocked),
      }))
    }
  }, [plan, dayOverrides, blockedDays, planId])

  const planComponents = useMemo(
    () => buildPlanComponents(setSelectedExercise, planId, weights, handleWeightChange),
    // weights intentionally omitted — ExerciseTableCard uses local state after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planId, handleWeightChange],
  )

  if (!plan) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-in">
        <GlassCard>
          <div className="text-4xl mb-4">🤔</div>
          <h2 className="text-xl font-semibold text-white mb-2">No plan found</h2>
          <p className="text-white/50 mb-6">Let's create your personalized workout plan.</p>
          <Link to="/questionnaire" className="btn-primary">Create a Plan</Link>
        </GlassCard>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
      {selectedExercise && (
        <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold gradient-text">Your Workout Plan</h1>
        <div className="flex gap-3">
          <button onClick={() => navigate('/history')} className="btn-ghost !px-4 !py-2 !text-sm">
            History
          </button>
          <Link to="/questionnaire" className="btn-primary !px-4 !py-2 !text-sm">
            New Plan
          </Link>
        </div>
      </div>

      {/* Initial assessment slides */}
      {analysis && formData && (
        <AnalysisSlides analysis={analysis} formData={formData} onDone={handleViewPlan} />
      )}

      {/* Reevaluation flow */}
      {reevalData && <ReevalSummary data={reevalData} />}
      {reevalData && reevalAnalysis && (
        <ReevalAnalysisCard analysis={reevalAnalysis} onViewPlan={handleViewPlan} />
      )}

      {/* Workout plan */}
      {planVisible && (
        <div ref={planRef} className="animate-fade-in">
          <NutritionTargets />

          <p className="text-white/30 text-xs mb-4 flex items-center gap-1.5">
            <span className="text-purple-400/70">▶</span>
            Tap any exercise for step-by-step instructions
          </p>

          <WorkoutDayView
            plan={plan}
            planComponents={planComponents}
            blockedDays={blockedDays}
            dayWorkoutOverrides={dayOverrides}
            onUnblockDay={handleUnblockDay}
            onGenerateDayWorkout={handleGenerateDayWorkout}
          />
        </div>
      )}
    </main>
  )
}
