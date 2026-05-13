import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import { generateAnalysis, generateWorkoutPlan, generateReevaluationAnalysis, reevaluateWorkoutPlan, type WorkoutFormData, type ReevaluationData } from '@/lib/gemini'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'

const TIPS = [
  'Analyzing your equipment and space...',
  'Designing your weekly schedule...',
  'Balancing intensity and recovery...',
  'Calibrating to your fitness level...',
  'Adding progression guidelines...',
  'Finalizing your personalized plan...',
]

const REEVALUATION_TIPS = [
  'Reviewing your last 2 weeks of training...',
  'Identifying progression opportunities...',
  'Calculating weight increases...',
  'Refreshing exercise variety...',
  'Fine-tuning rest periods...',
  'Building your next-level plan...',
]

export default function Generating() {
  const navigate = useNavigate()
  const location = useLocation()
  const payload = location.state?.payload as WorkoutFormData | undefined
  const reevaluation = location.state?.reevaluation as ReevaluationData | undefined
  const plansToDelete = (location.state?.plansToDelete as string[] | undefined) ?? []
  const isReevaluation = !!reevaluation

  const [tipIndex, setTipIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const tips = isReevaluation ? REEVALUATION_TIPS : TIPS
  const progress = Math.min(100, ((tipIndex + 1) / tips.length) * 100)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [tips.length])

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!payload && !reevaluation) {
      navigate('/questionnaire', { replace: true })
      return
    }

    ;(async () => {
      try {
        const userId = getUserId()
        const planId = id()

        if (reevaluation) {
          const [reevalAnalysis, plan] = await Promise.all([
            generateReevaluationAnalysis(reevaluation),
            reevaluateWorkoutPlan(reevaluation),
          ])
          await db.transact(
            db.tx.workoutPlans[planId].update({
              userId,
              userName: reevaluation.userName,
              fitnessLevel: reevaluation.fitnessLevel,
              goals: typeof reevaluation.goals === 'string' ? reevaluation.goals : JSON.stringify(reevaluation.goals),
              equipment: typeof reevaluation.equipment === 'string' ? reevaluation.equipment : JSON.stringify(reevaluation.equipment),
              constraints: reevaluation.daysPerWeek ? `${reevaluation.daysPerWeek}d/wk` : '',
              plan,
              createdAt: Date.now(),
              parentPlanId: reevaluation.originalPlanId,
              unavailableDays: JSON.stringify(reevaluation.unavailableDays ?? []),
            }),
          )
          navigate('/results', { state: { plan, planId, reevalData: reevaluation, reevalAnalysis }, replace: true })
        } else if (payload) {
          if (plansToDelete.length > 0) {
            await db.transact(plansToDelete.map(id => db.tx.workoutPlans[id].delete()))
          }
          const [analysis, plan] = await Promise.all([
            generateAnalysis(payload),
            generateWorkoutPlan(payload),
          ])
          await db.transact(
            db.tx.workoutPlans[planId].update({
              userId,
              userName: payload.planName,
              fitnessLevel: payload.fitnessLevel,
              goals: JSON.stringify(payload.goals),
              equipment: JSON.stringify(payload.equipment),
              constraints: `${payload.injuries || 'None'} | ${payload.daysPerWeek}d/wk | ${payload.sessionDuration}min`,
              plan,
              createdAt: Date.now(),
              parentPlanId: '',
              unavailableDays: JSON.stringify(payload.unavailableDays ?? []),
              otherSports: payload.otherSports ? JSON.stringify(payload.otherSports) : undefined,
            }),
          )
          navigate('/results', { state: { plan, planId, analysis, formData: payload }, replace: true })
        }
      } catch (err) {
        console.error('[Generating] Error:', err)
        setError(err instanceof Error ? err.message : String(err))
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-5">⚠️</div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Generation Failed</h2>
          <p className="text-white/45 text-sm mb-5 leading-relaxed">
            Your plan couldn't be generated. Here's what went wrong:
          </p>
          <div
            className="p-4 rounded-2xl text-red-300 text-sm mb-7 text-left break-words leading-relaxed"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {error}
          </div>
          <div className="flex gap-3">
            <Link to="/history" className="btn-ghost flex-1 !justify-center">
              Go Back
            </Link>
            <button
              onClick={() => { setError(null); started.current = false }}
              className="btn-primary flex-1"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 overflow-hidden">
      <div className="text-center w-full max-w-xs animate-fade-up">

        {/* Spinning gradient ring with icon */}
        <div className="relative w-36 h-36 mx-auto mb-10">
          {/* Outer spinning conic gradient ring */}
          <div
            className="absolute inset-0 rounded-full animate-spin-slow"
            style={{
              background: 'conic-gradient(from 0deg, #A855F7 0%, #22D3EE 45%, transparent 65%, #A855F7 100%)',
              padding: '3px',
            }}
          >
            <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
          </div>
          {/* Inner glow */}
          <div
            className="absolute inset-2 rounded-full animate-pulse-slow"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, rgba(34,211,238,0.08) 60%, transparent 100%)' }}
          />
          {/* Center emoji */}
          <div className="absolute inset-0 flex items-center justify-center text-4xl select-none">
            {isReevaluation ? '🔄' : '🤖'}
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-3xl font-black tracking-tight text-white mb-1">
          {isReevaluation ? 'Evolving' : 'Crafting'}
        </h2>
        <p className="gradient-text font-black text-xl mb-8">
          your plan
        </p>

        {/* Animated tip */}
        <p
          key={tipIndex}
          className="text-white/50 text-sm leading-relaxed mb-8 animate-fade-in"
        >
          {tips[tipIndex]}
        </p>

        {/* Progress bar */}
        <div
          className="h-1 rounded-full overflow-hidden mb-4"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-[2400ms] ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #A855F7, #22D3EE)',
            }}
          />
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5">
          {tips.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === tipIndex ? 20 : 6,
                height: 6,
                background: i === tipIndex
                  ? 'linear-gradient(90deg, #A855F7, #22D3EE)'
                  : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
