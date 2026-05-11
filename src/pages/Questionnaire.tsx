import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { id } from '@instantdb/react'
import StepIndicator from '@/components/StepIndicator'
import GlassCard from '@/components/GlassCard'
import { type WorkoutFormData } from '@/lib/gemini'
import { saveNutritionProfile } from '@/lib/nutrition'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { requestNotificationPermission } from '@/lib/notifications'

type Unit = 'metric' | 'imperial'

interface FormData {
  unit: Unit
  age: string
  sex: '' | 'male' | 'female'
  weight: string   // kg (metric) or lbs (imperial)
  height: string   // cm (metric) or feet (imperial)
  heightIn: string // inches — imperial only
  fitnessLevel: '' | 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
  equipment: string[]
  equipmentNotes: string
  injuries: string
  daysPerWeek: string
  sessionDuration: string
  unavailableDays: string[]
  otherSports: string[]
  dietType: string
  foodAllergies: string[]
  customRestrictions: string
  mealsPerDay: string
  images: string[]
}

const INITIAL: FormData = {
  unit: 'metric',
  age: '',
  sex: '',
  weight: '',
  height: '',
  heightIn: '',
  fitnessLevel: '',
  goals: [],
  equipment: [],
  equipmentNotes: '',
  injuries: '',
  daysPerWeek: '3',
  sessionDuration: '45',
  unavailableDays: [],
  otherSports: [],
  dietType: '',
  foodAllergies: [],
  customRestrictions: '',
  mealsPerDay: '3',
  images: [],
}

// --- unit helpers ---
function lbsToKg(lbs: number) { return lbs / 2.2046 }
function kgToLbs(kg: number)  { return kg * 2.2046 }
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) }
}
function ftInToCm(ft: number, inches: number) { return (ft * 12 + inches) * 2.54 }

function toMetricWeight(value: string, unit: Unit): number {
  const n = parseFloat(value)
  return unit === 'metric' ? n : lbsToKg(n)
}
function toMetricHeight(height: string, heightIn: string, unit: Unit): number {
  if (unit === 'metric') return parseFloat(height)
  return ftInToCm(parseFloat(height) || 0, parseFloat(heightIn) || 0)
}

function generatePlanName(goals: string[], fitnessLevel: string, equipment: string[], daysPerWeek: string): string {
  const d = parseInt(daysPerWeek, 10)
  const bodyweightOnly = equipment.length === 1 && equipment[0] === 'Bodyweight Only'
  const hasHeavy = equipment.some(e => ['Barbell', 'Kettlebell'].includes(e))

  if (goals.includes('Body Recomposition')) return 'Body Recomposition Program'
  if (goals.includes('Weight Loss') && goals.includes('Muscle Gain')) return 'Body Recomposition Program'
  if (goals.includes('Weight Loss') && d >= 5) return 'High-Frequency Fat Loss Program'
  if (goals.includes('Weight Loss') && bodyweightOnly) return 'Bodyweight Burn Program'
  if (goals.includes('Weight Loss')) return 'Fat Loss Circuit Program'
  if (goals.includes('Strength') && hasHeavy && fitnessLevel === 'advanced') return 'Strength Powerlifting Program'
  if (goals.includes('Strength') && hasHeavy) return 'Strength Training Program'
  if (goals.includes('Strength')) return 'Bodyweight Strength Program'
  if (goals.includes('Muscle Gain') && hasHeavy && fitnessLevel === 'advanced') return 'Powerbuilding Program'
  if (goals.includes('Muscle Gain') && hasHeavy) return 'Strength and Hypertrophy Program'
  if (goals.includes('Muscle Gain') && bodyweightOnly) return 'Calisthenics Strength Program'
  if (goals.includes('Muscle Gain')) return 'Muscle Building Program'
  if (goals.includes('Athletic Performance')) return 'Athletic Performance Program'
  if (goals.includes('Endurance') && d >= 5) return 'High-Volume Endurance Program'
  if (goals.includes('Endurance')) return 'Cardio and Conditioning Program'
  if (goals.includes('Flexibility') && goals.includes('Stress Relief')) return 'Mobility and Wellness Program'
  if (goals.includes('Flexibility')) return 'Flexibility and Mobility Program'
  if (goals.includes('Stress Relief')) return 'Mindful Movement Program'
  if (fitnessLevel === 'beginner') return 'Foundation Fitness Program'
  if (fitnessLevel === 'advanced') return 'Advanced Performance Program'
  return 'General Fitness Program'
}

