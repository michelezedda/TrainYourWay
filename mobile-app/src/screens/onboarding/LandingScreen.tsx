import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, Easing, Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Ellipse, Defs, RadialGradient as SvgRadialGradient, Stop, Line } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '@/navigation/types'
import { db } from '@/lib/db'
import { Colors, Spacing, Radius } from '@/theme'
import GradientText from '@/components/GradientText'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Landing'>

const { width: W, height: H } = Dimensions.get('window')

const FEATURES = [
  {
    icon: '🏋️', badge: 'Personalized', title: 'Workout Plans',
    desc: 'Built around your goals, equipment, body type, and schedule.',
    color: '#A855F7', borderColor: 'rgba(168,85,247,0.28)',
    bg1: 'rgba(168,85,247,0.13)', bg2: 'rgba(168,85,247,0.05)',
  },
  {
    icon: '🎯', badge: 'Built-In', title: 'Smart Coaching',
    desc: 'Form cues, session tips, and coaching insights in every workout.',
    color: '#22D3EE', borderColor: 'rgba(34,211,238,0.25)',
    bg1: 'rgba(34,211,238,0.1)', bg2: 'rgba(34,211,238,0.04)',
  },
  {
    icon: '📈', badge: 'Auto-Evolving', title: 'Smart Progress',
    desc: 'Your plan adapts and levels up every 4 weeks automatically.',
    color: '#10b981', borderColor: 'rgba(16,185,129,0.25)',
    bg1: 'rgba(16,185,129,0.1)', bg2: 'rgba(16,185,129,0.04)',
  },
  {
    icon: '🥗', badge: 'Nutrition', title: 'Food Tracking',
    desc: 'Macros, calories, food scanner, and daily nutrition insights.',
    color: '#f97316', borderColor: 'rgba(249,115,22,0.25)',
    bg1: 'rgba(249,115,22,0.1)', bg2: 'rgba(249,115,22,0.04)',
  },
]

const GOALS = ['Weight Loss', 'Muscle Gain', 'Athletic Performance', 'Strength', 'Flexibility']

const STATS = [
  { value: 'Gym & Home', label: 'Flexible Training' },
  { value: 'Beginner-Friendly', label: 'Easy To Start' },
  { value: 'Goal-Based', label: 'Focused Training' },
]


