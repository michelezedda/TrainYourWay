import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, Animated, Easing, KeyboardAvoidingView,
  Platform, Alert, Dimensions, Image,
} from 'react-native'
import { id } from '@instantdb/react-native'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { estimateFoodMacros, type FoodMacros } from '@/lib/gemini'
import { getNutritionProfile, loadNutritionProfile, calculateTargets, type DailyTargets } from '@/lib/nutrition'
import { useLocale } from '@/context/LocaleContext'
import { type Unit } from '@/lib/units'
import { localDateStr, shiftDateStr } from '@/lib/utils'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] as const
type Meal = typeof MEALS[number]
type Mode = 'manual' | 'photo'
type LogStep = 'food' | 'quantity' | 'result'
type FoodKind = 'unit' | 'weight' | 'liquid'

const MEAL_EMOJI: Record<Meal, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snacks: '🍎',
}

const ZERO_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

interface MealEntry {
  id: string
  userId: string
  date: string
  meal: string
  description: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  createdAt: number
}

// ── Food classification ───────────────────────────────────────────────────────

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
  'syrup','honey','molasses','vinegar',
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
  if (/[a-zA-Z]/.test(q)) return `${q} ${foodName.trim()}`
  const label = getUnitLabel(kind, unit)
  return `${q}${label} ${foodName.trim()}`
}

interface AddState {
  mode: Mode
  step: LogStep
  foodName: string
  foodKind: FoodKind
  quantityRaw: string
  imageUri: string | null
  imageBase64: string | null
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
  imageUri: null,
  imageBase64: null,
  loading: false,
  estimate: null,
  error: '',
}

// ── MacroBar ──────────────────────────────────────────────────────────────────

function MacroBar({ label, unit: unitStr, current, max, gradient, color }: {
  label: string; unit: string; current: number; max: number; gradient: [string, string]; color: string
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0
  const isOver = current > max

  return (
    <View style={macroBarStyles.container}>
      <View style={macroBarStyles.row}>
        <Text style={macroBarStyles.label}>{label}</Text>
        <Text style={[macroBarStyles.value, isOver && macroBarStyles.over]}>
          {Math.round(current)}{unitStr}
          <Text style={macroBarStyles.target}> / {max}{unitStr}</Text>
        </Text>
      </View>
      <View style={macroBarStyles.track}>
        {isOver ? (
          <View style={[macroBarStyles.fill, { width: '100%', backgroundColor: 'rgba(239,68,68,0.8)' }]} />
        ) : (
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[macroBarStyles.fill, { width: `${pct}%` }]}
          />
        )}
      </View>
    </View>
  )
}

const macroBarStyles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  value: { fontSize: 13, fontWeight: '700', color: '#34d399' },
  over: { color: '#f87171' },
  target: { fontSize: 11, fontWeight: '400', color: Colors.textDim },
  track: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: 7, borderRadius: 4 },
})

// ── MacroSummary ──────────────────────────────────────────────────────────────

