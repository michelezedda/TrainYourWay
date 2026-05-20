import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Animated } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { saveSession, formatDuration } from '@/lib/wellness'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'
import BackButton from '@/components/BackButton'

interface Phase {
  label: string
  instruction: string
  duration: number
  targetScale: number
  isExpand: boolean
}

interface Pattern {
  id: string
  name: string
  desc: string
  icon: string
  timing: string
  phases: Phase[]
  accent: string
}

const PATTERNS: Pattern[] = [
  {
    id: 'calm',
    name: 'Calm Breath',
    desc: 'Slow the mind and melt tension',
    icon: '🌊',
    timing: '4s in - 6s out',
    accent: '#22D3EE',
    phases: [
      { label: 'Inhale', instruction: 'Breathe in slowly through your nose', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Exhale', instruction: 'Let it go, fully and gently', duration: 6, targetScale: 0.28, isExpand: false },
    ],
  },
  {
    id: 'box',
    name: 'Box Breathing',
    desc: 'Used by athletes and Navy SEALs',
    icon: '⬜',
    timing: '4s - 4s - 4s - 4s',
    accent: '#818CF8',
    phases: [
      { label: 'Inhale', instruction: 'Fill your lungs completely', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Hold', instruction: 'Hold at the top, stay still', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Exhale', instruction: 'Release slowly, all the way out', duration: 4, targetScale: 0.28, isExpand: false },
      { label: 'Hold', instruction: 'Rest here at the bottom', duration: 4, targetScale: 0.28, isExpand: false },
    ],
  },
  {
    id: '478',
    name: '4-7-8',
    desc: 'Activate your rest response',
    icon: '🌙',
    timing: '4s - 7s - 8s',
    accent: '#6366F1',
    phases: [
      { label: 'Inhale', instruction: 'Breathe in through your nose', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Hold', instruction: 'Hold the breath, be still', duration: 7, targetScale: 1, isExpand: true },
      { label: 'Exhale', instruction: 'Exhale fully through your mouth', duration: 8, targetScale: 0.28, isExpand: false },
    ],
  },
]

type ViewType = 'setup' | 'session' | 'done'

export default function BreathingScreen() {
  const navigation = useNavigation()
  const [view, setView] = useState<ViewType>('setup')
  const [pattern, setPattern] = useState(PATTERNS[0])
  const [durationSecs, setDurationSecs] = useState(180)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cycleCount, setCycleCount] = useState(0)
  const [currentPhaseLabel, setCurrentPhaseLabel] = useState('')
  const [currentInstruction, setCurrentInstruction] = useState('')
  const orbScale = useRef(new Animated.Value(0.28)).current
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseIdxRef = useRef(0)
  const phaseElapsedRef = useRef(0)

  const currentPhase = pattern.phases[phaseIdx]
  const progress = totalElapsed / durationSecs

  const animateOrb = useCallback((toScale: number, duration: number) => {
    Animated.timing(orbScale, {
      toValue: toScale,
      duration: duration * 1000,
      useNativeDriver: true,
    }).start()
  }, [orbScale])

  useEffect(() => {
    if (view === 'session' && !paused) {
      const p = pattern.phases[phaseIdxRef.current]
      setCurrentPhaseLabel(p.label)
      setCurrentInstruction(p.instruction)
      animateOrb(p.targetScale, p.duration)
    }
  }, [view, paused, pattern, animateOrb])

  useEffect(() => {
    if (view !== 'session' || paused) return
    let phaseTime = phaseElapsedRef.current

    intervalRef.current = setInterval(() => {
      setTotalElapsed(t => {
        if (t + 1 >= durationSecs) {
          clearInterval(intervalRef.current!)
          setView('done')
          void saveSession('breathing', durationSecs)
          return t + 1
        }
        return t + 1
      })
      phaseTime += 1
      phaseElapsedRef.current = phaseTime
      setPhaseElapsed(phaseTime)

      if (phaseTime >= pattern.phases[phaseIdxRef.current].duration) {
        phaseTime = 0
        phaseElapsedRef.current = 0
        const nextIdx = (phaseIdxRef.current + 1) % pattern.phases.length
        if (nextIdx === 0) setCycleCount(c => c + 1)
        phaseIdxRef.current = nextIdx
        setPhaseIdx(nextIdx)
        const nextPhase = pattern.phases[nextIdx]
        setCurrentPhaseLabel(nextPhase.label)
        setCurrentInstruction(nextPhase.instruction)
        animateOrb(nextPhase.targetScale, nextPhase.duration)
      }
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, pattern, durationSecs, animateOrb])

  const startSession = () => {
    phaseIdxRef.current = 0
    phaseElapsedRef.current = 0
    setPhaseIdx(0)
    setPhaseElapsed(0)
    setTotalElapsed(0)
    setCycleCount(0)
    setPaused(false)
    setCurrentPhaseLabel(pattern.phases[0].label)
    setCurrentInstruction(pattern.phases[0].instruction)
    orbScale.setValue(0.28)
    setView('session')
  }

  const remainingSecs = durationSecs - totalElapsed
  const mm = String(Math.floor(remainingSecs / 60)).padStart(2, '0')
  const ss = String(remainingSecs % 60).padStart(2, '0')

  // ── Setup ──────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTextCol}>
            <GradientText style={styles.title} colors={['#22D3EE', '#818CF8']}>Breathing</GradientText>
            <Text style={styles.subtitle}>Calm your body and mind with guided breath.</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>Choose a technique</Text>
          <View style={{ gap: Spacing.sm, marginBottom: Spacing.xl }}>
            {PATTERNS.map(p => {
              const sel = pattern.id === p.id
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.patternCard, sel && { borderColor: p.accent, backgroundColor: 'rgba(255,255,255,0.06)' }]}
                  onPress={() => setPattern(p)}
                  activeOpacity={0.85}
                >
                  <View style={styles.patternLeft}>
                    <Text style={{ fontSize: 24 }}>{p.icon}</Text>
                    <View style={styles.patternInfo}>
                      <Text style={styles.patternName}>{p.name}</Text>
                      <Text style={styles.patternDesc}>{p.desc}</Text>
                    </View>
                  </View>
                  <View style={[styles.timingBadge, sel && { backgroundColor: p.accent + '25', borderColor: p.accent + '60' }]}>
                    <Text style={[styles.timingText, sel && { color: p.accent }]}>{p.timing}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.durationRow}>
            {[60, 180, 300, 600].map(sec => (
              <TouchableOpacity
                key={sec}
                style={[styles.durationBtn, durationSecs === sec && { borderColor: pattern.accent + '80', backgroundColor: pattern.accent + '20' }]}
                onPress={() => setDurationSecs(sec)}
              >
                <Text style={[styles.durationText, durationSecs === sec && { color: pattern.accent }]}>{sec / 60} min</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={[styles.startBtn, { borderColor: pattern.accent + '60', backgroundColor: pattern.accent + '25' }]} onPress={startSession}>
            <Text style={styles.startBtnText}>Begin Session</Text>
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
          <View style={[styles.doneOrb, { borderColor: pattern.accent + '50', backgroundColor: pattern.accent + '20' }]}>
            <Text style={{ fontSize: 48, lineHeight: 60 }}>{pattern.icon}</Text>
          </View>
          <Text style={[styles.doneTag, { color: pattern.accent }]}>Session complete</Text>
          <Text style={styles.doneTitle}>Well done.</Text>
          <Text style={styles.doneStats}>
            {formatDuration(durationSecs)} - {cycleCount} cycle{cycleCount !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.doneSub}>Your nervous system has calmed. Carry this stillness with you.</Text>
          <TouchableOpacity style={[styles.againBtn, { borderColor: pattern.accent + '50', backgroundColor: pattern.accent + '18' }]} onPress={startSession}>
            <Text style={[styles.againBtnText, { color: pattern.accent }]}>Breathe again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backWellnessBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backWellnessBtnText}>Back to Mindspace</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Session ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { position: 'relative' }]}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: pattern.accent }]} />
      </View>

      {/* Header */}
      <View style={styles.sessionHeader}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.timerBadge}>
          <View style={[styles.timerDot, { backgroundColor: paused ? Colors.textDim : pattern.accent }]} />
          <Text style={styles.timerText}>{mm}:{ss}</Text>
        </View>
        <TouchableOpacity onPress={() => setPaused(p => !p)} style={styles.pauseBtn}>
          <Text style={styles.pauseText}>{paused ? '▶' : '⏸'}</Text>
        </TouchableOpacity>
      </View>

      {/* Orb */}
      <View style={styles.orbContainer}>
        <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }], backgroundColor: pattern.accent + 'CC', shadowColor: pattern.accent }]} />
      </View>

      {/* Phase label */}
      <View style={styles.phaseContainer}>
        <Text style={[styles.phaseLabel, { color: pattern.accent }]}>{currentPhaseLabel}</Text>
        <Text style={styles.phaseInstruction}>{currentInstruction}</Text>
        {cycleCount > 0 && <Text style={styles.cycleCount}>{cycleCount} cycle{cycleCount !== 1 ? 's' : ''} completed</Text>}
      </View>

      {/* Phase progress */}
      <View style={styles.phaseTrack}>
        <View style={[styles.phaseFill, { width: `${(phaseElapsed / (currentPhase?.duration ?? 1)) * 100}%` as any, backgroundColor: pattern.accent + '80' }]} />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTextCol: { flex: 1 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '900', color: '#22D3EE' },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  patternCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  patternLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  patternInfo: { flex: 1 },
  patternName: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  patternDesc: { ...Typography.bodySmall, color: Colors.textMuted },
  timingBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  timingText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  durationRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  durationBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBg, alignItems: 'center' },
  durationText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  startBtn: { paddingVertical: 20, borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  doneOrb: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginBottom: Spacing.sm },
  doneTag: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  doneTitle: { ...Typography.h2, fontSize: 36, letterSpacing: -1 },
  doneStats: { ...Typography.body, color: Colors.textMuted },
  doneSub: { ...Typography.bodySmall, color: Colors.textDim, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  againBtn: { width: '100%', paddingVertical: 16, borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center' },
  againBtnText: { fontSize: 15, fontWeight: '700' },
  backWellnessBtn: { width: '100%', paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  backWellnessBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: 2 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  sessionBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  sessionBackText: { color: Colors.textMuted, fontSize: 16 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  timerDot: { width: 6, height: 6, borderRadius: 3 },
  timerText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  pauseBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  pauseText: { color: Colors.textMuted, fontSize: 14 },
  orbContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orb: { width: 160, height: 160, borderRadius: 80, shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  phaseContainer: { alignItems: 'center', paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.sm },
  phaseLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  phaseInstruction: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  cycleCount: { ...Typography.caption, color: Colors.textDim },
  phaseTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)' },
  phaseFill: { height: 3 },
})
