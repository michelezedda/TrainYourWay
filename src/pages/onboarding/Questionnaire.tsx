import { useState, useEffect, useRef } from 'react'
import { HiArrowNarrowLeft, HiLightningBolt, HiExclamation } from 'react-icons/hi'
import { IoIosMale } from "react-icons/io"
import { CgShapeTriangle, CgShapeSquare, CgShapeCircle } from "react-icons/cg"
import { IoFemaleOutline } from "react-icons/io5"
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import GlassCard from '@/components/GlassCard'
import { type WorkoutFormData } from '@/lib/gemini'
import { saveNutritionProfile } from '@/lib/nutrition'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { requestNotificationPermission } from '@/lib/notifications'
import { getUnit, saveUnit, lbsToKg, kgToLbs, cmToFtIn, ftInToCm, toMetricWeight, toMetricHeight, type Unit } from '@/lib/units'

interface FormData {
  name: string
  unit: Unit
  birthDay: string
  birthMonth: string
  birthYear: string
  sex: '' | 'male' | 'female'
  bodyType: '' | 'ectomorph' | 'mesomorph' | 'endomorph'
  weight: string
  height: string
  heightIn: string
  fitnessLevel: '' | 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
  gymAccess: '' | 'gym' | 'home'
  equipment: string[]
  equipmentNotes: string
  injuries: string
  workoutDays: string[]
  sessionDuration: string
  otherSports: string[]
  dietType: string
  foodAllergies: string[]
  customRestrictions: string
  images: string[]
}

const INITIAL: FormData = {
  name: '',
  unit: 'metric',
  birthDay: '',
  birthMonth: '',
  birthYear: '',
  sex: '',
  bodyType: '',
  weight: '',
  height: '',
  heightIn: '',
  fitnessLevel: '',
  goals: [],
  gymAccess: '',
  equipment: [],
  equipmentNotes: '',
  injuries: '',
  workoutDays: [],
  sessionDuration: '45',
  otherSports: [],
  dietType: '',
  foodAllergies: [],
  customRestrictions: '',
  images: [],
}

// ── Birthday helpers ───────────────────────────────────────────────────────────
function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}
function computeAgeFromBirthday(day: number, month: number, year: number): number {
  const today = new Date()
  let age = today.getFullYear() - year
  const m = today.getMonth() - (month - 1)
  if (m < 0 || (m === 0 && today.getDate() < day)) age--
  return age
}

// ── Plan name generator ────────────────────────────────────────────────────────
function generatePlanName(goals: string[], fitnessLevel: string, equipment: string[], workoutDays: string[]): string {
  const d = workoutDays.length
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

// ── BMI recommendations ────────────────────────────────────────────────────────
interface BmiRec { bmi: number; category: string; color: string; recommended: string[]; message: string }
function getBmiRecommendations(wKg: number, hCm: number): BmiRec | null {
  const h = hCm / 100
  if (!wKg || !h || h <= 0 || wKg < 20 || hCm < 100) return null
  const bmi = wKg / (h * h)
  if (bmi < 10 || bmi > 60) return null
  if (bmi < 18.5) return { bmi, category: 'Underweight', color: 'text-blue-300', recommended: ['Muscle Gain', 'Strength', 'General Fitness'], message: 'Building strength and gaining healthy weight may be most beneficial for you right now.' }
  if (bmi < 25) return { bmi, category: 'Healthy weight', color: 'text-green-300', recommended: ['Endurance', 'Flexibility', 'Athletic Performance', 'General Fitness'], message: 'Great foundation. Improving stamina and flexibility could be your next step.' }
  if (bmi < 30) return { bmi, category: 'Overweight', color: 'text-yellow-300', recommended: ['Weight Loss', 'Body Recomposition', 'Endurance'], message: 'A mix of fat-burning and cardio tends to work well for your current profile.' }
  return { bmi, category: 'Obese', color: 'text-red-300', recommended: ['Weight Loss', 'Endurance'], message: 'Starting with weight management and steady cardio is often the most effective approach.' }
}

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_GOALS = 3
const GOAL_OPTIONS = [
  { label: 'Weight Loss', icon: '🔥', conflictsWith: ['Muscle Gain'] },
  { label: 'Muscle Gain', icon: '💪', conflictsWith: ['Weight Loss'] },
  { label: 'Body Recomposition', icon: '⚖️', conflictsWith: [] },
  { label: 'Strength', icon: '🏋️', conflictsWith: [] },
  { label: 'Endurance', icon: '🏃', conflictsWith: [] },
  { label: 'Athletic Performance', icon: '🏆', conflictsWith: [] },
  { label: 'Flexibility', icon: '🧘', conflictsWith: [] },
  { label: 'General Fitness', icon: '⚡', conflictsWith: [] },
  { label: 'Stress Relief', icon: '🌿', conflictsWith: [] },
]
const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SPORT_OPTIONS = [
  { label: 'Basketball', icon: '🏀' }, { label: 'Volleyball', icon: '🏐' }, { label: 'Soccer', icon: '⚽' },
  { label: 'Tennis', icon: '🎾' }, { label: 'Swimming', icon: '🏊' }, { label: 'Cycling', icon: '🚴' },
  { label: 'Running', icon: '🏃' }, { label: 'Boxing', icon: '🥊' }, { label: 'Martial Arts', icon: '🥋' },
  { label: 'Yoga', icon: '🧘' }, { label: 'Baseball', icon: '⚾' }, { label: 'Golf', icon: '⛳' },
  { label: 'Climbing', icon: '🧗' }, { label: 'Skiing', icon: '⛷️' },
]
const HOME_EQUIPMENT_OPTIONS = [
  { label: 'Bodyweight Only', icon: '🙆' }, { label: 'Dumbbells', icon: '🏋️' },
  { label: 'Resistance Bands', icon: '🟡' }, { label: 'Kettlebell', icon: '⚙️' },
  { label: 'Pull-up Bar', icon: '🔱' }, { label: 'Dip Bars', icon: '⬇️' },
  { label: 'Yoga Mat', icon: '🟪' }, { label: 'Jump Rope', icon: '🪢' },
  { label: 'Bench', icon: '🪑' }, { label: 'TRX / Suspension Trainer', icon: '🎯' },
]
const GYM_EQUIPMENT_OPTIONS = [
  { label: 'Barbell', icon: '🏋️‍♂️' }, { label: 'Dumbbells', icon: '🏋️' }, { label: 'Squat Rack', icon: '🏗️' },
  { label: 'Cable Machine', icon: '🔗' }, { label: 'Smith Machine', icon: '🔩' }, { label: 'Leg Press Machine', icon: '🦵' },
  { label: 'Chest Press Machine', icon: '💪' }, { label: 'Lat Pulldown Machine', icon: '⬇️' }, { label: 'Seated Row Machine', icon: '🚣' },
  { label: 'Shoulder Press Machine', icon: '🔼' }, { label: 'Leg Curl / Extension Machine', icon: '🦿' },
  { label: 'Treadmill', icon: '🏃' }, { label: 'Stationary Bike', icon: '🚴' }, { label: 'Elliptical', icon: '〰️' },
  { label: 'Rowing Machine', icon: '🛶' }, { label: 'Bench', icon: '🪑' }, { label: 'Kettlebell', icon: '⚙️' },
]
const EQUIPMENT_OPTIONS = [...HOME_EQUIPMENT_OPTIONS, ...GYM_EQUIPMENT_OPTIONS]
const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore', desc: 'No restrictions' },
  { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat, includes dairy and eggs' },
  { value: 'vegan', label: 'Vegan', desc: 'Entirely plant-based' },
  { value: 'pescatarian', label: 'Pescatarian', desc: 'Fish ok, no other meat' },
  { value: 'keto', label: 'Keto / Low-carb', desc: 'High fat, very low carbs' },
  { value: 'paleo', label: 'Paleo', desc: 'Whole foods, no grains or dairy' },
  { value: 'halal', label: 'Halal', desc: 'No pork or alcohol, halal-certified meat' },
  { value: 'kosher', label: 'Kosher', desc: 'No pork or shellfish, no mixing meat and dairy' },
  { value: 'hindu-veg', label: 'Hindu Vegetarian', desc: 'No beef, typically lacto-vegetarian' },
  { value: 'jain', label: 'Jain', desc: 'No meat, no root vegetables (onion, garlic, potato)' },
]
const ALLERGY_OPTIONS = ['Gluten-free', 'Dairy-free', 'Nut-free', 'Egg-free', 'Shellfish-free', 'Soy-free']
const DURATION_OPTIONS = ['20', '30', '45', '60', '90', '120']
const PRESET_EQUIPMENT_LABELS = new Set(EQUIPMENT_OPTIONS.map((o) => o.label))

// ── Goal plan previews ─────────────────────────────────────────────────────────
const GOAL_PREVIEWS: Record<string, { emoji: string; headline: string; body: string; accent: string; badge: string }> = {
  'Muscle Gain': { emoji: '💪', headline: 'Time to get big.', body: 'A progressive overload program built to maximize hypertrophy and pack on real, lasting muscle.', accent: '#A855F7', badge: 'Hypertrophy Focus' },
  'Weight Loss': { emoji: '🔥', headline: 'Fat loss mode: on.', body: 'High-intensity circuits and cardio conditioning designed to torch calories while preserving muscle.', accent: '#f97316', badge: 'Fat Burning' },
  'Strength': { emoji: '🏋️', headline: 'Get brutally strong.', body: 'Compound lifts, progressive loading, and periodization to push your maxes to new heights.', accent: '#22D3EE', badge: 'Strength Protocol' },
  'Body Recomposition': { emoji: '⚖️', headline: 'Recomp in progress.', body: 'Simultaneous fat loss and muscle gain through precision training and smart nutritional strategy.', accent: '#A855F7', badge: 'Recomp Protocol' },
  'Endurance': { emoji: '🏃', headline: 'Build the engine.', body: 'Cardio and conditioning sessions to expand your aerobic base and push your limits further every week.', accent: '#22D3EE', badge: 'Endurance Training' },
  'Athletic Performance': { emoji: '🏆', headline: 'Sport-ready.', body: 'Speed, power, and agility training designed to sharpen every athletic edge you have.', accent: '#22D3EE', badge: 'Athletic Program' },
  'Flexibility': { emoji: '🧘', headline: 'Move freely.', body: 'Mobility work, stretching, and functional movement patterns for a body that feels strong and unrestricted.', accent: '#10b981', badge: 'Mobility Focus' },
  'General Fitness': { emoji: '⚡', headline: 'All-around athlete.', body: 'A balanced mix of strength, cardio, and mobility to make you fitter in every dimension.', accent: '#A855F7', badge: 'Balanced Program' },
  'Stress Relief': { emoji: '🌿', headline: 'Find your flow.', body: 'Mindful movement and low-intensity training to melt stress and improve your mental wellbeing.', accent: '#10b981', badge: 'Wellness Protocol' },
}

// ── Animation ──────────────────────────────────────────────────────────────────
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -18 : 18, scale: 0.98 }),
}
const stepTransition = { duration: 0.24, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }

