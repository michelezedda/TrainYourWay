import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  ActivityIndicator, TextInput, Animated, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import GradientText from '@/components/GradientText'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { loadWeights, setWeight } from '@/lib/exerciseWeights'
import { getInjuryState, loadInjuryState, clearInjuryState, saveInjuryState, getInjuryAdvice, type InjuryState } from '@/lib/injuryStore'
import { calcWeeklyStreak } from '@/lib/streaks'
import { localDateStr, parseJsonList, parseJsonRecord } from '@/lib/utils'
import { generateDayWorkout } from '@/lib/gemini'
import {
  DAY_NAMES, DAY_SHORT,
  sanitizePlan,
  parseWeeklySchedule, parseDayChunks, parseSectionContent,
  getWeeklyWorkoutDays, getDefaultDayIdx,
  extractExerciseKeys, countTotalSets,
  readDoneMap, readSetsMap, readFiredMap,
  writeDoneMap, writeSetsMap, writeFiredMap,
  clearWeekPersistence, evictOldWeekIfNeeded,
  parseDayItems,
} from '@/lib/planUtils'
import { convertPlanUnits } from '@/lib/units'
import { useLocale } from '@/context/LocaleContext'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'
import ExerciseCard from '@/components/ExerciseCard'
import ExerciseModal from '@/components/ExerciseModal'
import InjuryTriageModal from '@/components/InjuryTriageModal'
import type { TrainingStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<TrainingStackParamList, 'WorkoutHome'>

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

const ALL_WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getBlockedDays(workoutDays: string | undefined): string[] {
  const stored = parseJsonList(workoutDays ?? '[]')
  if (stored.length === 0) return []
  return ALL_WEEK_DAYS.filter(d => !stored.includes(d))
}

const RECOVERY_TIPS = [
  'Stretch for 5-10 min to reduce next-day soreness.',
  'A protein-rich meal in the next hour supports muscle repair.',
  'Stay hydrated today. Aim for at least 2L of water.',
  'Sleep is when muscles grow. Prioritize 8 hours tonight.',
  'Light mobility work tomorrow will speed up recovery.',
]

// ── Types ──────────────────────────────────────────────────────────────────────

type Plan = {
  id: string; plan: string; userName: string; fitnessLevel: string
  goals: string; equipment: string; constraints: string; createdAt: number
  parentPlanId?: string; workoutDays?: string; dayOverrides?: string
}
type Completion = { id: string; date: string; createdAt: number }
type LeaderboardEntry = { id: string; workoutStreak: number; mealStreak: number; nickname: string; updatedAt: number }

// ── Plan chain builder ─────────────────────────────────────────────────────────

function buildPlanChain(plans: Plan[]): Plan[] {
  const roots = plans.filter(p => !p.parentPlanId || p.parentPlanId === '')
  if (roots.length === 0) return []
  const root = roots.sort((a, b) => b.createdAt - a.createdAt)[0]
  const chain = [root]
  let current = root
  for (; ;) {
    const child = plans.find(p => p.parentPlanId === current.id)
    if (!child) break
    chain.push(child)
    current = child
  }
  return chain
}

// ── Plan name inline editor ────────────────────────────────────────────────────

function PlanName({ planId, name }: { planId: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const save = async () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) {
      await db.transact(db.tx.workoutPlans[planId].update({ userName: trimmed }))
    } else {
      setDraft(name)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <TextInput
        autoFocus
        value={draft}
        onChangeText={setDraft}
        onBlur={() => void save()}
        onSubmitEditing={() => void save()}
        style={planNameStyles.input}
        returnKeyType="done"
        selectTextOnFocus
        underlineColorAndroid="transparent"
        selectionColor="#A855F7"
      />
    )
  }

  return (
    <TouchableOpacity
      onPress={() => { setDraft(name); setEditing(true) }}
      style={planNameStyles.row}
      activeOpacity={0.7}
    >
      <Text style={planNameStyles.name} numberOfLines={2}>{name || 'My Plan'}</Text>
      <Ionicons name="pencil-outline" size={13} color="rgba(255,255,255,0.25)" style={{ marginLeft: 5 }} />
    </TouchableOpacity>
  )
}

const planNameStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  input: {
    fontSize: 18, fontWeight: '800', color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.5)',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6,
    flex: 1,
  },
})

// ── Injury banner ──────────────────────────────────────────────────────────────

function InjuryBanner({ injuryState, onRecovered }: { injuryState: InjuryState; onRecovered: () => void }) {
  const advice = getInjuryAdvice(injuryState)
  const isRest = advice.intensity === 'rest'

  return (
    <View style={injuryStyles.container}>
      <View style={injuryStyles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
          <Text style={{ fontSize: 18, lineHeight: 26 }}>{isRest ? '🛑' : '⚠️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={injuryStyles.title}>Recovery Mode Active</Text>
            <Text style={injuryStyles.sub}>
              {injuryState.location} injury - {injuryState.severity} severity
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRecovered} style={injuryStyles.recoveredBtn} activeOpacity={0.8}>
          <Text style={injuryStyles.recoveredText}>I'm Recovered</Text>
        </TouchableOpacity>
      </View>
      <Text style={injuryStyles.message}>{advice.message}</Text>
      <View style={injuryStyles.columns}>
        <View style={[injuryStyles.col, injuryStyles.colAvoid]}>
          <Text style={injuryStyles.colTitle}>AVOID</Text>
          {advice.avoid.slice(0, 3).map(item => (
            <Text key={item} style={injuryStyles.colItem}>
              <Text style={{ color: 'rgba(248,113,113,0.6)' }}>✕ </Text>{item}
            </Text>
          ))}
        </View>
        <View style={[injuryStyles.col, injuryStyles.colFocus]}>
          <Text style={[injuryStyles.colTitle, { color: '#86efac' }]}>FOCUS</Text>
          {advice.focus.slice(0, 3).map(item => (
            <Text key={item} style={injuryStyles.colItem}>
              <Text style={{ color: 'rgba(134,239,172,0.6)' }}>✦ </Text>{item}
            </Text>
          ))}
        </View>
      </View>
    </View>
  )
}

const injuryStyles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md, borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(245,158,11,0.07)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    padding: 16,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 10 },
  title: { fontSize: 13, fontWeight: '700', color: '#fde68a' },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'capitalize' },
  recoveredBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
    flexShrink: 0,
  },
  recoveredText: { color: '#86efac', fontSize: 12, fontWeight: '600' },
  message: { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18, marginBottom: 12 },
  columns: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, borderRadius: 12, padding: 10 },
  colAvoid: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  colFocus: { backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' },
  colTitle: {
    fontSize: 10, fontWeight: '700', color: '#fca5a5',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  colItem: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2, lineHeight: 15 },
})

