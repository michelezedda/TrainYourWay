import { useState, useCallback, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Animated, KeyboardAvoidingView, Platform, Easing,
  Image, Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import * as ImagePicker from 'expo-image-picker'
import { requestNotificationPermission } from '@/lib/notifications'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { db } from '@/lib/db'
import { storageGetAsync, storageSetAsync, storageRemoveAsync } from '@/lib/storage'
import { Colors, Spacing } from '@/theme'
import GradientText from '@/components/GradientText'
import type { RootStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
const { width: W } = Dimensions.get('window')
const TOTAL_STEPS = 15
const MAX_GOALS = 3
const STEP_LABELS = ['Your Name', 'Welcome', 'About You', 'Birthday', 'Metrics', 'Your Level', 'Goals', 'Your Plan', 'Equipment', 'Schedule', 'Your Diet', 'Restrictions', 'Space', 'Launch']

// ── Constants ──────────────────────────────────────────────────────────────────
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

const HOME_EQUIPMENT_OPTIONS = [
  { label: 'Bodyweight Only', icon: '🙆' },
  { label: 'Dumbbells', icon: '🏋️' },
  { label: 'Resistance Bands', icon: '🟡' },
  { label: 'Kettlebell', icon: '⚙️' },
  { label: 'Pull-up Bar', icon: '🔱' },
  { label: 'Dip Bars', icon: '⬇️' },
  { label: 'Yoga Mat', icon: '🟪' },
  { label: 'Jump Rope', icon: '🪢' },
  { label: 'Bench', icon: '🪑' },
  { label: 'TRX / Suspension Trainer', icon: '🎯' },
]

const GYM_EQUIPMENT_OPTIONS = [
  { label: 'Barbell', icon: '🏋️‍♂️' },
  { label: 'Dumbbells', icon: '🏋️' },
  { label: 'Squat Rack', icon: '🏗️' },
  { label: 'Cable Machine', icon: '🔗' },
  { label: 'Smith Machine', icon: '🔩' },
  { label: 'Leg Press Machine', icon: '🦵' },
  { label: 'Chest Press Machine', icon: '💪' },
  { label: 'Lat Pulldown Machine', icon: '⬇️' },
  { label: 'Seated Row Machine', icon: '🚣' },
  { label: 'Shoulder Press Machine', icon: '🔼' },
  { label: 'Leg Curl / Extension Machine', icon: '🦿' },
  { label: 'Treadmill', icon: '🏃' },
  { label: 'Stationary Bike', icon: '🚴' },
  { label: 'Elliptical', icon: '〰️' },
  { label: 'Rowing Machine', icon: '🛶' },
  { label: 'Bench', icon: '🪑' },
  { label: 'Kettlebell', icon: '⚙️' },
]

const PRESET_EQUIPMENT_LABELS = new Set([
  ...HOME_EQUIPMENT_OPTIONS.map(o => o.label),
  ...GYM_EQUIPMENT_OPTIONS.map(o => o.label),
])

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

const SPORT_OPTIONS = [
  { label: 'Basketball', icon: '🏀' }, { label: 'Volleyball', icon: '🏐' },
  { label: 'Soccer', icon: '⚽' }, { label: 'Tennis', icon: '🎾' },
  { label: 'Swimming', icon: '🏊' }, { label: 'Cycling', icon: '🚴' },
  { label: 'Running', icon: '🏃' }, { label: 'Boxing', icon: '🥊' },
  { label: 'Martial Arts', icon: '🥋' }, { label: 'Yoga', icon: '🧘' },
  { label: 'Baseball', icon: '⚾' }, { label: 'Golf', icon: '⛳' },
  { label: 'Climbing', icon: '🧗' }, { label: 'Skiing', icon: '⛷️' },
]

const ALLERGY_OPTIONS = ['Gluten-free', 'Dairy-free', 'Nut-free', 'Egg-free', 'Shellfish-free', 'Soy-free']
const DURATION_OPTIONS = ['20', '30', '45', '60', '90', '120']
const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function lbsToKg(lbs: number) { return lbs * 0.453592 }
function ftInToCm(ft: number, inches: number) { return (ft * 12 + inches) * 2.54 }

function getBmiRec(wKg: number, hCm: number) {
  const h = hCm / 100
  if (!wKg || !h || h <= 0 || wKg < 20 || hCm < 100) return null
  const bmi = wKg / (h * h)
  if (bmi < 10 || bmi > 60) return null
  if (bmi < 18.5) return { bmi, category: 'Underweight', recommended: ['Muscle Gain', 'Strength', 'General Fitness'], message: 'Building strength and gaining healthy weight may be most beneficial for you right now.' }
  if (bmi < 25) return { bmi, category: 'Healthy weight', recommended: ['Endurance', 'Flexibility', 'Athletic Performance', 'General Fitness'], message: 'Great foundation. Improving stamina and flexibility could be your next step.' }
  if (bmi < 30) return { bmi, category: 'Overweight', recommended: ['Weight Loss', 'Body Recomposition', 'Endurance'], message: 'A mix of fat-burning and cardio tends to work well for your current profile.' }
  return { bmi, category: 'Obese', recommended: ['Weight Loss', 'Endurance'], message: 'Starting with weight management and steady cardio is often the most effective approach.' }
}

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

function sanitizeName(raw: string): string {
  const stripped = raw.replace(/\s/g, '')
  if (!stripped) return ''
  return stripped[0].toUpperCase() + stripped.slice(1).toLowerCase()
}

// ── Form state ─────────────────────────────────────────────────────────────────
type FormState = {
  name: string
  unit: 'metric' | 'imperial'
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
  injuries: string
  workoutDays: string[]
  sessionDuration: string
  otherSports: string[]
  dietType: string
  foodAllergies: string[]
  customRestrictions: string
  images: string[]
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function GradientButton({ label, onPress, disabled, icon, fullWidth }: {
  label: string
  onPress: () => void
  disabled?: boolean
  icon?: string
  fullWidth?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={[styles.gradBtn, fullWidth && styles.gradBtnFull, disabled && { opacity: 0.4 }]}
    >
      <LinearGradient
        colors={['#A855F7', '#22D3EE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradBtnInner}
      >
        <Text style={styles.gradBtnText}>{label}</Text>
        {icon && <Text style={styles.gradBtnIcon}>{icon}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  )
}

function GhostButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: string }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.ghostBtn}>
      {icon && <Text style={styles.ghostIcon}>{icon}</Text>}
      <Text style={styles.ghostText}>{label}</Text>
    </TouchableOpacity>
  )
}

function StepHeader({ tag, title, sub, animKey }: { tag?: string; title: string; sub?: string; animKey?: number }) {
  const tagAnim = useRef(new Animated.Value(0)).current
  const titleAnim = useRef(new Animated.Value(0)).current
  const subAnim = useRef(new Animated.Value(0)).current
  const ease = Easing.bezier(0.4, 0, 0.2, 1)

  useEffect(() => {
    tagAnim.setValue(0)
    titleAnim.setValue(0)
    subAnim.setValue(0)
    Animated.parallel([
      Animated.timing(tagAnim, { toValue: 1, duration: 300, delay: 40, easing: ease, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 340, delay: 100, easing: ease, useNativeDriver: true }),
      Animated.timing(subAnim, { toValue: 1, duration: 280, delay: 160, easing: ease, useNativeDriver: true }),
    ]).start()
  }, [animKey])

  const fadeUp = (anim: Animated.Value, dy = 10) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
  })

  return (
    <View style={styles.stepHeader}>
      {tag && <Animated.Text style={[styles.stepTag, fadeUp(tagAnim, 8)]}>{tag}</Animated.Text>}
      <Animated.Text style={[styles.stepTitle, fadeUp(titleAnim, 12)]}>{title}</Animated.Text>
      {sub && <Animated.Text style={[styles.stepSub, fadeUp(subAnim, 8)]}>{sub}</Animated.Text>}
    </View>
  )
}

