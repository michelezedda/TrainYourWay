import { useState, useRef, useEffect, useCallback } from 'react'
import { usePageTitle } from '@/lib/pageMeta'
import { HiChevronLeft, HiChevronRight, HiPencil, HiCamera, HiInformationCircle, HiArrowRight } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, saveNutritionProfile, calculateTargets, type DailyTargets, type NutritionProfile } from '@/lib/nutrition'
import { estimateFoodMacros, type FoodMacros } from '@/lib/gemini'
import { type Unit } from '@/lib/units'
import { useLocale } from '@/context/LocaleContext'
import { localDateStr, shiftDateStr } from '@/lib/utils'
import { motion } from 'framer-motion'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const
type Meal = (typeof MEALS)[number]
type Mode = 'manual' | 'photo'
type LogStep = 'food' | 'quantity' | 'result'
type FoodKind = 'unit' | 'weight' | 'liquid'

const MEAL_EMOJI: Record<Meal, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snacks: '🍎',
}

// ── Food classification ───────────────────────────────────────────────────────
// Determines whether a food is counted by unit, weighed, or measured by volume.

const UNIT_FOODS = new Set([
  'egg','eggs','apple','apples','banana','bananas','orange','oranges',
  'grape','grapes','strawberry','strawberries','cherry','cherries',
  'blueberry','blueberries','raspberry','raspberries','plum','plums',
  'peach','peaches','pear','pears','mango','mangoes','kiwi','kiwis',
  'date','dates','fig','figs','prune','prunes','lemon','lemons','lime','limes',
  'cookie','cookies','cracker','crackers','biscuit','biscuits',
  'chip','chips','nugget','nuggets','shrimp','prawn','prawns',
  'oyster','oysters','mussel','mussels','scallop','scallops',
  'muffin','muffins','pancake','pancakes','waffle','waffles',
  'slice','slices','piece','pieces','portion','portions',
  'wrap','wraps','taco','tacos','burger','burgers','hotdog','hotdogs',
  'bagel','bagels','roll','rolls','bun','buns','croissant','croissants',
  'sandwich','sandwiches','tortilla','tortillas','pita','pitas',
  'clementine','clementines','satsuma','satsumas','tangerine','tangerines',
  'apricot','apricots','nectarine','nectarines',
])

const LIQUID_FOODS = new Set([
  'milk','water','juice','coffee','tea','latte','cappuccino','americano','espresso',
  'smoothie','shake','milkshake','kefir',
  'soda','coke','pepsi','beer','wine','champagne','spirits','whiskey','whisky',
  'vodka','rum','gin','tequila','kombucha',
  'oil','sauce','ketchup','mayo','mayonnaise','dressing','vinaigrette',
  'soup','broth','stock','cream','gravy',
  'yogurt','yoghurt',
  'syrup','honey','molasses','vinegar','soy sauce',
  'coconut milk','almond milk','oat milk','soy milk','rice milk',
])

function classifyFood(name: string): FoodKind {
  const words = name.toLowerCase().trim().split(/[\s,]+/)
  for (const word of words) {
    const stem = word.replace(/e?s$/, '')
    if (UNIT_FOODS.has(word) || UNIT_FOODS.has(stem)) return 'unit'
  }
  for (const word of words) {
    const stem = word.replace(/e?s$/, '')
    if (LIQUID_FOODS.has(word) || LIQUID_FOODS.has(stem)) return 'liquid'
  }
  return 'weight'
}

function getUnitLabel(kind: FoodKind, unit: Unit): string {
  if (kind === 'unit') return ''
  if (kind === 'liquid') return unit === 'imperial' ? 'fl oz' : 'ml'
  return unit === 'imperial' ? 'oz' : 'g'
}

function getPrompt(kind: FoodKind): string {
  return kind === 'unit' ? 'How many?' : 'How much?'
}

function getPlaceholder(kind: FoodKind, unit: Unit): string {
  if (kind === 'unit') return 'e.g. 3'
  if (kind === 'liquid') return unit === 'imperial' ? 'e.g. 8' : 'e.g. 250'
  return unit === 'imperial' ? 'e.g. 5' : 'e.g. 150'
}