export default function LandingScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = db.useAuth()
  const [activeFeature, setActiveFeature] = useState(0)
  // Goal cycling: current shows the entering goal; exiting shows the leaving goal
  const [goalIdxCurrent, setGoalIdxCurrent] = useState(0)
  const [goalIdxExiting, setGoalIdxExiting] = useState<number | null>(null)

  // Orb animations
  const orb1X = useRef(new Animated.Value(0)).current
  const orb1Y = useRef(new Animated.Value(0)).current
  const orb1Scale = useRef(new Animated.Value(1)).current
  const orb2X = useRef(new Animated.Value(0)).current
  const orb2Y = useRef(new Animated.Value(0)).current
  const orb2Scale = useRef(new Animated.Value(1.06)).current
  const orb3X = useRef(new Animated.Value(0)).current
  const orb3Y = useRef(new Animated.Value(0)).current

  // Card transition animation
  const cardOpacity = useRef(new Animated.Value(1)).current
  const cardY = useRef(new Animated.Value(0)).current
  const cardScale = useRef(new Animated.Value(1)).current

  // Goal cycling animations — enterOpacity starts at 1 so first goal is immediately visible
  const goalEnterOpacity = useRef(new Animated.Value(1)).current
  const goalEnterY = useRef(new Animated.Value(0)).current
  const goalExitOpacity = useRef(new Animated.Value(0)).current
  const goalExitY = useRef(new Animated.Value(0)).current

  // Button press scale
  const btnScale = useRef(new Animated.Value(1)).current

  // Shine sweep — ambient light pass across the feature card
  const shineAnim = useRef(new Animated.Value(0)).current

  // Entrance animations
  const logoAnim = useRef(new Animated.Value(0)).current
  const headlineAnim = useRef(new Animated.Value(0)).current
  const cardAnim = useRef(new Animated.Value(0)).current
  const statsAnim = useRef(new Animated.Value(0)).current
  const ctaAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Entrance — matches web: logo 0ms/550ms, headline 100ms/550ms, card 180ms/600ms,
    // stats 300ms/400ms, cta 380ms/400ms — all ease [0.4,0,0.2,1]
    const ease = Easing.bezier(0.4, 0, 0.2, 1)
    Animated.parallel([
      Animated.timing(logoAnim, { toValue: 1, duration: 550, delay: 0, easing: ease, useNativeDriver: true }),
      Animated.timing(headlineAnim, { toValue: 1, duration: 550, delay: 100, easing: ease, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 1, duration: 600, delay: 180, easing: ease, useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 400, delay: 300, easing: ease, useNativeDriver: true }),
      Animated.timing(ctaAnim, { toValue: 1, duration: 400, delay: 380, easing: ease, useNativeDriver: true }),
    ]).start()

    // Orb float loops — exact web keyframes: orb1 22s, orb2 28s, orb3 18s (5s delay)
    const orbEase = Easing.inOut(Easing.ease)

    // Orb 1: x[0,40,-20,0] y[0,-30,40,0] scale[1,1.12,0.94,1]
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orb1X, { toValue: 40, duration: 8000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb1Y, { toValue: -30, duration: 8000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb1Scale, { toValue: 1.12, duration: 8000, easing: orbEase, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orb1X, { toValue: -20, duration: 7000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb1Y, { toValue: 40, duration: 7000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb1Scale, { toValue: 0.94, duration: 7000, easing: orbEase, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orb1X, { toValue: 0, duration: 7000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb1Y, { toValue: 0, duration: 7000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb1Scale, { toValue: 1, duration: 7000, easing: orbEase, useNativeDriver: true }),
        ]),
      ])
    ).start()

    // Orb 2: x[0,-35,25,0] y[0,30,-40,0] scale[1.06,0.94,1.14,1.06]
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orb2X, { toValue: -35, duration: 10000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb2Y, { toValue: 30, duration: 10000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb2Scale, { toValue: 0.94, duration: 10000, easing: orbEase, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orb2X, { toValue: 25, duration: 9000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb2Y, { toValue: -40, duration: 9000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb2Scale, { toValue: 1.14, duration: 9000, easing: orbEase, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orb2X, { toValue: 0, duration: 9000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb2Y, { toValue: 0, duration: 9000, easing: orbEase, useNativeDriver: true }),
          Animated.timing(orb2Scale, { toValue: 1.06, duration: 9000, easing: orbEase, useNativeDriver: true }),
        ]),
      ])
    ).start()

    // Orb 3: x[0,18,-14,0] y[0,14,-18,0] — 5s delay matching web
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(orb3X, { toValue: 18, duration: 6000, easing: orbEase, useNativeDriver: true }),
            Animated.timing(orb3Y, { toValue: 14, duration: 6000, easing: orbEase, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(orb3X, { toValue: -14, duration: 6000, easing: orbEase, useNativeDriver: true }),
            Animated.timing(orb3Y, { toValue: -18, duration: 6000, easing: orbEase, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(orb3X, { toValue: 0, duration: 6000, easing: orbEase, useNativeDriver: true }),
            Animated.timing(orb3Y, { toValue: 0, duration: 6000, easing: orbEase, useNativeDriver: true }),
          ]),
        ])
      ).start()
    }, 5000)
  }, [])

  // Cycle features — matches web: exit scale+y+opacity 320ms, enter y+opacity 420ms ease [0.4,0,0.2,1]
  useEffect(() => {
    const ease = Easing.bezier(0.4, 0, 0.2, 1)
    const t = setInterval(() => {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 0, duration: 320, easing: ease, useNativeDriver: true }),
        Animated.timing(cardY, { toValue: -14, duration: 320, easing: ease, useNativeDriver: true }),
        Animated.timing(cardScale, { toValue: 0.96, duration: 320, easing: ease, useNativeDriver: true }),
      ]).start(() => {
        setActiveFeature(i => (i + 1) % FEATURES.length)
        cardY.setValue(20)
        cardScale.setValue(1)
        Animated.parallel([
          Animated.timing(cardOpacity, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
          Animated.timing(cardY, { toValue: 0, duration: 420, easing: ease, useNativeDriver: true }),
        ]).start()
      })
    }, 2800)
    return () => clearInterval(t)
  }, [])

  // Cycle goals — matches web: exit slides up (-35dp + fade) while enter slides in from below
  // simultaneously, 380ms ease [0.4,0,0.2,1], interval 2400ms
  useEffect(() => {
    const ease = Easing.bezier(0.4, 0, 0.2, 1)
    const t = setInterval(() => {
      const next = (goalIdxCurrent + 1) % GOALS.length
      setGoalIdxExiting(goalIdxCurrent)
      goalExitOpacity.setValue(1)
      goalExitY.setValue(0)
      setGoalIdxCurrent(next)
      goalEnterOpacity.setValue(0)
      goalEnterY.setValue(35)
      Animated.parallel([
        Animated.timing(goalExitOpacity, { toValue: 0, duration: 380, easing: ease, useNativeDriver: true }),
        Animated.timing(goalExitY, { toValue: -35, duration: 380, easing: ease, useNativeDriver: true }),
        Animated.timing(goalEnterOpacity, { toValue: 1, duration: 380, easing: ease, useNativeDriver: true }),
        Animated.timing(goalEnterY, { toValue: 0, duration: 380, easing: ease, useNativeDriver: true }),
      ]).start(() => {
        setGoalIdxExiting(null)
        goalExitOpacity.setValue(0)
      })
    }, 2400)
    return () => clearInterval(t)
  }, [goalIdxCurrent])

  // Shine sweep loop — 1.1s sweep, 3.2s pause, repeat. Matches web glass reflective premium feel.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let active = true
    const ease = Easing.bezier(0.4, 0, 0.6, 1)
    const run = () => {
      if (!active) return
      shineAnim.setValue(0)
      Animated.timing(shineAnim, { toValue: 1, duration: 1100, easing: ease, useNativeDriver: true })
        .start(({ finished }) => { if (finished && active) timer = setTimeout(run, 3200) })
    }
    timer = setTimeout(run, 1800)
    return () => { active = false; clearTimeout(timer); shineAnim.stopAnimation() }
  }, [])

  if (user) {
    // Navigate to app if already signed in
    navigation.reset({ index: 0, routes: [{ name: 'App' }] })
    return null
  }

  const feature = FEATURES[activeFeature]

  const cardWidth = W - 2 * Spacing.lg
  const shineTranslate = shineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(66), cardWidth + 10],
  })

  const makeEntrance = (anim: Animated.Value, dy = 20) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
  })

  return (
    <View style={styles.container}>

      {/* Background: SVG radial-gradient orbs + grid — exact web parity */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">

        {/* Orb 1: purple top-left — radial rgba(168,85,247,0.24)→transparent 65%, matches blur(80px) */}
        <Animated.View style={[styles.orbContainer1, { transform: [{ translateX: orb1X }, { translateY: orb1Y }, { scale: orb1Scale }] }]}>
          <Svg width={W * 0.65} height={W * 0.65}>
            <Defs>
              <SvgRadialGradient id="landingOrb1" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#A855F7" stopOpacity={0.24} />
                <Stop offset="65%" stopColor="#A855F7" stopOpacity={0} />
                <Stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
              </SvgRadialGradient>
            </Defs>
            <Ellipse cx={W * 0.325} cy={W * 0.325} rx={W * 0.325} ry={W * 0.325} fill="url(#landingOrb1)" />
          </Svg>
        </Animated.View>

        {/* Orb 2: cyan bottom-right — radial rgba(34,211,238,0.16)→transparent 65%, matches blur(80px) */}
        <Animated.View style={[styles.orbContainer2, { transform: [{ translateX: orb2X }, { translateY: orb2Y }, { scale: orb2Scale }] }]}>
          <Svg width={W * 0.65} height={W * 0.65}>
            <Defs>
              <SvgRadialGradient id="landingOrb2" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#22D3EE" stopOpacity={0.16} />
                <Stop offset="65%" stopColor="#22D3EE" stopOpacity={0} />
                <Stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
              </SvgRadialGradient>
            </Defs>
            <Ellipse cx={W * 0.325} cy={W * 0.325} rx={W * 0.325} ry={W * 0.325} fill="url(#landingOrb2)" />
          </Svg>
        </Animated.View>

        {/* Orb 3: purple center — radial rgba(168,85,247,0.07)→transparent 70%, matches blur(60px) */}
        <Animated.View style={[styles.orbContainer3, { transform: [{ translateX: orb3X }, { translateY: orb3Y }] }]}>
          <Svg width={W * 0.4} height={W * 0.4}>
            <Defs>
              <SvgRadialGradient id="landingOrb3" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#A855F7" stopOpacity={0.07} />
                <Stop offset="70%" stopColor="#A855F7" stopOpacity={0} />
                <Stop offset="100%" stopColor="#A855F7" stopOpacity={0} />
              </SvgRadialGradient>
            </Defs>
            <Ellipse cx={W * 0.2} cy={W * 0.2} rx={W * 0.2} ry={W * 0.2} fill="url(#landingOrb3)" />
          </Svg>
        </Animated.View>

        {/* Grid: 72px pitch, 2% opacity white lines — matches web grid overlay */}
        <Svg width={W} height={H} style={StyleSheet.absoluteFillObject}>
          {Array.from({ length: Math.ceil(W / 72) + 1 }).map((_, i) => (
            <Line key={`gv${i}`} x1={i * 72} y1={0} x2={i * 72} y2={H} stroke="#ffffff" strokeOpacity={0.02} strokeWidth={1} />
          ))}
          {Array.from({ length: Math.ceil(H / 72) + 1 }).map((_, i) => (
            <Line key={`gh${i}`} x1={0} y1={i * 72} x2={W} y2={i * 72} stroke="#ffffff" strokeOpacity={0.02} strokeWidth={1} />
          ))}
        </Svg>

      </View>

      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>

          {/* Logo */}
          <Animated.View style={[styles.logoBlock, makeEntrance(logoAnim, -18)]}>
            <GradientText style={styles.logoText}>UPLYFT</GradientText>
            <Text style={styles.tagline}>TRAIN. EVOLVE. REPEAT.</Text>
          </Animated.View>

          {/* Headline with cycling goal — slot-machine exit/enter matching web AnimatePresence */}
          <Animated.View style={[styles.headlineBlock, makeEntrance(headlineAnim, 16)]}>
            <Text style={styles.headline}>Your AI coach,{'\n'}built for </Text>
            <View style={styles.goalCycler}>
              {goalIdxExiting !== null && (
                <Animated.View style={[styles.goalAbs, { opacity: goalExitOpacity, transform: [{ translateY: goalExitY }] }]}>
                  <GradientText style={styles.headlineGoal}>{GOALS[goalIdxExiting] + '.'}</GradientText>
                </Animated.View>
              )}
              <Animated.View style={[styles.goalAbs, { opacity: goalEnterOpacity, transform: [{ translateY: goalEnterY }] }]}>
                <GradientText style={styles.headlineGoal}>{GOALS[goalIdxCurrent] + '.'}</GradientText>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Cycling feature card */}
          <Animated.View style={[styles.cardBlock, makeEntrance(cardAnim, 20)]}>
            <Animated.View
              style={[
                styles.featureCard,
                {
                  borderColor: feature.borderColor,
                  opacity: cardOpacity,
                  transform: [{ translateY: cardY }, { scale: cardScale }],
                  // Colored glow — matches web: `0 0 40px rgba(featureColor, 0.22)`
                  shadowColor: feature.color,
                  shadowOffset: { width: 0, height: 0 },
                  shadowRadius: 40,
                  shadowOpacity: 0.22,
                },
              ]}
            >
              <LinearGradient
                colors={[feature.bg1, feature.bg2]}
                style={styles.featureCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Specular top rim — matches web: inset 0 1.5px 0 rgba(255,255,255,0.1) */}
                <View pointerEvents="none" style={styles.specularRim} />
                {/* Shine sweep — animated light pass, non-interactive */}
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shineBeam, { transform: [{ translateX: shineTranslate }] }]}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <View style={styles.featureCardTop}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <View style={[styles.badgePill, { backgroundColor: feature.color + '22', borderColor: feature.color + '44' }]}>
                    <Text style={[styles.badgeText, { color: feature.color }]}>{feature.badge}</Text>
                  </View>
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </LinearGradient>
            </Animated.View>

            {/* Progress dots */}
            <View style={styles.dotsRow}>
              {FEATURES.map((f, i) => (
                <TouchableOpacity key={i} onPress={() => setActiveFeature(i)} activeOpacity={0.8}>
                  <Animated.View style={[
                    styles.dot,
                    {
                      width: i === activeFeature ? 22 : 6,
                      backgroundColor: i === activeFeature ? FEATURES[i].color : 'rgba(255,255,255,0.18)',
                    },
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Stats */}
          <Animated.View style={[styles.statsBlock, makeEntrance(statsAnim, 12)]}>
            {STATS.map(({ value, label }, i) => (
              <View key={label} style={[styles.statRow, i < STATS.length - 1 && styles.statRowBorder]}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </Animated.View>

          {/* CTAs */}
          <Animated.View style={[styles.ctaBlock, makeEntrance(ctaAnim, 14)]}>
            <Animated.View style={[styles.primaryBtnWrap, { transform: [{ scale: btnScale }] }]}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => navigation.navigate('Questionnaire')}
                onPressIn={() => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 4 }).start()}
                onPressOut={() => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }).start()}
              >
                <LinearGradient
                  colors={['#A855F7', '#22D3EE']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>Build My Plan  →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>
                Already have an account?{' '}
                <Text style={styles.ghostBtnAccent}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030014' },
  safe: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: 48,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },

  // Orb containers — pixel coords matching web's percentage positions
  orbContainer1: {
    position: 'absolute',
    top: H * -0.18,
    left: W * -0.12,
  },
  orbContainer2: {
    position: 'absolute',
    bottom: H * -0.22,
    right: W * -0.12,
  },
  orbContainer3: {
    position: 'absolute',
    top: H * 0.35,
    left: W * 0.30,
  },

  // Logo
  logoBlock: { alignItems: 'flex-start', gap: 6 },
  logoText: { fontSize: 52, fontWeight: '900', letterSpacing: -1, lineHeight: 56, color: Colors.purple },
  tagline: {
    fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)',
    letterSpacing: 3, textTransform: 'uppercase',
  },

  // Headline
  headlineBlock: { gap: 0 },
  headline: { fontSize: 26, fontWeight: '900', color: '#fff', lineHeight: 32, letterSpacing: -0.5 },
  headlineGoal: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 32, color: Colors.purple },

  // Feature card
  cardBlock: { gap: Spacing.md },
  featureCard: {
    borderRadius: Radius.xxl, borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
  },
  specularRim: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1.5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shineBeam: {
    position: 'absolute', top: 0, bottom: 0, width: 56,
  },
  featureCardGradient: { padding: Spacing.lg, gap: Spacing.sm, minHeight: 160 },
  featureCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  featureIcon: { fontSize: 36, lineHeight: 46 },
  badgePill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  featureTitle: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  featureDesc: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },

  // Dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 },
  dot: { height: 6, borderRadius: 3 },

  // Stats
  statsBlock: {
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  statRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600' },
  statValue: { fontSize: 13, color: '#fff', fontWeight: '800' },

  // CTAs
  ctaBlock: { gap: Spacing.sm },
  primaryBtnWrap: { borderRadius: Radius.xl, overflow: 'hidden', backgroundColor: 'transparent', shadowColor: '#A855F7', shadowOffset: { width: 0, height: 0 }, shadowRadius: 24, shadowOpacity: 0.5 },
  primaryBtn: { paddingVertical: 18, alignItems: 'center', borderRadius: Radius.xl },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  ghostBtn: { paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  ghostBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  ghostBtnAccent: { color: '#c084fc', fontWeight: '700' },

  // Goal cycler slot machine
  goalCycler: { height: 40, overflow: 'hidden', position: 'relative' },
  goalAbs: { position: 'absolute', top: 0, left: 0, right: 0 },
})