function MacroSummary({ targets, totals }: { targets: DailyTargets | null; totals: typeof ZERO_TOTALS }) {
  if (!targets) return null
  const kcalPct = Math.min(100, (totals.kcal / targets.kcal) * 100)
  const remaining = Math.max(0, targets.kcal - Math.round(totals.kcal))
  const isOver = totals.kcal > targets.kcal

  return (
    <View style={summaryStyles.card}>
      <View style={summaryStyles.topRow}>
        <View>
          <Text style={summaryStyles.sectionLabel}>Calories</Text>
          <View style={summaryStyles.kcalRow}>
            <Text style={[summaryStyles.kcalNum, isOver && summaryStyles.kcalOver]}>
              {Math.round(totals.kcal)}
            </Text>
            <Text style={summaryStyles.kcalTarget}> / {targets.kcal} kcal</Text>
          </View>
        </View>
        <View style={summaryStyles.remaining}>
          <Text style={summaryStyles.remainingLabel}>{isOver ? 'Over by' : 'Remaining'}</Text>
          <Text style={[summaryStyles.remainingNum, isOver ? summaryStyles.over : summaryStyles.under]}>
            {isOver ? `+${Math.round(totals.kcal) - targets.kcal}` : remaining}
          </Text>
        </View>
      </View>
      <View style={summaryStyles.bar}>
        {isOver ? (
          <View style={[summaryStyles.barFill, { width: '100%', backgroundColor: 'rgba(239,68,68,0.8)' }]} />
        ) : (
          <LinearGradient
            colors={['#A855F7', '#22D3EE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[summaryStyles.barFill, { width: `${kcalPct}%` }]}
          />
        )}
      </View>
      <View style={summaryStyles.macros}>
        <MacroBar label="Protein" unit="g" current={totals.protein} max={targets.protein} gradient={['#22D3EE', '#34d399']} color="#34d399" />
        <MacroBar label="Carbs" unit="g" current={totals.carbs} max={targets.carbs} gradient={['#f59e0b', '#f97316']} color="#f97316" />
        <MacroBar label="Fat" unit="g" current={totals.fat} max={targets.fat} gradient={['#ec4899', '#f43f5e']} color="#ec4899" />
      </View>
    </View>
  )
}

const summaryStyles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, gap: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  kcalNum: { fontSize: 30, fontWeight: '900', color: '#c084fc', letterSpacing: -0.5 },
  kcalOver: { color: '#f87171' },
  kcalTarget: { fontSize: 13, color: Colors.textDim },
  remaining: { alignItems: 'flex-end' },
  remainingLabel: { fontSize: 11, color: Colors.textDim, marginBottom: 2 },
  remainingNum: { fontSize: 18, fontWeight: '700' },
  over: { color: '#f87171' },
  under: { color: '#34d399' },
  bar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  macros: { gap: 14 },
})

// ── EstimateResult ────────────────────────────────────────────────────────────