// ── Workout Celebration ────────────────────────────────────────────────────────

function WorkoutCelebration({
  exerciseCount, setsCount, weekStreak, weekWorkouts, weeklyTarget,
  dayFocus, onDismiss,
}: {
  exerciseCount: number; setsCount: number; weekStreak: number
  weekWorkouts: number; weeklyTarget: number; dayFocus?: string
  onDismiss: () => void
}) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 380, friction: 32 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start()
  }, [])

  const tip = RECOVERY_TIPS[(exerciseCount + setsCount) % RECOVERY_TIPS.length]
  const weekProgress = weeklyTarget > 0 ? Math.min(weekWorkouts / weeklyTarget, 1) : 0

  const stats = [
    { value: String(exerciseCount), label: 'Exercises', color: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.2)', textColor: '#fff' },
    { value: setsCount > 0 ? String(setsCount) : '-', label: 'Sets', color: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.18)', textColor: '#fff' },
    { value: weekStreak > 0 ? `${weekStreak}w` : '-', label: 'Streak', color: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.18)', textColor: '#fff' },
  ]

  return (
    <Animated.View style={[celebStyles.container, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
      <TouchableOpacity onPress={onDismiss} style={celebStyles.closeBtn} activeOpacity={0.8}>
        <Text style={celebStyles.closeX}>×</Text>
      </TouchableOpacity>
      <Text style={celebStyles.trophy}>🏆</Text>
      <GradientText style={celebStyles.title}>Workout Complete!</GradientText>
      <Text style={celebStyles.subtitle}>{dayFocus || `${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''} done`}</Text>
      <View style={celebStyles.statsRow}>
        {stats.map(({ value, label, color, border, textColor }) => (
          <View key={label} style={[celebStyles.statBox, { backgroundColor: color, borderColor: border }]}>
            <Text style={[celebStyles.statValue, { color: textColor }]}>{value}</Text>
            <Text style={celebStyles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>
      {weeklyTarget > 0 && (
        <View style={celebStyles.weekProgress}>
          <View style={celebStyles.weekProgressHeader}>
            <Text style={celebStyles.weekProgressLabel}>This week</Text>
            <Text style={celebStyles.weekProgressCount}>{weekWorkouts}/{weeklyTarget} sessions</Text>
          </View>
          <View style={celebStyles.progressTrack}>
            <View style={[celebStyles.progressFill, { width: `${weekProgress * 100}%` }]}>
              <LinearGradient colors={['#A855F7', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
            </View>
          </View>
        </View>
      )}
      <Text style={celebStyles.tip}>{tip}</Text>
    </Animated.View>
  )
}

const celebStyles = StyleSheet.create({
  container: {
    marginVertical: 8, borderRadius: 28, overflow: 'hidden', padding: 24,
    backgroundColor: 'rgba(10,10,30,0.95)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 30,
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  closeX: { color: 'rgba(255,255,255,0.35)', fontSize: 16, lineHeight: 18 },
  trophy: { fontSize: 56, lineHeight: 70, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 22, fontWeight: '900', textAlign: 'center',
    color: '#C084FC', letterSpacing: -0.5, marginBottom: 4,
  },
  subtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.52)', textAlign: 'center', marginBottom: 20,
  },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statBox: {
    flex: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8,
    alignItems: 'center', borderWidth: 1,
  },
  statValue: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekProgress: { marginBottom: 14 },
  weekProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  weekProgressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  weekProgressCount: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  tip: { fontSize: 11, color: 'rgba(255,255,255,0.28)', textAlign: 'center', fontStyle: 'italic', lineHeight: 17 },
})

// ── Simple native markdown renderer (replaces react-native-markdown-display) ───

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <Text key={i} style={{ fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>{part.slice(2, -2)}</Text>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <Text key={i} style={{ fontStyle: 'italic', color: '#a78bfa' }}>{part.slice(1, -1)}</Text>
    }
    return <Text key={i}>{part}</Text>
  })
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <View>
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <View key={idx} style={{ height: 6 }} />
        if (trimmed.startsWith('## ')) {
          return <Text key={idx} style={simpleMdStyles.h2}>{trimmed.slice(3)}</Text>
        }
        if (trimmed.startsWith('### ')) {
          return <Text key={idx} style={simpleMdStyles.h3}>{trimmed.slice(4)}</Text>
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <View key={idx} style={simpleMdStyles.bulletRow}>
              <Text style={simpleMdStyles.bulletDot}>•</Text>
              <Text style={simpleMdStyles.bulletText}>{renderInline(trimmed.slice(2))}</Text>
            </View>
          )
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)\./)?.[1] ?? ''
          return (
            <View key={idx} style={simpleMdStyles.bulletRow}>
              <Text style={simpleMdStyles.bulletDot}>{num}.</Text>
              <Text style={simpleMdStyles.bulletText}>{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</Text>
            </View>
          )
        }
        return <Text key={idx} style={simpleMdStyles.para}>{renderInline(trimmed)}</Text>
      })}
    </View>
  )
}

