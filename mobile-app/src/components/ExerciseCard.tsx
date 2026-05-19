import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Animated, Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Radius } from '@/theme'
import { parseExerciseBlock, parseRestSeconds, type ParsedExercise } from '@/lib/planUtils'
import { useLocale } from '@/context/LocaleContext'

interface ExerciseCardProps {
  content: string
  exerciseKey: string
  weight: string
  onWeightChange: (value: string) => void
  onGuideClick: (name: string) => void
  initialDone?: boolean
  initialSetsDone?: boolean[]
  onDone?: (key: string, done: boolean) => void
  onSetsDone?: (key: string, setsDone: boolean[]) => void
}

function SetRow({
  idx, reps, done, onToggle,
}: { idx: number; reps: string; done: boolean; onToggle: () => void }) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start()
    onToggle()
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={1}
        style={[setStyles.row, done && setStyles.rowDone]}
      >
        <View style={[setStyles.badge, done && setStyles.badgeDone]}>
          <Text style={[setStyles.badgeText, { color: done ? '#4ade80' : '#c084fc' }]}>{idx + 1}</Text>
        </View>
        <Text style={[setStyles.repsText, { color: done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.78)' }]}>
          {reps ? `${reps} reps` : 'Complete set'}
        </Text>
        <View style={[setStyles.checkCircle, done && setStyles.checkCircleDone]}>
          {done && <Text style={setStyles.checkMark}>✓</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

const setStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  rowDone: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.28)',
  },
  badge: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
  },
  badgeDone: { backgroundColor: 'rgba(34,197,94,0.22)' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  repsText: { flex: 1, fontSize: 14, fontWeight: '500' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  checkCircleDone: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 12 },
})

// ── Main Card ──────────────────────────────────────────────────────────────────