const STEP_LABELS = ['Profile', 'Goals', 'Equipment', 'Schedule', 'Diet', 'Space', 'Notifications']


interface BmiRec {
  bmi: number
  category: string
  color: string
  recommended: string[]
  message: string
}

function getBmiRecommendations(wKg: number, hCm: number): BmiRec | null {
  const h = hCm / 100
  if (!wKg || !h || h <= 0 || wKg < 20 || hCm < 100) return null
  const bmi = wKg / (h * h)
  if (bmi < 10 || bmi > 60) return null
  if (bmi < 18.5) return {
    bmi, category: 'Underweight', color: 'text-blue-300',
    recommended: ['Muscle Gain', 'Strength', 'General Fitness'],
    message: 'Building strength and gaining healthy weight may be most beneficial for you right now.',
  }
  if (bmi < 25) return {
    bmi, category: 'Healthy weight', color: 'text-green-300',
    recommended: ['Endurance', 'Flexibility', 'Athletic Performance', 'General Fitness'],
    message: 'Great foundation. Improving stamina and flexibility could be your next step.',
  }
  if (bmi < 30) return {
    bmi, category: 'Overweight', color: 'text-yellow-300',
    recommended: ['Weight Loss', 'Body Recomposition', 'Endurance'],
    message: 'A mix of fat-burning and cardio tends to work well for your current profile.',
  }
  return {
    bmi, category: 'Obese', color: 'text-red-300',
    recommended: ['Weight Loss', 'Endurance'],
    message: 'Starting with weight management and steady cardio is often the most effective approach.',
  }
}

const MAX_GOALS = 3

const GOAL_OPTIONS = [
  { label: 'Weight Loss',          icon: '🔥', conflictsWith: ['Muscle Gain'] },
  { label: 'Muscle Gain',          icon: '💪', conflictsWith: ['Weight Loss'] },
  { label: 'Body Recomposition',   icon: '⚖️', conflictsWith: [] },
  { label: 'Strength',             icon: '🏋️', conflictsWith: [] },
  { label: 'Endurance',            icon: '🏃', conflictsWith: [] },
  { label: 'Athletic Performance', icon: '🏆', conflictsWith: [] },
  { label: 'Flexibility',          icon: '🧘', conflictsWith: [] },
  { label: 'General Fitness',      icon: '⚡', conflictsWith: [] },
  { label: 'Stress Relief',        icon: '🌿', conflictsWith: [] },
]

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL    = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SPORT_OPTIONS = [
  { label: 'Basketball',   icon: '🏀' },
  { label: 'Volleyball',   icon: '🏐' },
  { label: 'Soccer',       icon: '⚽' },
  { label: 'Tennis',       icon: '🎾' },
  { label: 'Swimming',     icon: '🏊' },
  { label: 'Cycling',      icon: '🚴' },
  { label: 'Running',      icon: '🏃' },
  { label: 'Boxing',       icon: '🥊' },
  { label: 'Martial Arts', icon: '🥋' },
  { label: 'Yoga',         icon: '🧘' },
  { label: 'Baseball',     icon: '⚾' },
  { label: 'Golf',         icon: '⛳' },
  { label: 'Climbing',     icon: '🧗' },
  { label: 'Skiing',       icon: '⛷️' },
]