// ── Step labels ────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 15
const STEP_LABELS = ['Your Name', 'Welcome', 'About You', 'Birthday', 'Metrics', 'Your Level', 'Goals', 'Your Plan', 'Equipment', 'Schedule', 'Your Diet', 'Restrictions', 'Space', 'Launch']

// ── Recovery hint ──────────────────────────────────────────────────────────────
function getLongestConsecutiveStreak(selectedDays: string[]): number {
  if (selectedDays.length < 2) return selectedDays.length
  const idx = new Set(selectedDays.map(d => DAY_FULL.indexOf(d)).filter(i => i >= 0))
  let max = 0
  for (const start of idx) {
    let len = 0
    while (len < 7 && idx.has((start + len) % 7)) len++
    max = Math.max(max, len)
  }
  return max
}

function RecoveryHint({ streak, fitnessLevel }: { streak: number; fitnessLevel?: string }) {
  if (streak < 3) return null
  let message: string
  if (streak >= 6) {
    message = fitnessLevel === 'advanced'
      ? "At this volume, sleep and nutrition carry as much weight as the sessions themselves. Make it count."
      : "A schedule this dense works best with intentional recovery. Even a short walk on rest days beats no rest."
  } else if (streak >= 4) {
    message = fitnessLevel === 'beginner'
      ? "Four consecutive days is a real commitment. Rest days are where growth actually happens."
      : "Training this many days in a row is demanding. One rest day mid-week can lift performance across all sessions."
  } else {
    message = fitnessLevel === 'beginner'
      ? "As you're building your routine, a rest day between sessions helps your body adapt without overloading."
      : "A recovery day between sessions is where muscles repair and grow. You'll train harder for it."
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
      className="flex gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)' }}
    >
      <span className="text-base flex-shrink-0 mt-0.5">💡</span>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'rgba(168,85,247,0.7)' }}>
          Coach tip
        </p>
        <p className="text-xs text-white/55 leading-relaxed">{message}</p>
      </div>
    </motion.div>
  )
}