function buildQuery(foodName: string, qty: string, kind: FoodKind, unit: Unit): string {
  const q = qty.trim()
  if (!q) return foodName.trim()
  if (kind === 'unit') return `${q} ${foodName.trim()}`
  // If user already typed a unit (e.g. "150g"), pass as-is
  if (/[a-zA-Z]/.test(q)) return `${q} ${foodName.trim()}`
  const label = getUnitLabel(kind, unit)
  return `${q}${label} ${foodName.trim()}`
}

// ── Helpers ───────────────────────────────────────────────────────────────────



type MealEntry = {
  id: string; meal: string; description: string
  kcal: number; protein: number; carbs: number; fat: number; createdAt: number
}

// ── State ─────────────────────────────────────────────────────────────────────

interface AddState {
  mode: Mode
  // Manual two-step flow
  step: LogStep
  foodName: string
  foodKind: FoodKind
  quantityRaw: string
  // Photo mode
  imageDataUrl: string | null
  // Shared
  loading: boolean
  estimate: FoodMacros | null
  error: string
}

const EMPTY_ADD: AddState = {
  mode: 'manual',
  step: 'food',
  foodName: '',
  foodKind: 'weight',
  quantityRaw: '',
  imageDataUrl: null,
  loading: false,
  estimate: null,
  error: '',
}

const ZERO_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

// ── Sub-components ────────────────────────────────────────────────────────────

function MacroBar({ label, unit, current, max, gradient, color }: {
  label: string; unit: string; current: number; max: number; gradient: string; color: string
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0
  const isOver = current > max
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-white/60 text-sm font-medium">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${isOver ? 'text-red-400' : ''}`} style={isOver ? {} : { color }}>
          {Math.round(current)}<span className="text-white/30 font-normal text-xs">{unit}</span>
          <span className="text-white/25 font-normal"> / {max}{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: isOver ? 'rgba(239,68,68,0.8)' : gradient }}
        />
      </div>
    </div>
  )
}

function MacroSummary({ targets, totals }: { targets: DailyTargets | null; totals: typeof ZERO_TOTALS }) {
  if (!targets) return null
  const kcalPct = Math.min(100, (totals.kcal / targets.kcal) * 100)
  const remaining = Math.max(0, targets.kcal - Math.round(totals.kcal))
  const isOver = totals.kcal > targets.kcal
  return (
    <div className="glass-card p-5 mb-4">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1">Calories</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tabular-nums" style={{ color: isOver ? '#f87171' : '#c084fc' }}>
              {Math.round(totals.kcal)}
            </span>
            <span className="text-white/30 text-sm">/ {targets.kcal} kcal</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/30 mb-0.5">{isOver ? 'Over by' : 'Remaining'}</p>
          <p className={`text-lg font-bold tabular-nums ${isOver ? 'text-red-400' : 'text-green-400'}`}>
            {isOver ? `+${Math.round(totals.kcal) - targets.kcal}` : remaining}
          </p>
        </div>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden mb-5" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${kcalPct}%`, background: isOver ? 'rgba(239,68,68,0.8)' : 'linear-gradient(90deg,#A855F7,#22D3EE)' }}
        />
      </div>
      <div className="space-y-4">
        <MacroBar label="Protein" unit="g" current={totals.protein} max={targets.protein} gradient="linear-gradient(90deg,#22D3EE,#34d399)" color="#34d399" />
        <MacroBar label="Carbs"   unit="g" current={totals.carbs}   max={targets.carbs}   gradient="linear-gradient(90deg,#f59e0b,#f97316)" color="#f97316" />
        <MacroBar label="Fat"     unit="g" current={totals.fat}     max={targets.fat}     gradient="linear-gradient(90deg,#ec4899,#f43f5e)" color="#ec4899" />
      </div>
    </div>
  )
}

