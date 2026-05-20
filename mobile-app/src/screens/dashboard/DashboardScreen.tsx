import { useState, useMemo, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop } from 'react-native-svg'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { getDailyInsight } from '@/lib/coaching'
import { useMood, MOODS } from '@/context/MoodContext'
import { localDateStr } from '@/lib/utils'
import GlassCard from '@/components/GlassCard'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'
import { TAB_BAR_HEIGHT } from '@/navigation/AppNavigator'
import type { AppTabParamList } from '@/navigation/types'

type Nav = BottomTabNavigationProp<AppTabParamList>

const DAILY_GOAL = 8
const ML_PER_GLASS = 250
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000

function getGreeting(name: string | undefined): string {
  const h = new Date().getHours()
  const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  const first = name?.trim().split(' ')[0]
  return first ? `Good ${period}, ${first}!` : `Good ${period}!`
}

function getTodayWorkout(planText: string): { dayName: string; exercises: string[] } | null {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const todayName = weekdays[new Date().getDay()]
  const lines = planText.split('\n')
  let inSection = false
  const exercises: string[] = []
  let dayName = ''

  for (const line of lines) {
    const lower = line.toLowerCase()
    const isHeading = line.startsWith('#') || /^\*\*Day \d+/i.test(line.trim())
    if (isHeading && lower.includes(todayName)) {
      inSection = true
      dayName = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/Day \d+[:\s-]*/i, '').trim()
      continue
    }
    if (inSection) {
      if (isHeading && !lower.includes(todayName)) break
      if (lower.includes('rest day') || lower.includes('active recovery')) {
        exercises.push('Rest Day')
        break
      }
      const m = line.match(/^\*\*\d+\.\s*(.+?)(\*|$)/)
      if (m) exercises.push(m[1].trim())
    }
  }
  return dayName ? { dayName, exercises: exercises.slice(0, 4) } : null
}


// ── Mini ring (border trick) ──────────────────────────────────────────────────

const OVERSHOOT = Easing.bezier(0.34, 1.2, 0.64, 1)

function MiniRing({ pct, title, subtitle, color }: { pct: number; title: string; subtitle: string; color: string }) {
  const targetPct = Math.round(Math.min(1, pct) * 100)
  const anim = useRef(new Animated.Value(0)).current
  const [displayNum, setDisplayNum] = useState(0)

  useEffect(() => {
    const countVal = new Animated.Value(0)
    const listenerId = countVal.addListener(({ value }) => {
      setDisplayNum(Math.max(0, Math.min(100, Math.round(value))))
    })
    Animated.timing(anim, {
      toValue: Math.min(1, pct),
      duration: 1000,
      delay: 80,
      easing: OVERSHOOT,
      useNativeDriver: false,
    }).start()
    Animated.timing(countVal, {
      toValue: targetPct,
      duration: 1000,
      delay: 80,
      easing: OVERSHOOT,
      useNativeDriver: false,
    }).start(() => countVal.removeListener(listenerId))
    return () => countVal.removeAllListeners()
  }, [pct])

  return (
    <View style={miniRingStyles.container}>
      <View style={miniRingStyles.track}>
        <View style={[miniRingStyles.ring, { borderColor: 'rgba(255,255,255,0.07)' }]} />
        <Animated.View style={[miniRingStyles.ring, miniRingStyles.fill, {
          borderColor: color,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
        }]} />
        <View style={miniRingStyles.center}>
          <Text style={[miniRingStyles.pct, { color }]}>{displayNum}%</Text>
        </View>
      </View>
      <Text style={miniRingStyles.title}>{title}</Text>
      <Text style={miniRingStyles.sub}>{subtitle}</Text>
    </View>
  )
}

const miniRingStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 5 },
  track: { width: 58, height: 58, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 6 },
  fill: { borderRightColor: 'transparent', borderBottomColor: 'transparent' },
  center: { alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  sub: { fontSize: 9, color: Colors.textDim, textAlign: 'center' },
})

