import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Animated, Dimensions, Easing,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import GradientText from '@/components/GradientText'
import { db } from '@/lib/db'
import { getStreak, getWeekSessions, getSessions, formatDuration, type WellnessSession } from '@/lib/wellness'
import { useMood, MOODS } from '@/context/MoodContext'
import { useLocale } from '@/context/LocaleContext'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import type { WellnessStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<WellnessStackParamList>

const { width: SCREEN_W } = Dimensions.get('window')
const GRID_GAP = Spacing.sm
const GRID_CARD_W = (SCREEN_W - Spacing.md * 2 - GRID_GAP) / 2

const SESSION_CARDS = [
  { id: 'breathing', icon: '🌬️', label: 'Breathing', desc: 'Calm your nervous system', color: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.25)', accent: '#22D3EE', screen: 'Breathing' as const },
  { id: 'meditation', icon: '🧘', label: 'Meditate', desc: 'Guided mental rest', color: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)', accent: '#818CF8', screen: 'Session' as const, params: { type: 'meditation' as const } },
  { id: 'sleep', icon: '🌙', label: 'Sleep', desc: 'Wind down tonight', color: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', accent: '#6366F1', screen: 'Session' as const, params: { type: 'sleep' as const } },
  { id: 'focus', icon: '🎯', label: 'Focus', desc: 'Deep work sessions', color: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', accent: '#A855F7', screen: 'Focus' as const },
  { id: 'journal', icon: '📔', label: 'Journal', desc: 'Reflect and release', color: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', accent: '#34D399', screen: 'Journal' as const },
  { id: 'affirmation', icon: '✨', label: 'Affirm', desc: 'Positive mindset', color: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', accent: '#FBBF24', screen: 'Affirmations' as const },
  { id: 'reset', icon: '⚡', label: 'Quick Reset', desc: '3-min mental refresh', color: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', accent: '#10B981', screen: 'Session' as const, params: { type: 'reset' as const } },
  { id: 'stress', icon: '🌿', label: 'Stress Relief', desc: 'Release tension', color: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', accent: '#F59E0B', screen: 'Session' as const, params: { type: 'stress' as const } },
] as const

const AFFIRMATIONS = [
  'Your consistency is building something great.',
  'Rest is part of the process, not a break from it.',
  "You don't need to earn your peace today.",
  'Small steps compound into massive results.',
  'Your mind is as important as your body.',
  "Progress isn't always visible, but it's always happening.",
  'You are stronger than you think.',
  'Recovery is where growth really happens.',
  "It's okay to take things one breath at a time.",
  'Every day you show up is a win.',
  'Be patient with yourself. Transformation takes time.',
  'The work you do in silence speaks loudest.',
  "Your effort today is tomorrow's baseline.",
  'Rest is productive. Stillness has power.',
  'You are more resilient than yesterday.',
  'Breathe. You are exactly where you need to be.',
  'Strength includes knowing when to slow down.',
  'Your best looks different every day. Both are valid.',
  'The comeback is always stronger than the setback.',
  'Take care of your mind and your body will follow.',
]

const SESSION_TYPE_LABELS: Record<string, string> = {
  breathing: '🌬️ Breathing',
  meditation: '🧘 Meditation',
  sleep: '🌙 Sleep',
  focus: '🎯 Focus',
  journal: '📔 Journal',
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getDailyAffirmation(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  )
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length]
}

function getRecommendation(weekSessions: WellnessSession[]) {
  const h = new Date().getHours()
  const types = weekSessions.map(s => s.type)
  if (h >= 21 || h < 6) return SESSION_CARDS.find(s => s.id === 'sleep')!
  if (h >= 12 && h <= 14) return SESSION_CARDS.find(s => s.id === 'reset')!
  if (h <= 9 && !types.includes('breathing')) return SESSION_CARDS.find(s => s.id === 'breathing')!
  if (!types.includes('journal')) return SESSION_CARDS.find(s => s.id === 'journal')!
  if (!types.includes('breathing')) return SESSION_CARDS.find(s => s.id === 'breathing')!
  if (!types.includes('meditation')) return SESSION_CARDS.find(s => s.id === 'meditation')!
  return SESSION_CARDS.find(s => s.id === 'focus')!
}

// ── Ambient orb ───────────────────────────────────────────────────────────────

function AmbientOrb({ color, size, style, delay }: {
  color: string; size: number; style?: object; delay: number
}) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.14, duration: 8000, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay }),
        Animated.timing(scale, { toValue: 0.96, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }] }, style]}
    />
  )
}

// ── Mood button ───────────────────────────────────────────────────────────────