function EstimateResult({ estimate, onReenter, onConfirm }: {
  estimate: FoodMacros; onReenter: () => void; onConfirm: () => void
}) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}>
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <p className="text-white/85 text-sm font-medium">{estimate.description}</p>
      </div>
      <div className="grid grid-cols-4 divide-x divide-white/[0.07]">
        {[
          { label: 'Kcal',    val: String(estimate.kcal) },
          { label: 'Protein', val: `${estimate.protein}g` },
          { label: 'Carbs',   val: `${estimate.carbs}g` },
          { label: 'Fat',     val: `${estimate.fat}g` },
        ].map(({ label, val }) => (
          <div key={label} className="px-2 py-3 text-center">
            <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">{label}</p>
            <p className="text-white/85 text-sm font-bold tabular-nums">{val}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-4 py-3.5 border-t border-white/[0.08]">
        <button
          onClick={onReenter}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
        >
          Re-enter
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}
        >
          Log it
        </button>
      </div>
    </div>
  )
}

// ── Manual input steps ────────────────────────────────────────────────────────

interface ManualInputProps {
  st: AddState
  unit: Unit
  onFoodSubmit: (name: string) => void
  onQuantitySubmit: () => void
  onBack: () => void
  onChange: (patch: Partial<AddState>) => void
}