// ── Calorie ring (SVG arc, matches web CalorieRing) ──────────────────────────

function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const remaining = Math.max(0, target - eaten)
  const pct = Math.min(1, eaten / Math.max(1, target))
  const [sweepPct, setSweepPct] = useState(0)
  const animVal = useRef(new Animated.Value(0)).current

  useEffect(() => {
    animVal.setValue(0)
    const listenerId = animVal.addListener(({ value }) => setSweepPct(value))
    Animated.timing(animVal, {
      toValue: pct,
      duration: 1000,
      delay: 200,
      easing: OVERSHOOT,
      useNativeDriver: false,
    }).start()
    return () => animVal.removeListener(listenerId)
  }, [pct])

  const cx = 60, cy = 60, r = 50
  const startAngle = 135
  const sweepDeg = 270
  const toRad = (d: number) => (d * Math.PI) / 180
  const arcPath = (start: number, sweep: number): string => {
    if (sweep < 0.5) return ''
    const end = start + sweep
    const x1 = cx + r * Math.cos(toRad(start))
    const y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(end))
    const y2 = cy + r * Math.sin(toRad(end))
    const large = sweep > 180 ? 1 : 0
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }

  const trackPath = arcPath(startAngle, sweepDeg)
  const fillPath = sweepPct > 0.005 ? arcPath(startAngle, sweepDeg * sweepPct) : ''

  return (
    <View style={calRingStyles.wrap}>
      <View style={calRingStyles.side}>
        <Text style={calRingStyles.statNum}>{eaten.toLocaleString()}</Text>
        <Text style={calRingStyles.statLbl}>Eaten</Text>
      </View>
      <View style={calRingStyles.ringWrap}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Defs>
            <SvgLinearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#A855F7" />
              <Stop offset="100%" stopColor="#22D3EE" />
            </SvgLinearGradient>
          </Defs>
          <Path d={trackPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={11} strokeLinecap="round" />
          {fillPath ? (
            <Path d={fillPath} fill="none" stroke="url(#calGrad)" strokeWidth={11} strokeLinecap="round" />
          ) : null}
        </Svg>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={calRingStyles.center}>
            <Text style={calRingStyles.remaining}>{remaining.toLocaleString()}</Text>
            <Text style={calRingStyles.remainingLbl}>kcal left</Text>
          </View>
        </View>
      </View>
      <View style={calRingStyles.side}>
        <Text style={calRingStyles.statNum}>0</Text>
        <Text style={calRingStyles.statLbl}>Burned</Text>
      </View>
    </View>
  )
}

const calRingStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  ringWrap: { width: 120, height: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  remaining: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  remainingLbl: { fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: '500', marginTop: 4 },
  side: { alignItems: 'center' },
  statNum: { fontSize: 20, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginTop: 2 },
})

// ── Water glass icon (animated) ───────────────────────────────────────────────