export default function ExerciseCard({
  content,
  exerciseKey,
  weight,
  onWeightChange,
  onGuideClick,
  initialDone = false,
  initialSetsDone,
  onDone,
  onSetsDone,
}: ExerciseCardProps) {
  const { unit } = useLocale()
  const ex: ParsedExercise = parseExerciseBlock(content)

  const [localWeight, setLocalWeight] = useState(weight)
  const [showTip, setShowTip] = useState(false)
  const [restActive, setRestActive] = useState(false)
  const [restSecsLeft, setRestSecsLeft] = useState(0)
  const restTotalRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const restBarWidth = useRef(new Animated.Value(1)).current

  const [setsDone, setSetsDone] = useState<boolean[]>(() => {
    if (initialSetsDone && initialSetsDone.length === ex.setsCount) return initialSetsDone
    return Array(Math.max(ex.setsCount, 0)).fill(initialDone)
  })
  const [manualDone, setManualDone] = useState(initialDone)

  const allSetsDone = ex.setsCount > 0 && setsDone.every(Boolean)
  const isDone = manualDone || allSetsDone
  const completedCount = setsDone.filter(Boolean).length

  const isMountedRef = useRef(false)
  useEffect(() => {
    if (!isMountedRef.current) { isMountedRef.current = true; return }
    onDone?.(exerciseKey, isDone)
  }, [isDone])

  const setsMountedRef = useRef(false)
  useEffect(() => {
    if (!setsMountedRef.current) { setsMountedRef.current = true; return }
    onSetsDone?.(exerciseKey, setsDone)
  }, [setsDone])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const startRestTimer = (totalSecs: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    restTotalRef.current = totalSecs
    setRestSecsLeft(totalSecs)
    setRestActive(true)
    restBarWidth.setValue(1)
    timerRef.current = setInterval(() => {
      setRestSecsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          setRestActive(false)
          return 0
        }
        Animated.timing(restBarWidth, {
          toValue: (prev - 1) / restTotalRef.current,
          duration: 1000,
          useNativeDriver: false,
        }).start()
        return prev - 1
      })
    }, 1000)
  }

  const skipRest = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setRestActive(false)
    setRestSecsLeft(0)
  }

  const toggleSet = (idx: number) => {
    const wasCompleted = setsDone[idx]
    const next = setsDone.map((v, i) => i === idx ? !v : v)
    const nowAllDone = next.every(Boolean)
    setSetsDone(next)
    if (!wasCompleted) {
      if (nowAllDone) {
        skipRest()
      } else if (ex.metaParts['rest']) {
        startRestTimer(parseRestSeconds(ex.metaParts['rest']))
      }
    } else {
      skipRest()
    }
  }

  const toggleManualDone = () => {
    if (isDone) {
      setManualDone(false)
      setSetsDone(Array(ex.setsCount).fill(false))
      skipRest()
    } else {
      setManualDone(true)
      if (ex.setsCount > 0) setSetsDone(Array(ex.setsCount).fill(true))
      skipRest()
    }
  }

  const restMins = Math.floor(restSecsLeft / 60)
  const restSecs = restSecsLeft % 60

  return (
    <View style={[styles.card, isDone && styles.cardDone]}>
      {/* Header */}
      <View style={styles.header}>
        {/* Number badge */}
        {isDone ? (
          <LinearGradient
            colors={['#22C55E', '#16A34A']}
            style={styles.numBadge}
          >
            <Text style={styles.numBadgeText}>✓</Text>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['#A855F7', '#22D3EE']}
            style={styles.numBadge}
          >
            <Text style={styles.numBadgeText}>{ex.num || '•'}</Text>
          </LinearGradient>
        )}

        {/* Name block */}
        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.exerciseName, { color: isDone ? 'rgba(255,255,255,0.42)' : '#fff' }]}
              numberOfLines={2}
            >
              {ex.exerciseKey}
            </Text>
            {ex.isNew && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>new</Text>
              </View>
            )}
          </View>
          <View style={styles.chipRow}>
            {ex.metaParts['rest'] && (
              <View style={styles.chipRest}>
                <Text style={styles.chipRestText}>{ex.metaParts['rest']} rest</Text>
              </View>
            )}
            {ex.metaParts['weight'] && (
              <View style={styles.chipWeight}>
                <Text style={styles.chipWeightText}>{ex.metaParts['weight']}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => onGuideClick(ex.exerciseKey)}
            style={styles.guideBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={18} color="#c084fc" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleManualDone}
            style={[styles.doneToggle, isDone && styles.doneToggleActive]}
            activeOpacity={0.8}
          >
            {isDone && <Text style={styles.doneCheck}>✓</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Sets */}
      {ex.setsCount > 0 && (
        <View style={styles.setsSection}>
          <View style={styles.setsHeader}>
            <Text style={styles.setsLabel}>SETS</Text>
            <Text style={[
              styles.setsCount,
              { color: completedCount === ex.setsCount ? '#4ade80' : 'rgba(255,255,255,0.4)' },
            ]}>
              {completedCount}/{ex.setsCount}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${ex.setsCount > 0 ? (completedCount / ex.setsCount) * 100 : 0}%` }]}>
              <LinearGradient
                colors={isDone ? ['#22C55E', '#16A34A'] : ['#A855F7', '#22D3EE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          </View>
          <View style={{ gap: 6 }}>
            {setsDone.map((done, idx) => (
              <SetRow
                key={idx}
                idx={idx}
                reps={ex.reps}
                done={done}
                onToggle={() => toggleSet(idx)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Rest timer */}
      {restActive && (
        <View style={styles.restTimer}>
          <View style={styles.restTimerHeader}>
            <Text style={styles.restTimerText}>
              Rest {restMins > 0 ? `${restMins}m ` : ''}{String(restSecs).padStart(2, '0')}s
            </Text>
            <TouchableOpacity onPress={skipRest}>
              <Text style={styles.restSkip}>Skip</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.restBarTrack}>
            <Animated.View
              style={[
                styles.restBarFill,
                { width: restBarWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        </View>
      )}

      {/* Weight input */}
      <View style={styles.weightRow}>
        <Text style={styles.weightLabel}>MY WEIGHT</Text>
        <TextInput
          style={styles.weightInput}
          placeholder={unit === 'imperial' ? 'e.g. 25 lbs, bodyweight...' : 'e.g. 12 kg, bodyweight...'}
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={localWeight}
          onChangeText={v => { setLocalWeight(v); onWeightChange(v) }}
          returnKeyType="done"
          selectionColor="#A855F7"
          underlineColorAndroid="transparent"
        />
        {localWeight ? (
          <TouchableOpacity onPress={() => { setLocalWeight(''); onWeightChange('') }}>
            <Text style={styles.weightClear}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Form tip */}
      {ex.tip ? (
        <View style={styles.tipSection}>
          <TouchableOpacity
            style={styles.tipToggle}
            onPress={() => setShowTip(p => !p)}
            activeOpacity={0.7}
          >
            <Text style={styles.tipToggleText}>Form tip</Text>
            <Ionicons
              name={showTip ? 'chevron-down' : 'chevron-forward'}
              size={14}
              color="rgba(255,255,255,0.25)"
            />
          </TouchableOpacity>
          {showTip && (
            <Text style={styles.tipText}>{ex.tip}</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.22)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20 },
      android: { elevation: 0 },
    }),
  },
  cardDone: {
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderColor: 'rgba(34,197,94,0.28)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  numBadge: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10,
  },
  numBadgeText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  nameBlock: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  exerciseName: { fontSize: 15, fontWeight: '700', lineHeight: 20, flexShrink: 1 },
  newBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(34,211,238,0.15)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)',
  },
  newBadgeText: { color: '#67e8f9', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  chipRest: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(34,211,238,0.1)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.18)',
  },
  chipRestText: { color: 'rgba(34,211,238,0.75)', fontSize: 10, fontWeight: '600' },
  chipWeight: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    backgroundColor: 'rgba(251,146,60,0.1)',
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.18)',
  },
  chipWeightText: { color: 'rgba(251,146,60,0.75)', fontSize: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  guideBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.22)',
  },
  doneToggle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  doneToggleActive: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
    shadowColor: '#22C55E', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  doneCheck: { color: '#fff', fontSize: 12, fontWeight: '900' },
  setsSection: { paddingHorizontal: 16, paddingBottom: 14 },
  setsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  setsLabel: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.22)',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  setsCount: { fontSize: 11, fontWeight: '700' },
  progressBar: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  progressFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
  restTimer: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(34,211,238,0.07)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.18)',
  },
  restTimerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  restTimerText: { color: '#67e8f9', fontSize: 12, fontWeight: '700' },
  restSkip: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '600' },
  restBarTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  restBarFill: {
    height: '100%', borderRadius: 2,
    backgroundColor: '#22D3EE',
  },
  weightRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(168,85,247,0.03)',
  },
  weightLabel: {
    color: 'rgba(168,85,247,0.6)', fontSize: 9,
    fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase',
    flexShrink: 0,
  },
  weightInput: {
    flex: 1, color: 'rgba(255,255,255,0.9)', fontSize: 14,
    paddingVertical: 0,
  },
  weightClear: { color: 'rgba(255,255,255,0.25)', fontSize: 18, lineHeight: 20 },
  tipSection: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  tipToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  tipToggleText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' },
  tipText: {
    paddingHorizontal: 16, paddingBottom: 12,
    color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18, fontStyle: 'italic',
  },
})
