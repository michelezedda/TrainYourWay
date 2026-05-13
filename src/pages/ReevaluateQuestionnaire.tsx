import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import GlassCard from '@/components/GlassCard'
import StepIndicator from '@/components/StepIndicator'
import { type ReevaluationData } from '@/lib/gemini'
import { HiArrowNarrowLeft, HiArrowNarrowRight } from 'react-icons/hi'

const STEP_LABELS = ['Progress', 'Body', 'Adjustments']

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function parseStatsFromPlan(plan: string): { weight: string; height: string } {
  const match = plan.match(/\*\*Body Metrics:\*\*\s*Weight\s+([\d.]+)\s*kg\s*\|\s*Height\s+([\d.]+)\s*cm/)
  return match ? { weight: match[1], height: match[2] } : { weight: '', height: '' }
}

const GOAL_OPTIONS = [
  { label: 'Weight Loss', icon: '🔥' },
  { label: 'Muscle Gain', icon: '💪' },
  { label: 'Endurance', icon: '🏃' },
  { label: 'Flexibility', icon: '🧘' },
  { label: 'General Fitness', icon: '⚡' },
  { label: 'Stress Relief', icon: '🌿' },
]

type Unit = 'metric' | 'imperial'

function lbsToKg(lbs: number) { return lbs / 2.2046 }
function kgToLbs(kg: number)  { return kg * 2.2046 }
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) }
}
function ftInToCm(ft: number, inches: number) { return (ft * 12 + inches) * 2.54 }

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-white/50 mt-1">{subtitle}</p>
    </div>
  )
}

interface RevalForm {
  unit: Unit
  timeOnPlan: string
  adherence: string
  currentWeight: string
  currentHeight: string
  currentHeightIn: string
  physicalFeel: string
  difficulty: string
  daysPerWeek: string
  unavailableDays: string[]
  exercisesToRemove: string
  newInjuries: string
  newGoals: string[]
}

const INITIAL: RevalForm = {
  unit: 'metric',
  timeOnPlan: '',
  adherence: '',
  currentWeight: '',
  currentHeight: '',
  currentHeightIn: '',
  physicalFeel: '',
  difficulty: '',
  daysPerWeek: '3',
  unavailableDays: [],
  exercisesToRemove: '',
  newInjuries: '',
  newGoals: [],
}

