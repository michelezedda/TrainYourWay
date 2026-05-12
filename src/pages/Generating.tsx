import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import LoadingSpinner from '@/components/LoadingSpinner'
import GlassCard from '@/components/GlassCard'
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
      <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="max-w-md w-full">
          <GlassCard className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Generation Failed</h2>
            <p className="text-white/50 text-sm mb-2 leading-relaxed">
              Your plan couldn't be generated. Here's what went wrong:
            </p>
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm mb-6 text-left break-words">
              {error}
            </div>
            <div className="flex gap-3 justify-center">
              <Link to="/history" className="btn-ghost !text-sm">
                Go Back
              </Link>
              <button
                onClick={() => {
                  setError(null)
                  started.current = false
                }}
                className="btn-primary !text-sm"
              >
                Try Again
              </button>
            </div>
          </GlassCard>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="text-center">
        <div className="mb-8">
          <LoadingSpinner size="lg" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          {isReevaluation ? 'Evolving your plan' : 'Crafting your plan'}
          <span className="animate-pulse">...</span>
        </h2>

        <p
          key={tipIndex}
          className="text-white/50 text-base mb-8 max-w-sm mx-auto leading-relaxed animate-fade-in"
        >
          {tips[tipIndex]}
        </p>

        <div className="flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-pulse-slow"
              style={{
                background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
