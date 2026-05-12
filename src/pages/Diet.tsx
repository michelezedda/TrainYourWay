import { useState, useRef, useEffect } from 'react'
import { HiChevronLeft, HiChevronRight, HiPencil, HiCamera, HiInformationCircle } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, saveNutritionProfile, calculateTargets, type DailyTargets, type NutritionProfile } from '@/lib/nutrition'
import { estimateFoodMacros, type FoodMacros } from '@/lib/gemini'
import GlassCard from '@/components/GlassCard'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const
type Meal = (typeof MEALS)[number]
type Mode = 'manual' | 'photo'

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
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

type MealEntry = {
  id: string
  meal: string
  description: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
}

interface AddState {
  mode: Mode
  input: string
  imageDataUrl: string | null
  loading: boolean
  estimate: FoodMacros | null
  error: string
}

const EMPTY_ADD: AddState = {
  mode: 'manual',
  input: '',
  imageDataUrl: null,
  loading: false,
  estimate: null,
  error: '',
}

function MacroBar({
  label, unit, current, max, gradient,
}: {
  label: string; unit: string; current: number; max: number; gradient: string
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0
  const isOver = current > max
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-white/50 text-xs font-medium">{label}</span>
        <span className={`text-xs font-semibold tabular-nums ${isOver ? 'text-red-400' : 'text-white/60'}`}>
          {Math.round(current)}{unit} / {max}{unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
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
  return (
    <GlassCard className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-white/30 text-[9px] uppercase tracking-widest">Daily Targets</p>
        <span className="text-white/40 text-xs tabular-nums">
          <span className={`font-semibold ${totals.kcal > targets.kcal ? 'text-red-400' : 'text-white/70'}`}>
            {Math.round(totals.kcal)}
          </span>{' '}/ {targets.kcal} kcal
        </span>
      </div>
      <div className="space-y-3.5">
        <MacroBar label="Calories" unit=" kcal" current={totals.kcal}    max={targets.kcal}    gradient="linear-gradient(90deg, #A855F7, #22D3EE)" />
        <MacroBar label="Protein"  unit="g"     current={totals.protein}  max={targets.protein}  gradient="linear-gradient(90deg, #22D3EE, #34d399)" />
        <MacroBar label="Carbs"    unit="g"     current={totals.carbs}    max={targets.carbs}    gradient="linear-gradient(90deg, #f59e0b, #f97316)" />
        <MacroBar label="Fat"      unit="g"     current={totals.fat}      max={targets.fat}      gradient="linear-gradient(90deg, #ec4899, #f43f5e)" />
      </div>
    </GlassCard>
  )
}

function EstimateResult({
  estimate,
  onReenter,
  onConfirm,
}: {
  estimate: FoodMacros
  onReenter: () => void
  onConfirm: () => void
}) {
  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="px-4 py-3 border-b border-white/8">
        <p className="text-white/85 text-sm font-medium">{estimate.description}</p>
      </div>
      <div className="grid grid-cols-4 divide-x divide-white/8">
        {[
          { label: 'Kcal',    val: String(estimate.kcal) },
          { label: 'Protein', val: `${estimate.protein}g` },
          { label: 'Carbs',   val: `${estimate.carbs}g` },
          { label: 'Fat',     val: `${estimate.fat}g` },
        ].map(({ label, val }) => (
          <div key={label} className="px-3 py-2.5 text-center">
            <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">{label}</p>
            <p className="text-white/85 text-xs font-semibold tabular-nums">{val}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-white/8">
        <button onClick={onReenter} className="btn-ghost !px-4 !py-2 !text-xs flex-1">Re-enter</button>
        <button onClick={onConfirm} className="btn-primary !px-4 !py-2 !text-xs flex-1">Log it</button>
      </div>
    </div>
  )
}

const ZERO_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

export default function Diet() {
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null)
  const [addState, setAddState] = useState<Partial<Record<Meal, AddState>>>({})
  const fileInputRefs = useRef<Partial<Record<Meal, HTMLInputElement | null>>>({})

  const userId = getUserId()
  const [profile, setProfile] = useState<NutritionProfile | null>(() => getNutritionProfile())
  const targets = profile ? calculateTargets(profile) : null

  const { data: profileQueryData } = db.useQuery({
    userProfiles: { $: { where: { userId } } },
  })

  useEffect(() => {
    if (profile || profileQueryData === undefined) return
    const snap = (profileQueryData.userProfiles?.[0] as { nutritionSnapshot?: string } | undefined)?.nutritionSnapshot
    if (!snap) return
    try {
      const parsed = JSON.parse(snap) as NutritionProfile
      saveNutritionProfile(parsed)
      setProfile(parsed)
    } catch { /* ignore malformed snapshot */ }
  }, [profile, profileQueryData])

  const { data } = db.useQuery({
    mealEntries: { $: { where: { userId, date: selectedDate } } },
  })

  const entries = ((data?.mealEntries ?? []) as MealEntry[]).sort(
    (a, b) => a.createdAt - b.createdAt,
  )

  const totals = entries.reduce(
    (acc, e) => ({
      kcal:    acc.kcal    + (e.kcal    || 0),
      protein: acc.protein + (e.protein || 0),
      carbs:   acc.carbs   + (e.carbs   || 0),
      fat:     acc.fat     + (e.fat     || 0),
    }),
    { ...ZERO_TOTALS },
  )

  const get = (meal: Meal): AddState => addState[meal] ?? EMPTY_ADD
  const patch = (meal: Meal, update: Partial<AddState>) =>
    setAddState(prev => ({ ...prev, [meal]: { ...(prev[meal] ?? EMPTY_ADD), ...update } }))

  const handleImageUpload = (meal: Meal, file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      patch(meal, { imageDataUrl: ev.target?.result as string, estimate: null, error: '' })
    }
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
    await db.transact(
      db.tx.mealEntries[id()].update({
        userId,
        date: selectedDate,
        meal: meal.toLowerCase(),
        description: st.estimate.description,
        kcal:    st.estimate.kcal,
        protein: st.estimate.protein,
        carbs:   st.estimate.carbs,
        fat:     st.estimate.fat,
        createdAt: Date.now(),
      }),
    )
    patch(meal, EMPTY_ADD)
    setActiveMeal(null)
  }

  const handleDelete = async (entryId: string) => {
    await db.transact(db.tx.mealEntries[entryId].delete())
  }

  const goToDate = (d: string) => { setSelectedDate(d); setActiveMeal(null) }
  const isToday = selectedDate === today

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-black gradient-text mb-1">DIET</h1>
        <p className="text-white/40 text-sm">Track your meals and monitor your daily intake.</p>
      </div>

      {/* Date navigator */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => goToDate(shiftDate(selectedDate, -1))}
          className="btn-ghost !px-3 !py-2.5 flex-shrink-0"
          aria-label="Previous day"
        >
          <HiChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-center">
          <p className={`font-bold text-base ${isToday ? 'gradient-text' : 'text-white/80'}`}>
            {isToday ? 'Today' : formatDate(selectedDate)}
          </p>
          {isToday && <p className="text-white/30 text-xs mt-0.5">{formatDate(selectedDate)}</p>}
          {!isToday && (
            <button
              onClick={() => goToDate(today)}
              className="text-purple-400/70 text-xs hover:text-purple-300 transition-colors mt-0.5"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => goToDate(shiftDate(selectedDate, 1))}
          disabled={isToday}
          className="btn-ghost !px-3 !py-2.5 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next day"
        >
          <HiChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* No profile prompt - only show after DB has confirmed no snapshot exists */}
      {!profile && profileQueryData !== undefined && (
        <GlassCard className="mb-6 text-center">
          <div className="text-3xl mb-3">🎯</div>
          <h3 className="text-white font-bold mb-1.5">No targets set</h3>
          <p className="text-white/45 text-sm leading-relaxed mb-4 max-w-xs mx-auto">
            Complete the fitness questionnaire to unlock personalized daily calorie and macro targets.
          </p>
          <Link to="/questionnaire" className="btn-primary inline-flex">Set My Targets</Link>
        </GlassCard>
      )}

      <MacroSummary targets={targets} totals={totals} />

      {!targets && entries.length > 0 && (
        <GlassCard className="mb-6">
          <p className="text-white/30 text-[9px] uppercase tracking-widest mb-3">Today's totals</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: 'Kcal',    val: Math.round(totals.kcal) },
              { label: 'Protein', val: `${Math.round(totals.protein)}g` },
              { label: 'Carbs',   val: `${Math.round(totals.carbs)}g` },
              { label: 'Fat',     val: `${Math.round(totals.fat)}g` },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-white/30 text-[9px] uppercase tracking-wide mb-1">{label}</p>
                <p className="text-white font-bold text-sm tabular-nums">{val}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Meal sections */}
      <div className="space-y-3">
        {MEALS.map(meal => {
          const mealEntries = entries.filter(e => e.meal.toLowerCase() === meal.toLowerCase())
          const mealKcal = mealEntries.reduce((a, e) => a + (e.kcal || 0), 0)
          const st = get(meal)
          const isActive = activeMeal === meal
          return (
            <GlassCard key={meal} padding={false} className="overflow-hidden">
              {/* Meal header */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'rgba(255,255,255,0.025)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-white/85">{meal}</span>
                  {mealKcal > 0 && (
                    <span className="text-[10px] text-white/30 tabular-nums">{Math.round(mealKcal)} kcal</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (isActive) { setActiveMeal(null) }
                    else { setActiveMeal(meal); patch(meal, EMPTY_ADD) }
                  }}
                  className="flex items-center gap-1 text-xs font-medium transition-colors text-purple-400/70 hover:text-purple-300"
                >
                  <span className="leading-none">{isActive ? '×' : '+'}</span>
                  <span>{isActive ? 'Cancel' : 'Add food'}</span>
                </button>
              </div>

              {/* Logged entries */}
              {mealEntries.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 px-5 py-3 border-t border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm truncate">{entry.description}</p>
                    <p className="text-white/30 text-xs mt-0.5 tabular-nums">
                      {Math.round(entry.kcal)} kcal
                      <span className="mx-1.5 text-white/15">·</span>P {Math.round(entry.protein)}g
                      <span className="mx-1.5 text-white/15">·</span>C {Math.round(entry.carbs)}g
                      <span className="mx-1.5 text-white/15">·</span>F {Math.round(entry.fat)}g
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm leading-none"
                    aria-label="Remove entry"
                  >×</button>
                </div>
              ))}

              {mealEntries.length === 0 && !isActive && (
                <div className="px-5 py-4 border-t border-white/5">
                  <p className="text-white/20 text-sm italic">Nothing logged yet.</p>
                </div>
              )}

              {/* Add food panel */}
              {isActive && (
                <div className="border-t border-white/8" style={{ background: 'rgba(168,85,247,0.04)' }}>

                  {/* Mode tabs */}
                  <div className="flex px-5 pt-4 gap-2">
                    {(['manual', 'photo'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => patch(meal, { mode, input: '', imageDataUrl: null, estimate: null, error: '' })}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
                          st.mode === mode
                            ? 'text-white border-purple-500/50 bg-purple-500/15'
                            : 'text-white/40 border-white/8 bg-white/3 hover:text-white/70 hover:bg-white/6'
                        }`}
                      >
                        {mode === 'manual' ? (
                          <>
                            <HiPencil className="w-3 h-3" />
                            Manual
                          </>
                        ) : (
                          <>
                            <HiCamera className="w-3 h-3" />
                            Photo
                          </>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="px-5 pb-4 pt-3 space-y-3">
                    {/* Manual mode */}
                    {st.mode === 'manual' && !st.estimate && (
                      <div className="flex gap-2">
                        <input
                          className="input-glass flex-1 !py-2.5 !text-sm"
                          placeholder="e.g. 2 eggs with toast and butter..."
                          value={st.input}
                          autoFocus
                          onChange={e => patch(meal, { input: e.target.value, estimate: null, error: '' })}
                          onKeyDown={e => { if (e.key === 'Enter') handleEstimate(meal) }}
                        />
                        <button
                          onClick={() => handleEstimate(meal)}
                          disabled={!st.input.trim() || st.loading}
                          className="btn-primary !px-4 !py-2.5 !text-sm flex-shrink-0 disabled:opacity-40"
                        >
                          {st.loading
                            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                            : 'Estimate'}
                        </button>
                      </div>
                    )}

                    {/* Photo mode */}
                    {st.mode === 'photo' && !st.estimate && (
                      <>
                        <input
                          ref={el => { fileInputRefs.current[meal] = el }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(meal, file)
                            e.target.value = ''
                          }}
                        />

                        {!st.imageDataUrl ? (
                          <label
                            onClick={() => fileInputRefs.current[meal]?.click()}
                            className="flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-white/12 cursor-pointer transition-colors hover:border-purple-500/40 hover:bg-white/2"
                          >
                            <HiCamera className="w-7 h-7 text-white/25" />
                            <span className="text-white/40 text-sm">Tap to upload a photo of your meal</span>
                          </label>
                        ) : (
                          <div className="relative">
                            <img
                              src={st.imageDataUrl}
                              alt="Meal photo"
                              className="w-full max-h-52 object-cover rounded-2xl border border-white/10"
                            />
                            <button
                              onClick={() => fileInputRefs.current[meal]?.click()}
                              className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white/70 text-xs hover:text-white transition-colors backdrop-blur-sm"
                            >
                              Change
                            </button>
                          </div>
                        )}

                        {/* Precision note */}
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                          <HiInformationCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                          <p className="text-orange-300/80 text-xs leading-relaxed">
                            Photo estimates are approximate. Portion sizes and hidden ingredients are hard to detect from an image. For precise tracking, use manual entry.
                          </p>
                        </div>

                        <button
                          onClick={() => handleEstimate(meal)}
                          disabled={!st.imageDataUrl || st.loading}
                          className="btn-primary w-full !py-2.5 !text-sm disabled:opacity-40"
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
                        onReenter={() =>
                          patch(meal, {
                            estimate: null,
                            ...(st.mode === 'manual' ? { input: '' } : { imageDataUrl: null }),
                          })
                        }
                        onConfirm={() => handleConfirm(meal)}
                      />
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>
    </main>
  )
}