export default function ReevaluateQuestionnaire() {
  const navigate = useNavigate()
  const location = useLocation()

  const original = location.state as {
    planId: string
    originalPlan: string
    userName: string
    fitnessLevel: string
    goals: string
    equipment: string
  } | null

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<RevalForm>(INITIAL)
  const [dayBlockError, setDayBlockError] = useState('')

  if (!original) {
    navigate('/history', { replace: true })
    return null
  }

  const update = (patch: Partial<RevalForm>) => setForm((p) => ({ ...p, ...patch }))

  const pick = (key: keyof RevalForm, value: string) => {
    setForm((p) => ({ ...p, [key]: p[key] === value ? '' : value }))
  }

  const switchUnit = (next: Unit) => {
    if (next === form.unit) return
    let weight = ''
    let height = ''
    let heightIn = ''
    const w = parseFloat(form.currentWeight)
    const h = parseFloat(form.currentHeight)
    if (next === 'imperial') {
      if (!isNaN(w)) weight = kgToLbs(w).toFixed(1)
      if (!isNaN(h)) {
        const { ft, inches } = cmToFtIn(h)
        height = String(ft)
        heightIn = String(inches)
      }
    } else {
      if (!isNaN(w)) weight = lbsToKg(w).toFixed(1)
      const ft = parseFloat(form.currentHeight)
      const inches = parseFloat(form.currentHeightIn || '0')
      if (!isNaN(ft)) height = ftInToCm(ft, isNaN(inches) ? 0 : inches).toFixed(0)
    }
    setForm((p) => ({ ...p, unit: next, currentWeight: weight, currentHeight: height, currentHeightIn: heightIn }))
  }

  const toggleGoal = (goal: string) => {
    setForm((p) => ({
      ...p,
      newGoals: p.newGoals.includes(goal) ? p.newGoals.filter((g) => g !== goal) : [...p.newGoals, goal],
    }))
  }

  const toggleDay = (day: string) => {
    if (form.unavailableDays.includes(day)) {
      setDayBlockError('')
      setForm((p) => ({ ...p, unavailableDays: p.unavailableDays.filter((d) => d !== day) }))
      return
    }
    const maxBlocked = 7 - parseInt(form.daysPerWeek, 10)
    if (form.unavailableDays.length >= maxBlocked) {
      setDayBlockError(
        `You want to train ${form.daysPerWeek} day${parseInt(form.daysPerWeek) !== 1 ? 's' : ''} a week, so you can only block up to ${maxBlocked} day${maxBlocked !== 1 ? 's' : ''}.`
      )
      return
    }
    setDayBlockError('')
    setForm((p) => ({ ...p, unavailableDays: [...p.unavailableDays, day] }))
  }

  // --- validation ---
  const wNum = parseFloat(form.currentWeight)
  const weightInvalid = form.currentWeight.trim() !== '' && (
    isNaN(wNum) ||
    (form.unit === 'metric' ? wNum < 30 || wNum > 300 : wNum < 66 || wNum > 661)
  )

  const ftNum = parseInt(form.currentHeight, 10)
  const inNum = parseInt(form.currentHeightIn || '0', 10)
  const hNum  = parseFloat(form.currentHeight)
  const heightInvalid = form.currentHeight.trim() !== '' && (
    form.unit === 'metric'
      ? isNaN(hNum) || hNum < 100 || hNum > 250
      : isNaN(ftNum) || ftNum < 3 || ftNum > 8 || isNaN(inNum) || inNum < 0 || inNum > 11
  )

  const weightKg = form.unit === 'metric'
    ? parseFloat(form.currentWeight)
    : lbsToKg(parseFloat(form.currentWeight))
  const heightCm = form.unit === 'metric'
    ? parseFloat(form.currentHeight)
    : ftInToCm(parseFloat(form.currentHeight) || 0, parseFloat(form.currentHeightIn) || 0)

  const canAdvance = () => {
    if (step === 1) return !!(form.timeOnPlan && form.adherence)
    if (step === 2) return !!(
      form.currentWeight.trim() && !weightInvalid &&
      form.currentHeight.trim() && !heightInvalid &&
      form.physicalFeel && form.difficulty
    )
    return true
  }

  const handleSubmit = () => {
    const originalStats = parseStatsFromPlan(original.originalPlan)
    const reevaluation: ReevaluationData = {
      originalPlanId: original.planId,
      originalPlan: original.originalPlan,
      userName: original.userName,
      fitnessLevel: original.fitnessLevel,
      goals: (() => { try { return JSON.parse(original.goals) as string[] } catch { return [] } })(),
      equipment: (() => { try { return JSON.parse(original.equipment) as string[] } catch { return [] } })(),
      timeOnPlan: form.timeOnPlan,
      adherence: form.adherence,
      originalWeight: originalStats.weight,
      originalHeight: originalStats.height,
      currentWeight: weightKg.toFixed(1),
      currentHeight: heightCm.toFixed(0),
      physicalFeel: form.physicalFeel,
      difficulty: form.difficulty,
      daysPerWeek: form.daysPerWeek,
      unavailableDays: form.unavailableDays,
      exercisesToRemove: form.exercisesToRemove,
      newInjuries: form.newInjuries,
      newGoals: form.newGoals,
    }
    navigate('/generating', { state: { reevaluation } })
  }

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <div className="mb-6">
        <p className="text-white/40 text-sm mb-1">Evolving plan for</p>
        <h1 className="text-3xl font-black tracking-tight gradient-text">{original.userName}'s Plan</h1>
      </div>

      <div className="mb-8">
        <StepIndicator currentStep={step} totalSteps={3} labels={STEP_LABELS} />
      </div>

      <GlassCard className="animate-slide-up">
        {/* Step 1 — Progress */}
        {step === 1 && (
          <div className="space-y-6">
            <StepHeader title="Progress Check" subtitle="Tell us how the last phase went." />

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                How long have you been following this plan?
              </label>
              <div className="flex flex-wrap gap-3">
                {['Less than 1 week', '1-2 weeks', '2-4 weeks', '1+ month'].map((v) => (
                  <button
                    key={v}
                    onClick={() => pick('timeOnPlan', v)}
                    className={`chip ${form.timeOnPlan === v ? 'active' : ''}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                How consistently did you follow it?
              </label>
              <div className="flex flex-wrap gap-3">
                {['Every session', 'Most sessions', 'About half', 'Rarely'].map((v) => (
                  <button
                    key={v}
                    onClick={() => pick('adherence', v)}
                    className={`chip ${form.adherence === v ? 'active' : ''}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Body */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <StepHeader title="Your Body Now" subtitle="Updated stats help us recalibrate your plan." />
              {/* Unit toggle */}
              <div className="flex rounded-xl overflow-hidden border border-white/10 flex-shrink-0 mt-1">
                {(['metric', 'imperial'] as const).map((u, i) => (
                  <button
                    key={u}
                    onClick={() => switchUnit(u)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      form.unit === u
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-white/5 text-white/40 hover:text-white/70'
                    } ${i === 0 ? 'border-r border-white/10' : ''}`}
                  >
                    {u === 'metric' ? 'Metric' : 'US Imperial'}
                  </button>
                ))}
              </div>
            </div>

            <div className={`grid gap-4 ${form.unit === 'imperial' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})
                </label>
                <input
                  className="input-glass"
                  type="number"
                  placeholder={form.unit === 'metric' ? 'e.g. 73' : 'e.g. 161'}
                  value={form.currentWeight}
                  onChange={(e) => update({ currentWeight: e.target.value })}
                />
                {weightInvalid && (
                  <p className="mt-1 text-xs text-red-400">{form.unit === 'metric' ? '30-300 kg' : '66-661 lbs'}</p>
                )}
              </div>

              {form.unit === 'metric' ? (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Height (cm)</label>
                  <input
                    className="input-glass"
                    type="number"
                    placeholder="e.g. 175"
                    value={form.currentHeight}
                    onChange={(e) => update({ currentHeight: e.target.value })}
                  />
                  {heightInvalid && <p className="mt-1 text-xs text-red-400">100-250 cm</p>}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">Feet</label>
                    <input
                      className="input-glass"
                      type="number"
                      placeholder="e.g. 5"
                      min="3"
                      max="8"
                      value={form.currentHeight}
                      onChange={(e) => update({ currentHeight: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">Inches</label>
                    <input
                      className="input-glass"
                      type="number"
                      placeholder="e.g. 11"
                      min="0"
                      max="11"
                      value={form.currentHeightIn}
                      onChange={(e) => update({ currentHeightIn: e.target.value })}
                    />
                  </div>
                  {heightInvalid && (
                    <p className="col-span-2 text-xs text-red-400">Enter feet (3-8) and inches (0-11).</p>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                How do you feel physically compared to when you started?
              </label>
              <div className="flex flex-wrap gap-3">
                {['Much stronger', 'Slightly improved', 'About the same', 'More fatigued'].map((v) => (
                  <button
                    key={v}
                    onClick={() => pick('physicalFeel', v)}
                    className={`chip ${form.physicalFeel === v ? 'active' : ''}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                How was the overall difficulty of the plan?
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['Too easy', 'Just right', 'Too hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => pick('difficulty', d)}
                    className={`py-3 rounded-2xl text-sm font-medium border transition-all duration-200 ${
                      form.difficulty === d
                        ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow'
                        : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {d === 'Too easy' ? '😴' : d === 'Just right' ? '✅' : '😤'} {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Adjustments */}
        {step === 3 && (
          <div className="space-y-6">
            <StepHeader title="Adjustments" subtitle="Update your schedule and anything else you want changed." />

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                Training days per week:{' '}
                <span className="text-white font-semibold">{form.daysPerWeek} days</span>
              </label>
              <input
                type="range"
                min="1"
                max="7"
                value={form.daysPerWeek}
                onChange={(e) => {
                  const val = e.target.value
                  const maxBlocked = 7 - parseInt(val, 10)
                  setDayBlockError('')
                  setForm((p) => ({
                    ...p,
                    daysPerWeek: val,
                    unavailableDays: p.unavailableDays.slice(0, maxBlocked),
                  }))
                }}
                className="w-full accent-purple-500 h-2 rounded-full"
              />
              <div className="flex justify-between text-xs text-white/30 mt-1">
                {[1,2,3,4,5,6,7].map((n) => <span key={n}>{n}</span>)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Days you cannot train{' '}
                <span className="text-white/25 text-xs font-normal">optional</span>
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_OPTIONS.map((day, i) => {
                  const unavailable = form.unavailableDays.includes(DAY_FULL[i])
                  const maxBlocked  = 7 - parseInt(form.daysPerWeek, 10)
                  const atLimit     = !unavailable && form.unavailableDays.length >= maxBlocked
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(DAY_FULL[i])}
                      disabled={atLimit}
                      className={`flex flex-col items-center py-2.5 rounded-2xl border transition-all duration-200 ${
                        unavailable
                          ? 'border-red-500/50 bg-red-500/15 text-red-300'
                          : atLimit
                          ? 'border-white/5 bg-white/2 text-white/20 cursor-not-allowed'
                          : 'border-white/10 bg-white/4 text-white/50 hover:bg-white/8 hover:text-white/80'
                      }`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide">{day}</span>
                      {unavailable && <span className="text-[9px] mt-0.5">✕</span>}
                    </button>
                  )
                })}
              </div>
              {dayBlockError ? (
                <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1.5">
                  <span>⚠</span>{dayBlockError}
                </p>
              ) : form.unavailableDays.length > 0 && (
                <p className="text-xs text-white/30 mt-2">
                  Blocked: {form.unavailableDays.join(', ')}
                </p>
              )}
            </div>

            <div className="border-t border-white/8 pt-6">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-5">
                Optional tweaks
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Exercises to remove or replace (optional)
              </label>
              <textarea
                className="input-glass resize-none"
                rows={3}
                placeholder="e.g. Burpees - too intense on knees, Plank - get bored of it..."
                value={form.exercisesToRemove}
                onChange={(e) => update({ exercisesToRemove: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                New injuries or limitations (optional)
              </label>
              <textarea
                className="input-glass resize-none"
                rows={2}
                placeholder="e.g. Shoulder strain, avoid overhead pressing..."
                value={form.newInjuries}
                onChange={(e) => update({ newInjuries: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                Want to shift focus? (optional)
              </label>
              <div className="flex flex-wrap gap-3">
                {GOAL_OPTIONS.map(({ label, icon }) => (
                  <button
                    key={label}
                    onClick={() => toggleGoal(label)}
                    className={`chip ${form.newGoals.includes(label) ? 'active' : ''}`}
                  >
                    <span>{icon}</span> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
          <button
            onClick={() => step === 1 ? navigate('/history') : setStep((s) => s - 1)}
            className="btn-ghost"
          >
            <HiArrowNarrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            >
              Continue
              <HiArrowNarrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSubmit} className="btn-primary">
              Evolve My Plan ✨
            </button>
          )}
        </div>
      </GlassCard>
    </main>
  )
}