function EstimateResult({ estimate, onReenter, onConfirm }: {
  estimate: FoodMacros; onReenter: () => void; onConfirm: () => void
}) {
  return (
    <View style={estStyles.card}>
      <View style={estStyles.descRow}>
        <Text style={estStyles.desc}>{estimate.description}</Text>
      </View>
      <View style={estStyles.macroRow}>
        {[
          { label: 'Kcal', val: String(estimate.kcal) },
          { label: 'Protein', val: `${estimate.protein}g` },
          { label: 'Carbs', val: `${estimate.carbs}g` },
          { label: 'Fat', val: `${estimate.fat}g` },
        ].map(({ label, val }) => (
          <View key={label} style={estStyles.macroCell}>
            <Text style={estStyles.macroLabel}>{label}</Text>
            <Text style={estStyles.macroVal}>{val}</Text>
          </View>
        ))}
      </View>
      <View style={estStyles.btnRow}>
        <TouchableOpacity style={estStyles.reenterBtn} onPress={onReenter} activeOpacity={0.8}>
          <Text style={estStyles.reenterText}>Re-enter</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm} activeOpacity={0.9} style={{ flex: 1 }}>
          <LinearGradient colors={['#A855F7', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estStyles.logBtn}>
            <Text style={estStyles.logBtnText}>Log it</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const estStyles = StyleSheet.create({
  card: { borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  descRow: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  desc: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },
  macroRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  macroCell: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.07)' },
  macroLabel: { fontSize: 9, color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  macroVal: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  btnRow: { flexDirection: 'row', gap: 8, padding: 12 },
  reenterBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  reenterText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  logBtn: { paddingVertical: 12, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  logBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
})

// ── FadeSlide ─────────────────────────────────────────────────────────────────

function FadeSlide({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(16)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  )
}

// ── MealSection ───────────────────────────────────────────────────────────────

interface MealSectionProps {
  meal: Meal
  entries: MealEntry[]
  isActive: boolean
  st: AddState
  unit: Unit
  onToggle: () => void
  onPatch: (update: Partial<AddState>) => void
  onFoodSubmit: (name: string) => void
  onQuantitySubmit: () => void
  onConfirm: () => void
  onDelete: (id: string) => void
  onPickPhoto: () => void
  onAnalyzePhoto: () => void
}

function MealSection({ meal, entries, isActive, st, unit, onToggle, onPatch, onFoodSubmit, onQuantitySubmit, onConfirm, onDelete, onPickPhoto, onAnalyzePhoto }: MealSectionProps) {
  const mealKcal = entries.reduce((a, e) => a + (e.kcal || 0), 0)
  const unitLabel = getUnitLabel(st.foodKind, unit)
  const prompt = getPrompt(st.foodKind)
  const placeholder = getPlaceholder(st.foodKind, unit)

  return (
    <View style={mealStyles.card}>
      {/* Meal header */}
      <TouchableOpacity style={mealStyles.header} onPress={onToggle} activeOpacity={0.85}>
        <View style={mealStyles.headerLeft}>
          <Text style={{ fontSize: 22 }}>{MEAL_EMOJI[meal]}</Text>
          <View>
            <Text style={mealStyles.mealName}>{meal}</Text>
            {mealKcal > 0 && (
              <Text style={mealStyles.mealKcal}>{Math.round(mealKcal)} kcal logged</Text>
            )}
          </View>
        </View>
        <View style={[mealStyles.addBadge, isActive && mealStyles.addBadgeClose]}>
          <Text style={[mealStyles.addBadgeText, isActive && mealStyles.addBadgeTextClose]}>
            {isActive ? '✕ Close' : '+ Add'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Logged entries */}
      {entries.map(entry => (
        <View key={entry.id} style={mealStyles.entryRow}>
          <View style={mealStyles.entryInfo}>
            <Text style={mealStyles.entryDesc} numberOfLines={1}>{entry.description}</Text>
            <Text style={mealStyles.entryMacros}>
              {Math.round(entry.kcal)} kcal{' '}
              <Text style={mealStyles.entryMacroSep}>|</Text>{' '}
              P {Math.round(entry.protein)}g{' '}
              <Text style={mealStyles.entryMacroSep}>|</Text>{' '}
              C {Math.round(entry.carbs)}g{' '}
              <Text style={mealStyles.entryMacroSep}>|</Text>{' '}
              F {Math.round(entry.fat)}g
            </Text>
          </View>
          <TouchableOpacity style={mealStyles.deleteBtn} onPress={() => onDelete(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={mealStyles.deleteBtnText}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      {entries.length === 0 && !isActive && (
        <View style={mealStyles.emptyRow}>
          <Text style={mealStyles.emptyText}>Nothing logged yet.</Text>
        </View>
      )}

      {/* Add food panel */}
      {isActive && (
        <View style={mealStyles.panel}>
          {/* Mode tabs - show only on food step */}
          {st.step === 'food' && (
            <View style={mealStyles.modeTabs}>
              {(['manual', 'photo'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[mealStyles.modeTab, st.mode === mode && mealStyles.modeTabActive]}
                  onPress={() => onPatch({ ...EMPTY_ADD, mode })}
                  activeOpacity={0.8}
                >
                  <Text style={[mealStyles.modeTabText, st.mode === mode && mealStyles.modeTabTextActive]}>
                    {mode === 'manual' ? '✏️ Manual' : '📷 Photo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Manual: food name step */}
          {st.mode === 'manual' && st.step === 'food' && (
            <View style={mealStyles.inputRow}>
              <TextInput
                style={mealStyles.textInput}
                placeholder="What did you eat?"
                placeholderTextColor={Colors.textDim}
                value={st.foodName}
                onChangeText={t => onPatch({ foodName: t, error: '' })}
                onSubmitEditing={() => { if (st.foodName.trim()) onFoodSubmit(st.foodName) }}
                returnKeyType="next"
                autoFocus
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
              <TouchableOpacity
                style={[mealStyles.nextBtn, !st.foodName.trim() && mealStyles.nextBtnDisabled]}
                onPress={() => { if (st.foodName.trim()) onFoodSubmit(st.foodName) }}
                disabled={!st.foodName.trim()}
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#A855F7', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={mealStyles.nextBtnGrad}>
                  <Text style={mealStyles.nextBtnArrow}>›</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Manual: quantity step */}
          {st.mode === 'manual' && st.step === 'quantity' && (
            <View style={{ gap: Spacing.sm }}>
              <TouchableOpacity
                style={mealStyles.foodChip}
                onPress={() => onPatch({ step: 'food', quantityRaw: '', error: '' })}
                activeOpacity={0.8}
              >
                <Text style={mealStyles.foodChipText} numberOfLines={1}>{st.foodName}</Text>
                <Text style={mealStyles.foodChipX}>×</Text>
              </TouchableOpacity>
              <View style={mealStyles.qtyRow}>
                <Text style={mealStyles.qtyPrompt}>{prompt}</Text>
                <View style={mealStyles.qtyInputWrap}>
                  <TextInput
                    style={[mealStyles.textInput, { flex: 1 }]}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textDim}
                    keyboardType="decimal-pad"
                    value={st.quantityRaw}
                    onChangeText={t => onPatch({ quantityRaw: t, error: '' })}
                    onSubmitEditing={() => { if (st.quantityRaw.trim()) onQuantitySubmit() }}
                    returnKeyType="done"
                    editable={!st.loading}
                    autoFocus
                    underlineColorAndroid="transparent"
                    selectionColor="#A855F7"
                  />
                  {unitLabel ? (
                    <View style={mealStyles.unitLabel}>
                      <Text style={mealStyles.unitLabelText}>{unitLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[mealStyles.logBtn, (!st.quantityRaw.trim() || st.loading) && mealStyles.logBtnDisabled]}
                  onPress={onQuantitySubmit}
                  disabled={!st.quantityRaw.trim() || st.loading}
                  activeOpacity={0.9}
                >
                  {st.loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={mealStyles.logBtnText}>Log</Text>}
                </TouchableOpacity>
              </View>
              {st.error ? <Text style={mealStyles.errorText}>{st.error}</Text> : null}
            </View>
          )}

          {/* Photo mode */}
          {st.mode === 'photo' && !st.estimate && (
            <View style={{ gap: Spacing.sm }}>
              {!st.imageUri ? (
                <TouchableOpacity style={mealStyles.photoPlaceholder} onPress={onPickPhoto} activeOpacity={0.8}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>📷</Text>
                  <Text style={mealStyles.photoPlaceholderText}>Tap to add a photo</Text>
                </TouchableOpacity>
              ) : (
                <View style={mealStyles.photoPreviewContainer}>
                  <Image
                    source={{ uri: st.imageUri }}
                    style={mealStyles.photoPreviewImg}
                    resizeMode="cover"
                  />
                  <TouchableOpacity style={mealStyles.photoChangeOverlay} onPress={onPickPhoto} activeOpacity={0.8}>
                    <Text style={mealStyles.photoChangeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={mealStyles.photoWarning}>
                <Text style={{ fontSize: 13, marginRight: 6 }}>⚠️</Text>
                <Text style={mealStyles.photoWarningText}>
                  Photo estimates are approximate. For precise tracking use manual entry.
                </Text>
              </View>
              <TouchableOpacity
                style={[mealStyles.analyzeBtn, (!st.imageUri || st.loading) && mealStyles.logBtnDisabled]}
                onPress={onAnalyzePhoto}
                disabled={!st.imageUri || st.loading}
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#A855F7', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={mealStyles.analyzeBtnGrad}>
                  {st.loading ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={mealStyles.logBtnText}>Analyzing...</Text>
                    </View>
                  ) : (
                    <Text style={mealStyles.logBtnText}>Analyze Photo</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              {st.error ? <Text style={mealStyles.errorText}>{st.error}</Text> : null}
            </View>
          )}

          {/* Estimate result */}
          {st.estimate && (
            <EstimateResult
              estimate={st.estimate}
              onReenter={() => onPatch({
                estimate: null,
                step: st.mode === 'manual' ? 'quantity' : 'food',
                ...(st.mode === 'photo' ? { imageUri: null, imageBase64: null } : {}),
              })}
              onConfirm={onConfirm}
            />
          )}
        </View>
      )}
    </View>
  )
}

const mealStyles = StyleSheet.create({
  card: { borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  mealKcal: { fontSize: 11, color: Colors.textDim, marginTop: 1 },
  addBadge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.xl, backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)' },
  addBadgeClose: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'transparent' },
  addBadgeText: { fontSize: 13, fontWeight: '600', color: '#c084fc' },
  addBadgeTextClose: { color: Colors.textMuted },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  entryInfo: { flex: 1 },
  entryDesc: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  entryMacros: { fontSize: 11, color: Colors.textDim, marginTop: 3 },
  entryMacroSep: { color: 'rgba(255,255,255,0.12)' },
  deleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(239,68,68,0.08)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 18, color: 'rgba(239,68,68,0.6)', lineHeight: 20 },
  emptyRow: { paddingHorizontal: 20, paddingBottom: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  emptyText: { fontSize: 14, color: Colors.textDim, marginTop: 12 },
  panel: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, paddingVertical: 16, gap: Spacing.sm, backgroundColor: 'rgba(168,85,247,0.03)' },
  modeTabs: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  modeTab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  modeTabActive: { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.3)' },
  modeTabText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  modeTabTextActive: { color: '#c084fc' },
  inputRow: { flexDirection: 'row', gap: 8 },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: Colors.textPrimary, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  nextBtn: { width: 48, height: 48, borderRadius: Radius.lg, overflow: 'hidden' },
  nextBtnDisabled: { opacity: 0.35 },
  nextBtnGrad: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  nextBtnArrow: { fontSize: 24, color: '#fff', lineHeight: 28 },
  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)', alignSelf: 'flex-start', maxWidth: '70%' },
  foodChipText: { fontSize: 13, fontWeight: '500', color: '#c084fc', flexShrink: 1 },
  foodChipX: { fontSize: 12, color: 'rgba(192,132,252,0.6)' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyPrompt: { fontSize: 13, fontWeight: '500', color: Colors.textMuted, width: 80, flexShrink: 0 },
  qtyInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  unitLabel: { paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)' },
  unitLabelText: { fontSize: 13, fontWeight: '600', color: 'rgba(168,85,247,0.7)' },
  logBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: Radius.lg, backgroundColor: 'linear-gradient(135deg,#A855F7,#22D3EE)' as any, alignItems: 'center', justifyContent: 'center', minWidth: 60 },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  errorText: { fontSize: 12, color: '#f87171', paddingHorizontal: 2 },
  photoPlaceholder: { paddingVertical: 32, borderRadius: Radius.xl, borderWidth: 2, borderColor: 'rgba(168,85,247,0.25)', borderStyle: 'dashed', backgroundColor: 'rgba(168,85,247,0.04)', alignItems: 'center' },
  photoPlaceholderText: { fontSize: 13, color: Colors.textMuted },
  photoPreviewContainer: { borderRadius: Radius.xl, overflow: 'hidden', position: 'relative' },
  photoPreviewImg: { width: '100%', height: 192, borderRadius: Radius.xl },
  photoChangeOverlay: {
    position: 'absolute', top: 8, right: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoChangeText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  photoWarning: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, borderRadius: Radius.md, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)' },
  photoWarningText: { fontSize: 12, color: 'rgba(253,186,116,0.8)', flex: 1, lineHeight: 17 },
  analyzeBtn: { borderRadius: Radius.lg, overflow: 'hidden' },
  analyzeBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
})

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DietScreen() {
  const userId = getUserId()
  const today = localDateStr()
  const { unit, formatDateWithWeekday } = useLocale()

  const [selectedDate, setSelectedDate] = useState(today)
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null)
  const [addState, setAddState] = useState<Partial<Record<Meal, AddState>>>({})
  const [targets, setTargets] = useState<DailyTargets | null>(() => {
    const profile = getNutritionProfile()
    return profile ? calculateTargets(profile) : null
  })

  useEffect(() => {
    loadNutritionProfile().then(profile => {
      if (profile) setTargets(calculateTargets(profile))
    })
  }, [])

  const { data: profileData } = db.useQuery({
    userProfiles: { $: { where: { userId } } },
  })

  useEffect(() => {
    if (targets || profileData === undefined) return
    const snap = (profileData?.userProfiles?.[0] as { nutritionSnapshot?: string } | undefined)?.nutritionSnapshot
    if (!snap) return
    try {
      const parsed = JSON.parse(snap) as Parameters<typeof calculateTargets>[0]
      setTargets(calculateTargets(parsed))
    } catch { /* ignore */ }
  }, [targets, profileData])

  const { data } = db.useQuery({
    mealEntries: { $: { where: { userId, date: selectedDate } } },
  })

  const entries = ((data?.mealEntries ?? []) as MealEntry[]).sort((a, b) => a.createdAt - b.createdAt)

  const totals = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + (e.kcal || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
    }),
    { ...ZERO_TOTALS },
  )

  const isToday = selectedDate === today

  const get = (meal: Meal): AddState => addState[meal] ?? EMPTY_ADD
  const patch = useCallback((meal: Meal, update: Partial<AddState>) =>
    setAddState(prev => ({ ...prev, [meal]: { ...(prev[meal] ?? EMPTY_ADD), ...update } })), [])

  const goToDate = (d: string) => { setSelectedDate(d); setActiveMeal(null) }

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
      if (!st.imageBase64) return
      patch(meal, { loading: true, error: '', estimate: null })
      try {
        const dataUrl = `data:image/jpeg;base64,${st.imageBase64}`
        const estimate = await estimateFoodMacros('', dataUrl)
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
      userId,
      date: selectedDate,
      meal: meal.toLowerCase(),
      description: st.estimate.description,
      kcal: st.estimate.kcal,
      protein: st.estimate.protein,
      carbs: st.estimate.carbs,
      fat: st.estimate.fat,
      createdAt: Date.now(),
    }))
    patch(meal, EMPTY_ADD)
    setActiveMeal(null)
  }

  const handleDelete = async (entryId: string) => {
    await db.transact(db.tx.mealEntries[entryId].delete())
  }

  const handlePickPhoto = async (meal: Meal) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      patch(meal, {
        imageUri: asset.uri,
        imageBase64: asset.base64 ?? null,
        estimate: null,
        error: '',
      })
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={['#0f0a2e', Colors.bg]} locations={[0, 0.45]} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(168,85,247,0.09)', 'transparent']} style={styles.orbTopLeft} />
        <LinearGradient colors={['rgba(34,211,238,0.07)', 'transparent']} style={styles.orbBottomRight} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <FadeSlide delay={0}>
            <GradientText style={styles.titleMask} end={{ x: 1, y: 1 }}>Diet</GradientText>
            <Text style={styles.subtitle}>Track your meals and macros.</Text>
          </FadeSlide>

          {/* Date navigator */}
          <FadeSlide delay={60}>
            <View style={styles.dateNav}>
              <TouchableOpacity
                style={styles.dateNavBtn}
                onPress={() => goToDate(shiftDateStr(selectedDate, -1))}
                activeOpacity={0.8}
              >
                <Text style={styles.dateNavArrow}>‹</Text>
              </TouchableOpacity>
              <View style={styles.dateCenter}>
                <Text style={[styles.dateText, isToday && styles.dateTodayText]}>
                  {isToday ? 'Today' : formatDateWithWeekday(new Date(selectedDate + 'T12:00:00'))}
                </Text>
                {!isToday && (
                  <TouchableOpacity onPress={() => goToDate(today)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.backToToday}>Back to today</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
                onPress={() => !isToday && goToDate(shiftDateStr(selectedDate, 1))}
                disabled={isToday}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
          </FadeSlide>

          {/* No profile prompt */}
          {!targets && profileData !== undefined && (
            <FadeSlide delay={80}>
              <View style={styles.noProfileCard}>
                <Text style={{ fontSize: 30, lineHeight: 40, marginBottom: 8 }}>🎯</Text>
                <Text style={styles.noProfileTitle}>No targets set</Text>
                <Text style={styles.noProfileDesc}>
                  Complete the fitness questionnaire to unlock personalized daily calorie and macro targets.
                </Text>
              </View>
            </FadeSlide>
          )}

          {/* Macro summary */}
          <FadeSlide delay={120}>
            <MacroSummary targets={targets} totals={totals} />
          </FadeSlide>

          {/* No-targets totals fallback */}
          {!targets && entries.length > 0 && (
            <FadeSlide delay={140}>
              <View style={styles.totalsCard}>
                <Text style={styles.totalsLabel}>Today's Totals</Text>
                <View style={styles.totalsRow}>
                  {[
                    { label: 'Kcal', val: String(Math.round(totals.kcal)) },
                    { label: 'Protein', val: `${Math.round(totals.protein)}g` },
                    { label: 'Carbs', val: `${Math.round(totals.carbs)}g` },
                    { label: 'Fat', val: `${Math.round(totals.fat)}g` },
                  ].map(({ label, val }) => (
                    <View key={label} style={styles.totalCell}>
                      <Text style={styles.totalCellVal}>{val}</Text>
                      <Text style={styles.totalCellLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </FadeSlide>
          )}

          {/* Meal sections */}
          <FadeSlide delay={180}>
            <View style={{ gap: Spacing.sm }}>
              {MEALS.map(meal => {
                const mealEntries = entries.filter(e => e.meal.toLowerCase() === meal.toLowerCase())
                const isActive = activeMeal === meal
                return (
                  <MealSection
                    key={meal}
                    meal={meal}
                    entries={mealEntries}
                    isActive={isActive}
                    st={get(meal)}
                    unit={unit}
                    onToggle={() => {
                      if (isActive) { setActiveMeal(null) }
                      else { setActiveMeal(meal); patch(meal, EMPTY_ADD) }
                    }}
                    onPatch={update => patch(meal, update)}
                    onFoodSubmit={name => handleFoodSubmit(meal, name)}
                    onQuantitySubmit={() => void handleEstimate(meal)}
                    onConfirm={() => void handleConfirm(meal)}
                    onDelete={entryId => void handleDelete(entryId)}
                    onPickPhoto={() => void handlePickPhoto(meal)}
                    onAnalyzePhoto={() => void handleEstimate(meal)}
                  />
                )
              })}
            </View>
          </FadeSlide>

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  orbTopLeft: { position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150 },
  orbBottomRight: { position: 'absolute', bottom: 100, right: -80, width: 260, height: 260, borderRadius: 130 },
  scroll: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 116 },

  titleMask: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, color: Colors.purple },
  titleGradient: { borderRadius: 2 },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },

  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateNavBtn: { width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center' },
  dateNavBtnDisabled: { opacity: 0.3 },
  dateNavArrow: { fontSize: 22, color: Colors.textSecondary, lineHeight: 26 },
  dateNavArrowDisabled: { color: Colors.textDim },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  dateTodayText: { color: '#c084fc' },
  backToToday: { fontSize: 12, color: '#c084fc', marginTop: 2 },

  noProfileCard: { borderRadius: Radius.xl, padding: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center' },
  noProfileTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  noProfileDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },

  totalsCard: { borderRadius: Radius.xl, padding: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  totalsLabel: { fontSize: 11, fontWeight: '600', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  totalsRow: { flexDirection: 'row', gap: 8 },
  totalCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.04)' },
  totalCellVal: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  totalCellLabel: { fontSize: 9, color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
})
