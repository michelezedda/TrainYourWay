import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Animated, Easing, TouchableOpacity,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { storageGetAsync, storageSetAsync } from '@/lib/storage'
import { generateAnalysis, generateWorkoutPlan, type WorkoutFormData } from '@/lib/gemini'
import { Colors, Spacing, Radius } from '@/theme'
import GradientText from '@/components/GradientText'
import type { RootStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Generating'>

const TIPS = [
  'Analysing your equipment and space...',
  'Designing your weekly schedule...',
  'Balancing intensity and recovery...',
  'Calibrating to your fitness level...',
  'Adding progression guidelines...',
  'Finalising your personalised plan...',
]

const RING_SIZE = 144
const RING_BORDER = 4

function SpinningRing() {
  const spin = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(0.6)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    ).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={ringStyles.container}>
      {/* Spinning gradient ring */}
      <Animated.View style={[ringStyles.spinWrap, { transform: [{ rotate }] }]}>
        <LinearGradient
          colors={[Colors.purple, Colors.cyan, 'rgba(168,85,247,0.1)', Colors.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={ringStyles.gradientRing}
        />
      </Animated.View>

      {/* Dark inner circle to create ring effect */}
      <View style={ringStyles.innerCircle} />

      {/* Inner glow pulse */}
      <Animated.View style={[ringStyles.glowPulse, { opacity: pulse }]}>
        <LinearGradient
          colors={['rgba(168,85,247,0.25)', 'rgba(34,211,238,0.12)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Center emoji */}
      <View style={ringStyles.center}>
        <Text style={ringStyles.emoji}>🤖</Text>
      </View>
    </View>
  )
}

const ringStyles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spinWrap: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    overflow: 'hidden',
  },
  gradientRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
  },
  innerCircle: {
    position: 'absolute',
    width: RING_SIZE - RING_BORDER * 2,
    height: RING_SIZE - RING_BORDER * 2,
    borderRadius: (RING_SIZE - RING_BORDER * 2) / 2,
    backgroundColor: Colors.bg,
  },
  glowPulse: {
    position: 'absolute',
    width: RING_SIZE - 16,
    height: RING_SIZE - 16,
    borderRadius: (RING_SIZE - 16) / 2,
    overflow: 'hidden',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 40, lineHeight: 52 },
})

const gradStyles = StyleSheet.create({
  gradText: { fontSize: 24, fontWeight: '900', color: Colors.purple },
})

export default function GeneratingScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const insets = useSafeAreaInsets()
  const [tipIdx, setTipIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const tipOpacity = useRef(new Animated.Value(1)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const started = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(tipOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(tipOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start()
      setTipIdx(i => (i + 1) % TIPS.length)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (tipIdx + 1) / TIPS.length,
      duration: 2400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [tipIdx])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const formData = route.params.formData as unknown as WorkoutFormData
    const userId = getUserId()

    const PROFILE_KEY = `tyw_profile_${userId}`

    async function generate() {
      try {
        const [analysis, plan] = await Promise.all([
          generateAnalysis(formData),
          generateWorkoutPlan(formData),
        ])

        const planId = id()
        const storedProfileId = await storageGetAsync(PROFILE_KEY)
        const profileId = storedProfileId ?? id()
        if (!storedProfileId) {
          await storageSetAsync(PROFILE_KEY, profileId)
        }

        await db.transact([
          db.tx.workoutPlans[planId].update({
            userId,
            userName: formData.planName,
            fitnessLevel: formData.fitnessLevel,
            goals: JSON.stringify(formData.goals),
            equipment: JSON.stringify(formData.equipment),
            constraints: formData.injuries || '',
            plan,
            createdAt: Date.now(),
            workoutDays: JSON.stringify(formData.workoutDays),
            otherSports: formData.otherSports ? JSON.stringify(formData.otherSports) : undefined,
          }),
          db.tx.userProfiles[profileId].update({
            userId,
            name: formData.name || formData.planName,
            createdAt: Date.now(),
          }),
        ])

        navigation.replace('Results', {
          planId,
          plan,
          analysis,
          formData: JSON.stringify({ ...formData, images: [] }),
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    }

    void generate()
  }, [])

  const progressW = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContent}>
          <Text style={{ fontSize: 48, lineHeight: 60, marginBottom: 16 }}>⚠️</Text>
          <Text style={styles.errorTitle}>Generation Failed</Text>
          <Text style={styles.errorSub}>Your plan couldn't be generated. Here's what went wrong:</Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setError(null); started.current = false }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[Colors.purple, Colors.cyan]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.retryBtnGrad}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Ambient orbs */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient colors={['#0f0a2e', Colors.bg]} locations={[0, 0.45]} style={StyleSheet.absoluteFillObject} />
        <LinearGradient
          colors={['rgba(168,85,247,0.15)', 'transparent']}
          style={styles.orbTop}
        />
        <LinearGradient
          colors={['rgba(34,211,238,0.10)', 'transparent']}
          style={styles.orbBottom}
        />
      </View>

      <View style={styles.content}>
        {/* Spinning ring */}
        <SpinningRing />

        {/* Heading */}
        <View style={styles.headingWrap}>
          <Text style={styles.headingTop}>Crafting</Text>
          <GradientText style={gradStyles.gradText}>your plan</GradientText>
        </View>

        {/* Animated tip */}
        <Animated.Text style={[styles.tip, { opacity: tipOpacity }]}>
          {TIPS[tipIdx]}
        </Animated.Text>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressW }]}>
            <LinearGradient
              colors={[Colors.purple, Colors.cyan]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>

        {/* Step dots */}
        <View style={styles.dotsRow}>
          {TIPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === tipIdx && styles.dotActive,
              ]}
            >
              {i === tipIdx && (
                <LinearGradient
                  colors={[Colors.purple, Colors.cyan]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
            </View>
          ))}
        </View>

        <Text style={styles.hint}>This usually takes 15-30 seconds.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  orbTop: {
    position: 'absolute', top: -100, left: -100,
    width: 400, height: 400, borderRadius: 200,
  },
  orbBottom: {
    position: 'absolute', bottom: -80, right: -80,
    width: 320, height: 320, borderRadius: 160,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  headingWrap: { alignItems: 'center', gap: 4 },
  headingTop: { fontSize: 32, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5 },

  tip: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    minHeight: 44,
  },

  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },

  dotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  dotActive: {
    width: 22,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },

  hint: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' },

  // Error state
  errorContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  errorTitle: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.3 },
  errorSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    width: '100%',
  },
  errorText: { fontSize: 13, color: '#fca5a5', lineHeight: 20 },
  retryBtn: { width: '100%', borderRadius: Radius.xl, overflow: 'hidden', marginTop: Spacing.sm },
  retryBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