const EQUIPMENT_OPTIONS = [
  { label: 'Dumbbells',                  icon: '🏋️' },
  { label: 'Resistance Bands',           icon: '🟡' },
  { label: 'Pull-up Bar',                icon: '🔱' },
  { label: 'Yoga Mat',                   icon: '🟪' },
  { label: 'Jump Rope',                  icon: '🪢' },
  { label: 'Kettlebell',                 icon: '⚙️' },
  { label: 'Barbell',                    icon: '🏋️‍♂️' },
  { label: 'Bench',                      icon: '🪑' },
  { label: 'Squat Rack',                 icon: '🏗️' },
  { label: 'Cable Machine',              icon: '🔗' },
  { label: 'Dip Bars',                   icon: '⬇️' },
  { label: 'TRX / Suspension Trainer',   icon: '🎯' },
  { label: 'Treadmill / Cardio Machine', icon: '🏃' },
  { label: 'Full Gym Access',            icon: '🏢' },
  { label: 'Bodyweight Only',            icon: '🙆' },
]

const DIET_OPTIONS = [
  { value: 'omnivore',     label: 'Omnivore',           desc: 'No restrictions' },
  { value: 'vegetarian',   label: 'Vegetarian',         desc: 'No meat, includes dairy and eggs' },
  { value: 'vegan',        label: 'Vegan',              desc: 'Entirely plant-based' },
  { value: 'pescatarian',  label: 'Pescatarian',        desc: 'Fish ok, no other meat' },
  { value: 'keto',         label: 'Keto / Low-carb',    desc: 'High fat, very low carbs' },
  { value: 'paleo',        label: 'Paleo',              desc: 'Whole foods, no grains or dairy' },
  { value: 'halal',        label: 'Halal',              desc: 'No pork or alcohol, halal-certified meat' },
  { value: 'kosher',       label: 'Kosher',             desc: 'No pork or shellfish, no mixing meat and dairy' },
  { value: 'hindu-veg',    label: 'Hindu Vegetarian',   desc: 'No beef, typically lacto-vegetarian' },
  { value: 'jain',         label: 'Jain',               desc: 'No meat, no root vegetables (onion, garlic, potato)' },
]

const ALLERGY_OPTIONS = ['Gluten-free', 'Dairy-free', 'Nut-free', 'Egg-free', 'Shellfish-free', 'Soy-free']

const DURATION_OPTIONS = ['20', '30', '45', '60', '90', '120']
const PRESET_EQUIPMENT_LABELS = new Set(EQUIPMENT_OPTIONS.map((o) => o.label))

