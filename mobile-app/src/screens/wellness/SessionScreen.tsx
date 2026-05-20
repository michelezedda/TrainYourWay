import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Animated } from 'react-native'
import { Audio } from 'expo-av'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { saveSession, formatDuration } from '@/lib/wellness'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'
import BackButton from '@/components/BackButton'
import type { WellnessStackParamList } from '@/navigation/types'

type Route = RouteProp<WellnessStackParamList, 'Session'>

interface SessionDef {
  type: 'meditation' | 'sleep'
  title: string
  desc: string
  icon: string
  accent: string
  durationOptions: number[]
  scripts: string[][]
}

const SESSIONS: Record<string, SessionDef> = {
  meditation: {
    type: 'meditation',
    title: 'Meditation',
    desc: 'A guided pause for your mind.',
    icon: '🧘',
    accent: '#818CF8',
    durationOptions: [5, 10, 15, 20],
    scripts: [
      [
        'Close your eyes gently. Let your hands rest.',
        'Notice the weight of your body. Breathe naturally.',
        'With each breath out, let the tension ease.',
        "Your mind will wander. That's fine. Gently return.",
        'You have nowhere to be right now. Only here.',
        'Soften your jaw. Your shoulders. Your hands.',
        'Notice the sounds around you without reacting.',
        'You are safe. You are still. You are enough.',
        'When ready, take a deep breath in.',
        'And slowly open your eyes.',
      ],
    ],
  },
  sleep: {
    type: 'sleep',
    title: 'Sleep',
    desc: 'Wind down and prepare for deep rest.',
    icon: '🌙',
    accent: '#6366F1',
    durationOptions: [5, 10, 15, 20, 30],
    scripts: [
      [
        "It's time to let the day go. You did enough.",
        'Lie down comfortably. Let your body feel heavy.',
        'Close your eyes. There is nothing you need to do.',
        'Breathe in slowly... and out even slower.',
        'Your body knows how to rest. Trust it.',
        'Let your legs feel heavy. Your arms too.',
        'Notice the coolness of the air as you inhale.',
        'Warmth as you exhale. In and out.',
        'Tomorrow can wait. Tonight belongs to rest.',
        'Drift down, slowly, into sleep.',
      ],
    ],
  },
  reset: {
    type: 'meditation',
    title: 'Quick Reset',
    desc: 'A 3-minute mental refresh.',
    icon: '⚡',
    accent: '#10B981',
    durationOptions: [3, 5],
    scripts: [
      [
        'Close your eyes. Take one slow breath.',
        'Feel your feet flat on the floor. Grounded.',
        'Let your shoulders drop away from your ears.',
        'Breathe in... and release.',
        'Notice the room around you. You are here.',
        'You are present. Capable. Okay.',
        'One more breath in slowly... and out.',
        'Open your eyes when ready.',
      ],
    ],
  },
  stress: {
    type: 'meditation',
    title: 'Stress Relief',
    desc: 'Release tension, breathe deeply.',
    icon: '🌿',
    accent: '#F59E0B',
    durationOptions: [5, 10, 15],
    scripts: [
      [
        'Notice where the stress is sitting in your body.',
        'Breathe into that tight spot. Gently.',
        'As you exhale, imagine the tension leaving.',
        'Your jaw. Your shoulders. Your hands. Soften.',
        "You don't have to solve anything right now.",
        'This moment is yours. Just breathe.',
        'The pressure is temporary. You are not it.',
        'Let the next breath be a little slower.',
        'And the next even slower still.',
        'Rest here. You are okay.',
      ],
    ],
  },
}

interface Soundscape {
  label: string
  // Replace these with local require() assets for production, e.g. require('@/assets/audio/rain.mp3')
  url: string | null
}