const simpleMdStyles = StyleSheet.create({
  h2: {
    color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 14,
    marginTop: 14, marginBottom: 4,
    paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  h3: { color: Colors.purpleLight, fontWeight: '700', fontSize: 13, marginTop: 10, marginBottom: 3 },
  para: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20, marginBottom: 3 },
  bulletRow: { flexDirection: 'row', gap: 7, marginBottom: 3, alignItems: 'flex-start' },
  bulletDot: { color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: 20, minWidth: 14, flexShrink: 0 },
  bulletText: { flex: 1, color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 20 },
})

// ── Collapsible section ────────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, content }: { title: string; icon: string; content: string }) {
  const [open, setOpen] = useState(false)
  return (
    <GlassCard style={{ marginBottom: 12, padding: 0 }}>
      <TouchableOpacity
        onPress={() => setOpen(p => !p)}
        style={sectionStyles.header}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 18 }}>{icon}</Text>
        <Text style={sectionStyles.title}>{title}</Text>
        <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
      {open && (
        <View style={sectionStyles.body}>
          <SimpleMarkdown text={content} />
        </View>
      )}
    </GlassCard>
  )
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  title: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },
  body: {
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
})

// ── Day workout renderer ───────────────────────────────────────────────────────

function DayContent({
  dayName, dayBody, unit, planId, weights,
  doneMap, setsMap,
  onDone, onSetsDone, onGuideClick,
}: {
  dayName: string; dayBody: string; unit: 'metric' | 'imperial'; planId: string
  weights: Record<string, string>
  doneMap: Record<string, boolean>; setsMap: Record<string, boolean[]>
  onDone: (key: string, done: boolean) => void
  onSetsDone: (key: string, setsDone: boolean[]) => void
  onGuideClick: (name: string) => void
}) {
  const items = useMemo(
    () => parseDayItems(sanitizePlan(convertPlanUnits(dayBody, unit))),
    [dayBody, unit],
  )

  return (
    <View style={{ paddingTop: 4 }}>
      <Text style={dayContentStyles.hint}>
        <Text style={{ color: Colors.purpleLight }}>▶ </Text>
        Tap any exercise for a guide. Log weights below.
      </Text>
      {items.map((item, idx) => {
        if (item.type === 'heading') {
          return (
            <View key={idx} style={dayContentStyles.sectionHeadRow}>
              <View style={dayContentStyles.sectionHeadBar} />
              <Text style={dayContentStyles.sectionHead}>{item.text}</Text>
            </View>
          )
        }
        const fullKey = `${dayName}:${item.exerciseKey}`
        return (
          <ExerciseCard
            key={item.exerciseKey}
            content={item.content}
            exerciseKey={item.exerciseKey}
            weight={weights[item.exerciseKey] ?? ''}
            onWeightChange={(v) => { void setWeight(planId, item.exerciseKey, v) }}
            onGuideClick={onGuideClick}
            initialDone={doneMap[fullKey] === true}
            initialSetsDone={setsMap[fullKey]}
            onDone={(key, done) => onDone(`${dayName}:${key}`, done)}
            onSetsDone={(key, sets) => onSetsDone(`${dayName}:${key}`, sets)}
          />
        )
      })}
      {items.length === 0 && (
        <Text style={dayContentStyles.empty}>No exercises found for this day.</Text>
      )}
    </View>
  )
}

const dayContentStyles = StyleSheet.create({
  hint: {
    fontSize: 12, color: 'rgba(255,255,255,0.3)',
    marginBottom: 8, paddingHorizontal: 2, lineHeight: 18,
  },
  sectionHeadRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, marginBottom: 4,
  },
  sectionHeadBar: {
    width: 3, height: 18, borderRadius: 2,
    backgroundColor: Colors.purple,
  },
  sectionHead: {
    color: Colors.purpleLight, fontWeight: '700', fontSize: 14, flex: 1,
  },
  empty: {
    fontSize: 13, color: 'rgba(255,255,255,0.3)',
    textAlign: 'center', paddingVertical: 24,
  },
})

// ── Version history ────────────────────────────────────────────────────────────

function VersionHistory({
  versions, expandedId, onToggle, formatDateShort,
}: {
  versions: Plan[]; expandedId: string | null
  onToggle: (id: string) => void
  formatDateShort: (ts: number) => string
}) {
  if (versions.length === 0) return null
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={histStyles.sectionLabel}>VERSION HISTORY</Text>
      {versions.map((version, i) => {
        const isExpanded = expandedId === version.id
        const isOriginal = i === versions.length - 1
        const label = isOriginal ? 'Original Plan' : `Evolution ${versions.length - 1 - i}`
        return (
          <GlassCard key={version.id} style={{ marginBottom: 8, padding: 0 }}>
            <TouchableOpacity
              onPress={() => onToggle(version.id)}
              style={histStyles.row}
              activeOpacity={0.7}
            >
              <View style={[histStyles.dot, { backgroundColor: isOriginal ? 'rgba(255,255,255,0.2)' : 'rgba(192,132,252,0.5)' }]} />
              <Text style={histStyles.label}>{label}</Text>
              <Text style={histStyles.date}>{formatDateShort(version.createdAt)}</Text>
              <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={14} color="rgba(255,255,255,0.25)" />
            </TouchableOpacity>
            {isExpanded && version.plan && (
              <View style={[histStyles.expandedBody, { paddingHorizontal: 12 }]}>
                <SimpleMarkdown text={sanitizePlan(version.plan)} />
              </View>
            )}
          </GlassCard>
        )
      })}
    </View>
  )
}

const histStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  label: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },
  date: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },
  expandedBody: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 12, paddingBottom: 12,
  },
})

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const navigation = useNavigation<Nav>()
  const userId = getUserId()
  const today = localDateStr()
  const { unit, weekStart, formatDateShort } = useLocale()

  const [selectedDay, setSelectedDay] = useState(0)
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(readDoneMap)
  const [setsMap, setSetsMap] = useState<Record<string, boolean[]>>(readSetsMap)
  const [firedMap, setFiredMap] = useState<Record<string, boolean>>(readFiredMap)
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrationData, setCelebrationData] = useState({ exerciseCount: 0, setsCount: 0 })
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  const [confirmStartOver, setConfirmStartOver] = useState(false)
  const [startingOver, setStartingOver] = useState(false)
  const [injuryState, setInjuryState] = useState<InjuryState | null>(() => getInjuryState())
  const [showTriage, setShowTriage] = useState(false)
  const [weightsMap, setWeightsMap] = useState<Record<string, string>>({})
  const [guideExercise, setGuideExercise] = useState<string | null>(null)
  const [generatingDayFor, setGeneratingDayFor] = useState<string | null>(null)

  const { isLoading, data } = db.useQuery({
    workoutPlans: { $: { where: { userId }, order: { serverCreatedAt: 'desc' } } },
    workoutCompletions: { $: { where: { userId } } },
    leaderboardEntries: { $: { where: { userId } } },
  })

  const plans = (data?.workoutPlans ?? []) as Plan[]
  const completions = (data?.workoutCompletions ?? []) as Completion[]
  const leaderboardEntry = ((data?.leaderboardEntries ?? []) as LeaderboardEntry[])[0] ?? null

  const chain = useMemo(() => buildPlanChain(plans), [plans])
  const latestPlan = chain[chain.length - 1]
  const previousVersions = chain.slice(0, -1).reverse()

  const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false
  const daysUntilEvolve = latestPlan && !canEvolve
    ? Math.ceil((FOUR_WEEKS_MS - (Date.now() - latestPlan.createdAt)) / (24 * 60 * 60 * 1000))
    : 0

  const weekWorkouts = useMemo(() => Object.keys(firedMap).length, [firedMap])

  const weeklyTarget = useMemo(() => {
    if (!latestPlan) return 0
    const days = parseJsonList(latestPlan.workoutDays ?? '[]')
    return days.length > 0 ? days.length : getWeeklyWorkoutDays(latestPlan.plan)
  }, [latestPlan])

  const weekStreak = useMemo(
    () => calcWeeklyStreak(completions.map(c => c.date), weekStart, today),
    [completions, weekStart, today],
  )

  const blockedDays = useMemo(
    () => latestPlan ? getBlockedDays(latestPlan.workoutDays) : [],
    [latestPlan?.workoutDays],
  )
  const dayOverrides = useMemo(
    () => latestPlan ? parseJsonRecord(latestPlan.dayOverrides ?? '{}') : {},
    [latestPlan?.dayOverrides],
  )

  const sanitized = useMemo(
    () => latestPlan ? convertPlanUnits(sanitizePlan(latestPlan.plan), unit) : '',
    [latestPlan, unit],
  )
  const schedule = useMemo(() => parseWeeklySchedule(sanitized), [sanitized])
  const dayChunks = useMemo(() => parseDayChunks(sanitized), [sanitized])
  const overview = useMemo(() => parseSectionContent(sanitized, 'Overview'), [sanitized])
  const progression = useMemo(() => parseSectionContent(sanitized, 'Progression Plan'), [sanitized])
  const nutritionSection = useMemo(() => parseSectionContent(sanitized, 'Nutrition Tips'), [sanitized])

  const dayToChunkIdx = useMemo(() => {
    const map: Record<number, number> = {}
    let ci = 0
    for (let i = 0; i < 7; i++) {
      const label = schedule[DAY_NAMES[i]] ?? ''
      if (label && !/rest/i.test(label)) map[i] = ci++
    }
    return map
  }, [schedule])

  useEffect(() => {
    setSelectedDay(getDefaultDayIdx(schedule))
  }, [latestPlan?.id])

  useEffect(() => {
    if (!latestPlan) return
    loadWeights(latestPlan.id).then(setWeightsMap)
  }, [latestPlan?.id])

  useEffect(() => {
    loadInjuryState().then(setInjuryState)
    evictOldWeekIfNeeded()
  }, [])

  useEffect(() => { void writeDoneMap(doneMap) }, [doneMap])
  useEffect(() => { void writeSetsMap(setsMap) }, [setsMap])

  const currentDayName = DAY_NAMES[selectedDay]
  const selectedLabel = schedule[currentDayName] ?? ''
  const isCurrentDayBlocked = blockedDays.includes(currentDayName)
  const isRest = !isCurrentDayBlocked && (!selectedLabel || /rest/i.test(selectedLabel))
  const chunkIdx = dayToChunkIdx[selectedDay]
  const rawChunk = chunkIdx !== undefined ? (dayChunks[chunkIdx] ?? '') : ''
  const baseDayBody = rawChunk.replace(/^### Day \d+:[^\n]*\n?/, '').trim()
  const dayBody = dayOverrides[currentDayName] ?? baseDayBody

  const exerciseKeys = useMemo(() => extractExerciseKeys(dayBody), [dayBody])
  const totalSetsCount = useMemo(() => countTotalSets(dayBody), [dayBody])

  const allDone = exerciseKeys.length > 0 && exerciseKeys.every(k => doneMap[`${currentDayName}:${k}`] === true)
  const doneCount = Object.entries(doneMap).filter(([k, v]) => k.startsWith(`${currentDayName}:`) && v).length

  useEffect(() => {
    if (allDone && !firedMap[currentDayName] && !isRest && exerciseKeys.length > 0) {
      const newFired = { ...firedMap, [currentDayName]: true }
      setFiredMap(newFired)
      void writeFiredMap(newFired)
      setCelebrationData({ exerciseCount: exerciseKeys.length, setsCount: totalSetsCount })
      setShowCelebration(true)
      if (!completions.some(c => c.date === today)) {
        const newDates = [...completions.map(c => c.date), today]
        const newStreak = calcWeeklyStreak(newDates, weekStart, today)
        const txns: Parameters<typeof db.transact>[0] = [
          db.tx.workoutCompletions[id()].update({ userId, date: today, createdAt: Date.now() }),
        ]
        if (leaderboardEntry) {
          txns.push(db.tx.leaderboardEntries[leaderboardEntry.id].update({ workoutStreak: newStreak, updatedAt: Date.now() }))
        }
        void db.transact(txns)
      }
    }
  }, [allDone, currentDayName])

  const handleDone = useCallback((fullKey: string, done: boolean) => {
    setDoneMap(prev => prev[fullKey] === done ? prev : { ...prev, [fullKey]: done })
  }, [])

  const handleSetsDone = useCallback((fullKey: string, sets: boolean[]) => {
    setSetsMap(prev => {
      const ex = prev[fullKey]
      if (ex && ex.length === sets.length && ex.every((v, i) => v === sets[i])) return prev
      return { ...prev, [fullKey]: sets }
    })
  }, [])

  const handleStartOver = async () => {
    setStartingOver(true)
    try {
      if (plans.length > 0) {
        await db.transact(plans.map(p => db.tx.workoutPlans[p.id].delete()))
      }
      await clearWeekPersistence()
    } catch {
      setStartingOver(false)
      setConfirmStartOver(false)
    }
  }

  const handleActivateRecovery = useCallback(async (state: InjuryState) => {
    await saveInjuryState(state)
    setInjuryState(state)
    setShowTriage(false)
  }, [])

  const handleRecovered = async () => {
    await clearInjuryState()
    setInjuryState(null)
  }

  const handleUnblockDay = useCallback((day: string) => {
    if (!latestPlan) return
    const current = parseJsonList(latestPlan.workoutDays ?? '[]')
    void db.transact(db.tx.workoutPlans[latestPlan.id].update({
      workoutDays: JSON.stringify([...current.filter(d => d !== day), day]),
    }))
  }, [latestPlan])

  const handleGenerateDayWorkout = useCallback(async (day: string) => {
    if (!latestPlan) return
    setGeneratingDayFor(day)
    try {
      const workoutText = await generateDayWorkout(latestPlan.plan, day)
      const newOverrides = { ...dayOverrides, [day]: workoutText }
      const current = parseJsonList(latestPlan.workoutDays ?? '[]')
      await db.transact(db.tx.workoutPlans[latestPlan.id].update({
        dayOverrides: JSON.stringify(newOverrides),
        workoutDays: JSON.stringify([...current.filter(d => d !== day), day]),
      }))
    } finally {
      setGeneratingDayFor(null)
    }
  }, [latestPlan, dayOverrides])

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.purple} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!latestPlan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noPlan}>
          <View style={styles.noPlanCard}>
            <Text style={{ fontSize: 40, lineHeight: 52, textAlign: 'center', marginBottom: 16 }}>📋</Text>
            <Text style={styles.noPlanTitle}>No plan yet</Text>
            <Text style={styles.noPlanBody}>
              Create your first personalised workout plan to get started.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={['#0f0a2e', Colors.bg]} locations={[0, 0.45]} style={StyleSheet.absoluteFillObject} />
        <LinearGradient colors={['rgba(168,85,247,0.10)', 'transparent']} style={styles.orbTopRight} />
        <LinearGradient colors={['rgba(34,211,238,0.07)', 'transparent']} style={styles.orbBottomLeft} />
      </View>
      {/* Header */}
      <View style={styles.header}>
        {/* Row 1: "My Plan" title + action buttons */}
        <View style={styles.headerRow1}>
          <View style={{ flex: 1 }}>
            <GradientText style={styles.pageTitleText}>My Plan</GradientText>
            <Text style={styles.pageSubtitle}>
              {chain.length > 1
                ? `${chain.length - 1} evolution${chain.length > 2 ? 's' : ''} from original`
                : 'Original plan'}
            </Text>
          </View>
          {/* Action buttons */}
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={[styles.injuredBtn, injuryState?.active && styles.injuredBtnActive]}
              onPress={() => setShowTriage(true)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 12 }}>🩹</Text>
              <Text style={[styles.injuredBtnText, injuryState?.active && styles.injuredBtnTextActive]}>
                {injuryState?.active ? 'Injured' : 'Injured?'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.importBtn}
              onPress={() => navigation.navigate('Import')}
              activeOpacity={0.8}
            >
              <Text style={styles.importBtnText}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Row 2: Plan name + level badge + evolve + streak */}
        <View style={styles.headerRow2}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              paddingRight: 10,
            }}
          >
            <PlanName planId={latestPlan.id} name={latestPlan.userName || 'My Plan'} />
            <View style={styles.fitnessRow}>
              <View style={[
                styles.levelBadge,
                { backgroundColor: latestPlan.fitnessLevel === 'advanced' ? 'rgba(239,68,68,0.12)' : latestPlan.fitnessLevel === 'beginner' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)' },
              ]}>
                <Text style={[
                  styles.levelText,
                  { color: latestPlan.fitnessLevel === 'advanced' ? '#fca5a5' : latestPlan.fitnessLevel === 'beginner' ? '#86efac' : '#fde68a' },
                ]}>
                  {latestPlan.fitnessLevel || 'intermediate'}
                </Text>
              </View>
              {weekStreak > 0 && (
                <Text style={styles.streakText}>🔥 {weekStreak}w streak</Text>
              )}
            </View>
          </View>
          {canEvolve ? (
            <TouchableOpacity
              style={styles.evolveBtn}
              onPress={() => navigation.navigate('Reevaluate', {
                planId: latestPlan.id,
                originalPlan: latestPlan.plan,
                userName: latestPlan.userName,
                fitnessLevel: latestPlan.fitnessLevel ?? '',
                goals: latestPlan.goals ?? '[]',
                equipment: latestPlan.equipment ?? '[]',
              })}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#A855F7', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.evolveBtnInner}>
                <Text style={styles.evolveBtnText}>Evolve</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : daysUntilEvolve > 0 ? (
            <View style={styles.evolveLocked}>
              <Ionicons name="lock-closed" size={12} color="rgba(255,255,255,0.3)" />
              <Text style={styles.evolveLockedText}>{daysUntilEvolve}d</Text>
            </View>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Injury banner */}
          {injuryState && <InjuryBanner injuryState={injuryState} onRecovered={() => void handleRecovered()} />}

          {/* Day selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {DAY_NAMES.map((day, i) => {
              const label = schedule[day] ?? ''
              const isBlocked = blockedDays.includes(day)
              const isRestDay = !isBlocked && (!label || /rest/i.test(label))
              const isSel = selectedDay === i
              const isDayCompleted = !isBlocked && exerciseKeys.length > 0 &&
                extractExerciseKeys(
                  (() => { const ci = dayToChunkIdx[i]; const rc = ci !== undefined ? (dayChunks[ci] ?? '') : ''; return rc.replace(/^### Day \d+:[^\n]*\n?/, '').trim() })()
                ).every(k => doneMap[`${day}:${k}`] === true) &&
                extractExerciseKeys(
                  (() => { const ci = dayToChunkIdx[i]; const rc = ci !== undefined ? (dayChunks[ci] ?? '') : ''; return rc.replace(/^### Day \d+:[^\n]*\n?/, '').trim() })()
                ).length > 0

              const shortLabel = isBlocked ? 'Blocked'
                : isRestDay ? 'Rest'
                  : (label.split(/[-,]/)[0].trim().slice(0, 10))

              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => setSelectedDay(i)}
                  style={[
                    styles.dayTab,
                    isSel && isBlocked && styles.dayTabSelBlocked,
                    isSel && isRestDay && styles.dayTabSelRest,
                    isSel && !isRestDay && !isBlocked && isDayCompleted && styles.dayTabSelComplete,
                    isSel && !isRestDay && !isBlocked && !isDayCompleted && styles.dayTabSel,
                    !isSel && isBlocked && styles.dayTabBlocked,
                    !isSel && isRestDay && styles.dayTabRest,
                    !isSel && !isBlocked && isDayCompleted && styles.dayTabComplete,
                  ]}
                  activeOpacity={0.7}
                >
                  {isBlocked && !isSel && (
                    <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.2)" />
                  )}
                  <Text style={[
                    styles.dayTabShort,
                    {
                      color: isSel && isBlocked ? 'rgba(255,255,255,0.4)'
                        : isSel && !isRestDay && isDayCompleted ? '#d1fae5'
                          : isSel && !isRestDay ? '#e9d5ff'
                            : isSel && isRestDay ? 'rgba(255,255,255,0.5)'
                              : isBlocked ? 'rgba(255,255,255,0.2)'
                                : isDayCompleted ? 'rgba(74,222,128,0.8)'
                                  : isRestDay ? 'rgba(255,255,255,0.25)'
                                    : 'rgba(255,255,255,0.75)',
                    },
                  ]}>
                    {DAY_SHORT[i]}
                  </Text>
                  <Text style={[
                    styles.dayTabLabel,
                    {
                      color: isSel && isBlocked ? 'rgba(255,255,255,0.3)'
                        : isSel && !isRestDay && isDayCompleted ? 'rgba(134,239,172,0.85)'
                          : isSel && !isRestDay ? 'rgba(216,180,254,0.8)'
                            : isSel && isRestDay ? 'rgba(255,255,255,0.3)'
                              : isBlocked ? 'rgba(255,255,255,0.15)'
                                : isDayCompleted ? 'rgba(134,239,172,0.55)'
                                  : isRestDay ? 'rgba(255,255,255,0.18)'
                                    : 'rgba(255,255,255,0.4)',
                    },
                  ]}>
                    {shortLabel}
                  </Text>
                  <View style={[
                    styles.dayTabDot,
                    {
                      backgroundColor: isSel && isBlocked ? 'rgba(255,255,255,0.2)'
                        : isSel && isDayCompleted ? '#4ade80'
                          : isSel && isRestDay ? 'rgba(255,255,255,0.35)'
                            : isSel ? '#c084fc'
                              : isDayCompleted ? 'rgba(74,222,128,0.55)'
                                : isRestDay ? 'rgba(255,255,255,0.1)'
                                  : isBlocked ? 'rgba(255,255,255,0.08)'
                                    : 'rgba(255,255,255,0.25)',
                      opacity: isSel ? 1 : 0.6,
                    },
                  ]} />
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* Day card */}
          <GlassCard style={{ marginBottom: 16, padding: 0 }}>
            {/* Day header */}
            <View style={[
              styles.dayHeader,
              isCurrentDayBlocked ? styles.dayHeaderBlocked
                : isRest ? styles.dayHeaderRest
                  : allDone ? styles.dayHeaderDone
                    : styles.dayHeaderActive,
            ]}>
              <View>
                <Text style={styles.dayName}>{currentDayName}</Text>
                {!isRest && !isCurrentDayBlocked && selectedLabel && (
                  <Text style={styles.dayFocus}>{selectedLabel}</Text>
                )}
              </View>
              <View style={styles.dayBadgeRow}>
                {exerciseKeys.length > 0 && !isRest && !isCurrentDayBlocked && (
                  <View style={[styles.exerciseCount, allDone && styles.exerciseCountDone]}>
                    <Text style={[styles.exerciseCountText, { color: allDone ? '#4ade80' : '#c084fc' }]}>
                      {doneCount}/{exerciseKeys.length}
                    </Text>
                  </View>
                )}
                <View style={[
                  styles.statusBadge,
                  isCurrentDayBlocked ? styles.statusBadgeBlocked
                    : isRest ? styles.statusBadgeRest
                      : allDone ? styles.statusBadgeDone
                        : styles.statusBadgeActive,
                ]}>
                  <Text style={[
                    styles.statusText,
                    {
                      color: isCurrentDayBlocked ? 'rgba(255,255,255,0.25)'
                        : isRest ? 'rgba(255,255,255,0.3)'
                          : allDone ? '#86efac'
                            : '#d8b4fe',
                    },
                  ]}>
                    {isCurrentDayBlocked ? 'Blocked' : isRest ? 'Rest Day' : allDone ? 'Complete' : 'Active'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Day body */}
            <View style={styles.dayBody}>
              {isCurrentDayBlocked ? (
                <View style={styles.blockedContent}>
                  <Ionicons name="lock-closed" size={28} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
                  <Text style={styles.blockedTitle}>Day not in your schedule</Text>
                  <Text style={styles.blockedBody}>
                    This day was not part of your original schedule. You can unblock it or generate a custom workout.
                  </Text>
                  <View style={styles.blockedBtns}>
                    <TouchableOpacity
                      style={styles.blockedUnblockBtn}
                      onPress={() => handleUnblockDay(currentDayName)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="lock-open-outline" size={14} color="#d8b4fe" />
                      <Text style={styles.blockedUnblockText}>Unblock Day</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.blockedGenerateBtn}
                      onPress={() => void handleGenerateDayWorkout(currentDayName)}
                      disabled={generatingDayFor === currentDayName}
                      activeOpacity={0.8}
                    >
                      {generatingDayFor === currentDayName ? (
                        <ActivityIndicator size="small" color="#22D3EE" />
                      ) : (
                        <>
                          <Ionicons name="sparkles-outline" size={14} color="#22D3EE" />
                          <Text style={styles.blockedGenerateText}>Generate Workout</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isRest ? (
                <View style={styles.restContent}>
                  <Text style={{ fontSize: 36, lineHeight: 46, textAlign: 'center', marginBottom: 10 }}>😴</Text>
                  <Text style={styles.restTitle}>Rest Day</Text>
                  <Text style={styles.restBody}>
                    Recovery is part of the programme. Prioritise sleep and hydration today.
                  </Text>
                </View>
              ) : dayBody ? (
                <DayContent
                  dayName={currentDayName}
                  dayBody={dayBody}
                  unit={unit}
                  planId={latestPlan.id}
                  weights={weightsMap}
                  doneMap={doneMap}
                  setsMap={setsMap}
                  onDone={handleDone}
                  onSetsDone={handleSetsDone}
                  onGuideClick={setGuideExercise}
                />
              ) : (
                <Text style={styles.noDayContent}>No workout content found for this day.</Text>
              )}
            </View>
          </GlassCard>

          {/* Workout celebration */}
          {showCelebration && exerciseKeys.length > 0 && !isRest && (
            <WorkoutCelebration
              exerciseCount={celebrationData.exerciseCount}
              setsCount={celebrationData.setsCount}
              weekStreak={weekStreak}
              weekWorkouts={weekWorkouts + 1}
              weeklyTarget={weeklyTarget}
              dayFocus={selectedLabel || undefined}
              onDismiss={() => setShowCelebration(false)}
            />
          )}

          {/* Summary sections */}
          {overview && <CollapsibleSection title="Plan Overview" icon="📋" content={overview} />}
          {progression && <CollapsibleSection title="Progression Plan" icon="📈" content={progression} />}
          {nutritionSection && <CollapsibleSection title="Nutrition Tips" icon="🥗" content={nutritionSection} />}

          {/* Version history */}
          <VersionHistory
            versions={previousVersions}
            expandedId={expandedVersionId}
            onToggle={id => setExpandedVersionId(p => p === id ? null : id)}
            formatDateShort={formatDateShort}
          />

          {/* Start over */}
          <View style={styles.startOverSection}>
            {!confirmStartOver ? (
              <TouchableOpacity onPress={() => setConfirmStartOver(true)} activeOpacity={0.7}>
                <Text style={styles.startOverLink}>Start over with a new plan</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.startOverConfirm}>
                <Text style={styles.startOverWarning}>
                  This permanently deletes your current plan
                  {chain.length > 1 ? ` and all ${chain.length} versions` : ''}. Cannot be undone.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={styles.startOverConfirmBtn}
                    onPress={() => void handleStartOver()}
                    disabled={startingOver}
                    activeOpacity={0.85}
                  >
                    {startingOver
                      ? <ActivityIndicator color="#fca5a5" size="small" />
                      : <Text style={styles.startOverConfirmText}>Yes, start over</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.startOverCancelBtn}
                    onPress={() => setConfirmStartOver(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.startOverCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ExerciseModal
        name={guideExercise ?? ''}
        visible={guideExercise !== null}
        onClose={() => setGuideExercise(null)}
      />
      <InjuryTriageModal
        visible={showTriage}
        injuryState={injuryState}
        onClose={() => setShowTriage(false)}
        onActivate={state => void handleActivateRecovery(state)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  orbTopRight: { position: 'absolute', top: -80, right: -60, width: 300, height: 300, borderRadius: 150 },
  orbBottomLeft: { position: 'absolute', bottom: 100, left: -80, width: 260, height: 260, borderRadius: 130 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.md, paddingTop: 8, paddingBottom: 116 },
  header: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 16,
    gap: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerRow1: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  pageTitleText: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  pageSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 2, fontWeight: '500' },
  headerRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 58,
  },
  fitnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  levelBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  levelText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  streakText: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  injuredBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  injuredBtnActive: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  injuredBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  injuredBtnTextActive: { color: '#fde68a' },
  evolveBtn: { borderRadius: 20, overflow: 'hidden' },
  evolveBtnInner: { paddingHorizontal: 12, paddingVertical: 7 },
  evolveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  evolveLocked: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  evolveLockedText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  importBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20,
    backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  importBtnText: { color: Colors.textMuted, fontWeight: '600', fontSize: 13 },
  dayTab: {
    width: 68, alignItems: 'center', paddingVertical: 14,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)', gap: 3,
  },
  dayTabSel: {
    borderColor: 'rgba(168,85,247,0.5)', backgroundColor: 'rgba(168,85,247,0.15)',
  },
  dayTabSelRest: {
    borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dayTabSelComplete: {
    borderColor: 'rgba(34,197,94,0.55)',
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  dayTabSelBlocked: {
    borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dayTabBlocked: { borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'transparent' },
  dayTabRest: { borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'transparent' },
  dayTabComplete: { borderColor: 'rgba(34,197,94,0.28)', backgroundColor: 'rgba(34,197,94,0.07)' },
  dayTabShort: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  dayTabLabel: { fontSize: 10, lineHeight: 13 },
  dayTabDot: { width: 6, height: 6, borderRadius: 3 },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  dayHeaderRest: { backgroundColor: 'rgba(255,255,255,0.02)' },
  dayHeaderDone: { backgroundColor: 'rgba(34,197,94,0.05)', borderBottomColor: 'rgba(34,197,94,0.15)' },
  dayHeaderActive: { backgroundColor: 'rgba(168,85,247,0.05)' },
  dayHeaderBlocked: { backgroundColor: 'transparent' },
  dayName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  dayFocus: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  dayBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseCount: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)',
  },
  exerciseCountDone: { backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.3)' },
  exerciseCountText: { fontSize: 11, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeRest: { borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'transparent' },
  statusBadgeDone: { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.12)' },
  statusBadgeActive: { borderColor: 'rgba(168,85,247,0.35)', backgroundColor: 'rgba(168,85,247,0.12)' },
  statusBadgeBlocked: { borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'transparent' },
  statusText: { fontSize: 12, fontWeight: '600' },
  dayBody: { padding: 16 },
  restContent: { paddingVertical: 24, alignItems: 'center' },
  restTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 6 },
  restBody: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 20, maxWidth: 260 },
  blockedContent: { paddingVertical: 24, alignItems: 'center' },
  blockedTitle: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginBottom: 6 },
  blockedBody: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: 18, maxWidth: 260, marginBottom: 20 },
  blockedBtns: { flexDirection: 'row', gap: 10 },
  blockedUnblockBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)',
  },
  blockedUnblockText: { color: '#d8b4fe', fontSize: 12, fontWeight: '600' },
  blockedGenerateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.22)',
    minWidth: 80,
  },
  blockedGenerateText: { color: '#22D3EE', fontSize: 12, fontWeight: '600' },
  noDayContent: { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingVertical: 24 },
  noPlan: {
    flex: 1, padding: Spacing.lg, alignItems: 'center', justifyContent: 'center',
  },
  noPlanCard: {
    borderRadius: 28, overflow: 'hidden',
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.22)',
    padding: 32, width: '100%', alignItems: 'center',
  },
  noPlanTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  noPlanBody: {
    fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21,
  },
  startOverSection: { alignItems: 'center', paddingVertical: 16 },
  startOverLink: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },
  startOverConfirm: {
    borderRadius: 20, padding: 16, gap: 12, width: '100%',
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  startOverWarning: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },
  startOverConfirmBtn: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    alignItems: 'center',
  },
  startOverConfirmText: { color: '#fca5a5', fontSize: 14, fontWeight: '600' },
  startOverCancelBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  startOverCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
})