function ManualInput({ st, unit, onFoodSubmit, onQuantitySubmit, onBack, onChange }: ManualInputProps) {
  const foodRef   = useRef<HTMLInputElement>(null)
  const qtyRef    = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (st.step === 'food')     foodRef.current?.focus()
    if (st.step === 'quantity') qtyRef.current?.focus()
  }, [st.step])

  const unitLabel   = getUnitLabel(st.foodKind, unit)
  const prompt      = getPrompt(st.foodKind)
  const placeholder = getPlaceholder(st.foodKind, unit)

  // ── Step: food name ──
  if (st.step === 'food') {
    return (
      <div className="flex gap-2">
        <input
          ref={foodRef}
          className="flex-1 px-4 py-3.5 rounded-2xl outline-none text-white placeholder-white/30"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 16 }}
          placeholder="What did you eat?"
          value={st.foodName}
          onChange={e => onChange({ foodName: e.target.value, error: '' })}
          onKeyDown={e => {
            if (e.key === 'Enter' && st.foodName.trim()) onFoodSubmit(st.foodName)
          }}
        />
        <button
          onClick={() => { if (st.foodName.trim()) onFoodSubmit(st.foodName) }}
          disabled={!st.foodName.trim()}
          className="w-13 h-13 px-4 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-35"
          style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)' }}
          aria-label="Next"
        >
          <HiArrowRight className="w-5 h-5 text-white" />
        </button>
      </div>
    )
  }

  // ── Step: quantity (loading or input) ──
  if (st.step === 'quantity') {
    return (
      <div className="space-y-3">
        {/* Food name chip + back */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95 max-w-[70%]"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}
          >
            <span className="truncate">{st.foodName}</span>
            <span className="flex-shrink-0 text-purple-400/60 text-xs leading-none">×</span>
          </button>
        </div>

        {/* Quantity row */}
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-sm font-medium w-24 flex-shrink-0">{prompt}</span>
          <div className="flex-1 flex items-center gap-2">
            <div
              className="flex-1 flex items-center rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <input
                ref={qtyRef}
                type="text"
                inputMode="decimal"
                className="flex-1 px-4 py-3.5 bg-transparent outline-none text-white placeholder-white/30 min-w-0"
                style={{ fontSize: 16 }}
                placeholder={placeholder}
                value={st.quantityRaw}
                disabled={st.loading}
                onChange={e => onChange({ quantityRaw: e.target.value, error: '' })}
                onKeyDown={e => {
                  if (e.key === 'Enter' && st.quantityRaw.trim()) onQuantitySubmit()
                }}
              />
              {unitLabel && (
                <span
                  className="px-3 text-sm font-semibold flex-shrink-0"
                  style={{ color: 'rgba(168,85,247,0.7)' }}
                >
                  {unitLabel}
                </span>
              )}
            </div>
            <button
              onClick={onQuantitySubmit}
              disabled={!st.quantityRaw.trim() || st.loading}
              className="px-5 py-3.5 rounded-2xl text-sm font-semibold flex-shrink-0 transition-all active:scale-[0.97] disabled:opacity-35 flex items-center justify-center min-w-[72px]"
              style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}
            >
              {st.loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                : 'Log'}
            </button>
          </div>
        </div>

        {st.error && <p className="text-red-400 text-xs px-1">{st.error}</p>}
      </div>
    )
  }

  return null
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Diet() {
  usePageTitle('Nutrition')
  const today = localDateStr()
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeMeal, setActiveMeal]     = useState<Meal | null>(null)
  const [addState, setAddState]         = useState<Partial<Record<Meal, AddState>>>({})
  const fileInputRefs = useRef<Partial<Record<Meal, HTMLInputElement | null>>>({})

  const userId = getUserId()
  const { unit, formatDateWithWeekday } = useLocale()

  const [profile, setProfile] = useState<NutritionProfile | null>(() => getNutritionProfile())
  const targets = profile ? calculateTargets(profile) : null

  const { data: profileQueryData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })

  useEffect(() => {
    if (profile || profileQueryData === undefined) return
    const snap = (profileQueryData.userProfiles?.[0] as { nutritionSnapshot?: string } | undefined)?.nutritionSnapshot
    if (!snap) return
    try {
      const parsed = JSON.parse(snap) as NutritionProfile
      saveNutritionProfile(parsed)
      setProfile(parsed)
    } catch { /* ignore */ }
  }, [profile, profileQueryData])

  const { data } = db.useQuery({ mealEntries: { $: { where: { userId, date: selectedDate } } } })
  const entries = ((data?.mealEntries ?? []) as MealEntry[]).sort((a, b) => a.createdAt - b.createdAt)

  const totals = entries.reduce(
    (acc, e) => ({ kcal: acc.kcal + (e.kcal || 0), protein: acc.protein + (e.protein || 0), carbs: acc.carbs + (e.carbs || 0), fat: acc.fat + (e.fat || 0) }),
    { ...ZERO_TOTALS },
  )

  const get   = (meal: Meal): AddState => addState[meal] ?? EMPTY_ADD
  const patch = useCallback((meal: Meal, update: Partial<AddState>) =>
    setAddState(prev => ({ ...prev, [meal]: { ...(prev[meal] ?? EMPTY_ADD), ...update } })), [])

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleFoodSubmit = (meal: Meal, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const foodKind = classifyFood(trimmed)
    patch(meal, { step: 'quantity', foodName: trimmed, foodKind, quantityRaw: '', error: '' })
  }

  const handleEstimate = async (meal: Meal) => {
    const st = get(meal)

    if (st.mode === 'manual') {
      const qty = st.quantityRaw.trim()
      if (!qty) return
      const query = buildQuery(st.foodName, qty, st.foodKind, unit)
      patch(meal, { loading: true, error: '', estimate: null })
      try {
        const estimate = await estimateFoodMacros(query)
        patch(meal, { loading: false, estimate, step: 'result' })
      } catch {
        patch(meal, { loading: false, error: "Couldn't estimate. Try again." })
      }
    } else {
      // Photo mode - unchanged
      if (!st.imageDataUrl) return
      patch(meal, { loading: true, error: '', estimate: null })
      try {
        const estimate = await estimateFoodMacros('', st.imageDataUrl)
        patch(meal, { loading: false, estimate })
      } catch {
        patch(meal, { loading: false, error: "Couldn't estimate. Try again." })
      }
    }
  }

  const handleConfirm = async (meal: Meal) => {
    const st = get(meal)
    if (!st.estimate) return
    await db.transact(db.tx.mealEntries[id()].update({
      userId, date: selectedDate, meal: meal.toLowerCase(),
      description: st.estimate.description,
      kcal: st.estimate.kcal, protein: st.estimate.protein,
      carbs: st.estimate.carbs, fat: st.estimate.fat,
      createdAt: Date.now(),
    }))
    patch(meal, EMPTY_ADD)
    setActiveMeal(null)
  }

  const handleDelete = async (entryId: string) => {
    await db.transact(db.tx.mealEntries[entryId].delete())
  }

  const handleImageUpload = (meal: Meal, file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => patch(meal, { imageDataUrl: ev.target?.result as string, estimate: null, error: '' })
    reader.readAsDataURL(file)
  }

  const goToDate = (d: string) => { setSelectedDate(d); setActiveMeal(null) }
  const isToday  = selectedDate === today

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5"
      >
        <h1 className="text-2xl font-black gradient-text">Diet</h1>
        <p className="text-white/40 text-sm mt-0.5">Track your meals and macros.</p>
      </motion.div>

      {/* Date navigator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="flex items-center gap-2 mb-5"
      >
        <button
          onClick={() => goToDate(shiftDateStr(selectedDate, -1))}
          className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          aria-label="Previous day"
        >
          <HiChevronLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1 text-center">
          <p className={`font-bold text-lg ${isToday ? 'gradient-text' : 'text-white/85'}`}>
            {isToday ? 'Today' : formatDateWithWeekday(new Date(selectedDate + 'T12:00:00'))}
          </p>
          {!isToday && (
            <button onClick={() => goToDate(today)} className="text-xs mt-0.5" style={{ color: '#c084fc' }}>
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => goToDate(shiftDateStr(selectedDate, 1))}
          disabled={isToday}
          className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90 flex-shrink-0 disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          aria-label="Next day"
        >
          <HiChevronRight className="w-5 h-5 text-white/60" />
        </button>
      </motion.div>

      {/* No profile prompt */}
      {!profile && profileQueryData !== undefined && (
        <div className="glass-card p-5 mb-4 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-white font-bold mb-1.5">No targets set</h3>
          <p className="text-white/45 text-sm leading-relaxed mb-4">
            Complete the fitness questionnaire to unlock personalized daily calorie and macro targets.
          </p>
          <Link to="/questionnaire" className="btn-primary inline-flex">Set My Targets</Link>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
      >
        <MacroSummary targets={targets} totals={totals} />
      </motion.div>

      {/* No-target totals fallback */}
      {!targets && entries.length > 0 && (
        <div className="glass-card p-5 mb-3.5">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">Today's Totals</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Kcal',    val: Math.round(totals.kcal) },
              { label: 'Protein', val: `${Math.round(totals.protein)}g` },
              { label: 'Carbs',   val: `${Math.round(totals.carbs)}g` },
              { label: 'Fat',     val: `${Math.round(totals.fat)}g` },
            ].map(({ label, val }) => (
              <div key={label} className="py-2.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-white font-bold text-sm tabular-nums">{val}</p>
                <p className="text-white/30 text-[9px] uppercase tracking-wide mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meal sections */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-3 pb-10"
      >
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal.toLowerCase() === meal.toLowerCase())
          const mealKcal    = mealEntries.reduce((a, e) => a + (e.kcal || 0), 0)
          const st          = get(meal)
          const isActive    = activeMeal === meal

          return (
            <div key={meal} className="glass-card p-0 overflow-hidden">
              {/* Meal header */}
              <button
                onClick={() => {
                  if (isActive) { setActiveMeal(null) }
                  else { setActiveMeal(meal); patch(meal, EMPTY_ADD) }
                }}
                className="w-full flex items-center justify-between px-5 py-4 transition-all active:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{MEAL_EMOJI[meal]}</span>
                  <div className="text-left">
                    <p className="text-base font-bold text-white/90">{meal}</p>
                    {mealKcal > 0 && (
                      <p className="text-xs text-white/35 tabular-nums mt-0.5">{Math.round(mealKcal)} kcal logged</p>
                    )}
                  </div>
                </div>
                <span
                  className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                  style={isActive
                    ? { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }
                    : { background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }
                  }
                >
                  {isActive ? '✕ Close' : '+ Add'}
                </span>
              </button>

              {/* Logged entries */}
              {mealEntries.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3.5 border-t border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{entry.description}</p>
                    <p className="text-white/35 text-xs mt-1 tabular-nums">
                      <span className="font-semibold text-white/55">{Math.round(entry.kcal)}</span> kcal
                      <span className="mx-2 text-white/15">|</span>P <span className="font-semibold">{Math.round(entry.protein)}g</span>
                      <span className="mx-2 text-white/15">|</span>C <span className="font-semibold">{Math.round(entry.carbs)}g</span>
                      <span className="mx-2 text-white/15">|</span>F <span className="font-semibold">{Math.round(entry.fat)}g</span>
                    </p>
                  </div>
                  <button
                    onClick={() => void handleDelete(entry.id)}
                    className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'rgba(239,68,68,0.08)' }}
                    aria-label="Remove entry"
                  >
                    <span className="text-red-400/60 text-base leading-none">×</span>
                  </button>
                </div>
              ))}

              {mealEntries.length === 0 && !isActive && (
                <div className="px-5 py-4 border-t border-white/[0.05]">
                  <p className="text-white/25 text-sm">Nothing logged yet.</p>
                </div>
              )}

              {/* Add food panel */}
              {isActive && (
                <div className="border-t border-white/[0.08] px-5 py-4 space-y-4" style={{ background: 'rgba(168,85,247,0.03)' }}>
                  {/* Mode tabs — only show on food step */}
                  {st.step === 'food' && (
                    <div className="flex gap-2">
                      {(['manual', 'photo'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => patch(meal, { ...EMPTY_ADD, mode })}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                          style={st.mode === mode
                            ? { background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }
                            : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.38)', border: '1px solid rgba(255,255,255,0.07)' }
                          }
                        >
                          {mode === 'manual'
                            ? <><HiPencil className="w-4 h-4" />Manual</>
                            : <><HiCamera className="w-4 h-4" />Photo</>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Manual two-step flow ── */}
                  {st.mode === 'manual' && st.step !== 'result' && (
                    <ManualInput
                      st={st}
                      unit={unit}
                      onFoodSubmit={name => handleFoodSubmit(meal, name)}
                      onQuantitySubmit={() => void handleEstimate(meal)}
                      onBack={() => patch(meal, { step: 'food', quantityRaw: '', error: '' })}
                      onChange={update => patch(meal, update)}
                    />
                  )}

                  {/* ── Photo flow ── */}
                  {st.mode === 'photo' && !st.estimate && (
                    <>
                      <input
                        ref={el => { fileInputRefs.current[meal] = el }}
                        type="file" accept="image/*" className="hidden"
                        onChange={e => { const file = e.target.files?.[0]; if (file) handleImageUpload(meal, file); e.target.value = '' }}
                      />
                      {!st.imageDataUrl ? (
                        <button
                          onClick={() => fileInputRefs.current[meal]?.click()}
                          className="w-full flex flex-col items-center gap-2 py-8 rounded-2xl transition-all active:scale-[0.98] border-2 border-dashed"
                          style={{ borderColor: 'rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.04)' }}
                        >
                          <HiCamera className="w-7 h-7 text-white/25" />
                          <span className="text-white/40 text-sm">Tap to add a photo</span>
                        </button>
                      ) : (
                        <div className="relative">
                          <img src={st.imageDataUrl} alt="Meal" className="w-full max-h-48 object-cover rounded-2xl" />
                          <button
                            onClick={() => fileInputRefs.current[meal]?.click()}
                            className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-white/70 text-xs backdrop-blur-sm"
                            style={{ background: 'rgba(0,0,0,0.6)' }}
                          >
                            Change
                          </button>
                        </div>
                      )}
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                        <HiInformationCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        <p className="text-orange-300/80 text-xs leading-relaxed">Photo estimates are approximate. For precise tracking use manual entry.</p>
                      </div>
                      <button
                        onClick={() => void handleEstimate(meal)}
                        disabled={!st.imageDataUrl || st.loading}
                        className="w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}
                      >
                        {st.loading
                          ? <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                            Analyzing...
                          </span>
                          : 'Analyze Photo'}
                      </button>
                    </>
                  )}

                  {st.error && st.mode === 'photo' && (
                    <p className="text-red-400 text-xs">{st.error}</p>
                  )}

                  {/* ── Estimate result (both modes) ── */}
                  {st.estimate && (
                    <EstimateResult
                      estimate={st.estimate}
                      onReenter={() => patch(meal, {
                        estimate: null,
                        step: st.mode === 'manual' ? 'quantity' : 'food',
                        ...(st.mode === 'photo' ? { imageDataUrl: null } : {}),
                      })}
                      onConfirm={() => void handleConfirm(meal)}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </motion.div>
    </main>
  )
}