const SOUNDSCAPES: Soundscape[] = [
  { label: 'None', url: null },
  { label: 'White Noise', url: 'https://assets.mixkit.co/music/preview/mixkit-white-noise-ambience-loop-591.mp3' },
  { label: 'Rain', url: 'https://assets.mixkit.co/sfx/preview/mixkit-rain-and-thunder-storm-2403.mp3' },
  { label: 'Forest', url: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-1210.mp3' },
  { label: 'Ocean', url: 'https://assets.mixkit.co/sfx/preview/mixkit-ocean-waves-loop-1196.mp3' },
]

type ViewType = 'setup' | 'session' | 'done'

export default function SessionScreen() {
  const navigation = useNavigation()
  const route = useRoute<Route>()
  const resolvedType = route.params?.type ?? 'meditation'
  const def = SESSIONS[resolvedType] ?? SESSIONS.meditation

  const [view, setView] = useState<ViewType>('setup')
  const [durationSecs, setDurationSecs] = useState((def.durationOptions[1] ?? def.durationOptions[0]) * 60)
  const [scriptIdx] = useState(() => Math.floor(Math.random() * def.scripts.length))
  const [lineIdx, setLineIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)

  const [selectedSound, setSelectedSound] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const orbScale = useRef(new Animated.Value(1)).current
  const orbOpacity = useRef(new Animated.Value(0.85)).current
  const orbAnimRef = useRef<Animated.CompositeAnimation | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)

  const stopSound = useCallback(async () => {
    try {
      await soundRef.current?.stopAsync()
      await soundRef.current?.unloadAsync()
      soundRef.current = null
    } catch {}
  }, [])

  const playSound = useCallback(async (url: string) => {
    await stopSound()
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false })
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { isLooping: true, volume: 0.55 })
      soundRef.current = sound
      await sound.playAsync()
    } catch {}
  }, [stopSound])

  const script = def.scripts[scriptIdx]
  const lineInterval = Math.floor(durationSecs / script.length)
  const { accent } = def

  const startOrbAnim = useCallback(() => {
    orbAnimRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.12, duration: 3000, useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 1, duration: 3000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 0.95, duration: 4000, useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 0.75, duration: 4000, useNativeDriver: true }),
        ]),
      ]),
    )
    orbAnimRef.current.start()
  }, [orbScale, orbOpacity])

  const stopOrbAnim = useCallback(() => {
    orbAnimRef.current?.stop()
  }, [])

  useEffect(() => {
    if (view === 'session' && !paused) {
      startOrbAnim()
      const url = SOUNDSCAPES[selectedSound]?.url
      if (url) void playSound(url)
    } else {
      stopOrbAnim()
      if (paused) void soundRef.current?.pauseAsync().catch(() => {})
    }
    return () => {
      stopOrbAnim()
      void stopSound()
    }
  }, [view, paused, startOrbAnim, stopOrbAnim, selectedSound, playSound, stopSound])

  useEffect(() => {
    if (view !== 'session' || paused) return
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= durationSecs) {
          clearInterval(intervalRef.current!)
          void saveSession(def.type, durationSecs)
          setView('done')
          return next
        }
        setLineIdx(Math.min(Math.floor(next / lineInterval), script.length - 1))
        return next
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, durationSecs, lineInterval, script.length, def.type])

  const remaining = durationSecs - elapsed
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const progress = elapsed / durationSecs

  // ── Setup ──────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTextCol}>
            <GradientText style={styles.title} colors={[accent, 'rgba(34,211,238,0.9)']}>{def.title}</GradientText>
            <Text style={styles.subtitle}>{def.desc}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.heroBanner, { borderColor: accent + '25', backgroundColor: accent + '08' }]}>
            <Text style={[styles.heroIcon, { textShadowColor: accent, textShadowRadius: 20 }]}>{def.icon}</Text>
            <Text style={styles.heroHint}>
              {def.type === 'sleep'
                ? 'Get into bed. Dim your lights. Let go of the day.'
                : 'Find a quiet spot. Sit comfortably or lie down.'}
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Session length</Text>
          <View style={styles.durationRow}>
            {def.durationOptions.map(mins => (
              <TouchableOpacity
                key={mins}
                style={[styles.durationBtn, durationSecs === mins * 60 && { borderColor: accent + '60', backgroundColor: accent + '20' }]}
                onPress={() => setDurationSecs(mins * 60)}
              >
                <Text style={[styles.durationText, durationSecs === mins * 60 && { color: accent }]}>{mins} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Soundscape</Text>
          <View style={styles.soundRow}>
            {SOUNDSCAPES.map((s, i) => (
              <TouchableOpacity
                key={s.label}
                style={[styles.soundChip, selectedSound === i && { borderColor: accent + '70', backgroundColor: accent + '20' }]}
                onPress={() => setSelectedSound(i)}
                activeOpacity={0.8}
              >
                <Text style={[styles.soundChipText, selectedSound === i && { color: accent }]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.startBtn, { borderColor: accent + '50', backgroundColor: accent + '30' }]}
            onPress={() => { setElapsed(0); setLineIdx(0); setPaused(false); setView('session') }}
          >
            <Text style={styles.startBtnText}>Begin {def.title}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Done ───────────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.doneCenter}>
          <View style={[styles.doneOrb, { borderColor: accent + '50', backgroundColor: accent + '18' }]}>
            <Text style={{ fontSize: 48, lineHeight: 60 }}>{def.icon}</Text>
          </View>
          <Text style={[styles.doneTag, { color: accent }]}>Complete</Text>
          <Text style={styles.doneTitle}>{def.type === 'sleep' ? 'Rest well.' : 'Beautiful.'}</Text>
          <Text style={styles.doneSub}>
            {formatDuration(durationSecs)} of {def.title.toLowerCase()}.{' '}
            {def.type === 'meditation' ? 'Your mind just got some much-needed space.' : 'Let go and drift off.'}
          </Text>
          <TouchableOpacity
            style={[styles.backBtn2, { borderColor: accent + '50', backgroundColor: accent + '25' }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backBtn2Text}>Back to Mindspace</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Session ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: accent }]} />
      </View>

      {/* Header */}
      <View style={styles.sessionHeader}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.timerBadge}>
          <View style={[styles.timerDot, { backgroundColor: paused ? Colors.textDim : accent }]} />
          <Text style={styles.timerText}>{mm}:{ss}</Text>
        </View>
        <TouchableOpacity onPress={() => setPaused(p => !p)} style={styles.pauseBtn}>
          <Text style={styles.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
      </View>

      {/* Orb */}
      <View style={styles.orbArea}>
        <Animated.View style={[styles.orbOuter, { transform: [{ scale: orbScale }], opacity: orbOpacity, borderColor: accent + '30', backgroundColor: accent + '08' }]} />
        <Animated.View style={[styles.orbInner, { transform: [{ scale: orbScale }], borderColor: accent + '22' }]} />
        <View style={[styles.orbCore, { backgroundColor: accent + '15', borderColor: accent + '25' }]}>
          <Text style={{ fontSize: 48, lineHeight: 60 }}>{def.icon}</Text>
        </View>
      </View>

      {/* Guided text */}
      <View style={styles.scriptContainer}>
        <Text style={styles.scriptText}>{script[lineIdx]}</Text>
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {script.map((_, i) => (
          <View key={i} style={[styles.dot, { width: i === lineIdx ? 20 : 5, backgroundColor: i <= lineIdx ? accent : 'rgba(255,255,255,0.12)' }]} />
        ))}
      </View>

      <TouchableOpacity onPress={() => { if (intervalRef.current) clearInterval(intervalRef.current); navigation.goBack() }} style={styles.endEarlyBtn}>
        <Text style={styles.endEarlyText}>End session early</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTextCol: { flex: 1 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '900' },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  heroBanner: { alignItems: 'center', paddingVertical: Spacing.xxl, borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.md },
  heroIcon: { fontSize: 60, lineHeight: 76, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  heroHint: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl, lineHeight: 22 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  durationBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBg },
  durationText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  startBtn: { paddingVertical: 20, borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  doneOrb: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginBottom: Spacing.sm },
  doneTag: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  doneTitle: { ...Typography.h2, fontSize: 36, letterSpacing: -1 },
  doneSub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  backBtn2: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center', marginTop: 8 },
  backBtn2Text: { color: '#fff', fontSize: 15, fontWeight: '700' },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: 2 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  sessionBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  sessionBackText: { color: Colors.textMuted, fontSize: 16 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  timerDot: { width: 6, height: 6, borderRadius: 3 },
  timerText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  pauseBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  pauseText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  orbArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbOuter: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 1 },
  orbInner: { position: 'absolute', width: 196, height: 196, borderRadius: 98, borderWidth: 1 },
  orbCore: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  scriptContainer: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, minHeight: 80, justifyContent: 'center' },
  scriptText: { ...Typography.body, fontSize: 19, color: Colors.textSecondary, textAlign: 'center', lineHeight: 30, fontStyle: 'italic' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: Spacing.md },
  dot: { height: 5, borderRadius: 3 },
  endEarlyBtn: { paddingVertical: 12, alignItems: 'center' },
  endEarlyText: { ...Typography.bodySmall, color: Colors.textDim },
  soundRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  soundChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBg },
  soundChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
})
