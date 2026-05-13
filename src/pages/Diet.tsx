import { useState, useRef, useEffect } from 'react'
import { HiChevronLeft, HiChevronRight, HiPencil, HiCamera, HiInformationCircle } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, saveNutritionProfile, calculateTargets, type DailyTargets, type NutritionProfile } from '@/lib/nutrition'
import { estimateFoodMacros, type FoodMacros } from '@/lib/gemini'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const
type Meal = (typeof MEALS)[number]
type Mode = 'manual' | 'photo'

const MEAL_EMOJI: Record<Meal, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snacks: '🍎',
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftDate(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

type MealEntry = {
  id: string; meal: string; description: string
  kcal: number; protein: number; carbs: number; fat: number; createdAt: number
}

interface AddState {
  mode: Mode; input: string; imageDataUrl: string | null
  loading: boolean; estimate: FoodMacros | null; error: string
}

const EMPTY_ADD: AddState = { mode: 'manual', input: '', imageDataUrl: null, loading: false, estimate: null, error: '' }
const ZERO_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

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
      {/* Calorie hero */}
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
        <MacroBar label="Carbs" unit="g" current={totals.carbs} max={targets.carbs} gradient="linear-gradient(90deg,#f59e0b,#f97316)" color="#f97316" />
        <MacroBar label="Fat" unit="g" current={totals.fat} max={targets.fat} gradient="linear-gradient(90deg,#ec4899,#f43f5e)" color="#ec4899" />
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
          { label: 'Kcal', val: String(estimate.kcal) },
          { label: 'Protein', val: `${estimate.protein}g` },
          { label: 'Carbs', val: `${estimate.carbs}g` },
          { label: 'Fat', val: `${estimate.fat}g` },
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

export default function Diet() {
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null)
  const [addState, setAddState] = useState<Partial<Record<Meal, AddState>>>({})
  const fileInputRefs = useRef<Partial<Record<Meal, HTMLInputElement | null>>>({})

  const userId = getUserId()
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

  const get = (meal: Meal): AddState => addState[meal] ?? EMPTY_ADD
  const patch = (meal: Meal, update: Partial<AddState>) =>
    setAddState(prev => ({ ...prev, [meal]: { ...(prev[meal] ?? EMPTY_ADD), ...update } }))

  const handleImageUpload = (meal: Meal, file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => patch(meal, { imageDataUrl: ev.target?.result as string, estimate: null, error: '' })
    reader.readAsDataURL(file)
  }

  const handleEstimate = async (meal: Meal) => {
    const st = get(meal)
    const ready = st.mode === 'manual' ? st.input.trim() : st.imageDataUrl
    if (!ready) return
    patch(meal, { loading: true, error: '', estimate: null })
    try {
      const estimate = st.mode === 'manual'
        ? await estimateFoodMacros(st.input.trim())
        : await estimateFoodMacros('', st.imageDataUrl!)
      patch(meal, { loading: false, estimate })
    } catch {
      patch(meal, { loading: false, error: "Couldn't estimate. Try again." })
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

  const goToDate = (d: string) => { setSelectedDate(d); setActiveMeal(null) }
  const isToday = selectedDate === today

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-black gradient-text">Diet</h1>
        <p className="text-white/40 text-sm mt-0.5">Track your meals and macros.</p>
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => goToDate(shiftDate(selectedDate, -1))}
          className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90 flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          aria-label="Previous day"
        >
          <HiChevronLeft className="w-5 h-5 text-white/60" />
        </button>
        <div className="flex-1 text-center">
          <p className={`font-bold text-lg ${isToday ? 'gradient-text' : 'text-white/85'}`}>
            {isToday ? 'Today' : formatDate(selectedDate)}
          </p>
          {!isToday && (
            <button onClick={() => goToDate(today)} className="text-xs mt-0.5" style={{ color: '#c084fc' }}>
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => goToDate(shiftDate(selectedDate, 1))}
          disabled={isToday}
          className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all active:scale-90 flex-shrink-0 disabled:opacity-30"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          aria-label="Next day"
        >
          <HiChevronRight className="w-5 h-5 text-white/60" />
        </button>
      </div>

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

      <MacroSummary targets={targets} totals={totals} />

      {/* No-target totals fallback */}
      {!targets && entries.length > 0 && (
        <div className="glass-card p-5 mb-3.5">
          <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">Today's Totals</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Kcal', val: Math.round(totals.kcal) },
              { label: 'Protein', val: `${Math.round(totals.protein)}g` },
              { label: 'Carbs', val: `${Math.round(totals.carbs)}g` },
              { label: 'Fat', val: `${Math.round(totals.fat)}g` },
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
      <div className="space-y-3 pb-10">
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal.toLowerCase() === meal.toLowerCase())
          const mealKcal = mealEntries.reduce((a, e) => a + (e.kcal || 0), 0)
          const st = get(meal)
          const isActive = activeMeal === meal

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
                  {/* Mode tabs */}
                  <div className="flex gap-2">
                    {(['manual', 'photo'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => patch(meal, { mode, input: '', imageDataUrl: null, estimate: null, error: '' })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={st.mode === mode
                          ? { background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.38)', border: '1px solid rgba(255,255,255,0.07)' }
                        }
                      >
                        {mode === 'manual' ? <><HiPencil className="w-4 h-4" />Manual</> : <><HiCamera className="w-4 h-4" />Photo</>}
                      </button>
                    ))}
                  </div>

                  {/* Manual input */}
                  {st.mode === 'manual' && !st.estimate && (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 px-4 py-3.5 rounded-2xl outline-none text-white placeholder-white/30"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 16 }}
                        placeholder="e.g. 2 eggs with toast..."
                        value={st.input}
                        autoFocus
                        onChange={e => patch(meal, { input: e.target.value, estimate: null, error: '' })}
                        onKeyDown={e => { if (e.key === 'Enter') void handleEstimate(meal) }}
                      />
                      <button
                        onClick={() => void handleEstimate(meal)}
                        disabled={!st.input.trim() || st.loading}
                        className="px-5 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-40 flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}
                      >
                        {st.loading
                          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                          : 'Estimate'}
                      </button>
                    </div>
                  )}

                  {/* Photo input */}
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

                  {st.error && <p className="text-red-400 text-xs">{st.error}</p>}

                  {st.estimate && (
                    <EstimateResult
                      estimate={st.estimate}
                      onReenter={() => patch(meal, { estimate: null, ...(st.mode === 'manual' ? { input: '' } : { imageDataUrl: null }) })}
                      onConfirm={() => void handleConfirm(meal)}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