function SelectionCard({ icon, label, desc, selected, onPress, large }: {
  icon: string; label: string; desc?: string; selected: boolean; onPress: () => void; large?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.selCardOuter, selected && styles.selCardOuterActive]}
    >
      <View style={[styles.selCard, selected && styles.selCardActive, large && styles.selCardLarge]}>
        {selected && (
          <LinearGradient
            colors={['rgba(168,85,247,0.15)', 'rgba(34,211,238,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <Text style={[styles.selCardIcon, large && styles.selCardIconLarge]}>{icon}</Text>
        <Text style={[styles.selCardLabel, selected && styles.selCardLabelActive]}>{label}</Text>
        {desc && <Text style={styles.selCardDesc}>{desc}</Text>}
      </View>
    </TouchableOpacity>
  )
}

function GridChip({ icon, label, desc, selected, onPress }: {
  icon: string; label: string; desc?: string; selected: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.gridChipOuter, selected && styles.gridChipOuterActive]}
    >
      <View style={[styles.gridChip, selected && styles.gridChipActive]}>
        {selected && (
          <LinearGradient
            colors={['rgba(168,85,247,0.15)', 'rgba(34,211,238,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <Text style={[styles.gridChipIcon, selected && styles.gridChipIconActive]}>{icon}</Text>
        <Text style={[styles.gridChipLabel, selected && styles.gridChipLabelActive]}>{label}</Text>
        {desc && <Text style={styles.gridChipDesc}>{desc}</Text>}
      </View>
    </TouchableOpacity>
  )
}

function GoalChip({ label, icon, selected, disabled, onPress }: {
  label: string; icon: string; selected: boolean; disabled: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[styles.goalChip, selected && styles.goalChipActive, disabled && { opacity: 0.3 }]}
    >
      {selected && (
        <LinearGradient
          colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      )}
      <Text style={styles.goalChipIcon}>{icon}</Text>
      <Text style={[styles.goalChipText, selected && styles.goalChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

function EquipmentItem({ label, icon, selected, onPress }: {
  label: string; icon: string; selected: boolean; onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.equipItemOuter, selected && styles.equipItemOuterActive]}
    >
      <View style={[styles.equipItem, selected && styles.equipItemActive]}>
        {selected && (
          <LinearGradient
            colors={['rgba(168,85,247,0.15)', 'rgba(34,211,238,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        <Text style={styles.equipItemIcon}>{icon}</Text>
        <Text style={[styles.equipItemLabel, selected && styles.equipItemLabelActive]}>{label}</Text>
        {selected && <Text style={styles.equipCheck}>✓</Text>}
      </View>
    </TouchableOpacity>
  )
}

function RecoveryHint({ days, fitnessLevel }: { days: string[]; fitnessLevel: string }) {
  const streak = getLongestConsecutiveStreak(days)
  if (streak < 3) return null
  let message: string
  if (streak >= 6) {
    message = fitnessLevel === 'advanced'
      ? 'At this volume, sleep and nutrition carry as much weight as the sessions. Make it count.'
      : "A schedule this dense works best with intentional recovery. Even a short walk on rest days beats no rest."
  } else if (streak >= 4) {
    message = fitnessLevel === 'beginner'
      ? 'Four consecutive days is a real commitment. Rest days are where growth actually happens.'
      : "Training this many days in a row is demanding. One rest day mid-week can lift performance across all sessions."
  } else {
    message = fitnessLevel === 'beginner'
      ? "As you're building your routine, a rest day between sessions helps your body adapt without overloading."
      : "A recovery day between sessions is where muscles repair and grow. You'll train harder for it."
  }
  return (
    <View style={styles.recoveryHint}>
      <Text style={styles.recoveryHintEmoji}>💡</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.recoveryTag}>Coach tip</Text>
        <Text style={styles.recoveryText}>{message}</Text>
      </View>
    </View>
  )
}


// ── Main screen ────────────────────────────────────────────────────────────────
export default function QuestionnaireScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const { user } = db.useAuth()

  const [step, setStep] = useState(0)
  const [equipSubStep, setEquipSubStep] = useState(0)
  const [schedSubStep, setSchedSubStep] = useState(0)
  const [goalConflictMsg, setGoalConflictMsg] = useState('')
  const [customSport, setCustomSport] = useState('')
  const [customEquip, setCustomEquip] = useState('')
  const [showMoreEquip, setShowMoreEquip] = useState(false)
  const [showMoreSports, setShowMoreSports] = useState(false)
  const [showMoreDiets, setShowMoreDiets] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    name: '', unit: 'metric',
    birthDay: '', birthMonth: '', birthYear: '',
    sex: '', bodyType: '',
    weight: '', height: '', heightIn: '',
    fitnessLevel: '',
    goals: [],
    gymAccess: '', equipment: [], injuries: '',
    workoutDays: [], sessionDuration: '45', otherSports: [],
    dietType: '', foodAllergies: [], customRestrictions: '',
    images: [],
  })

  const slideAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(1)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const greetAnim = useRef(new Animated.Value(0)).current
  const scaleExitAnim = useRef(new Animated.Value(1)).current
  const introIconAnim = useRef(new Animated.Value(0)).current
  const introTagAnim = useRef(new Animated.Value(0)).current
  const introTitleAnim = useRef(new Animated.Value(0)).current
  const introSubAnim = useRef(new Animated.Value(0)).current
  const introBtnAnim = useRef(new Animated.Value(0)).current
  const greetIconAnim = useRef(new Animated.Value(0)).current
  const greetTagAnim = useRef(new Animated.Value(0)).current
  const greetNameAnim = useRef(new Animated.Value(0)).current
  const greetSubAnim = useRef(new Animated.Value(0)).current
  const greetBarFadeAnim = useRef(new Animated.Value(0)).current

  // Birthday refs for auto-focus
  const dayRef = useRef<TextInput>(null)
  const monthRef = useRef<TextInput>(null)
  const yearRef = useRef<TextInput>(null)

  // Progress bar animation
  useEffect(() => {
    if (step === 0 || step === 2) return
    Animated.timing(progressAnim, {
      toValue: step / (TOTAL_STEPS - 1),
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [step])

  // Step 0 entrance animation
  useEffect(() => {
    const ease = Easing.bezier(0.4, 0, 0.2, 1)
    const spring = Easing.bezier(0.34, 1.56, 0.64, 1)
    Animated.parallel([
      Animated.timing(introIconAnim, { toValue: 1, duration: 400, delay: 0, easing: spring, useNativeDriver: true }),
      Animated.timing(introTagAnim, { toValue: 1, duration: 350, delay: 100, easing: ease, useNativeDriver: true }),
      Animated.timing(introTitleAnim, { toValue: 1, duration: 380, delay: 200, easing: ease, useNativeDriver: true }),
      Animated.timing(introSubAnim, { toValue: 1, duration: 320, delay: 300, easing: ease, useNativeDriver: true }),
      Animated.timing(introBtnAnim, { toValue: 1, duration: 320, delay: 400, easing: ease, useNativeDriver: true }),
    ]).start()
  }, [])

  // Step 2 auto-advance
  useEffect(() => {
    if (step !== 2) return
    const t = setTimeout(() => animateTransition(3, 1), 2800)
    return () => clearTimeout(t)
  }, [step])

  // Step 2 greeting animations
  useEffect(() => {
    if (step !== 2) return
    const ease = Easing.bezier(0.4, 0, 0.2, 1)
    const spring = Easing.bezier(0.34, 1.56, 0.64, 1)
    greetIconAnim.setValue(0)
    greetTagAnim.setValue(0)
    greetNameAnim.setValue(0)
    greetSubAnim.setValue(0)
    greetBarFadeAnim.setValue(0)
    greetAnim.setValue(0)
    Animated.parallel([
      Animated.timing(greetIconAnim, { toValue: 1, duration: 420, delay: 0, easing: spring, useNativeDriver: true }),
      Animated.timing(greetTagAnim, { toValue: 1, duration: 340, delay: 80, easing: ease, useNativeDriver: true }),
      Animated.timing(greetNameAnim, { toValue: 1, duration: 380, delay: 160, easing: ease, useNativeDriver: true }),
      Animated.timing(greetSubAnim, { toValue: 1, duration: 320, delay: 260, easing: ease, useNativeDriver: true }),
      Animated.timing(greetBarFadeAnim, { toValue: 1, duration: 280, delay: 360, easing: ease, useNativeDriver: true }),
    ]).start()
    Animated.timing(greetAnim, {
      toValue: 1,
      duration: 2600,
      delay: 400,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start()
  }, [step])

  // Pending plan: navigate to Generating after auth completes
  useEffect(() => {
    if (!user) return
    void (async () => {
      const raw = await storageGetAsync('pendingPlan')
      if (!raw) return
      await storageRemoveAsync('pendingPlan')
      try {
        const pending = JSON.parse(raw) as Record<string, unknown>
        navigation.navigate('Generating', { formData: pending })
      } catch { /* invalid JSON */ }
    })()
  }, [user?.id])

  const update = useCallback((patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }))
  }, [])

  const animateTransition = (newStep: number, dir: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: dir > 0 ? -14 : 14, duration: 180, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
      Animated.timing(scaleExitAnim, { toValue: 0.97, duration: 180, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(dir > 0 ? 28 : -28)
      scaleExitAnim.setValue(1)
      setStep(newStep)
      if (dir > 0) {
        setEquipSubStep(0)
        setSchedSubStep(0)
      }
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start()
    })
  }

  const animateSubTransition = (setter: (v: number) => void, newVal: number, dir: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: dir > 0 ? -14 : 14, duration: 180, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
      Animated.timing(scaleExitAnim, { toValue: 0.97, duration: 180, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(dir > 0 ? 28 : -28)
      scaleExitAnim.setValue(1)
      setter(newVal)
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start()
    })
  }

  // ── Birthday computed ──────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear()
  const bdDay = parseInt(form.birthDay, 10)
  const bdMonth = parseInt(form.birthMonth, 10)
  const bdYear = parseInt(form.birthYear, 10)
  const monthValid = !isNaN(bdMonth) && bdMonth >= 1 && bdMonth <= 12
  const yearValid = form.birthYear.length === 4 && !isNaN(bdYear) && bdYear >= currentYear - 100 && bdYear <= currentYear - 14
  const maxDays = (monthValid && yearValid) ? getDaysInMonth(bdMonth, bdYear) : 31
  const dayValid = !isNaN(bdDay) && bdDay >= 1 && bdDay <= maxDays
  const allBdValid = dayValid && monthValid && yearValid
  const computedAge = allBdValid ? computeAgeFromBirthday(bdDay, bdMonth, bdYear) : null
  const ageValid = computedAge !== null && computedAge >= 14 && computedAge <= 100
  let birthdayError = ''
  if (form.birthDay && !dayValid)
    birthdayError = maxDays < 31 ? `${maxDays} days in this month, not ${form.birthDay}.` : 'Days go 1 to 31, just like on a calendar.'
  else if (form.birthMonth && !monthValid)
    birthdayError = 'There are only 12 months. Try a number between 1 and 12.'
  else if (form.birthYear.length === 4 && !yearValid)
    birthdayError = bdYear > currentYear - 14 ? 'You need to be at least 14 to use this app.' : 'That year is a bit too far back, even for legends.'
  else if (allBdValid && !ageValid)
    birthdayError = 'Please enter a valid birth year (age 14-100).'

  // ── Metrics computed ───────────────────────────────────────────────────────────
  const wNum = parseFloat(form.weight)
  const weightInvalid = form.weight.trim() !== '' && (isNaN(wNum) || (form.unit === 'metric' ? wNum < 30 || wNum > 300 : wNum < 66 || wNum > 661))
  const hNum = parseFloat(form.height)
  const ftNum = parseInt(form.height, 10)
  const inNum = parseInt(form.heightIn || '0', 10)
  const heightInvalid = form.height.trim() !== '' && (
    form.unit === 'metric' ? isNaN(hNum) || hNum < 100 || hNum > 250
      : isNaN(ftNum) || ftNum < 3 || ftNum > 8 || isNaN(inNum) || inNum < 0 || inNum > 11
  )

  const weightKg = form.unit === 'metric' ? wNum : lbsToKg(wNum)
  const heightCm = form.unit === 'metric' ? hNum : ftInToCm(ftNum, inNum)
  const bmiRec = getBmiRec(isNaN(weightKg) ? 0 : weightKg, isNaN(heightCm) ? 0 : heightCm)

  const primaryGoal = form.goals[0] ?? 'General Fitness'
  const goalPreview = GOAL_PREVIEWS[primaryGoal] ?? GOAL_PREVIEWS['General Fitness']

  // ── Can advance ────────────────────────────────────────────────────────────────
  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return true
      case 1: return form.name.trim().length >= 2
      case 2: return true
      case 3: return !!form.sex
      case 4: return ageValid
      case 5: return !!(form.weight.trim() && !weightInvalid && form.height.trim() && !heightInvalid)
      case 6: return !!(form.fitnessLevel && form.bodyType)
      case 7: return form.goals.length > 0
      case 8: return true
      case 9: return !!(form.gymAccess && form.equipment.length > 0)
      case 10: return !!(form.workoutDays.length > 0 && form.sessionDuration)
      case 11: return !!form.dietType
      default: return true
    }
  }

  const getContinueLabel = (): string => {
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

  // ── Navigation ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (step === 0) { navigation.goBack(); return }
    if (step === 9 && equipSubStep === 1) { animateSubTransition(setEquipSubStep, 0, -1); return }
    if (step === 10 && schedSubStep === 1) { animateSubTransition(setSchedSubStep, 0, -1); return }
    animateTransition(step - 1, -1)
  }

  const handleNext = () => {
    setGoalConflictMsg('')
    if (step === 10 && schedSubStep === 0) {
      animateSubTransition(setSchedSubStep, 1, 1)
      return
    }
    animateTransition(step + 1, 1)
  }

  // ── Goal toggle ────────────────────────────────────────────────────────────────
  const toggleGoal = (label: string) => {
    setGoalConflictMsg('')
    setForm(p => {
      if (p.goals.includes(label)) return { ...p, goals: p.goals.filter(g => g !== label) }
      const opt = GOAL_OPTIONS.find(o => o.label === label)
      const conflict = opt?.conflictsWith.find(c => p.goals.includes(c))
      if (conflict) {
        setGoalConflictMsg(`"${label}" and "${conflict}" conflict. Try "Body Recomposition" for both.`)
        return p
      }
      if (p.goals.length >= MAX_GOALS) {
        setGoalConflictMsg(`You can select up to ${MAX_GOALS} goals.`)
        return p
      }
      return { ...p, goals: [...p.goals, label] }
    })
  }

  const toggleArray = (key: 'equipment' | 'foodAllergies', val: string) => {
    setForm(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(v => v !== val) : [...p[key], val] }))
  }

  const toggleWorkoutDay = (day: string) => {
    setForm(p => ({
      ...p,
      workoutDays: p.workoutDays.includes(day) ? p.workoutDays.filter(d => d !== day) : [...p.workoutDays, day],
    }))
  }

  const toggleSport = (name: string) => {
    setForm(p => ({ ...p, otherSports: p.otherSports.includes(name) ? p.otherSports.filter(s => s !== name) : [...p.otherSports, name] }))
  }

  const addCustomSport = () => {
    const name = customSport.trim()
    if (!name || form.otherSports.includes(name)) return
    setForm(p => ({ ...p, otherSports: [...p.otherSports, name] }))
    setCustomSport('')
  }

  const addCustomEquipment = () => {
    const item = customEquip.trim()
    if (!item || form.equipment.includes(item)) return
    setForm(p => ({ ...p, equipment: [...p.equipment, item] }))
    setCustomEquip('')
  }

  // ── Image picker ───────────────────────────────────────────────────────────────
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 3 - form.images.length,
      quality: 0.7,
      base64: true,
    })
    if (!result.canceled) {
      const newUris = result.assets.map(a => a.uri)
      setForm(p => ({ ...p, images: [...p.images, ...newUris].slice(0, 3) }))
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const finalAge = computedAge ?? 25
    const sortedWorkoutDays = [...form.workoutDays].sort((a, b) => DAY_FULL.indexOf(a) - DAY_FULL.indexOf(b))
    const planName = generatePlanName(form.goals, form.fitnessLevel, form.equipment, sortedWorkoutDays)
    const wKg = form.unit === 'metric' ? parseFloat(form.weight) : lbsToKg(parseFloat(form.weight))
    const hCm = form.unit === 'metric' ? parseFloat(form.height) : ftInToCm(parseInt(form.height, 10), parseInt(form.heightIn || '0', 10))
    const payload = {
      planName,
      age: String(finalAge),
      sex: form.sex,
      bodyType: form.bodyType,
      weight: isNaN(wKg) ? '70' : wKg.toFixed(1),
      height: isNaN(hCm) ? '170' : hCm.toFixed(0),
      fitnessLevel: form.fitnessLevel,
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
      name: form.name.trim(),
    }
    if (!user) {
      void storageSetAsync('pendingPlan', JSON.stringify(payload))
      navigation.navigate('Auth')
      return
    }
    navigation.navigate('Generating', { formData: payload as Record<string, unknown> })
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  const renderStep = () => {
    const fadeUp = (anim: Animated.Value, dy = 12) => ({
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
    })

    // Step 0: Intro (fullscreen)
    if (step === 0) {
      return (
        <View style={styles.introWrap}>
          <Animated.View style={[styles.introIconWrap, fadeUp(introIconAnim, 20)]}>
            <LinearGradient
              colors={['rgba(168,85,247,0.25)', 'rgba(34,211,238,0.15)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.introIcon}
            >
              <Text style={styles.introIconText}>🏋️‍♂️</Text>
            </LinearGradient>
          </Animated.View>
          <View style={styles.introText}>
            <Animated.Text style={[styles.introTag, fadeUp(introTagAnim, 8)]}>Welcome to UPLYFT</Animated.Text>
            <Animated.View style={[styles.introTitleRow, fadeUp(introTitleAnim, 12)]}>
              <Text style={styles.introTitleWhite}>{"Let's build your "}</Text>
              <GradientText style={styles.introTitleGrad}>perfect plan.</GradientText>
            </Animated.View>
            <Animated.Text style={[styles.introSub, fadeUp(introSubAnim, 8)]}>
              A few quick questions to design a program built exactly for you. Takes about 3 minutes.
            </Animated.Text>
          </View>
          <Animated.View style={[{ alignSelf: 'stretch' }, fadeUp(introBtnAnim, 8)]}>
            <GradientButton label="Let's go" onPress={() => animateTransition(1, 1)} icon="→" fullWidth />
          </Animated.View>
          <Animated.View style={[styles.introTagline, fadeUp(introBtnAnim, 4)]}>
            <Text style={styles.introTaglineText}>Beginner-friendly</Text>
            <Text style={styles.introTaglineDot}>·</Text>
            <Text style={styles.introTaglineText}>AI-powered</Text>
            <Text style={styles.introTaglineDot}>·</Text>
            <Text style={styles.introTaglineText}>Personalized</Text>
          </Animated.View>
        </View>
      )
    }

    // Step 2: Greeting auto-advance
    if (step === 2) {
      const displayName = form.name.split(' ')[0] || form.name
      return (
        <View style={styles.greetWrap}>
          <Animated.View style={[styles.greetIconWrap, fadeUp(greetIconAnim, 20)]}>
            <LinearGradient
              colors={['rgba(168,85,247,0.28)', 'rgba(34,211,238,0.18)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.greetIcon}
            >
              <Text style={styles.greetIconText}>🏆</Text>
            </LinearGradient>
          </Animated.View>
          <Animated.Text style={[styles.greetSub, fadeUp(greetTagAnim, 8)]}>Let's go</Animated.Text>
          <Animated.View style={fadeUp(greetNameAnim, 12)}>
            <GradientText style={styles.greetTitle} colors={['#ffffff', 'rgba(168,85,247,0.9)']}>{`Hey, ${displayName}!`}</GradientText>
          </Animated.View>
          <Animated.Text style={[styles.greetBody, fadeUp(greetSubAnim, 8)]}>
            Your plan is going to be built around you. A few quick questions and we'll have it ready.
          </Animated.Text>
          <Animated.View style={[styles.greetBarWrap, fadeUp(greetBarFadeAnim, 4)]}>
            <Animated.View style={[styles.greetBar, { width: greetAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
              <LinearGradient
                colors={['#A855F7', '#22D3EE']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </Animated.View>
        </View>
      )
    }

    return null
  }

  const renderStepContent = () => {
    // Step 1: Name
    if (step === 1) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Let's get started" title="What's your name?" sub="We'll use it to personalize your plan from the very first step." />
          <TextInput
            style={[styles.nameInput, focusedField === 'name' && { borderBottomColor: Colors.purple }]}
            value={form.name}
            onChangeText={v => update({ name: sanitizeName(v) })}
            placeholder="Your first name"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => { if (canAdvance()) handleNext() }}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            underlineColorAndroid="transparent"
            selectionColor="#A855F7"
          />
        </View>
      )
    }

    // Step 3: Sex
    if (step === 3) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="About You" title="What's your sex?" sub="Used to calculate accurate calorie and macro targets." />
          <View style={styles.twoColGrid}>
            <SelectionCard icon="♂️" label="Male" selected={form.sex === 'male'} onPress={() => update({ sex: 'male' })} large />
            <SelectionCard icon="♀️" label="Female" selected={form.sex === 'female'} onPress={() => update({ sex: 'female' })} large />
          </View>
        </View>
      )
    }

    // Step 4: Birthday
    if (step === 4) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Birthday" title="When were you born?" sub="Helps us tailor training intensity and personalize your nutrition targets." />
          <View style={styles.bdRow}>
            <View style={styles.bdField}>
              <Text style={styles.bdLabel}>Day</Text>
              <TextInput
                ref={dayRef}
                style={[styles.bdInput, focusedField === 'day' && { borderBottomColor: Colors.purple }]}
                value={form.birthDay}
                onChangeText={v => {
                  update({ birthDay: v.replace(/\D/g, '').slice(0, 2) })
                  if (v.replace(/\D/g, '').length === 2) monthRef.current?.focus()
                }}
                placeholder="DD"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={2}
                autoFocus
                onFocus={() => setFocusedField('day')}
                onBlur={() => setFocusedField(null)}
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
            </View>
            <Text style={styles.bdSep}>/</Text>
            <View style={styles.bdField}>
              <Text style={styles.bdLabel}>Month</Text>
              <TextInput
                ref={monthRef}
                style={[styles.bdInput, focusedField === 'month' && { borderBottomColor: Colors.purple }]}
                value={form.birthMonth}
                onChangeText={v => {
                  update({ birthMonth: v.replace(/\D/g, '').slice(0, 2) })
                  if (v.replace(/\D/g, '').length === 2) yearRef.current?.focus()
                }}
                placeholder="MM"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={2}
                onFocus={() => setFocusedField('month')}
                onBlur={() => setFocusedField(null)}
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
            </View>
            <Text style={styles.bdSep}>/</Text>
            <View style={[styles.bdField, { flex: 2 }]}>
              <Text style={styles.bdLabel}>Year</Text>
              <TextInput
                ref={yearRef}
                style={[styles.bdInput, focusedField === 'year' && { borderBottomColor: Colors.purple }]}
                value={form.birthYear}
                onChangeText={v => update({ birthYear: v.replace(/\D/g, '').slice(0, 4) })}
                placeholder="YYYY"
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="number-pad"
                maxLength={4}
                onFocus={() => setFocusedField('year')}
                onBlur={() => setFocusedField(null)}
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
            </View>
          </View>
          {ageValid && computedAge !== null && (
            <View style={styles.ageConfirm}>
              <Text style={styles.ageConfirmEmoji}>🎂</Text>
              <Text style={styles.ageConfirmText}>You're <Text style={{ color: Colors.purple, fontWeight: '700' }}>{computedAge}</Text> years old</Text>
            </View>
          )}
          {!ageValid && !!birthdayError && (
            <Text style={styles.fieldErrorText}>⚠ {birthdayError}</Text>
          )}
        </View>
      )
    }

    // Step 5: Metrics
    if (step === 5) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Metrics" title="Body measurements" sub="Used for BMI analysis and calorie calculation." />
          <View style={styles.unitToggle}>
            <TouchableOpacity
              onPress={() => update({ unit: 'metric' })}
              style={[styles.unitBtn, form.unit === 'metric' && styles.unitBtnActive]}
            >
              <Text style={[styles.unitBtnText, form.unit === 'metric' && styles.unitBtnTextActive]}>Metric (kg/cm)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => update({ unit: 'imperial' })}
              style={[styles.unitBtn, form.unit === 'imperial' && styles.unitBtnActive]}
            >
              <Text style={[styles.unitBtnText, form.unit === 'imperial' && styles.unitBtnTextActive]}>Imperial (lbs/ft)</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricField}>
              <Text style={styles.metricLabel}>Weight ({form.unit === 'metric' ? 'kg' : 'lbs'})</Text>
              <TextInput
                style={[styles.metricInput, weightInvalid && styles.inputError, focusedField === 'weight' && styles.inputFocused]}
                value={form.weight}
                onChangeText={v => update({ weight: v })}
                placeholder={form.unit === 'metric' ? 'e.g. 75' : 'e.g. 165'}
                placeholderTextColor="rgba(255,255,255,0.25)"
                keyboardType="decimal-pad"
                onFocus={() => setFocusedField('weight')}
                onBlur={() => setFocusedField(null)}
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
              {weightInvalid && <Text style={styles.fieldErrorText}>{form.unit === 'metric' ? 'That seems off, try 30-300 kg.' : 'That seems off, try 66-661 lbs.'}</Text>}
            </View>
            {form.unit === 'metric' ? (
              <View style={styles.metricField}>
                <Text style={styles.metricLabel}>Height (cm)</Text>
                <TextInput
                  style={[styles.metricInput, heightInvalid && styles.inputError]}
                  value={form.height}
                  onChangeText={v => update({ height: v })}
                  placeholder="e.g. 175"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="decimal-pad"
                  underlineColorAndroid="transparent"
                  selectionColor="#A855F7"
                />
                {heightInvalid && <Text style={styles.fieldErrorText}>Try a number between 100 and 250 cm.</Text>}
              </View>
            ) : (
              <>
                <View style={styles.metricField}>
                  <Text style={styles.metricLabel}>Feet</Text>
                  <TextInput
                    style={[styles.metricInput, heightInvalid && styles.inputError]}
                    value={form.height}
                    onChangeText={v => update({ height: v })}
                    placeholder="e.g. 5"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="number-pad"
                    maxLength={1}
                    underlineColorAndroid="transparent"
                    selectionColor="#A855F7"
                  />
                </View>
                <View style={styles.metricField}>
                  <Text style={styles.metricLabel}>Inches</Text>
                  <TextInput
                    style={[styles.metricInput, heightInvalid && styles.inputError]}
                    value={form.heightIn}
                    onChangeText={v => update({ heightIn: v })}
                    placeholder="e.g. 11"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    keyboardType="number-pad"
                    maxLength={2}
                    underlineColorAndroid="transparent"
                    selectionColor="#A855F7"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      )
    }

    // Step 6: Fitness level + Body type
    if (step === 6) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Your Level" title="Fitness baseline" sub="Helps us calibrate exercise difficulty and volume." />
          <Text style={styles.sectionLabel}>Fitness level</Text>
          <View style={styles.threeColGrid}>
            {(['beginner', 'intermediate', 'advanced'] as const).map(level => (
              <GridChip
                key={level}
                icon={level === 'beginner' ? '🌱' : level === 'intermediate' ? '🔥' : '⚡'}
                label={level.charAt(0).toUpperCase() + level.slice(1)}
                selected={form.fitnessLevel === level}
                onPress={() => update({ fitnessLevel: level })}
              />
            ))}
          </View>
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Body type</Text>
          <View style={styles.threeColGrid}>
            {([
              { value: 'ectomorph', label: 'Ectomorph', icon: '○', desc: 'Lean, fast metabolism' },
              { value: 'mesomorph', label: 'Mesomorph', icon: '□', desc: 'Athletic, builds easily' },
              { value: 'endomorph', label: 'Endomorph', icon: '△', desc: 'Heavier, gains easily' },
            ] as const).map(({ value, label, icon, desc }) => (
              <GridChip
                key={value}
                icon={icon}
                label={label}
                desc={desc}
                selected={form.bodyType === value}
                onPress={() => update({ bodyType: value })}
              />
            ))}
          </View>
        </View>
      )
    }

    // Step 7: Goals
    if (step === 7) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Goals" title="What are you training for?" sub={`Choose up to ${MAX_GOALS} goals. Some combinations don't mix well.`} />
          {bmiRec && (
            <View style={styles.bmiCard}>
              <Text style={styles.bmiEmoji}>⚡</Text>
              <Text style={styles.bmiText}>
                Your BMI is <Text style={styles.bmiVal}>{bmiRec.bmi.toFixed(1)}</Text>{' '}
                <Text style={styles.bmiCat}>({bmiRec.category})</Text>. {bmiRec.message}
              </Text>
            </View>
          )}
          <View style={styles.goalsWrap}>
            {GOAL_OPTIONS.map(({ label, icon, conflictsWith }) => {
              const selected = form.goals.includes(label)
              const suggested = !selected && (bmiRec?.recommended.includes(label) ?? false)
              const disabled = !selected && (
                conflictsWith.some(c => form.goals.includes(c)) || form.goals.length >= MAX_GOALS
              )
              return (
                <View key={label} style={styles.goalChipWrap}>
                  {suggested && (
                    <View style={styles.suggestedBadgeWrap}>
                      <View style={styles.suggestedBadge}>
                        <Text style={styles.suggestedBadgeText}>✦ Suggested</Text>
                      </View>
                    </View>
                  )}
                  <GoalChip
                    label={label}
                    icon={icon}
                    selected={selected}
                    disabled={disabled}
                    onPress={() => toggleGoal(label)}
                  />
                </View>
              )
            })}
          </View>
          {form.goals.length > 0 && (
            <Text style={styles.goalsSelected}>
              Selected: {form.goals.join(', ')}
              {form.goals.length === MAX_GOALS && <Text style={styles.goalsMaxText}> (max reached)</Text>}
            </Text>
          )}
          {goalConflictMsg ? (
            <View style={styles.conflictMsg}>
              <Text style={styles.conflictText}>{goalConflictMsg}</Text>
            </View>
          ) : null}
        </View>
      )
    }

    // Step 8: Plan preview
    if (step === 8) {
      return (
        <View style={[styles.stepContent, { alignItems: 'center' }]}>
          <View style={styles.planPreviewIcon}>
            <LinearGradient
              colors={['rgba(168,85,247,0.22)', 'rgba(34,211,238,0.14)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.planPreviewIconGrad}
            >
              <Text style={styles.planPreviewEmoji}>{goalPreview.emoji}</Text>
            </LinearGradient>
          </View>
          <Text style={[styles.planPreviewBadge, { color: goalPreview.accent }]}>{goalPreview.badge}</Text>
          <Text style={styles.planPreviewHeadline}>{goalPreview.headline}</Text>
          <Text style={styles.planPreviewBody}>{goalPreview.body}</Text>
          <View style={styles.planFeatureGrid}>
            {[
              { icon: '🤖', label: 'AI-Powered', desc: 'Next-level fitness guidance' },
              { icon: '🎯', label: 'Goal-Aligned', desc: 'Tailored to you' },
              { icon: '📈', label: 'Progressive', desc: 'Gets harder weekly' },
              { icon: '🔄', label: 'Adaptive', desc: 'Evolves with you' },
            ].map(({ icon, label, desc }) => (
              <View key={label} style={styles.planFeatureItem}>
                <Text style={styles.planFeatureIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planFeatureLabel} numberOfLines={2}>{label}</Text>
                  <Text style={styles.planFeatureDesc} numberOfLines={2}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.planPreviewNote}>Just a few more questions to finalize your program.</Text>
        </View>
      )
    }

    // Step 9: Equipment
    if (step === 9) {
      if (equipSubStep === 0) {
        return (
          <View style={styles.stepContent}>
            <StepHeader animKey={step} tag="Equipment" title="Where do you train?" sub="We'll tailor your equipment list to your setup." />
            <View style={styles.twoColGrid}>
              <SelectionCard
                icon="🏢" label="Gym" desc="Full equipment access"
                selected={form.gymAccess === 'gym'}
                onPress={() => {
                  const changed = form.gymAccess !== 'gym'
                  update({ gymAccess: 'gym', equipment: changed ? ['Full Gym Access'] : form.equipment })
                  setTimeout(() => animateSubTransition(setEquipSubStep, 1, 1), 120)
                }}
                large
              />
              <SelectionCard
                icon="🏠" label="Home" desc="Your own setup"
                selected={form.gymAccess === 'home'}
                onPress={() => {
                  const changed = form.gymAccess !== 'home'
                  update({ gymAccess: 'home', equipment: changed ? [] : form.equipment })
                  setTimeout(() => animateSubTransition(setEquipSubStep, 1, 1), 120)
                }}
                large
              />
            </View>
          </View>
        )
      }
      // Sub-step 1: Equipment selection
      const allOptions = form.gymAccess === 'gym' ? GYM_EQUIPMENT_OPTIONS : HOME_EQUIPMENT_OPTIONS
      const INIT = 6
      const visibleOptions = showMoreEquip ? allOptions : allOptions.slice(0, INIT)
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step}
            tag={form.gymAccess === 'gym' ? 'Gym Equipment' : 'Home Equipment'}
            title={form.gymAccess === 'gym' ? "What's available at your gym?" : "What do you have at home?"}
            sub="Select everything you have access to. Your plan will be built around it."
          />
          {form.gymAccess === 'gym' && (
            <View style={styles.gymNote}>
              <Text style={styles.gymNoteText}>🏢 Full gym access is included. Select any extras below.</Text>
            </View>
          )}
          <View style={styles.twoColGrid}>
            {visibleOptions.map(({ label, icon }) => (
              <EquipmentItem
                key={label} label={label} icon={icon}
                selected={form.equipment.includes(label)}
                onPress={() => toggleArray('equipment', label)}
              />
            ))}
          </View>
          {allOptions.length > INIT && (
            <TouchableOpacity onPress={() => setShowMoreEquip(v => !v)} style={styles.showMoreBtn}>
              <Text style={styles.showMoreText}>
                {showMoreEquip ? 'Show less' : `Show ${allOptions.length - INIT} more`}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.sectionLabel}>Add your own equipment</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customEquip}
              onChangeText={setCustomEquip}
              placeholder={form.gymAccess === 'gym' ? 'e.g. cable crossover...' : 'e.g. chair, water bottles...'}
              placeholderTextColor="rgba(255,255,255,0.25)"
              onSubmitEditing={addCustomEquipment}
              returnKeyType="done"
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
            <TouchableOpacity onPress={addCustomEquipment} style={styles.addBtn} disabled={!customEquip.trim()}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {form.equipment.filter(e => !PRESET_EQUIPMENT_LABELS.has(e) && e !== 'Full Gym Access').length > 0 && (
            <View style={styles.customChipsWrap}>
              {form.equipment.filter(e => !PRESET_EQUIPMENT_LABELS.has(e) && e !== 'Full Gym Access').map(item => (
                <View key={item} style={styles.customChip}>
                  <Text style={styles.customChipText}>{item}</Text>
                  <TouchableOpacity onPress={() => setForm(p => ({ ...p, equipment: p.equipment.filter(e => e !== item) }))}>
                    <Text style={styles.customChipX}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )
    }

    // Step 10: Schedule
    if (step === 10) {
      if (schedSubStep === 0) {
        return (
          <View style={styles.stepContent}>
            <StepHeader animKey={step} tag="Schedule" title="Your training schedule" sub="Pick the days you want to train each week." />
            <Text style={styles.sectionLabel}>Training days</Text>
            <View style={styles.daysGrid}>
              {DAY_OPTIONS.map((day, i) => {
                const selected = form.workoutDays.includes(DAY_FULL[i])
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => toggleWorkoutDay(DAY_FULL[i])}
                    activeOpacity={0.75}
                    style={[styles.dayBtn, selected && styles.dayBtnActive]}
                  >
                    {selected && (
                      <LinearGradient
                        colors={['rgba(168,85,247,0.15)', 'rgba(34,211,238,0.06)']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                      />
                    )}
                    <Text style={[styles.dayBtnText, selected && styles.dayBtnTextActive]}>{day}</Text>
                    {selected && <Text style={styles.dayCheck}>✓</Text>}
                  </TouchableOpacity>
                )
              })}
            </View>
            <Text style={styles.daysCount}>
              {form.workoutDays.length === 0 ? 'Tap the days you want to train' : `${form.workoutDays.length} day${form.workoutDays.length !== 1 ? 's' : ''} selected`}
            </Text>
            <RecoveryHint days={form.workoutDays} fitnessLevel={form.fitnessLevel} />
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Session duration</Text>
            <View style={styles.durationGrid}>
              {DURATION_OPTIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => update({ sessionDuration: d })}
                  activeOpacity={0.75}
                  style={[styles.durationBtn, form.sessionDuration === d && styles.durationBtnActive]}
                >
                  {form.sessionDuration === d && (
                    <LinearGradient
                      colors={['rgba(168,85,247,0.15)', 'rgba(34,211,238,0.06)']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                  )}
                  <Text style={[styles.durationBtnNum, form.sessionDuration === d && styles.durationBtnNumActive]}>{d}</Text>
                  <Text style={styles.durationBtnLabel}>min</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>
              Injuries or limitations{' '}
              <Text style={styles.optionalLabel}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.textArea, focusedField === 'injuries' && styles.inputFocused]}
              value={form.injuries}
              onChangeText={v => update({ injuries: v })}
              placeholder="e.g. Lower back pain, avoid high-impact, left knee surgery..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              multiline
              numberOfLines={3}
              onFocus={() => setFocusedField('injuries')}
              onBlur={() => setFocusedField(null)}
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
          </View>
        )
      }
      // Sub-step 1: Sports
      const INIT = 6
      const visibleSports = showMoreSports ? SPORT_OPTIONS : SPORT_OPTIONS.slice(0, INIT)
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step}
            tag="Activities"
            title="Other sports?"
            sub="Let the AI know what else you do so it can plan around your full activity level."
          />
          <View style={styles.twoColGrid}>
            {visibleSports.map(({ label, icon }) => (
              <EquipmentItem
                key={label} label={label} icon={icon}
                selected={form.otherSports.includes(label)}
                onPress={() => toggleSport(label)}
              />
            ))}
          </View>
          {SPORT_OPTIONS.length > INIT && (
            <TouchableOpacity onPress={() => setShowMoreSports(v => !v)} style={styles.showMoreBtn}>
              <Text style={styles.showMoreText}>
                {showMoreSports ? 'Show less' : `Show ${SPORT_OPTIONS.length - INIT} more`}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.sectionLabel}>Add another activity</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={[styles.customInput, focusedField === 'sport' && styles.inputFocused]}
              value={customSport}
              onChangeText={setCustomSport}
              placeholder="e.g. Surfing, Padel, Hiking..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              onSubmitEditing={addCustomSport}
              returnKeyType="done"
              onFocus={() => setFocusedField('sport')}
              onBlur={() => setFocusedField(null)}
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
            <TouchableOpacity onPress={addCustomSport} style={styles.addBtn} disabled={!customSport.trim()}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {form.otherSports.filter(s => !SPORT_OPTIONS.some(o => o.label === s)).length > 0 && (
            <View>
              <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Your custom activities</Text>
              <View style={styles.customChipsWrap}>
                {form.otherSports.filter(s => !SPORT_OPTIONS.some(o => o.label === s)).map(sport => (
                  <View key={sport} style={styles.customChip}>
                    <Text style={styles.customChipText}>{sport}</Text>
                    <TouchableOpacity onPress={() => toggleSport(sport)}>
                      <Text style={styles.customChipX}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
          {form.otherSports.length === 0 && (
            <Text style={styles.skipNote}>Skip this if you only do gym training.</Text>
          )}
        </View>
      )
    }

    // Step 11: Diet
    if (step === 11) {
      const INIT = 6
      const expanded = showMoreDiets || DIET_OPTIONS.slice(INIT).some(o => o.value === form.dietType)
      const visibleDiets = expanded ? DIET_OPTIONS : DIET_OPTIONS.slice(0, INIT)
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Diet" title="Your diet" sub="Help us tailor your nutrition guidance to how you already eat." />
          <Text style={styles.sectionLabel}>Diet type</Text>
          <View style={styles.twoColGrid}>
            {visibleDiets.map(({ value, label, desc }) => (
              <TouchableOpacity
                key={value}
                onPress={() => update({ dietType: value })}
                activeOpacity={0.75}
                style={[styles.dietCard, form.dietType === value && styles.dietCardActive]}
              >
                {form.dietType === value && (
                  <LinearGradient
                    colors={['rgba(168,85,247,0.15)', 'rgba(34,211,238,0.06)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Text style={[styles.dietCardLabel, form.dietType === value && styles.dietCardLabelActive]}>{label}</Text>
                <Text style={styles.dietCardDesc}>{desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {DIET_OPTIONS.length > INIT && (
            <TouchableOpacity onPress={() => setShowMoreDiets(v => !v)} style={styles.showMoreBtn}>
              <Text style={styles.showMoreText}>
                {expanded ? 'Show less' : `Show ${DIET_OPTIONS.length - INIT} more`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )
    }

    // Step 12: Restrictions
    if (step === 12) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Diet" title="Any restrictions?" sub="Tell us about allergies, intolerances, or specific dietary rules." />
          <Text style={styles.sectionLabel}>
            Common allergies and intolerances{' '}
            <Text style={styles.optionalLabel}>(optional)</Text>
          </Text>
          <View style={styles.allergyWrap}>
            {ALLERGY_OPTIONS.map(item => (
              <TouchableOpacity
                key={item}
                onPress={() => toggleArray('foodAllergies', item)}
                activeOpacity={0.75}
                style={[styles.allergyChip, form.foodAllergies.includes(item) && styles.allergyChipActive]}
              >
                {form.foodAllergies.includes(item) && (
                  <LinearGradient
                    colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.08)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <Text style={[styles.allergyChipText, form.foodAllergies.includes(item) && styles.allergyChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
            Any other restrictions{' '}
            <Text style={styles.optionalLabel}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            value={form.customRestrictions}
            onChangeText={v => update({ customRestrictions: v })}
            placeholder="e.g. no red meat, no MSG, specific cultural rules..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={2}
            underlineColorAndroid="transparent"
            selectionColor="#A855F7"
          />
        </View>
      )
    }

    // Step 13: Photos
    if (step === 13) {
      return (
        <View style={styles.stepContent}>
          <StepHeader animKey={step} tag="Space" title="Your space" sub="Optionally add photos of your home gym to help tailor your plan." />
          {form.images.length < 3 && (
            <TouchableOpacity onPress={pickImages} activeOpacity={0.75} style={styles.photoUpload}>
              <Text style={styles.photoIcon}>📸</Text>
              <Text style={styles.photoLabel}>Tap to add photos</Text>
              <Text style={styles.photoHint}>Up to {3 - form.images.length} more image{3 - form.images.length !== 1 ? 's' : ''}</Text>
            </TouchableOpacity>
          )}
          {form.images.length > 0 && (
            <View style={styles.photosRow}>
              {form.images.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoThumbImg} />
                  <TouchableOpacity
                    onPress={() => setForm(p => ({ ...p, images: p.images.filter((_, idx) => idx !== i) }))}
                    style={styles.photoRemove}
                  >
                    <Text style={styles.photoRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.photoNote}>
            <Text style={styles.photoNoteText}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>Note:</Text>{' '}
              Photos help identify available equipment and space constraints. Your images are only used to generate the plan and are not stored.
            </Text>
          </View>
        </View>
      )
    }

    // Step 14: Launch
    if (step === 14) {
      return (
        <View style={[styles.stepContent, { alignItems: 'center' }]}>
          <View style={styles.launchIconWrap}>
            <LinearGradient
              colors={['rgba(168,85,247,0.12)', 'rgba(168,85,247,0.06)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.launchIcon}
            >
              <Text style={styles.launchIconText}>🔔</Text>
            </LinearGradient>
          </View>
          <Text style={styles.launchTitle}>Stay on track</Text>
          <Text style={styles.launchBody}>Get reminders when it's time to train, log meals, or hit your streak.</Text>
          <View style={styles.launchBtns}>
            <GradientButton
              label="Enable notifications"
              onPress={async () => {
                await requestNotificationPermission()
                handleSubmit()
              }}
            />
            <GhostButton label="Maybe later" onPress={handleSubmit} />
          </View>
        </View>
      )
    }

    return null
  }

  const isFullscreen = step === 0 || step === 2
  const showProgress = step > 0 && step !== 2 && step < 15
  const showFooter = step > 0 && step !== 2 && step < 14 && !(step === 9 && equipSubStep === 0)

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Background gradient tint */}
      <LinearGradient
        colors={['#0f0a2e', Colors.bg]}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Ambient orbs */}
      <LinearGradient
        colors={['rgba(168,85,247,0.14)', 'transparent']}
        style={styles.orbTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(34,211,238,0.10)', 'transparent']}
        style={styles.orbBottom}
        pointerEvents="none"
      />

      {/* Progress bar with step label */}
      {showProgress && (
        <View style={styles.progressWrap}>
          <View style={styles.progressMeta}>
            <Text style={styles.progressLabel}>{STEP_LABELS[step - 1] ?? ''}</Text>
            <Text style={styles.progressPercent}>{Math.round((step / (TOTAL_STEPS - 1)) * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
              <LinearGradient
                colors={['#A855F7', '#22D3EE']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>
        </View>
      )}


      {isFullscreen ? (
        <Animated.View style={[styles.flex, { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleExitAnim }] }]}>
          {renderStep()}
        </Animated.View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 88 : 0}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={[styles.cardShadow, { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleExitAnim }] }]}>
              <View style={styles.card}>
                {renderStepContent()}
                {showFooter && (
                  <View style={styles.cardFooter}>
                    <GhostButton label="Back" onPress={handleBack} icon="←" />
                    <GradientButton
                      label={getContinueLabel()}
                      onPress={handleNext}
                      disabled={!canAdvance()}
                      icon="→"
                    />
                  </View>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 16 },

  // ── Glass card (wraps all step content)
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },

  // Orbs
  orbTop: { position: 'absolute', top: '-5%', right: '-20%', width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35 },
  orbBottom: { position: 'absolute', bottom: '5%', left: '-20%', width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35 },

  // Progress
  progressWrap: { paddingHorizontal: Spacing.md, paddingTop: 8, paddingBottom: 8 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.8 },
  progressPercent: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },

  // Back button (inline)
  backBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
  backBtnText: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '500' },

  // ── Intro (step 0)
  introWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.lg, gap: 32,
  },
  introIconWrap: {
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 30,
  },
  introIcon: {
    width: 112, height: 112, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
  },
  introIconText: { fontSize: 52, lineHeight: 66 },
  introText: { alignItems: 'center', gap: 10 },
  introTag: {
    fontSize: 11, fontWeight: '800', letterSpacing: 2,
    textTransform: 'uppercase', color: Colors.purple, textAlign: 'center',
  },
  introTitleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  introTitleWhite: {
    fontSize: 36, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, lineHeight: 44,
  },
  introTitleGrad: {
    fontSize: 36, fontWeight: '900', letterSpacing: -0.5, lineHeight: 44,
  },
  introSub: {
    fontSize: 16, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 24,
  },

  // ── Gradient text
  gradientTextMask: { fontSize: 36, fontWeight: '900', letterSpacing: -0.5, color: Colors.purple },

  // ── Greeting (step 2)
  greetWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.lg, gap: 16,
  },
  greetIconWrap: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    marginBottom: 8,
  },
  greetIcon: {
    width: 112, height: 112, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.40)',
  },
  greetIconText: { fontSize: 56 },
  greetSub: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: Colors.purple,
  },
  greetTitle: { fontSize: 42, fontWeight: '900', letterSpacing: -0.5, color: Colors.purple },
  greetBody: {
    fontSize: 15, color: 'rgba(255,255,255,0.5)',
    textAlign: 'center', lineHeight: 22, marginTop: 4,
  },
  greetBarWrap: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 24,
  },
  greetBar: { height: '100%', borderRadius: 2, overflow: 'hidden' },

  // ── Gradient button
  gradBtnFull: { alignSelf: 'stretch' },
  gradBtn: {
    shadowColor: Colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  gradBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 32, paddingVertical: 16,
    borderRadius: 16,
  },
  gradBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  gradBtnIcon: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Ghost button
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  ghostText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '600' },
  ghostIcon: { color: 'rgba(255,255,255,0.55)', fontSize: 15 },

  // ── Step header
  stepHeader: { marginBottom: 20 },
  stepTag: {
    fontSize: 10, fontWeight: '800', letterSpacing: 2.5,
    textTransform: 'uppercase', color: Colors.purple, marginBottom: 8,
  },
  stepTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.3, lineHeight: 34 },
  stepSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 20 },

  // ── Section label
  sectionLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 10 },
  optionalLabel: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.25)' },

  // ── Step content wrapper
  stepContent: {},

  // ── Selection cards (2-col)
  twoColGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  selCardOuter: { flex: 1, minWidth: '45%' },
  selCardOuterActive: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 6,
  },
  selCard: {
    borderRadius: 24, padding: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', gap: 8,
  },
  selCardLarge: { paddingVertical: 40 },
  selCardActive: { borderColor: 'rgba(168,85,247,0.60)', backgroundColor: 'rgba(168,85,247,0.08)' },
  selCardIcon: { fontSize: 28, color: 'rgba(255,255,255,0.5)' },
  selCardIconLarge: { fontSize: 40 },
  selCardLabel: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  selCardLabelActive: { color: Colors.textPrimary },
  selCardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // ── 3-col grid chips (fitness level, body type)
  threeColGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  gridChipOuter: { flex: 1 },
  gridChipOuterActive: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  gridChip: {
    borderRadius: 16, paddingVertical: 20, paddingHorizontal: 8,
    alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden',
  },
  gridChipActive: { borderColor: 'rgba(168,85,247,0.60)', backgroundColor: 'rgba(168,85,247,0.08)' },
  gridChipIcon: { fontSize: 24, color: 'rgba(255,255,255,0.5)' },
  gridChipIconActive: { color: Colors.textPrimary },
  gridChipLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  gridChipLabelActive: { color: Colors.textPrimary },
  gridChipDesc: { fontSize: 10, color: 'rgba(255,255,255,0.30)', textAlign: 'center', lineHeight: 13 },

  // ── Goal chips
  goalsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  goalChipWrap: { position: 'relative' },
  suggestedBadgeWrap: {
    position: 'absolute', top: -10, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  suggestedBadge: {
    backgroundColor: Colors.purple, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  suggestedBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  goalsSelected: { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 8, marginTop: 4 },
  goalsMaxText: { color: 'rgba(251,191,36,0.60)' },
  goalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden',
  },
  goalChipActive: { borderColor: 'rgba(168,85,247,0.60)' },
  goalChipIcon: { fontSize: 14 },
  goalChipText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  goalChipTextActive: { color: Colors.textPrimary },

  // ── BMI card
  bmiCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 16, marginBottom: 16,
    backgroundColor: 'rgba(168,85,247,0.08)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.20)',
  },
  bmiEmoji: { fontSize: 14, marginTop: 1 },
  bmiText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19 },
  bmiVal: { fontWeight: '700', color: Colors.textPrimary},
  bmiCat: { fontSize: 11, fontWeight: '600', color: Colors.purple },

  // ── Conflict message
  conflictMsg: {
    padding: 10, borderRadius: 12, marginTop: 8,
    backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  conflictText: { fontSize: 13, color: 'rgba(251,191,36,0.85)' },

  // ── Plan preview
  planPreviewIcon: {
    marginBottom: 8,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  planPreviewIconGrad: {
    width: 96, height: 96, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
  },
  planPreviewEmoji: { fontSize: 48 },
  planPreviewBadge: { fontSize: 10, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 },
  planPreviewHeadline: { fontSize: 30, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.3, textAlign: 'center', marginTop: 6 },
  planPreviewBody: { fontSize: 14, color: 'rgba(255,255,255,0.50)', textAlign: 'center', lineHeight: 21, marginTop: 6, paddingHorizontal: 8 },
  planFeatureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', marginTop: 20 },
  planFeatureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '47%', padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  planFeatureIcon: { fontSize: 18 },
  planFeatureLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  planFeatureDesc: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  planPreviewNote: { fontSize: 12, color: 'rgba(255,255,255,0.30)', marginTop: 16, textAlign: 'center' },

  // ── Name input
  nameInput: {
    fontSize: 22, fontWeight: '600', color: Colors.textPrimary,
    borderBottomWidth: 2, borderBottomColor: 'rgba(168,85,247,0.4)',
    paddingVertical: 12, paddingHorizontal: 4, marginTop: 8,
  },

  // ── Birthday
  bdRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  bdField: { flex: 1, gap: 4 },
  bdLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.50)' },
  bdInput: {
    fontSize: 24, fontWeight: '700', color: Colors.textPrimary,
    borderBottomWidth: 2, borderBottomColor: 'rgba(168,85,247,0.35)',
    paddingVertical: 10, textAlign: 'center',
  },
  bdSep: { fontSize: 24, color: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  ageConfirm: {
    marginTop: 16, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(168,85,247,0.08)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  ageConfirmEmoji: { fontSize: 18 },
  ageConfirmText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center' },

  // ── Metrics
  unitToggle: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  unitBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  unitBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.45)',
  },
  unitBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  unitBtnTextActive: { color: Colors.textPrimary},
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricField: { flex: 1, minWidth: '40%', gap: 6 },
  metricLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.50)' },
  metricInput: {
    fontSize: 20, fontWeight: '600', color: Colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  inputError: { borderColor: 'rgba(248,113,113,0.5)' },
  inputFocused: { borderColor: Colors.purple },

  // ── Equipment items
  equipItemOuter: { flex: 1, minWidth: '45%' },
  equipItemOuterActive: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 4,
  },
  equipItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  equipItemActive: { borderColor: 'rgba(168,85,247,0.60)' },
  equipItemIcon: { fontSize: 20 },
  equipItemLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
  equipItemLabelActive: { color: Colors.textPrimary },
  equipCheck: { fontSize: 12, color: Colors.purple, fontWeight: '700' },

  // ── Gym note
  gymNote: {
    padding: 12, borderRadius: 14, marginBottom: 12,
    backgroundColor: 'rgba(168,85,247,0.08)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  gymNoteText: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },

  // ── Show more
  showMoreBtn: {
    width: '100%', paddingVertical: 10, borderRadius: 14, marginVertical: 4,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  showMoreText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

  // ── Custom input row
  customInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  customInput: {
    flex: 1, fontSize: 15, color: Colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  addBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },

  // ── Custom chips
  customChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  customChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.40)',
  },
  customChipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary},
  customChipX: { fontSize: 16, color: 'rgba(255,255,255,0.5)', fontWeight: '700', lineHeight: 18 },

  // ── Day buttons
  daysGrid: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  dayBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 22, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden', gap: 3,
  },
  dayBtnActive: { borderColor: 'rgba(168,85,247,0.60)', backgroundColor: 'rgba(168,85,247,0.12)' },
  dayBtnText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: 'rgba(255,255,255,0.50)', letterSpacing: 0.5 },
  dayBtnTextActive: { color: Colors.textPrimary },
  dayCheck: { fontSize: 9, color: Colors.purple, fontWeight: '700' },
  daysCount: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 10 },

  // ── Duration buttons
  durationGrid: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  durationBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 20, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden', gap: 3,
  },
  durationBtnActive: { borderColor: 'rgba(168,85,247,0.60)', backgroundColor: 'rgba(168,85,247,0.12)' },
  durationBtnNum: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  durationBtnNumActive: { color: Colors.textPrimary },
  durationBtnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.30)' },

  // ── Textarea
  textArea: {
    fontSize: 15, color: Colors.textPrimary, lineHeight: 22,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    textAlignVertical: 'top', minHeight: 80,
  },

  // ── Skip note
  skipNote: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 10 },

  // ── Diet cards
  dietCard: {
    flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dietCardActive: { borderColor: 'rgba(168,85,247,0.60)' },
  dietCardLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  dietCardLabelActive: { color: Colors.textPrimary},
  dietCardDesc: { fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 3, lineHeight: 15 },

  // ── Allergy chips
  allergyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  allergyChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  allergyChipActive: { borderColor: 'rgba(168,85,247,0.60)' },
  allergyChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  allergyChipTextActive: { color: Colors.textPrimary},

  // ── Photo upload
  photoUpload: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24, padding: 40, alignItems: 'center', gap: 8, marginBottom: 16,
  },
  photoIcon: { fontSize: 36 },
  photoLabel: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.60)' },
  photoHint: { fontSize: 13, color: 'rgba(255,255,255,0.30)' },
  photosRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  photoThumb: { position: 'relative', width: 96, height: 96 },
  photoThumbImg: { width: '100%', height: '100%', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  photoRemove: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22,
    borderRadius: 11, backgroundColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  photoNote: {
    padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  photoNoteText: { fontSize: 13, color: 'rgba(255,255,255,0.40)', lineHeight: 19 },

  // ── Launch
  launchIconWrap: { marginBottom: 4 },
  launchIcon: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  launchIconText: { fontSize: 30 },
  launchTitle: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, marginTop: 8, textAlign: 'center' },
  launchBody: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 21, marginTop: 6, paddingHorizontal: 16 },
  launchBtns: { width: '100%', gap: 10, marginTop: 24 },

  // ── Recovery hint
  recoveryHint: {
    flexDirection: 'row', gap: 10, padding: 14, borderRadius: 14, marginTop: 6, marginBottom: 4,
    backgroundColor: 'rgba(168,85,247,0.07)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.18)',
  },
  recoveryHintEmoji: { fontSize: 16, marginTop: 1 },
  recoveryTag: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(168,85,247,0.7)', marginBottom: 2 },
  recoveryText: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 17 },

  // ── Field error
  fieldErrorText: { fontSize: 12, color: 'rgba(248,113,113,0.85)', marginTop: 4 },

  // ── Intro tagline
  introTagline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  introTaglineText: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  introTaglineDot: { fontSize: 12, color: 'rgba(255,255,255,0.15)' },

  // ── Footer
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
})