// ── StepHeader ────────────────────────────────────────────────────────────────
function StepHeader({ tag, title, sub }: { tag?: string; title: string; sub?: string }) {
  return (
    <div className="mb-2">
      {tag && (
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#A855F7' }}
        >
          {tag}
        </motion.p>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="text-3xl font-black text-white tracking-tight"
      >
        {title}
      </motion.h2>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
          className="text-white/45 text-sm mt-1.5 leading-relaxed"
        >
          {sub}
        </motion.p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Questionnaire() {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState<FormData>(() => ({ ...INITIAL, unit: getUnit() }))
  const [error, setError] = useState('')
  const [goalConflictMsg, setGoalConflictMsg] = useState('')
  const [customSport, setCustomSport] = useState('')
  const [customInput, setCustomInput] = useState('')
  const [showMoreDiets, setShowMoreDiets] = useState(false)
  const [showMoreEquipment, setShowMoreEquipment] = useState(false)
  const [showMoreSports, setShowMoreSports] = useState(false)
  const [equipSubStep, setEquipSubStep] = useState(0)
  const [schedSubStep, setSchedSubStep] = useState(0)
  const [schedDir, setSchedDir] = useState(1)
  const navigate = useNavigate()
  const location = useLocation()
  const isStartOver = !!(location.state as { startOver?: boolean } | null)?.startOver

  const dayRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)

  const { user } = db.useAuth()
  const userId = getUserId()
  const { data: profileData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })
  const { data: plansData } = db.useQuery({ workoutPlans: { $: { where: { userId } } } })
  const existingPlanIds = (plansData?.workoutPlans ?? []).map((p: { id: string }) => p.id)
  const userName = (profileData?.userProfiles as Array<{ name?: string }>)?.[0]?.name?.split(' ')?.[0] ?? ''

  useEffect(() => {
    if (userName && !form.name) update({ name: userName })
  }, [userName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isStartOver) return
    if (plansData === undefined) return
    if (existingPlanIds.length > 0) {
      navigate('/dashboard', { replace: true })
    }
  }, [plansData]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 2) return
    const t = setTimeout(() => goToStep(3), 2800)
    return () => clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<FormData>) => setForm((p) => ({ ...p, ...patch }))

  const goToStep = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
    setEquipSubStep(0)
    setSchedSubStep(0)
    setSchedDir(1)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }
  const handleNext = () => {
    setError('')
    if (step === 10 && schedSubStep === 0) {
      setSchedDir(1)
      setSchedSubStep(1)
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    } else {
      goToStep(step + 1)
    }
  }
  const handleBack = () => {
    if (step === 0) navigate('/')
    else if (step === 9 && equipSubStep === 1) setEquipSubStep(0)
    else if (step === 10 && schedSubStep === 1) { setSchedDir(-1); setSchedSubStep(0); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }) }
    else goToStep(step - 1)
  }

  // ── Unit switch ───────────────────────────────────────────────────────────────
  const switchUnit = (next: Unit) => {
    if (next === form.unit) return
    let weight = '', height = '', heightIn = ''
    const w = parseFloat(form.weight), h = parseFloat(form.height)
    if (next === 'imperial') {
      if (!isNaN(w)) weight = kgToLbs(w).toFixed(1)
      if (!isNaN(h)) { const { ft, inches } = cmToFtIn(h); height = String(ft); heightIn = String(inches) }
    } else {
      if (!isNaN(w)) weight = lbsToKg(w).toFixed(1)
      const ft = parseFloat(form.height), inches = parseFloat(form.heightIn || '0')
      if (!isNaN(ft)) height = ftInToCm(ft, isNaN(inches) ? 0 : inches).toFixed(0)
    }
    saveUnit(next)
    setForm((p) => ({ ...p, unit: next, weight, height, heightIn }))
  }

  // ── Goal toggle ───────────────────────────────────────────────────────────────
  const toggleGoal = (label: string) => {
    setGoalConflictMsg('')
    setForm((p) => {
      if (p.goals.includes(label)) return { ...p, goals: p.goals.filter(g => g !== label) }
      const opt = GOAL_OPTIONS.find(o => o.label === label)
      const conflict = opt?.conflictsWith.find(c => p.goals.includes(c))
      if (conflict) { setGoalConflictMsg(`"${label}" and "${conflict}" are contradictory. For both, try "Body Recomposition".`); return p }
      if (p.goals.length >= MAX_GOALS) { setGoalConflictMsg(`You can select up to ${MAX_GOALS} goals.`); return p }
      return { ...p, goals: [...p.goals, label] }
    })
  }

  const toggleArray = (key: 'equipment' | 'foodAllergies', value: string) => {
    setForm((p) => ({ ...p, [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value] }))
  }

  const toggleWorkoutDay = (day: string) => {
    setForm((p) => ({
      ...p,
      workoutDays: p.workoutDays.includes(day)
        ? p.workoutDays.filter(d => d !== day)
        : [...p.workoutDays, day],
    }))
  }

  const toggleSport = (name: string) => {
    setForm((p) => ({ ...p, otherSports: p.otherSports.includes(name) ? p.otherSports.filter(s => s !== name) : [...p.otherSports, name] }))
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

  const removeEquipment = (item: string) => setForm((p) => ({ ...p, equipment: p.equipment.filter((e) => e !== item) }))
  const removeImage = (index: number) => setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== index) }))

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const slots = 3 - form.images.length
    files.slice(0, slots).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (ev) => setForm((p) => ({ ...p, images: [...p.images, ev.target?.result as string] }))
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  // ── Birthday validation ────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const bdDay = parseInt(form.birthDay, 10)
  const bdMonth = parseInt(form.birthMonth, 10)
  const bdYear = parseInt(form.birthYear, 10)
  const monthValid = !isNaN(bdMonth) && bdMonth >= 1 && bdMonth <= 12
  const yearValid = form.birthYear.length === 4 && !isNaN(bdYear) && bdYear >= currentYear - 100 && bdYear <= currentYear - 14
  const maxDaysForMonth = (monthValid && yearValid) ? getDaysInMonth(bdMonth, bdYear) : 31
  const dayValid = !isNaN(bdDay) && bdDay >= 1 && bdDay <= maxDaysForMonth
  const allBirthdayValid = dayValid && monthValid && yearValid
  const computedAge = allBirthdayValid ? computeAgeFromBirthday(bdDay, bdMonth, bdYear) : null
  const ageFromBirthdayValid = computedAge !== null && computedAge >= 14 && computedAge <= 100

  let birthdayError = ''
  if (form.birthDay && !dayValid)
    birthdayError = maxDaysForMonth < 31 ? `${maxDaysForMonth} days in this month, not ${form.birthDay}.` : 'Days go 1 to 31, just like on a calendar.'
  else if (form.birthMonth && !monthValid)
    birthdayError = 'There are only 12 months. Try a number between 1 and 12.'
  else if (form.birthYear.length === 4 && !yearValid)
    birthdayError = bdYear > currentYear - 14 ? 'You need to be at least 14 to use this app.' : 'That year is a bit too far back, even for legends.'
  else if (allBirthdayValid && !ageFromBirthdayValid)
    birthdayError = 'Please enter a valid birth year (age 14-100).'

  // ── Metrics validation ────────────────────────────────────────────────────────
  const wNum = parseFloat(form.weight)
  const weightInvalid = form.weight.trim() !== '' && (isNaN(wNum) || (form.unit === 'metric' ? wNum < 30 || wNum > 300 : wNum < 66 || wNum > 661))
  const ftNum = parseInt(form.height, 10), inNum = parseInt(form.heightIn || '0', 10), hNum = parseFloat(form.height)
  const heightInvalid = form.height.trim() !== '' && (
    form.unit === 'metric' ? isNaN(hNum) || hNum < 100 || hNum > 250 : isNaN(ftNum) || ftNum < 3 || ftNum > 8 || isNaN(inNum) || inNum < 0 || inNum > 11
  )

  const weightKg = toMetricWeight(form.weight, form.unit)
  const heightCm = toMetricHeight(form.height, form.heightIn, form.unit)
  const bmiRec = getBmiRecommendations(weightKg, heightCm)

  const primaryGoal = form.goals[0] ?? 'General Fitness'
  const goalPreview = GOAL_PREVIEWS[primaryGoal] ?? GOAL_PREVIEWS['General Fitness']

  // ── Can advance ───────────────────────────────────────────────────────────────
  const canAdvance = (): boolean => {
    if (step === 0) return true
    if (step === 1) return form.name.trim().length >= 2
    if (step === 2) return true
    if (step === 3) return !!form.sex
    if (step === 4) return ageFromBirthdayValid
    if (step === 5) return !!(form.weight.trim() && !weightInvalid && form.height.trim() && !heightInvalid)
    if (step === 6) return !!(form.fitnessLevel && form.bodyType)
    if (step === 7) return form.goals.length > 0
    if (step === 8) return true
    if (step === 9) return !!(form.gymAccess && form.equipment.length > 0)
    if (step === 10) return !!(form.workoutDays.length > 0 && form.sessionDuration)
    if (step === 11) return !!form.dietType
    return true
  }

  const getContinueLabel = (): string => {
    if (step === 3) return 'Next'
    if (step === 6) return 'Set my goals'
    if (step === 7) return 'Continue'
    if (step === 8) return 'Set up training'
    if (step === 10 && schedSubStep === 0) return 'Add activities'
    if (step === 10) return 'Set my diet'
    if (step === 11) return 'Continue'
    if (step === 12) return 'Almost done'
    if (step === 13) return 'Final step'
    return 'Continue'
  }

  // ── Submit ─────────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const finalAge = computedAge ?? 25
    const planName = generatePlanName(form.goals, form.fitnessLevel, form.equipment, form.workoutDays)
    const sortedWorkoutDays = [...form.workoutDays].sort((a, b) => DAY_FULL.indexOf(a) - DAY_FULL.indexOf(b))
    const nutritionData = {
      sex: form.sex as 'male' | 'female',
      age: finalAge,
      weight: weightKg,
      height: heightCm,
      goals: form.goals,
      daysPerWeek: form.workoutDays.length,
      dietType: form.dietType,
      allergies: form.foodAllergies,
      mealsPerDay: 3,
    }
    saveNutritionProfile(nutritionData)

    const payload: WorkoutFormData = {
      planName,
      age: finalAge.toString(),
      sex: form.sex as 'male' | 'female',
      bodyType: form.bodyType as WorkoutFormData['bodyType'],
      weight: weightKg.toFixed(1),
      height: heightCm.toFixed(0),
      fitnessLevel: form.fitnessLevel as WorkoutFormData['fitnessLevel'],
      goals: form.goals,
      equipment: form.equipment,
      equipmentNotes: '',
      injuries: form.injuries,
      workoutDays: sortedWorkoutDays,
      sessionDuration: form.sessionDuration,
      otherSports: form.otherSports.length > 0 ? form.otherSports : undefined,
      images: form.images,
      dietType: form.dietType,
      allergies: form.foodAllergies,
      customRestrictions: form.customRestrictions,
      mealsPerDay: '3',
      unit: form.unit,
    }

    if (!user) {
      // Pre-auth flow: save everything to sessionStorage, then request sign-up
      sessionStorage.setItem('pendingPlan', JSON.stringify({ payload, nutritionData, name: form.name.trim() }))
      navigate('/auth', { state: { newSignup: true } })
      return
    }

    // Logged-in flow: update DB profile snapshot (and name) then go generate
    const existingProfiles = (profileData?.userProfiles ?? []) as Array<{ id: string }>
    const profileId = existingProfiles[0]?.id
    const trimmedName = form.name.trim()
    if (profileId) {
      void db.transact(db.tx.userProfiles[profileId].update({
        nutritionSnapshot: JSON.stringify(nutritionData),
        ...(trimmedName ? { name: trimmedName } : {}),
      }))
    } else if (trimmedName) {
      void db.transact(db.tx.userProfiles[id()].update({
        userId: user.id,
        name: trimmedName,
        nutritionSnapshot: JSON.stringify(nutritionData),
        createdAt: Date.now(),
      }))
    }
    navigate('/generating', { state: { payload, plansToDelete: existingPlanIds } })
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">
      {/* Progress bar */}
      {step > 0 && step !== 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">{STEP_LABELS[step - 1]}</p>
            <p className="text-xs text-white/25">{Math.round((step / (TOTAL_STEPS - 1)) * 100)}%</p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
            />
          </div>
        </motion.div>
      )}

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={step}
          custom={dir}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={stepTransition}
        >
          {/* ── Step 0: Intro ──────────────────────────────────────────────── */}
          {step === 0 && (
            <div className="min-h-[calc(100svh-6rem)] flex flex-col items-center justify-center text-center py-10 space-y-8">
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                className="w-28 h-28 rounded-3xl flex items-center justify-center text-5xl"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(34,211,238,0.15))', border: '1px solid rgba(168,85,247,0.35)', boxShadow: '0 0 40px rgba(168,85,247,0.2)' }}
              >
                🏋️‍♂️
              </motion.div>

              <div className="space-y-3 max-w-xs">
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="text-xs font-bold uppercase tracking-widest" style={{ color: '#A855F7' }}
                >
                  {userName || form.name ? `Welcome, ${(userName || form.name).split(' ')[0]}` : 'Welcome to UPLYFT'}
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
                  className="text-4xl font-black text-white tracking-tight leading-tight"
                >
                  Let&apos;s build your{' '}
                  <span style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    perfect plan.
                  </span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
                  className="text-white/45 text-base leading-relaxed"
                >
                  A few quick questions to design a program built exactly for you. Takes about 3 minutes.
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
                className="flex flex-col items-center gap-3 w-full max-w-xs"
              >
                <button onClick={handleNext} className="btn-primary w-full !justify-center py-4 text-base">
                  Let&apos;s go
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
                  </svg>
                </button>
                <div className="flex items-center gap-3 text-white/25 text-xs">
                  <span>Beginner-friendly</span><span>·</span><span>AI-powered</span><span>·</span><span>Personalized</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* ── Step 2: Greeting (auto-advances) ──────────────────────────── */}
          {step === 2 && (
            <div className="min-h-[calc(100svh-6rem)] flex flex-col items-center justify-center text-center py-8 space-y-8">
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.05 }}
                className="w-28 h-28 rounded-3xl flex items-center justify-center text-6xl"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.18))', border: '1px solid rgba(168,85,247,0.4)', boxShadow: '0 0 60px rgba(168,85,247,0.28), 0 0 120px rgba(168,85,247,0.1)' }}
              >
                🏆
              </motion.div>
              <div className="space-y-4 max-w-sm px-4">
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                  className="text-sm font-bold uppercase tracking-widest" style={{ color: '#A855F7' }}
                >
                  Let&apos;s go
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="text-4xl font-black tracking-tight leading-tight"
                  style={{ background: 'linear-gradient(135deg, #fff 40%, rgba(168,85,247,0.9))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                >
                  Hey, {form.name.trim().split(' ')[0]}!
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
                  className="text-white/55 text-base leading-relaxed"
                >
                  Your plan is going to be built around you. A few quick questions and we&apos;ll have it ready.
                </motion.p>
              </div>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                className="w-48 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.5, delay: 0.6, ease: 'linear' }}
                  style={{ background: 'linear-gradient(90deg, #A855F7, #22D3EE)' }}
                />
              </motion.div>
            </div>
          )}

          {/* ── Steps 1, 3-14 inside GlassCard ────────────────────────────── */}
          {step > 0 && step !== 2 && (
            <GlassCard>
              {/* Step 1 - Name */}
              {step === 1 && (
                <div className="space-y-6">
                  <StepHeader tag="Let's get started" title="What's your name?" sub="We'll use it to personalize your plan from the very first step." />
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <input
                      className="input-glass font-semibold"
                      type="text"
                      placeholder="Your first name"
                      autoFocus
                      autoComplete="given-name"
                      style={{ fontSize: 22 }}
                      value={form.name}
                      onChange={(e) => update({ name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && form.name.trim().length >= 2) handleNext() }}
                    />
                  </motion.div>

                </div>
              )}

              {/* Step 3 - Sex */}
              {step === 3 && (
                <div className="space-y-6">
                  <StepHeader tag="About You" title="What's your sex?" sub="Used to calculate accurate calorie and macro targets." />
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    {(['male', 'female'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => update({ sex: s })}
                        className={`py-8 rounded-3xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-3 active:scale-[0.97] ${form.sex === s ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                      >
                        <span className="text-3xl">{s === 'male' ? <IoIosMale /> : <IoFemaleOutline />}</span>
                        <span className="text-base font-bold capitalize">{s}</span>
                      </button>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Step 4 - Birthday */}
              {step === 4 && (
                <div className="space-y-6">
                  <StepHeader tag="Birthday" title="When were you born?" sub="Helps us tailor training intensity and personalize your nutrition targets." />
                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="grid gap-3"
                    style={{ gridTemplateColumns: '1fr 1fr 1.5fr' }}
                  >
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Day</label>
                      <input
                        ref={dayRef}
                        className="input-glass text-center font-black"
                        type="number"
                        inputMode="numeric"
                        placeholder="DD"
                        style={{ fontSize: 20, appearance: 'textfield' } as React.CSSProperties}
                        value={form.birthDay}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                          update({ birthDay: val })
                          if (val.length === 2) monthRef.current?.focus()
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Month</label>
                      <input
                        ref={monthRef}
                        className="input-glass text-center font-black"
                        type="number"
                        inputMode="numeric"
                        placeholder="MM"
                        style={{ fontSize: 20, appearance: 'textfield' } as React.CSSProperties}
                        value={form.birthMonth}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                          update({ birthMonth: val })
                          if (val.length === 2) yearRef.current?.focus()
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Year</label>
                      <input
                        ref={yearRef}
                        className="input-glass text-center font-black"
                        type="number"
                        inputMode="numeric"
                        placeholder="YYYY"
                        style={{ fontSize: 20, appearance: 'textfield' } as React.CSSProperties}
                        value={form.birthYear}
                        onChange={(e) => update({ birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      />
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {computedAge !== null && ageFromBirthdayValid && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                        style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)' }}
                      >
                        <span className="text-xl">🎂</span>
                        <p className="text-white/80 text-sm font-semibold">You&apos;re {computedAge} years old</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {birthdayError && (
                    <p className="text-sm text-red-400 flex items-center gap-1.5"><span>⚠</span> {birthdayError}</p>
                  )}
                </div>
              )}

              {/* Step 5 - Metrics */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <StepHeader tag="Metrics" title="Body measurements" sub="Used for BMI analysis and calorie calculation." />
                    <div className="flex rounded-xl overflow-hidden border border-white/10 flex-shrink-0 mt-1">
                      {(['metric', 'imperial'] as const).map((u, i) => (
                        <button
                          key={u}
                          onClick={() => switchUnit(u)}
                          className={`px-3 py-1.5 text-xs font-medium transition-colors ${form.unit === u ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/40 hover:text-white/70'} ${i === 0 ? 'border-r border-white/10' : ''}`}
                        >
                          {u === 'metric' ? 'Metric' : 'Imperial'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className={`grid gap-4 ${form.unit === 'imperial' ? 'grid-cols-3' : 'grid-cols-2'}`}
                  >
                    <div>
                      <label className="block text-sm font-medium text-white/60 mb-2">Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})</label>
                      <input className="input-glass" type="number" placeholder={form.unit === 'metric' ? 'e.g. 75' : 'e.g. 165'} style={{ fontSize: 16 }} value={form.weight} onChange={(e) => update({ weight: e.target.value })} />
                      {weightInvalid && <p className="mt-1 text-xs text-red-400">{form.unit === 'metric' ? 'That seems off, try a number between 30 and 300 kg.' : 'That seems off, try a number between 66 and 661 lbs.'}</p>}
                    </div>

                    {form.unit === 'metric' ? (
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Height (cm)</label>
                        <input className="input-glass" type="number" placeholder="e.g. 175" style={{ fontSize: 16 }} value={form.height} onChange={(e) => update({ height: e.target.value })} />
                        {heightInvalid && <p className="mt-1 text-xs text-red-400">That does not look right, try between 100 and 250 cm.</p>}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-white/60 mb-2">Feet</label>
                          <input className="input-glass" type="number" style={{ fontSize: 16 }} placeholder="e.g. 5" min="3" max="8" value={form.height} onChange={(e) => update({ height: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/60 mb-2">Inches</label>
                          <input className="input-glass" type="number" style={{ fontSize: 16 }} placeholder="e.g. 11" min="0" max="11" value={form.heightIn} onChange={(e) => update({ heightIn: e.target.value })} />
                        </div>
                        {heightInvalid && <p className="col-span-3 mt-1 text-xs text-red-400">Feet should be 3-8, inches 0-11. Not a skyscraper, not a hobbit.</p>}
                      </>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Step 6 - Fitness + Body Type */}
              {step === 6 && (
                <div className="space-y-6">
                  <StepHeader tag="Your Level" title="Fitness baseline" sub="Helps us calibrate exercise difficulty and volume." />
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <label className="block text-sm font-medium text-white/60 mb-3">Fitness level</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => update({ fitnessLevel: level })}
                          className={`py-5 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-2 active:scale-[0.97] ${form.fitnessLevel === level ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                        >
                          <span className="text-2xl">{level === 'beginner' ? '🌱' : level === 'intermediate' ? '🔥' : '⚡'}</span>
                          <span className="text-xs font-semibold capitalize">{level}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                    <label className="block text-sm font-medium text-white/60 mb-1.5">Body type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { value: 'ectomorph', label: 'Ectomorph', icon: <CgShapeCircle />, desc: 'Lean, fast metabolism' },
                        { value: 'mesomorph', label: 'Mesomorph', icon: <CgShapeSquare />, desc: 'Athletic, builds easily' },
                        { value: 'endomorph', label: 'Endomorph', icon: <CgShapeTriangle />, desc: 'Heavier, gains easily' },
                      ] as const).map(({ value, label, icon, desc }) => (
                        <button
                          key={value}
                          onClick={() => update({ bodyType: value })}
                          className={`py-4 px-2 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-1 active:scale-[0.97] ${form.bodyType === value ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                        >
                          <span className="text-lg leading-none">{icon}</span>
                          <span className="font-medium text-xs">{label}</span>
                          <span className="text-[10px] text-white/35 leading-tight text-center">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Step 7 - Goals */}
              {step === 7 && (
                <div className="space-y-6">
                  <StepHeader tag="Goals" title="What are you training for?" sub={`Choose up to ${MAX_GOALS} goals. Some combinations don't mix well.`} />
                  {bmiRec && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-purple-500/8 border border-purple-500/20"
                    >
                      <HiLightningBolt className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-white/80 leading-relaxed">
                        Your BMI is <span className="font-semibold text-white">{bmiRec.bmi.toFixed(1)}</span>{' '}
                        <span className={`text-xs font-medium ${bmiRec.color}`}>({bmiRec.category})</span>
                        {'. '}{bmiRec.message}
                      </p>
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                    className="flex flex-wrap gap-x-3 gap-y-5 pt-1"
                  >
                    {GOAL_OPTIONS.map(({ label, icon }) => {
                      const suggested = bmiRec?.recommended.includes(label) ?? false
                      const selected = form.goals.includes(label)
                      const opt = GOAL_OPTIONS.find(o => o.label === label)!
                      const disabled = !selected && (opt.conflictsWith.some(c => form.goals.includes(c)) || (form.goals.length >= MAX_GOALS))
                      return (
                        <div key={label} className="relative">
                          {suggested && !selected && (
                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 text-[9px] px-2 py-0.5 rounded-full font-semibold bg-purple-500 text-white tracking-wide whitespace-nowrap">
                              ✦ Suggested
                            </span>
                          )}
                          <button
                            onClick={() => toggleGoal(label)}
                            disabled={disabled}
                            className={`chip ${selected ? 'active' : ''} ${suggested && !selected ? 'border-purple-500/50' : ''} ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            <span>{icon}</span> {label}
                          </button>
                        </div>
                      )
                    })}
                  </motion.div>
                  {goalConflictMsg && <p className="text-sm text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">{goalConflictMsg}</p>}
                  {form.goals.length > 0 && (
                    <p className="text-sm text-white/40">
                      Selected: {form.goals.join(', ')}
                      {form.goals.length === MAX_GOALS && <span className="text-amber-400/60 ml-2">(max reached)</span>}
                    </p>
                  )}
                </div>
              )}

              {/* Step 8 - Plan Preview */}
              {step === 8 && (
                <div className="py-4 space-y-6 text-center">
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.05 }}
                    className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-5xl"
                    style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.22), rgba(34,211,238,0.14))', border: '1px solid rgba(168,85,247,0.35)', boxShadow: '0 0 40px rgba(168,85,247,0.18)' }}
                  >
                    {goalPreview.emoji}
                  </motion.div>
                  <div className="space-y-3">
                    <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="text-xs font-bold uppercase tracking-widest" style={{ color: goalPreview.accent }}>
                      {goalPreview.badge}
                    </motion.p>
                    <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27 }}
                      className="text-3xl font-black text-white tracking-tight">
                      {goalPreview.headline}
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}
                      className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                      {goalPreview.body}
                    </motion.p>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {[
                      { icon: '🤖', label: 'AI-Powered', desc: 'Next-level fitness guidance' },
                      { icon: '🎯', label: 'Goal-Aligned', desc: 'Tailored to you' },
                      { icon: '📈', label: 'Progressive', desc: 'Gets harder weekly' },
                      { icon: '🔄', label: 'Adaptive', desc: 'Evolves with you' },
                    ].map(({ icon, label, desc }) => (
                      <div key={label} className="flex items-center gap-3 px-3.5 py-3.5 rounded-2xl text-left"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span className="text-lg">{icon}</span>
                        <div>
                          <p className="text-white/75 text-xs font-semibold">{label}</p>
                          <p className="text-white/35 text-[10px]">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
                    className="text-white/30 text-xs">
                    Just a few more questions to finalize your program.
                  </motion.p>
                </div>
              )}

              {/* Step 9 - Equipment */}
              {step === 9 && (
                <AnimatePresence mode="wait" custom={1}>
                  <motion.div
                    key={equipSubStep}
                    custom={1}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-6"
                  >
                    {/* Sub-step 0: Location */}
                    {equipSubStep === 0 && (
                      <>
                        <StepHeader tag="Equipment" title="Where do you train?" sub="We'll tailor your equipment list to your setup." />
                        <motion.div
                          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                          className="grid grid-cols-2 gap-4"
                        >
                          {([
                            { value: 'gym', label: 'Gym', icon: '🏢', desc: 'Full equipment access' },
                            { value: 'home', label: 'Home', icon: '🏠', desc: 'Your own setup' },
                          ] as const).map(({ value, label, icon, desc }) => (
                            <button
                              key={value}
                              onClick={() => {
                                if (form.gymAccess !== value) {
                                  setForm(p => ({ ...p, gymAccess: value, equipment: value === 'gym' ? ['Full Gym Access'] : [] }))
                                  setShowMoreEquipment(false)
                                }
                                setTimeout(() => setEquipSubStep(1), 160)
                              }}
                              className={`py-10 rounded-3xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-3 active:scale-[0.97] ${form.gymAccess === value ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                            >
                              <span className="text-4xl">{icon}</span>
                              <div className="text-center">
                                <span className="block text-base font-bold">{label}</span>
                                <span className="block text-xs text-white/40 mt-0.5">{desc}</span>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}

                    {/* Sub-step 1: Equipment selection */}
                    {equipSubStep === 1 && (
                      <>
                        <StepHeader
                          tag={form.gymAccess === 'gym' ? 'Gym Equipment' : 'Home Equipment'}
                          title={form.gymAccess === 'gym' ? "What's available at your gym?" : "What do you have at home?"}
                          sub="Select everything you have access to. Your plan will be built around it."
                        />
                        {form.gymAccess === 'gym' && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl"
                            style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
                          >
                            <span className="text-base">🏢</span>
                            <p className="text-sm text-white/70">Full gym access is included. Select any extras below.</p>
                          </motion.div>
                        )}
                        {(() => {
                          const allOptions = form.gymAccess === 'gym' ? GYM_EQUIPMENT_OPTIONS : HOME_EQUIPMENT_OPTIONS
                          const INITIAL_COUNT = 6
                          const visibleOptions = showMoreEquipment ? allOptions : allOptions.slice(0, INITIAL_COUNT)
                          const hasMore = allOptions.length > INITIAL_COUNT
                          return (
                            <>
                              <motion.div
                                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="grid grid-cols-2 gap-2.5"
                              >
                                {visibleOptions.map(({ label, icon }) => {
                                  const selected = form.equipment.includes(label)
                                  return (
                                    <button
                                      key={label}
                                      onClick={() => toggleArray('equipment', label)}
                                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.97] text-left ${selected ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                                    >
                                      <span className="text-xl flex-shrink-0">{icon}</span>
                                      <span className="text-sm font-medium leading-tight flex-1">{label}</span>
                                      {selected && <span className="text-purple-400 text-xs flex-shrink-0">✓</span>}
                                    </button>
                                  )
                                })}
                              </motion.div>
                              {hasMore && (
                                <motion.button
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
                                  onClick={() => setShowMoreEquipment(v => !v)}
                                  className="w-full py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)' }}
                                >
                                  {showMoreEquipment ? 'Show less' : `Show ${allOptions.length - INITIAL_COUNT} more`}
                                </motion.button>
                              )}
                            </>
                          )
                        })()}
                        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                          <label className="block text-sm font-medium text-white/60 mb-2">Add your own equipment</label>
                          <div className="flex gap-2">
                            <input className="input-glass flex-1" style={{ fontSize: 16 }}
                              placeholder={form.gymAccess === 'gym' ? 'e.g. cable crossover, hack squat...' : 'e.g. chair, water bottles...'}
                              value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEquipment() } }} />
                            <button onClick={addCustomEquipment} disabled={!customInput.trim() || form.equipment.includes(customInput.trim())} className="btn-ghost !px-4 disabled:opacity-30 flex-shrink-0">Add</button>
                          </div>
                        </motion.div>
                        {form.equipment.some((e) => !PRESET_EQUIPMENT_LABELS.has(e) && e !== 'Full Gym Access') && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <p className="text-xs text-white/40 mb-2">Your custom items</p>
                            <div className="flex flex-wrap gap-2">
                              {form.equipment.filter((e) => !PRESET_EQUIPMENT_LABELS.has(e) && e !== 'Full Gym Access').map((item) => (
                                <span key={item} className="chip active flex items-center gap-1.5">
                                  {item}
                                  <button onClick={() => removeEquipment(item)} className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-xs leading-none transition-colors">×</button>
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Step 10 - Schedule (2 sub-steps) */}
              {step === 10 && (
                <AnimatePresence mode="wait" custom={schedDir}>
                  <motion.div
                    key={schedSubStep}
                    custom={schedDir}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={stepTransition}
                    className="space-y-7"
                  >
                    {/* Sub-step 0: Main training schedule */}
                    {schedSubStep === 0 && (
                      <>
                        <StepHeader tag="Schedule" title="Your training schedule" sub="Pick the days you want to train each week." />

                        {/* Day picker */}
                        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                          <label className="block text-sm font-medium text-white/60 mb-3">
                            Training days
                          </label>
                          <div className="grid grid-cols-7 gap-2">
                            {DAY_OPTIONS.map((day, i) => {
                              const selected = form.workoutDays.includes(DAY_FULL[i])
                              return (
                                <button
                                  key={day}
                                  onClick={() => toggleWorkoutDay(DAY_FULL[i])}
                                  className={`py-5 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-1 active:scale-[0.95] ${selected ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                                >
                                  <span className="text-[11px] font-black uppercase tracking-wide">{day}</span>
                                  {selected && <span className="text-[9px] leading-none" style={{ color: '#A855F7' }}>✓</span>}
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-xs text-white/35 mt-2.5">
                            {form.workoutDays.length === 0
                              ? 'Tap the days you want to train'
                              : `${form.workoutDays.length} day${form.workoutDays.length !== 1 ? 's' : ''} selected`
                            }
                          </p>
                          <AnimatePresence>
                            {getLongestConsecutiveStreak(form.workoutDays) >= 3 && (
                              <div className="mt-2.5">
                                <RecoveryHint
                                  streak={getLongestConsecutiveStreak(form.workoutDays)}
                                  fitnessLevel={form.fitnessLevel}
                                />
                              </div>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        {/* Session duration - large cards */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.30 }}>
                          <label className="block text-sm font-medium text-white/60 mb-3">Session duration</label>
                          <div className="grid grid-cols-3 gap-3">
                            {DURATION_OPTIONS.map((d) => (
                              <button
                                key={d}
                                onClick={() => update({ sessionDuration: d })}
                                className={`py-5 rounded-2xl border transition-all duration-200 flex flex-col items-center gap-0.5 active:scale-[0.97] ${form.sessionDuration === d ? 'text-white border-purple-500/60 bg-purple-500/15' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                              >
                                <span className="text-xl font-bold">{d}</span>
                                <span className="text-xs opacity-60">min</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>

                        {/* Injuries / limitations */}
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
                          <label className="block text-sm font-medium text-white/60 mb-2">
                            Injuries or limitations <span className="text-white/25 text-xs font-normal">optional</span>
                          </label>
                          <textarea
                            className="input-glass resize-none"
                            rows={3}
                            placeholder="e.g. Lower back pain, avoid high-impact, left knee surgery..."
                            style={{ fontSize: 16 }}
                            value={form.injuries}
                            onChange={(e) => update({ injuries: e.target.value })}
                          />
                        </motion.div>
                      </>
                    )}

                    {/* Sub-step 1: Other activities */}
                    {schedSubStep === 1 && (
                      <>
                        <StepHeader
                          tag="Activities"
                          title="Other sports?"
                          sub="Let the AI know what else you do so it can plan around your full activity level."
                        />
                        {(() => {
                          const INITIAL_COUNT = 6
                          const visibleSports = showMoreSports ? SPORT_OPTIONS : SPORT_OPTIONS.slice(0, INITIAL_COUNT)
                          const hasMore = SPORT_OPTIONS.length > INITIAL_COUNT
                          return (
                            <>
                              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                                <div className="grid grid-cols-2 gap-2.5">
                                  {visibleSports.map(({ label, icon }) => {
                                    const selected = form.otherSports.includes(label)
                                    return (
                                      <button
                                        key={label}
                                        onClick={() => toggleSport(label)}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.97] text-left ${selected ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/80'}`}
                                      >
                                        <span className="text-xl flex-shrink-0">{icon}</span>
                                        <span className="text-sm font-medium leading-tight flex-1">{label}</span>
                                        {selected && <span className="text-purple-400 text-xs flex-shrink-0">✓</span>}
                                      </button>
                                    )
                                  })}
                                </div>
                              </motion.div>
                              {hasMore && (
                                <motion.button
                                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
                                  onClick={() => setShowMoreSports(v => !v)}
                                  className="w-full py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)' }}
                                >
                                  {showMoreSports ? 'Show less' : `Show ${SPORT_OPTIONS.length - INITIAL_COUNT} more`}
                                </motion.button>
                              )}
                            </>
                          )
                        })()}

                        {/* Custom sport input */}
                        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                          <label className="block text-sm font-medium text-white/60 mb-2">Add another activity</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              style={{ fontSize: 16 }}
                              value={customSport}
                              onChange={e => setCustomSport(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addCustomSport()}
                              placeholder="e.g. Surfing, Padel, Hiking..."
                              className="input-glass flex-1"
                            />
                            <button
                              onClick={addCustomSport}
                              disabled={!customSport.trim()}
                              className="btn-ghost !px-4 disabled:opacity-30 flex-shrink-0"
                            >
                              Add
                            </button>
                          </div>
                        </motion.div>

                        {/* Custom sports chips */}
                        {form.otherSports.filter(s => !SPORT_OPTIONS.some(o => o.label === s)).length > 0 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <p className="text-xs text-white/40 mb-2">Your custom activities</p>
                            <div className="flex flex-wrap gap-2">
                              {form.otherSports.filter(s => !SPORT_OPTIONS.some(o => o.label === s)).map(sport => (
                                <span key={sport} className="chip active flex items-center gap-1.5">
                                  {sport}
                                  <button onClick={() => toggleSport(sport)} className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-xs leading-none transition-colors">×</button>
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {form.otherSports.length === 0 && (
                          <motion.p
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                            className="text-white/25 text-xs text-center pt-2"
                          >
                            Skip this if you only do gym training.
                          </motion.p>
                        )}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Step 11 - Diet type */}
              {step === 11 && (
                <div className="space-y-6">
                  <StepHeader tag="Diet" title="Your diet" sub="Help us tailor your nutrition guidance to how you already eat." />
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <label className="block text-sm font-medium text-white/60 mb-3">Diet type</label>
                    {(() => {
                      const INITIAL_COUNT = 6
                      const hasMore = DIET_OPTIONS.length > INITIAL_COUNT
                      const expanded = showMoreDiets || DIET_OPTIONS.slice(INITIAL_COUNT).some(o => o.value === form.dietType)
                      const visibleDiets = expanded ? DIET_OPTIONS : DIET_OPTIONS.slice(0, INITIAL_COUNT)
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-2.5">
                            {visibleDiets.map(({ value, label, desc }) => (
                              <button key={value} onClick={() => update({ dietType: value })}
                                className={`text-left py-4 px-4 rounded-2xl border transition-all duration-200 active:scale-[0.97] ${form.dietType === value ? 'text-white border-purple-500/60 bg-purple-500/15 shadow-glow' : 'text-white/50 border-white/10 bg-white/5 hover:bg-white/8 hover:text-white/80'}`}>
                                <span className="block text-sm font-medium">{label}</span>
                                <span className="block text-xs text-white/35 mt-0.5">{desc}</span>
                              </button>
                            ))}
                          </div>
                          {hasMore && (
                            <motion.button
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
                              onClick={() => setShowMoreDiets(v => !v)}
                              className="w-full py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] mt-6"
                              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)' }}
                            >
                              {expanded ? 'Show less' : `Show ${DIET_OPTIONS.length - INITIAL_COUNT} more`}
                            </motion.button>
                          )}
                        </>
                      )
                    })()}
                  </motion.div>
                </div>
              )}

              {/* Step 12 - Allergies and restrictions */}
              {step === 12 && (
                <div className="space-y-6">
                  <StepHeader tag="Diet" title="Any restrictions?" sub="Tell us about allergies, intolerances, or specific dietary rules." />
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      Common allergies and intolerances <span className="text-white/25 text-xs font-normal">optional</span>
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {ALLERGY_OPTIONS.map((item) => (
                        <button key={item} onClick={() => toggleArray('foodAllergies', item)} className={`chip ${form.foodAllergies.includes(item) ? 'active' : ''}`}>{item}</button>
                      ))}
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      Any other restrictions <span className="text-white/25 text-xs font-normal">optional</span>
                    </label>
                    <textarea className="input-glass resize-none" rows={2}
                      placeholder="e.g. no red meat, no MSG, no onion or garlic, specific cultural rules..."
                      style={{ fontSize: 16 }} value={form.customRestrictions} onChange={(e) => update({ customRestrictions: e.target.value })} />
                  </motion.div>
                </div>
              )}

              {/* Step 13 - Space */}
              {step === 13 && (
                <div className="space-y-6">
                  <StepHeader tag="Space" title="Your space" sub="Optionally upload photos of your home gym to help tailor your plan." />
                  <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    {form.images.length < 3 && (
                      <label htmlFor="img-upload" className="block border-2 border-dashed border-white/15 rounded-3xl p-10 text-center cursor-pointer transition-all duration-200 hover:border-purple-500/40 hover:bg-white/3">
                        <input id="img-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                        <div className="text-4xl mb-3">📸</div>
                        <p className="text-white/60 font-medium">Drop photos here or click to upload</p>
                        <p className="text-white/30 text-sm mt-1">Up to {3 - form.images.length} more image{3 - form.images.length !== 1 ? 's' : ''}</p>
                      </label>
                    )}
                    {form.images.length > 0 && (
                      <div className="flex gap-3 flex-wrap mt-4">
                        {form.images.map((src, i) => (
                          <div key={i} className="relative group">
                            <img src={src} alt={`Upload ${i + 1}`} className="w-28 h-28 rounded-2xl object-cover border border-white/10" />
                            <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-xs text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
                    className="p-4 rounded-2xl bg-white/3 border border-white/8">
                    <p className="text-sm text-white/40 leading-relaxed">
                      <span className="text-white/60 font-medium">Note:</span> Photos help identify available equipment and space constraints. Your images are only used to generate the plan and are not stored.
                    </p>
                  </motion.div>
                </div>
              )}

              {/* Step 14 - Launch */}
              {step === 14 && (
                <div className="space-y-6">
                  {existingPlanIds.length > 0 && (
                    <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
                      <HiExclamation className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-300/90 leading-relaxed">
                        You already have a plan. Generating a new one will replace your current plan and all its history.
                      </p>
                    </div>
                  )}
                  <motion.div
                    initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.05 }}
                    className="text-center py-4"
                  >
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                      style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}>
                      🔔
                    </div>
                    <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="text-2xl font-bold text-white mb-2">Stay on track</motion.h2>
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-white/50 text-sm leading-relaxed max-w-xs mx-auto">
                      Get reminders when it's time to train, log meals, or hit your streak.
                    </motion.p>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 }} className="space-y-3">
                    <button onClick={async () => { await requestNotificationPermission(); handleSubmit() }} className="btn-primary w-full !justify-center">
                      Enable notifications
                    </button>
                    <button onClick={handleSubmit} className="btn-ghost w-full !justify-center">Maybe later</button>
                  </motion.div>
                  <div className="pt-2">
                    <button onClick={handleBack} className="btn-ghost">
                      <HiArrowNarrowLeft className="w-4 h-4" /> Back
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation footer for steps 1, 3-13 */}
              {step > 0 && step !== 2 && step < 14 && !(step === 9 && equipSubStep === 0) && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
                  <button onClick={handleBack} className="btn-ghost">
                    <HiArrowNarrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canAdvance()}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                  >
                    {getContinueLabel()}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
                    </svg>
                  </button>
                </div>
              )}
            </GlassCard>
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