export default function Questionnaire() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [error, setError] = useState('')
  const [goalConflictMsg, setGoalConflictMsg] = useState('')
  const [dayBlockError, setDayBlockError] = useState('')
  const [customSport, setCustomSport]     = useState('')
  const [customInput, setCustomInput] = useState('')
  const [showMoreDiets, setShowMoreDiets] = useState(false)
  // Step 0 fields
  const [name, setName] = useState('')
  const navigate = useNavigate()

  const userId = getUserId()
  const { data: profileData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })

  const update = (patch: Partial<FormData>) => setForm((p) => ({ ...p, ...patch }))

  const switchUnit = (next: Unit) => {
    if (next === form.unit) return
    let weight = ''
    let height = ''
    let heightIn = ''
    const w = parseFloat(form.weight)
    const h = parseFloat(form.height)
    if (next === 'imperial') {
      if (!isNaN(w)) weight = kgToLbs(w).toFixed(1)
      if (!isNaN(h)) {
        const { ft, inches } = cmToFtIn(h)
        height = String(ft)
        heightIn = String(inches)
      }
    } else {
      if (!isNaN(w)) weight = lbsToKg(w).toFixed(1)
      const ft = parseFloat(form.height)
      const inches = parseFloat(form.heightIn || '0')
      if (!isNaN(ft)) height = ftInToCm(ft, isNaN(inches) ? 0 : inches).toFixed(0)
    }
    setForm((p) => ({ ...p, unit: next, weight, height, heightIn }))
  }

  const toggleGoal = (label: string) => {
    setGoalConflictMsg('')
    setForm((p) => {
      if (p.goals.includes(label)) return { ...p, goals: p.goals.filter(g => g !== label) }
      const opt = GOAL_OPTIONS.find(o => o.label === label)
      const conflict = opt?.conflictsWith.find(c => p.goals.includes(c))
      if (conflict) {
        setGoalConflictMsg(`"${label}" and "${conflict}" are contradictory. For both, try "Body Recomposition".`)
        return p
      }
      if (p.goals.length >= MAX_GOALS) {
        setGoalConflictMsg(`You can select up to ${MAX_GOALS} goals.`)
        return p
      }
      return { ...p, goals: [...p.goals, label] }
    })
  }

  const toggleArray = (key: 'equipment' | 'foodAllergies', value: string) => {
    setForm((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }))
  }

  const toggleUnavailableDay = (day: string) => {
    if (form.unavailableDays.includes(day)) {
      setDayBlockError('')
      setForm((p) => ({ ...p, unavailableDays: p.unavailableDays.filter(d => d !== day) }))
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

  const toggleSport = (sportName: string) => {
    setForm((p) => ({
      ...p,
      otherSports: p.otherSports.includes(sportName)
        ? p.otherSports.filter(s => s !== sportName)
        : [...p.otherSports, sportName],
    }))
  }

  const addCustomSport = () => {
    const name = customSport.trim()
    if (!name || form.otherSports.includes(name)) return
    setForm((p) => ({ ...p, otherSports: [...p.otherSports, name] }))
    setCustomSport('')
  }

  const addCustomEquipment = () => {
    const item = customInput.trim()
    if (!item || form.equipment.includes(item)) return
    setForm((p) => ({ ...p, equipment: [...p.equipment, item] }))
    setCustomInput('')
  }

  const removeEquipment = (item: string) => {
    setForm((p) => ({ ...p, equipment: p.equipment.filter((e) => e !== item) }))
  }

  const removeImage = (index: number) => {
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== index) }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const slots = 3 - form.images.length
    files.slice(0, slots).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        setForm((p) => ({ ...p, images: [...p.images, result] }))
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // --- validation ---
  const ageNum = parseInt(form.age, 10)
  const ageInvalid = form.age.trim() !== '' && (isNaN(ageNum) || ageNum > 79 || ageNum <= 13)

  const wNum = parseFloat(form.weight)
  const weightInvalid = form.weight.trim() !== '' && (
    isNaN(wNum) ||
    (form.unit === 'metric'   ? wNum < 30  || wNum > 300  : wNum < 66  || wNum > 661)
  )

  const ftNum = parseInt(form.height, 10)
  const inNum = parseInt(form.heightIn || '0', 10)
  const hNum  = parseFloat(form.height)
  const heightInvalid = form.height.trim() !== '' && (
    form.unit === 'metric'
      ? isNaN(hNum) || hNum < 100 || hNum > 250
      : isNaN(ftNum) || ftNum < 3 || ftNum > 8 || isNaN(inNum) || inNum < 0 || inNum > 11
  )

  const weightKg = toMetricWeight(form.weight, form.unit)
  const heightCm = toMetricHeight(form.height, form.heightIn, form.unit)
  const bmiRec   = getBmiRecommendations(weightKg, heightCm)

  const handleNext = () => {
    setError('')
    if (step === 0) {
      const existing = (profileData?.userProfiles ?? []) as Array<{ id: string }>
      if (existing.length === 0) {
        void db.transact(db.tx.userProfiles[id()].update({
          userId, name: name.trim(), createdAt: Date.now(),
        }))
      }
    }
    setStep(s => s + 1)
  }

  const canAdvance = (): boolean => {
    if (step === 0) return name.trim().length >= 2
    if (step === 1) return !!(
      form.age.trim() && form.sex && form.fitnessLevel &&
      !ageInvalid && form.weight.trim() && !weightInvalid &&
      form.height.trim() && !heightInvalid
    )
    if (step === 2) return form.goals.length > 0
    if (step === 3) return form.equipment.length > 0
    if (step === 4) return !!(form.daysPerWeek && form.sessionDuration)
    if (step === 5) return !!form.dietType
    return true
  }

  const handleSubmit = () => {
    const planName = generatePlanName(form.goals, form.fitnessLevel, form.equipment, form.daysPerWeek)
    saveNutritionProfile({
      sex: form.sex as 'male' | 'female',
      age: parseInt(form.age, 10),
      weight: weightKg,
      height: heightCm,
      goals: form.goals,
      daysPerWeek: parseInt(form.daysPerWeek, 10),
      dietType: form.dietType,
      allergies: form.foodAllergies,
      mealsPerDay: parseInt(form.mealsPerDay, 10) || 3,
    })
    const payload: WorkoutFormData = {
      planName,
      age: form.age,
      weight: weightKg.toFixed(1),
      height: heightCm.toFixed(0),
      fitnessLevel: form.fitnessLevel as WorkoutFormData['fitnessLevel'],
      goals: form.goals,
      equipment: form.equipment,
      equipmentNotes: '',
      injuries: form.injuries,
      daysPerWeek: form.daysPerWeek,
      sessionDuration: form.sessionDuration,
      unavailableDays: form.unavailableDays,
      otherSports: form.otherSports.length > 0 ? form.otherSports : undefined,
      images: form.images,
      dietType: form.dietType,
      allergies: form.foodAllergies,
      customRestrictions: form.customRestrictions,
      mealsPerDay: form.mealsPerDay,
    }
    navigate('/generating', { state: { payload } })
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      {step > 0 && (
        <div className="mb-8">
          <StepIndicator currentStep={step} totalSteps={7} labels={STEP_LABELS} />
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <GlassCard className="animate-slide-up">
        {/* Step 0 — Welcome */}
        {step === 0 && (
          <div className="space-y-6">
            <StepHeader title="Welcome! Let's get started" subtitle="What should we call you?" />
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Your name <span className="text-red-400">*</span></label>
              <input
                className="input-glass"
                type="text"
                placeholder="e.g. Alex"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canAdvance()) handleNext() }}
              />
            </div>
          </div>
        )}

        {/* Step 1 — Profile */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <StepHeader title="Your Profile" subtitle="Let's start with the basics." />
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

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Age</label>
                  <input
                    className="input-glass"
                    type="number"
                    min="14"
                    max="79"
                    placeholder="e.g. 28"
                    value={form.age}
                    onChange={(e) => update({ age: e.target.value })}
                  />
                  {ageInvalid && (
                    <p className="mt-1 text-xs text-red-400">
                      {ageNum > 79 ? 'Max age 79.' : 'Must be over 13.'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5">
                    Sex{' '}
                    <span className="text-white/25 text-xs font-normal">for calorie targets</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['male', 'female'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => update({ sex: s })}
                        className={`py-2.5 rounded-2xl text-sm font-medium border transition-all duration-200 capitalize ${
                          form.sex === s
                            ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow'
                            : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'
                        }`}
                      >
                        {s === 'male' ? '♂ Male' : '♀ Female'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weight + Height */}
              <div className={`grid gap-4 ${form.unit === 'imperial' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})
                  </label>
                  <input
                    className="input-glass"
                    type="number"
                    placeholder={form.unit === 'metric' ? 'e.g. 75' : 'e.g. 165'}
                    value={form.weight}
                    onChange={(e) => update({ weight: e.target.value })}
                  />
                  {weightInvalid && (
                    <p className="mt-1 text-xs text-red-400">
                      {form.unit === 'metric' ? '30-300 kg' : '66-661 lbs'}
                    </p>
                  )}
                </div>

                {form.unit === 'metric' ? (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">Height (cm)</label>
                    <input
                      className="input-glass"
                      type="number"
                      placeholder="e.g. 175"
                      value={form.height}
                      onChange={(e) => update({ height: e.target.value })}
                    />
                    {heightInvalid && (
                      <p className="mt-1 text-xs text-red-400">100-250 cm</p>
                    )}
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
                        value={form.height}
                        onChange={(e) => update({ height: e.target.value })}
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
                        value={form.heightIn}
                        onChange={(e) => update({ heightIn: e.target.value })}
                      />
                    </div>
                    {heightInvalid && (
                      <p className="col-span-2 mt-1 text-xs text-red-400">Enter feet (3-8) and inches (0-11).</p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">Fitness Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => update({ fitnessLevel: level })}
                      className={`py-3 rounded-2xl text-sm font-medium border transition-all duration-200 capitalize ${
                        form.fitnessLevel === level
                          ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow'
                          : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'
                      }`}
                    >
                      {level === 'beginner' ? '🌱' : level === 'intermediate' ? '🔥' : '⚡'} {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Goals */}
        {step === 2 && (
          <div className="space-y-6">
            <StepHeader
              title="Your Goals"
              subtitle={`Choose up to ${MAX_GOALS} goals. Some combinations don't mix well.`}
            />

            {/* BMI-based recommendation banner */}
            {bmiRec && (
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-purple-500/8 border border-purple-500/20">
                <svg className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div className="space-y-0.5">
                  <p className="text-sm text-white/80 leading-relaxed">
                    Your BMI is{' '}
                    <span className="font-semibold text-white">{bmiRec.bmi.toFixed(1)}</span>
                    {' '}<span className={`text-xs font-medium ${bmiRec.color}`}>({bmiRec.category})</span>
                    {'. '}{bmiRec.message}
                  </p>
                  <p className="text-xs text-white/35">Goals marked with ✦ are suggested for your profile.</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-x-3 gap-y-5 pt-1">
              {GOAL_OPTIONS.map(({ label, icon }) => {
                const suggested = bmiRec?.recommended.includes(label) ?? false
                const selected  = form.goals.includes(label)
                const opt       = GOAL_OPTIONS.find(o => o.label === label)!
                const hasConflict = opt.conflictsWith.some(c => form.goals.includes(c))
                const atMax     = form.goals.length >= MAX_GOALS && !selected
                const disabled  = !selected && (hasConflict || atMax)
                return (
                  <div key={label} className="relative">
                    {suggested && !selected && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10
                                       text-[9px] px-2 py-0.5 rounded-full font-semibold
                                       bg-purple-500 text-white tracking-wide whitespace-nowrap">
                        ✦ Suggested
                      </span>
                    )}
                    <button
                      onClick={() => toggleGoal(label)}
                      disabled={disabled}
                      className={`chip ${selected ? 'active' : ''} ${
                        suggested && !selected ? 'border-purple-500/50' : ''
                      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                      <span>{icon}</span> {label}
                    </button>
                  </div>
                )
              })}
            </div>

            {goalConflictMsg && (
              <p className="text-sm text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                {goalConflictMsg}
              </p>
            )}

            {form.goals.length > 0 && (
              <p className="text-sm text-white/40">
                Selected: {form.goals.join(', ')}
                {form.goals.length === MAX_GOALS && (
                  <span className="text-amber-400/60 ml-2">(max reached)</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Equipment */}
        {step === 3 && (
          <div className="space-y-6">
            <StepHeader title="Available Equipment" subtitle="Select presets or type anything you have at home." />
            <div className="flex flex-wrap gap-3">
              {EQUIPMENT_OPTIONS.map(({ label, icon }) => (
                <button
                  key={label}
                  onClick={() => toggleArray('equipment', label)}
                  className={`chip ${form.equipment.includes(label) ? 'active' : ''}`}
                >
                  <span>{icon}</span> {label}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Add your own equipment</label>
              <div className="flex gap-2">
                <input
                  className="input-glass flex-1"
                  placeholder="e.g. chair, bed, water bottles, stairs..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEquipment() } }}
                />
                <button
                  onClick={addCustomEquipment}
                  disabled={!customInput.trim() || form.equipment.includes(customInput.trim())}
                  className="btn-ghost !px-4 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  Add
                </button>
              </div>
            </div>
            {form.equipment.some((e) => !PRESET_EQUIPMENT_LABELS.has(e)) && (
              <div>
                <p className="text-xs text-white/40 mb-2">Your custom items</p>
                <div className="flex flex-wrap gap-2">
                  {form.equipment.filter((e) => !PRESET_EQUIPMENT_LABELS.has(e)).map((item) => (
                    <span key={item} className="chip active flex items-center gap-1.5">
                      {item}
                      <button
                        onClick={() => removeEquipment(item)}
                        className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-xs leading-none transition-colors"
                        aria-label={`Remove ${item}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Schedule */}
        {step === 4 && (
          <div className="space-y-6">
            <StepHeader title="Your Schedule" subtitle="When can you train and what else do you do?" />
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
                  const unavailable  = form.unavailableDays.includes(DAY_FULL[i])
                  const maxBlocked   = 7 - parseInt(form.daysPerWeek, 10)
                  const atLimit      = !unavailable && form.unavailableDays.length >= maxBlocked
                  return (
                    <button
                      key={day}
                      onClick={() => toggleUnavailableDay(DAY_FULL[i])}
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

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">Session duration</label>
              <div className="flex gap-3 flex-wrap">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => update({ sessionDuration: d })}
                    className={`px-5 py-2.5 rounded-2xl text-sm font-medium border transition-all duration-200 ${
                      form.sessionDuration === d
                        ? 'text-white border-purple-500/60 bg-purple-500/15'
                        : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">
                Other sports or activities{' '}
                <span className="text-white/25 text-xs font-normal">optional</span>
              </label>

              {/* Sport chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {SPORT_OPTIONS.map(({ label, icon }) => {
                  const selected = form.otherSports.includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleSport(label)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all duration-200 ${
                        selected
                          ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                          : 'border-white/10 bg-white/4 text-white/50 hover:bg-white/8 hover:text-white/80'
                      }`}
                    >
                      <span>{icon}</span>
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Custom sport input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={customSport}
                  onChange={e => setCustomSport(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomSport()}
                  placeholder="Other sport or activity..."
                  className="input-glass flex-1 !py-2 !text-sm"
                />
                <button
                  type="button"
                  onClick={addCustomSport}
                  disabled={!customSport.trim()}
                  className="btn-ghost !px-4 !py-2 !text-sm disabled:opacity-30"
                >
                  Add
                </button>
              </div>

              {form.otherSports.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.otherSports.filter(s => !SPORT_OPTIONS.some(o => o.label === s)).map(sport => (
                    <span key={sport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border border-purple-500/50 bg-purple-500/15 text-purple-300">
                      {sport}
                      <button
                        type="button"
                        onClick={() => toggleSport(sport)}
                        className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-xs leading-none transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <p className="text-white/25 text-xs mt-1">
                The AI will account for these activities when designing your training schedule.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Injuries or limitations{' '}
                <span className="text-white/25 text-xs font-normal">optional</span>
              </label>
              <textarea
                className="input-glass resize-none"
                rows={3}
                placeholder="e.g. Lower back pain, avoid high-impact, left knee surgery..."
                value={form.injuries}
                onChange={(e) => update({ injuries: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Step 5 — Diet */}
        {step === 5 && (
          <div className="space-y-6">
            <StepHeader title="Your Diet" subtitle="Help us tailor your nutrition guidance to how you already eat." />

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">Diet type</label>
              <div className="grid grid-cols-2 gap-2.5">
                {DIET_OPTIONS.slice(0, 6).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => update({ dietType: value })}
                    className={`text-left py-3 px-4 rounded-2xl border transition-all duration-200 ${
                      form.dietType === value
                        ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow'
                        : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/8 hover:text-white/80'
                    }`}
                  >
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-[11px] text-white/35 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>

              {/* Religious / specialty diets */}
              {(showMoreDiets || DIET_OPTIONS.slice(6).some(o => o.value === form.dietType)) && (
                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                  {DIET_OPTIONS.slice(6).map(({ value, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => update({ dietType: value })}
                      className={`text-left py-3 px-4 rounded-2xl border transition-all duration-200 ${
                        form.dietType === value
                          ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow'
                          : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/8 hover:text-white/80'
                      }`}
                    >
                      <span className="block text-sm font-medium">{label}</span>
                      <span className="block text-[11px] text-white/35 mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowMoreDiets(v => !v)}
                className="mt-3 flex items-center gap-1.5 text-xs text-purple-400/70 hover:text-purple-300 transition-colors"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showMoreDiets ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {showMoreDiets ? 'Show less' : 'More diet types (Halal, Kosher, Hindu, Jain...)'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Common allergies and intolerances{' '}
                <span className="text-white/25 text-xs font-normal">optional</span>
              </label>
              <div className="flex flex-wrap gap-2.5">
                {ALLERGY_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleArray('foodAllergies', item)}
                    className={`chip ${form.foodAllergies.includes(item) ? 'active' : ''}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                Any other restrictions{' '}
                <span className="text-white/25 text-xs font-normal">optional</span>
              </label>
              <textarea
                className="input-glass resize-none"
                rows={2}
                placeholder="e.g. no red meat, no MSG, no onion or garlic, specific cultural rules..."
                value={form.customRestrictions}
                onChange={(e) => update({ customRestrictions: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">Meals per day</label>
              <div className="flex gap-3">
                {['2', '3', '4', '5+'].map((n) => (
                  <button
                    key={n}
                    onClick={() => update({ mealsPerDay: n })}
                    className={`flex-1 py-3 rounded-2xl text-sm font-medium border transition-all duration-200 ${
                      form.mealsPerDay === n
                        ? 'text-white border-purple-500/60 bg-purple-500/15'
                        : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 6 — Space (optional) */}
        {step === 6 && (
          <div className="space-y-6">
            <StepHeader
              title="Your Space"
              subtitle="Optionally upload photos of your home gym to help us tailor your plan."
            />
            {form.images.length < 3 && (
              <label
                htmlFor="img-upload"
                className="block border-2 border-dashed border-white/15 rounded-3xl p-10 text-center
                           cursor-pointer transition-all duration-200 hover:border-purple-500/40 hover:bg-white/3"
              >
                <input
                  id="img-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="text-4xl mb-3">📸</div>
                <p className="text-white/60 font-medium">Drop photos here or click to upload</p>
                <p className="text-white/30 text-sm mt-1">
                  Up to {3 - form.images.length} more image{3 - form.images.length !== 1 ? 's' : ''}
                </p>
              </label>
            )}
            {form.images.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {form.images.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt={`Upload ${i + 1}`} className="w-28 h-28 rounded-2xl object-cover border border-white/10" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-xs
                                 text-white flex items-center justify-center opacity-0
                                 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
              <p className="text-sm text-white/40 leading-relaxed">
                <span className="text-white/60 font-medium">Note:</span> Photos help identify your available
                equipment and space constraints. Your images are only used to generate the plan and are not stored.
              </p>
            </div>
          </div>
        )}

        {/* Step 7 — Notifications */}
        {step === 7 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}
              >
                🔔
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Stay on track</h2>
              <p className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                Get reminders when it's time to train, log meals, or hit your streak.
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => { await requestNotificationPermission(); handleSubmit() }}
                className="btn-primary w-full !justify-center"
              >
                Enable notifications
              </button>
              <button
                onClick={handleSubmit}
                className="btn-ghost w-full !justify-center"
              >
                Maybe later
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5 5-5M18 12H6" />
            </svg>
            Back
          </button>

          {step < 7 && (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
            >
              Continue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          )}
        </div>
      </GlassCard>
    </main>
  )
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-white/50 mt-1">{subtitle}</p>
    </div>
  )
}