function MoodButton({ emoji, label, selected, onPress }: {
  emoji: string; label: string; selected: boolean; onPress: () => void
}) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePress = useCallback(() => {
    if (selected) return
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, speed: 20, bounciness: 18 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
    ]).start()
    onPress()
  }, [selected, onPress])

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={selected ? 1 : 0.8}
        style={[styles.moodBtn, selected && styles.moodBtnSelected]}
      >
        <Text style={styles.moodEmoji}>{emoji}</Text>
        <Text style={[styles.moodLabel, selected && styles.moodLabelSelected]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Fade+slide section ────────────────────────────────────────────────────────

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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function WellnessScreen() {
  const navigation = useNavigation<Nav>()
  const { user } = db.useAuth()
  const { data: profileData } = db.useQuery({
    userProfiles: { $: { where: { userId: user?.id ?? '' } } },
  })
  const userName = (profileData?.userProfiles?.[0] as { name?: string } | undefined)?.name?.split(' ')[0] ?? ''

  const { mood, selectMood } = useMood()
  const { formatDateWithWeekday } = useLocale()
  const [streak, setStreak] = useState(0)
  const [weekSessions, setWeekSessions] = useState<WellnessSession[]>([])
  const [recentSessions, setRecentSessions] = useState<WellnessSession[]>([])

  useEffect(() => {
    const load = async () => {
      const [s, ws, rs] = await Promise.all([getStreak(), getWeekSessions(), getSessions()])
      setStreak(s)
      setWeekSessions(ws)
      setRecentSessions(rs.slice(0, 5))
    }
    void load()
  }, [])

  const weekMinutes = Math.round(weekSessions.reduce((acc, s) => acc + s.duration, 0) / 60)
  const rec = getRecommendation(weekSessions)
  const affirmation = getDailyAffirmation()

  const navigateTo = (card: typeof SESSION_CARDS[number]) => {
    if (card.screen === 'Session') {
      const p = (card as { params?: { type: WellnessStackParamList['Session']['type'] } }).params
      navigation.navigate('Session', p ?? { type: 'meditation' })
    } else {
      navigation.navigate(card.screen as 'Breathing' | 'Focus' | 'Journal' | 'Affirmations')
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Background gradient tint */}
      <LinearGradient
        colors={['#0f0a2e', Colors.bg]}
        locations={[0, 0.45]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Ambient orbs */}
      <View style={styles.orbsContainer} pointerEvents="none">
        <AmbientOrb color="rgba(34,211,238,0.07)" size={320} style={styles.orb1} delay={0} />
        <AmbientOrb color="rgba(99,102,241,0.07)" size={280} style={styles.orb2} delay={4000} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <FadeSlide delay={0}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>
                {getGreeting()}{userName ? `, ${userName}` : ''}
              </Text>
              <GradientText style={styles.titleMask} colors={['#22D3EE', '#818CF8']} end={{ x: 1, y: 1 }}>Mindspace</GradientText>
            </View>
            {streak > 0 && (
              <View style={styles.streakBadge}>
                <Text style={{ fontSize: 14 }}>🔥</Text>
                <Text style={styles.streakText}>{streak} day streak</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>Your space for mental recovery and growth.</Text>
        </FadeSlide>

        {/* Mood check-in */}
        <FadeSlide delay={80}>
          <View style={styles.moodCard}>
            <Text style={styles.moodPrompt}>How are you feeling today?</Text>
            <View style={styles.moodRow}>
              {MOODS.map((m, i) => (
                <MoodButton
                  key={i}
                  emoji={m.emoji}
                  label={m.label}
                  selected={mood === i}
                  onPress={() => selectMood(i)}
                />
              ))}
            </View>
          </View>
        </FadeSlide>

        {/* Stats row */}
        <FadeSlide delay={160}>
          <View style={styles.statsRow}>
            {[
              { label: 'Day streak', value: String(streak), icon: '🔥', color: '#FBBF24' },
              { label: 'Sessions this week', value: String(weekSessions.length), icon: '🧘', color: '#22D3EE' },
              { label: 'Mins this week', value: String(weekMinutes), icon: '⏱️', color: '#818CF8' },
            ].map(({ label, value, icon, color }) => (
              <View key={label} style={styles.statCard}>
                <Text style={{ fontSize: 20, lineHeight: 28, marginBottom: 4 }}>{icon}</Text>
                <Text style={[styles.statValue, { color }]}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </FadeSlide>

        {/* Recommended session */}
        <FadeSlide delay={240}>
          <Text style={styles.sectionLabel}>Recommended for now</Text>
          <TouchableOpacity
            style={[styles.recCard, { backgroundColor: rec.color, borderColor: rec.border }]}
            onPress={() => navigateTo(rec)}
            activeOpacity={0.9}
          >
            <View style={[styles.recIcon, { backgroundColor: rec.color, borderColor: rec.border }]}>
              <Text style={{ fontSize: 28, lineHeight: 36 }}>{rec.icon}</Text>
            </View>
            <View style={styles.recInfo}>
              <Text style={styles.recName}>{rec.label}</Text>
              <Text style={styles.recDesc}>{rec.desc}</Text>
            </View>
            <View style={styles.recArrowWrap}>
              <Text style={styles.recArrow}>›</Text>
            </View>
          </TouchableOpacity>
        </FadeSlide>

        {/* Session grid */}
        <FadeSlide delay={310}>
          <Text style={styles.sectionLabel}>All sessions</Text>
          <View style={styles.grid}>
            {SESSION_CARDS.map(card => (
              <TouchableOpacity
                key={card.id}
                style={[styles.gridCard, { backgroundColor: card.color, borderColor: card.border }]}
                onPress={() => navigateTo(card)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 30, lineHeight: 40, marginBottom: 8 }}>{card.icon}</Text>
                <Text style={styles.gridName}>{card.label}</Text>
                <Text style={styles.gridDesc}>{card.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FadeSlide>

        {/* Today's affirmation */}
        <FadeSlide delay={370}>
          <Text style={styles.sectionLabel}>Today's affirmation</Text>
          <View style={styles.affirmCard}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>✨</Text>
            <Text style={styles.affirmText}>"{affirmation}"</Text>
          </View>
        </FadeSlide>

        {/* Recent sessions / empty state */}
        <FadeSlide delay={420}>
          {recentSessions.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Recent sessions</Text>
              <View style={{ gap: Spacing.sm }}>
                {recentSessions.map(s => (
                  <View key={s.id} style={styles.sessionRow}>
                    <Text style={{ fontSize: 18 }}>{SESSION_TYPE_LABELS[s.type]?.split(' ')[0] ?? '🧘'}</Text>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionType}>{SESSION_TYPE_LABELS[s.type]?.slice(2) ?? s.type}</Text>
                      <Text style={styles.sessionDate}>{formatDateWithWeekday(new Date(s.timestamp))}</Text>
                    </View>
                    <Text style={styles.sessionDur}>{formatDuration(s.duration)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
              <Text style={styles.emptyTitle}>Your wellness journey starts here.</Text>
              <Text style={styles.emptyDesc}>Complete your first session to start building your streak.</Text>
            </View>
          )}
        </FadeSlide>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  orbsContainer: { position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 },
  orb1: { position: 'absolute', top: -80, right: -40 },
  orb2: { position: 'absolute', bottom: 60, left: -40 },
  scroll: { padding: Spacing.md, gap: Spacing.md, zIndex: 1, paddingBottom: 116 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  headerText: { flex: 1 },
  greeting: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  titleMask: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, color: Colors.cyan },
  titleGradient: { borderRadius: 2 },
  subtitle: { ...Typography.body, color: Colors.textMuted, marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: 'rgba(34,211,238,0.1)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.25)', marginTop: 4 },
  streakText: { fontSize: 12, fontWeight: '700', color: '#22D3EE' },

  moodCard: { borderRadius: Radius.xxl, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: 'rgba(34,211,238,0.06)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)' },
  moodPrompt: { fontSize: 12, fontWeight: '700', color: '#22D3EE', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  moodRow: { flexDirection: 'row', gap: 6 },
  moodBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 4 },
  moodBtnSelected: { backgroundColor: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.4)' },
  moodEmoji: { fontSize: 22 },
  moodLabel: { fontSize: 9, fontWeight: '600', color: Colors.textDim },
  moodLabelSelected: { color: '#22D3EE' },

  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 26 },
  statLabel: { fontSize: 10, color: Colors.textDim, marginTop: 2, textAlign: 'center', lineHeight: 13 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -4 },

  recCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl, borderWidth: 1 },
  recIcon: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  recInfo: { flex: 1 },
  recName: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
  recDesc: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  recArrowWrap: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  recArrow: { fontSize: 22, color: 'rgba(255,255,255,0.5)', lineHeight: 26 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  gridCard: { width: GRID_CARD_W, padding: Spacing.md, borderRadius: Radius.xl, borderWidth: 1 },
  gridName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  gridDesc: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },

  affirmCard: { borderRadius: Radius.xxl, paddingHorizontal: 20, paddingVertical: 20, backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  affirmText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, fontStyle: 'italic', lineHeight: 24 },

  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  sessionInfo: { flex: 1 },
  sessionType: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  sessionDate: { ...Typography.caption, color: Colors.textDim, marginTop: 1 },
  sessionDur: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  emptyCard: { alignItems: 'center', paddingVertical: Spacing.xl, borderRadius: Radius.xxl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center' },
  emptyDesc: { ...Typography.caption, color: Colors.textDim, textAlign: 'center', marginTop: 4, lineHeight: 18, paddingHorizontal: Spacing.lg },
})