function WaterGlass({
  filled, celebrating, delay, onPress,
}: { filled: boolean; celebrating: boolean; delay: number; onPress: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const prevCelebrating = useRef(false)

  useEffect(() => {
    if (celebrating && !prevCelebrating.current) {
      prevCelebrating.current = true
      // Replicate glass-bounce: translateY 0→-9→3→-2→0, scale 1→1.18→0.91→1.05→1
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(translateY, { toValue: -9, duration: 165, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 3, duration: 154, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: -2, duration: 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 121, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(scale, { toValue: 1.18, duration: 165, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.91, duration: 154, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.05, duration: 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 121, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
      ]).start()
    } else if (!celebrating) {
      prevCelebrating.current = false
    }
  }, [celebrating])

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={waterGlassStyles.tap}>
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <View style={[waterGlassStyles.glass, filled && waterGlassStyles.glassFilled]}>
          {filled && <View style={waterGlassStyles.waterFill} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  )
}

const waterGlassStyles = StyleSheet.create({
  tap: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  glass: {
    width: 18, height: 26, borderRadius: 3,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden', justifyContent: 'flex-end',
  },
  glassFilled: { borderColor: 'rgba(34,211,238,0.7)' },
  waterFill: { height: '70%', backgroundColor: 'rgba(34,211,238,0.25)' },
})

// ── Mood button with per-emotion animation ────────────────────────────────────

type MoodAnim = {
  // Card container: mood-pop (scale 1 → 1.32 → 0.88 → 1.1 → 1)
  containerScale: Animated.Value
  // Emoji: per-emotion transform values
  emojiScale: Animated.Value
  emojiRotate: Animated.Value
  emojiTranslateY: Animated.Value
  emojiTranslateX: Animated.Value
}

function runMoodAnimation(idx: number, a: MoodAnim) {
  // mood-pop on container
  Animated.sequence([
    Animated.timing(a.containerScale, { toValue: 1.32, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.timing(a.containerScale, { toValue: 0.88, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    Animated.timing(a.containerScale, { toValue: 1.1, duration: 100, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    Animated.timing(a.containerScale, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
  ]).start()

  // Reset emoji values
  a.emojiScale.setValue(1)
  a.emojiRotate.setValue(0)
  a.emojiTranslateY.setValue(0)
  a.emojiTranslateX.setValue(0)

  if (idx === 0) {
    // Low: droopy sag (scale+rotate+translateY)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(a.emojiScale, { toValue: 0.9, duration: 175, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 0.85, duration: 210, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 0.92, duration: 175, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiRotate, { toValue: -14, duration: 175, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -18, duration: 210, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -9, duration: 175, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiTranslateY, { toValue: 3, duration: 175, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: 7, duration: 210, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: 3, duration: 175, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
    ]).start()
  } else if (idx === 1) {
    // Meh: side wobble (translateX+rotate)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(a.emojiTranslateX, { toValue: -6, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateX, { toValue: 6, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateX, { toValue: -4, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateX, { toValue: 3, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateX, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiRotate, { toValue: -4, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 4, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -2, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]),
    ]).start()
  } else if (idx === 2) {
    // OK: single bounce (translateY+scale)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(a.emojiTranslateY, { toValue: -8, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: 2, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: -3, duration: 100, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiScale, { toValue: 1.1, duration: 160, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 0.95, duration: 140, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.04, duration: 100, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
    ]).start()
  } else if (idx === 3) {
    // Good: happy bounce (scale+rotate+translateY)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(a.emojiScale, { toValue: 1.22, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.12, duration: 132, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.06, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1, duration: 108, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiRotate, { toValue: 9, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -5, duration: 132, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 6, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -2, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 0, duration: 108, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiTranslateY, { toValue: -9, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: -4, duration: 132, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: -7, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(a.emojiTranslateY, { toValue: 0, duration: 108, useNativeDriver: true }),
      ]),
    ]).start()
  } else {
    // Great: wild excitement (scale+rotate)
    Animated.parallel([
      Animated.sequence([
        Animated.timing(a.emojiScale, { toValue: 1.45, duration: 91, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.32, duration: 104, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.5, duration: 130, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.22, duration: 117, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1.1, duration: 104, useNativeDriver: true }),
        Animated.timing(a.emojiScale, { toValue: 1, duration: 104, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(a.emojiRotate, { toValue: 22, duration: 91, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -18, duration: 104, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 28, duration: 130, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: -10, duration: 117, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 5, duration: 104, useNativeDriver: true }),
        Animated.timing(a.emojiRotate, { toValue: 0, duration: 104, useNativeDriver: true }),
      ]),
    ]).start()
  }
}

function MoodButton({
  emoji, label, selected, onPress, animValues,
}: {
  emoji: string; label: string; selected: boolean; onPress: () => void; animValues: MoodAnim
}) {
  const rotate = animValues.emojiRotate.interpolate({ inputRange: [-30, 0, 30], outputRange: ['-30deg', '0deg', '30deg'] })

  return (
    <Animated.View style={[moodBtnStyles.container, { transform: [{ scale: animValues.containerScale }] }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[moodBtnStyles.btn, selected && moodBtnStyles.btnSelected]}
      >
        <Animated.View style={{
          transform: [
            { scale: animValues.emojiScale },
            { rotate },
            { translateY: animValues.emojiTranslateY },
            { translateX: animValues.emojiTranslateX },
          ],
        }}>
          <Text style={moodBtnStyles.emoji}>{emoji}</Text>
        </Animated.View>
        <Text style={[moodBtnStyles.label, selected && moodBtnStyles.labelSelected]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const moodBtnStyles = StyleSheet.create({
  container: { flex: 1 },
  btn: {
    alignItems: 'center', paddingVertical: 9, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 3,
  },
  btnSelected: {
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderColor: 'rgba(168,85,247,0.4)',
    shadowColor: '#A855F7', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 8,
  },
  emoji: { fontSize: 22, lineHeight: 30 },
  label: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  labelSelected: { color: '#c084fc' },
})

// ── Dashboard ─────────────────────────────────────────────────────────────────

const ANIM_COUNT = 7
function useStagger() {
  const anims = useRef(Array.from({ length: ANIM_COUNT }, () => ({
    opacity: new Animated.Value(0),
    y: new Animated.Value(22),
  }))).current

  useEffect(() => {
    const ease = Easing.bezier(0.25, 0.1, 0.25, 1)
    Animated.parallel(
      anims.map((a, i) =>
        Animated.sequence([
          Animated.delay(50 + i * 80),
          Animated.parallel([
            Animated.timing(a.opacity, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
            Animated.timing(a.y, { toValue: 0, duration: 420, easing: ease, useNativeDriver: true }),
          ]),
        ])
      )
    ).start()
  }, [])

  return (i: number) => ({ opacity: anims[i].opacity, transform: [{ translateY: anims[i].y }] })
}

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>()
  const insets = useSafeAreaInsets()
  const today = localDateStr()
  const userId = getUserId()
  const { mood, selectMood } = useMood()
  const getAnim = useStagger()

  const moodAnimValues = useRef<MoodAnim[]>(
    MOODS.map(() => ({
      containerScale: new Animated.Value(1),
      emojiScale: new Animated.Value(1),
      emojiRotate: new Animated.Value(0),
      emojiTranslateY: new Animated.Value(0),
      emojiTranslateX: new Animated.Value(0),
    })),
  ).current

  const handleMoodClick = (i: number) => {
    if (mood === i) return
    selectMood(i)
    runMoodAnimation(i, moodAnimValues[i])
  }

  const { data } = db.useQuery({
    workoutPlans: { $: { where: { userId } } },
    mealEntries: { $: { where: { userId } } },
    waterLogs: { $: { where: { userId } } },
    userProfiles: { $: { where: { userId } } },
  })

  const allPlans = (data?.workoutPlans ?? []) as Array<{ id: string; plan: string; userName: string; fitnessLevel: string; goals: string; equipment: string; createdAt: number; workoutDays?: string }>
  const mealEntries = (data?.mealEntries ?? []) as Array<{ date: string; kcal?: number; protein?: number; carbs?: number; fat?: number }>
  const waterLogs = (data?.waterLogs ?? []) as Array<{ id: string; date: string; glasses: number }>
  const userProfile = ((data?.userProfiles ?? []) as Array<{ id: string; name?: string }>)[0]

  const latestPlan = useMemo(() => [...allPlans].sort((a, b) => b.createdAt - a.createdAt)[0], [allPlans])
  const nutritionProfile = useMemo(() => getNutritionProfile(), [])
  const targets = useMemo(
    () => nutritionProfile ? calculateTargets(nutritionProfile) : { kcal: 2000, protein: 150, carbs: 200, fat: 65 },
    [nutritionProfile],
  )

  const todayMeals = useMemo(() => mealEntries.filter(e => e.date === today), [mealEntries, today])
  const todayKcal = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.kcal ?? 0), 0)), [todayMeals])
  const todayProtein = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.protein ?? 0), 0)), [todayMeals])
  const todayCarbs = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.carbs ?? 0), 0)), [todayMeals])
  const todayFat = useMemo(() => Math.round(todayMeals.reduce((s, e) => s + (e.fat ?? 0), 0)), [todayMeals])

  const todayWaterLog = waterLogs.find(w => w.date === today)
  const glasses = todayWaterLog?.glasses ?? 0
  const liters = ((glasses * ML_PER_GLASS) / 1000).toFixed(1)
  const [waterCelebrating, setWaterCelebrating] = useState(false)

  const setGlasses = async (next: number) => {
    const clamped = Math.max(0, Math.min(next, 16))
    if (todayWaterLog) {
      await db.transact(db.tx.waterLogs[todayWaterLog.id].update({ glasses: clamped }))
    } else if (clamped > 0) {
      await db.transact(db.tx.waterLogs[id()].update({ userId, date: today, glasses: clamped, createdAt: Date.now() }))
    }
  }

  const handleGlassClick = (i: number) => {
    const next = glasses === i + 1 ? i : i + 1
    if (next >= DAILY_GOAL && glasses < DAILY_GOAL) {
      setWaterCelebrating(true)
      setTimeout(() => setWaterCelebrating(false), 1100)
    }
    void setGlasses(next)
  }

  const todayWorkout = useMemo(
    () => latestPlan?.plan ? getTodayWorkout(latestPlan.plan) : null,
    [latestPlan?.plan],
  )
  const canEvolve = latestPlan ? Date.now() - latestPlan.createdAt >= FOUR_WEEKS_MS : false
  const insight = getDailyInsight()

  const brandAnim = useRef(new Animated.Value(0)).current
  const brandVisible = useRef(false)
  const brandY = useRef(0)
  const brandH = useRef(80)
  const scrollViewH = useRef(0)
  const brandOpacity = useRef(brandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' })).current
  const brandScale = useRef(brandAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1], extrapolate: 'clamp' })).current
  const brandTranslateY = useRef(brandAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0], extrapolate: 'clamp' })).current

  const handleScroll = (e: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number } } }) => {
    const scrollY = e.nativeEvent.contentOffset.y
    scrollViewH.current = e.nativeEvent.layoutMeasurement.height
    const ey = brandY.current
    const eh = brandH.current
    const vh = scrollViewH.current
    const visible = Math.max(0, Math.min(ey + eh, scrollY + vh) - Math.max(ey, scrollY))
    const ratio = visible / Math.max(1, eh)
    if (ratio >= 0.6 && !brandVisible.current) {
      brandVisible.current = true
      brandAnim.setValue(0)
      Animated.spring(brandAnim, { toValue: 1, stiffness: 280, damping: 14, mass: 0.85, useNativeDriver: true }).start()
    } else if (ratio < 0.6 && brandVisible.current) {
      brandVisible.current = false
      Animated.spring(brandAnim, { toValue: 0, stiffness: 280, damping: 14, mass: 0.85, useNativeDriver: true }).start()
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Ambient background orbs */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient
          colors={['#0f0a2e', Colors.bg]}
          locations={[0, 0.45]}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['rgba(168,85,247,0.12)', 'transparent']}
          style={styles.orbTopLeft}
        />
        <LinearGradient
          colors={['rgba(34,211,238,0.08)', 'transparent']}
          style={styles.orbBottomRight}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >

        {/* Greeting */}
        <Animated.View style={[styles.section, getAnim(0)]}>
          <GradientText style={styles.greeting}>{getGreeting(userProfile?.name)}</GradientText>
          <Text style={styles.greetingSub}>
            {latestPlan ? "Here's your day at a glance." : "Let's get you started."}
          </Text>
        </Animated.View>

        {/* Progress rings */}
        <Animated.View style={getAnim(1)}>
          <GlassCard style={styles.section}>
            <View style={styles.ringsRow}>
              <MiniRing pct={todayKcal / Math.max(1, targets.kcal)} title="Calories" subtitle={`${todayKcal} kcal`} color="#A855F7" />
              <MiniRing pct={todayProtein / Math.max(1, targets.protein)} title="Protein" subtitle={`${todayProtein}g`} color="#ef4444" />
              <MiniRing pct={0} title="Workouts" subtitle="this week" color="#f97316" />
              <MiniRing pct={glasses / DAILY_GOAL} title="Water" subtitle={`${liters}L`} color="#22D3EE" />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Diet summary */}
        <Animated.View style={getAnim(2)}>
          <GlassCard style={styles.section}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>Daily Calories</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Diet', { screen: 'DietHome' })} activeOpacity={0.7}>
                <Text style={styles.detailsLink}>Details</Text>
              </TouchableOpacity>
            </View>
            <CalorieRing eaten={todayKcal} target={targets.kcal} />
            <View style={[styles.macroRow, { marginTop: 20 }]}>
              {[
                { label: 'Carbs', cur: todayCarbs, max: targets.carbs, colors: ['#A855F7', '#C084FC'] as [string,string] },
                { label: 'Protein', cur: todayProtein, max: targets.protein, colors: ['#22D3EE', '#67E8F9'] as [string,string] },
                { label: 'Fat', cur: todayFat, max: targets.fat, colors: ['#f97316', '#fb923c'] as [string,string] },
              ].map(({ label, cur, max, colors }) => (
                <View key={label} style={{ flex: 1 }}>
                  <Text style={styles.macroLabel}>{label}</Text>
                  <View style={styles.macroBarTrack}>
                    <LinearGradient
                      colors={colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.macroBarFill, { width: `${Math.min(100, (cur / Math.max(1, max)) * 100)}%` }]}
                    />
                  </View>
                  <Text style={styles.macroNumbers}>{cur}/{max}g</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Today's Workout */}
        <Animated.View style={getAnim(3)}>
          {latestPlan ? (
            <GlassCard style={styles.section}>
              <View style={styles.cardHeader}>
                <Text style={styles.sectionLabel}>Today's Workout</Text>
              </View>
              {todayWorkout ? (
                <>
                  <Text style={styles.workoutDay}>{todayWorkout.dayName}</Text>
                  {todayWorkout.exercises[0] === 'Rest Day' ? (
                    <Text style={styles.restText}>Active recovery or rest - recharge today.</Text>
                  ) : (
                    <View style={{ gap: 8, marginTop: 4 }}>
                      {todayWorkout.exercises.map((ex, i) => (
                        <View key={i} style={styles.exerciseRow}>
                          <View style={styles.exerciseNum}>
                            <Text style={styles.exerciseNumText}>{i + 1}</Text>
                          </View>
                          <Text style={styles.exerciseName}>{ex}</Text>
                        </View>
                      ))}
                      {todayWorkout.exercises.length === 4 && (
                        <Text style={styles.moreTip}>+ more exercises in full plan</Text>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.restText}>Rest day - recover and recharge.</Text>
              )}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.planBtn} onPress={() => navigation.navigate('Workout', { screen: 'WorkoutHome' })} activeOpacity={0.85}>
                  <Text style={styles.planBtnText}>View Plan</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planBtn, !canEvolve && styles.planBtnDisabled]}
                  disabled={!canEvolve}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.planBtnText, !canEvolve && styles.planBtnTextDisabled]}>Evolve</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.section}>
              <View style={styles.noPlanCard}>
                <View style={styles.noPlanIcon}>
                  <LinearGradient colors={['rgba(168,85,247,0.25)', 'rgba(34,211,238,0.15)']} style={styles.noPlanIconGrad}>
                    <Text style={{ fontSize: 32, lineHeight: 42 }}>🏋️</Text>
                  </LinearGradient>
                </View>
                <Text style={styles.noPlanTitle}>Build your first plan</Text>
                <Text style={styles.noPlanBody}>
                  Answer a few questions about your goals and equipment. Get a personalised plan in seconds.
                </Text>
              </View>
            </GlassCard>
          )}
        </Animated.View>

        {/* Mood + Hydration: stacked vertically (matches web grid-cols-1 on mobile) */}
        <Animated.View style={[styles.moodWaterStack, getAnim(4)]}>
          {/* Mood */}
          <GlassCard padding={20}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>How are you feeling today?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Wellness', { screen: 'WellnessHome' })} activeOpacity={0.7}>
                <Text style={styles.detailsLink}>Mindspace</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.moodRow}>
              {MOODS.map((m, i) => (
                <MoodButton
                  key={i}
                  emoji={m.emoji}
                  label={m.label}
                  selected={mood === i}
                  onPress={() => handleMoodClick(i)}
                  animValues={moodAnimValues[i]}
                />
              ))}
            </View>
          </GlassCard>

          {/* Water */}
          <GlassCard
            style={waterCelebrating && styles.waterCardCelebrating}
            padding={20}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>Hydration</Text>
              <View style={styles.waterAmountRow}>
                <Text style={[styles.waterAmount, glasses >= DAILY_GOAL && styles.waterAmountFull]}>
                  {liters}L
                </Text>
                <Text style={styles.waterAmountTarget}>/ 2.0L</Text>
              </View>
            </View>
            <View style={styles.glassRow}>
              {Array.from({ length: DAILY_GOAL }).map((_, i) => (
                <WaterGlass
                  key={i}
                  filled={i < glasses}
                  celebrating={waterCelebrating}
                  delay={i * 70}
                  onPress={() => handleGlassClick(i)}
                />
              ))}
            </View>
            <View style={styles.waterBarTrack}>
              <LinearGradient
                colors={['#22D3EE', '#34d399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.waterBarFill, { width: `${Math.min(100, (glasses / DAILY_GOAL) * 100)}%` }]}
              />
            </View>
          </GlassCard>
        </Animated.View>

        {/* Daily Coaching Insight */}
        <Animated.View style={getAnim(5)}>
          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightLabel}>{insight.label}</Text>
              <Text style={styles.insightText}>{insight.tip}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Feature Grid */}
        <Animated.View style={[styles.featureGrid, getAnim(6)]}>
          {([
            { emoji: '📷', label: 'Food Scan', sub: 'Scan barcodes', tab: 'Diet', screen: 'FoodScanner', accent: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.22)' },
            { emoji: '🏋️', label: 'Machine Scanner', sub: 'Photo any machine', tab: 'Me', screen: 'MachineScanner', accent: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.20)' },
            { emoji: '🧠', label: 'Mindspace', sub: 'Mental wellness', tab: 'Wellness', screen: undefined, accent: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.20)' },
            { emoji: '🏆', label: 'Community', sub: 'Leaderboard', tab: 'Me', screen: 'Community', accent: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.20)' },
          ] as const).map(({ emoji, label, sub, tab, screen, accent, border }) => (
            <TouchableOpacity
              key={label}
              style={[styles.featureCard, { backgroundColor: accent, borderColor: border }]}
              onPress={() => {
                if (screen) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  navigation.navigate(tab as any, { screen })
                } else {
                  navigation.navigate(tab as any)
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 28, lineHeight: 36 }}>{emoji}</Text>
              <Text style={styles.featureLabel}>{label}</Text>
              <Text style={styles.featureSub}>{sub}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* UPLYFT Branding */}
        <Animated.View
          onLayout={e => { brandY.current = e.nativeEvent.layout.y; brandH.current = e.nativeEvent.layout.height }}
          style={[styles.brandingSection, { opacity: brandOpacity, transform: [{ scale: brandScale }, { translateY: brandTranslateY }] }]}
        >
          <Svg width={64} height={64} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="brandGrad" cx="32%" cy="26%" r="72%">
                <Stop offset="0%" stopColor="#C026D3" />
                <Stop offset="48%" stopColor="#7C3AED" />
                <Stop offset="100%" stopColor="#3B5CF0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill="url(#brandGrad)" />
            <Path
              d="M50,13 C37,37 37,37 13,50 C37,63 37,63 50,87 C63,63 63,63 87,50 C63,37 63,37 50,13 Z"
              fill="white"
              transform="rotate(28, 50, 50)"
            />
          </Svg>
          <GradientText style={styles.brandingText} colors={['#A855F7', '#22D3EE']}>UPLYFT</GradientText>
        </Animated.View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  orbTopLeft: {
    position: 'absolute', top: -80, left: -80,
    width: 320, height: 320, borderRadius: 160,
  },
  orbBottomRight: {
    position: 'absolute', bottom: 100, right: -100,
    width: 280, height: 280, borderRadius: 140,
  },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  section: { marginBottom: 0 },

  greeting: { fontSize: 28, fontWeight: '900', color: Colors.purple, letterSpacing: -0.3 },
  greetingSub: { ...Typography.body, color: Colors.textMuted, marginTop: 4 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: { ...Typography.label },
  detailsLink: { fontSize: 12, fontWeight: '600', color: Colors.purpleLight },

  ringsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },

  // Diet
  macroRow: { flexDirection: 'row', gap: 10 },
  macroLabel: { fontSize: 9, color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', marginBottom: 4 },
  macroBarTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: 5, borderRadius: 3 },
  macroNumbers: { fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 3 },

  // Workout
  workoutDay: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  restText: { ...Typography.body, color: Colors.textMuted },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exerciseNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.purpleDim, alignItems: 'center', justifyContent: 'center' },
  exerciseNumText: { fontSize: 10, fontWeight: '700', color: Colors.purpleLight },
  exerciseName: { ...Typography.body, flex: 1 },
  moreTip: { fontSize: 10, color: Colors.textDim, paddingLeft: 30 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  planBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.xl, alignItems: 'center',
    backgroundColor: Colors.purpleDim, borderWidth: 1, borderColor: Colors.purpleBorder,
  },
  planBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', opacity: 0.5 },
  planBtnText: { color: Colors.purpleLight, fontWeight: '600', fontSize: 14 },
  planBtnTextDisabled: { color: Colors.textDim },

  // No plan
  noPlanCard: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  noPlanIcon: { width: 64, height: 64, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  noPlanIconGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noPlanTitle: { ...Typography.h3, textAlign: 'center' },
  noPlanBody: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },

  // Mood + Water stacked
  moodWaterStack: { gap: 14 },

  moodRow: { flexDirection: 'row', gap: 6 },

  waterCardCelebrating: { borderColor: 'rgba(34,211,238,0.55)', shadowColor: Colors.cyan },
  waterAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  waterAmount: { fontSize: 15, fontWeight: '800', color: Colors.textSecondary },
  waterAmountFull: { color: Colors.cyan },
  waterAmountTarget: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  glassRow: { flexDirection: 'row', gap: 3, marginBottom: 12, justifyContent: 'space-between' },
  waterBarTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' },
  waterBarFill: { height: 3, borderRadius: 2 },

  // Coaching insight
  insightCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.06)', borderRadius: Radius.xl,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.15)', padding: Spacing.md,
  },
  insightIcon: { fontSize: 14, color: 'rgba(192,132,252,0.7)', marginTop: 1 },
  insightLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(192,132,252,0.6)', textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 4 },
  insightText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 18 },

  // Feature grid
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: {
    width: '47%', borderRadius: Radius.xl, borderWidth: 1,
    padding: Spacing.md, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  featureLabel: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  featureSub: { ...Typography.caption, color: Colors.textMuted },

  brandingSection: { alignItems: 'center', justifyContent: 'center', paddingBottom: 40, paddingTop: 24, gap: 12, overflow: 'hidden' },
  brandingText: { fontSize: 22, fontWeight: '900', letterSpacing: 4 },
})
