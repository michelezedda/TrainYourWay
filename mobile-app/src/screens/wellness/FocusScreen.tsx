import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Animated } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { saveSession, formatDuration } from '@/lib/wellness'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'
import BackButton from '@/components/BackButton'

interface FocusMode {
  id: string
  name: string
  desc: string
  icon: string
  work: number
  rest: number
  accent: string
}

const MODES: FocusMode[] = [
  { id: 'pomodoro', name: 'Pomodoro', desc: '25 min work, 5 min rest', icon: '🍅', work: 25, rest: 5, accent: '#F87171' },
  { id: 'deep', name: 'Deep Work', desc: '50 min work, 10 min rest', icon: '🔬', work: 50, rest: 10, accent: '#818CF8' },
  { id: 'sprint', name: 'Sprint', desc: '15 min work, 3 min rest', icon: '⚡', work: 15, rest: 3, accent: '#FBBF24' },
  { id: 'flow', name: 'Flow State', desc: '90 min uninterrupted', icon: '🌊', work: 90, rest: 0, accent: '#22D3EE' },
]

const WORK_TIPS = [
  'Single-task. One thing at a time.',
  'Close every tab you don\'t need right now.',
  'Put your phone face-down.',
  'Noise-cancelling or silence. Your call.',
  'Write down what you\'re working on before you start.',
  'Drink water. You\'re probably dehydrated.',
  'The goal is progress, not perfection.',
  'Start with the hardest task first.',
]

function pad(n: number) { return String(n).padStart(2, '0') }

type Phase = 'work' | 'rest'
type ViewType = 'setup' | 'session' | 'done'

export default function FocusScreen() {
  const navigation = useNavigation()
  const [view, setView] = useState<ViewType>('setup')
  const [mode, setMode] = useState(MODES[0])
  const [phase, setPhase] = useState<Phase>('work')
  const [remaining, setRemaining] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)
  const [paused, setPaused] = useState(false)
  const [totalWorkSecs, setTotalWorkSecs] = useState(0)
  const [tipIndex] = useState(() => Math.floor(Math.random() * WORK_TIPS.length))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const strokeAnim = useRef(new Animated.Value(0)).current
  const phaseRef = useRef<Phase>('work')
  const remainingRef = useRef(0)
  const modeRef = useRef(mode)

  useEffect(() => { modeRef.current = mode }, [mode])

  const startSession = () => {
    phaseRef.current = 'work'
    remainingRef.current = mode.work * 60
    setPhase('work')
    setRemaining(mode.work * 60)
    setCycleCount(0)
    setTotalWorkSecs(0)
    setPaused(false)
    strokeAnim.setValue(0)
    setView('session')
  }

  useEffect(() => {
    if (view !== 'session' || paused) return
    intervalRef.current = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1)
      const r = remainingRef.current
      setRemaining(r)

      const totalSecs = phaseRef.current === 'work' ? modeRef.current.work * 60 : modeRef.current.rest * 60
      const progress = 1 - r / totalSecs
      strokeAnim.setValue(progress)

      if (r <= 0) {
        if (phaseRef.current === 'work') {
          setTotalWorkSecs(t => t + modeRef.current.work * 60)
          if (modeRef.current.rest === 0) {
            clearInterval(intervalRef.current!)
            setView('done')
            void saveSession('focus', modeRef.current.work * 60)
            return
          }
          phaseRef.current = 'rest'
          remainingRef.current = modeRef.current.rest * 60
          setPhase('rest')
          setRemaining(modeRef.current.rest * 60)
          setCycleCount(c => c + 1)
          strokeAnim.setValue(0)
        } else {
          phaseRef.current = 'work'
          remainingRef.current = modeRef.current.work * 60
          setPhase('work')
          setRemaining(modeRef.current.work * 60)
          strokeAnim.setValue(0)
        }
      }
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, strokeAnim])

  const mm = pad(Math.floor(remaining / 60))
  const ss = pad(remaining % 60)
  const accent = mode.accent

  // ── Setup ──────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTextCol}>
            <GradientText style={styles.title} colors={['#A855F7', '#818CF8']}>Focus</GradientText>
            <Text style={styles.subtitle}>Deep work sessions with structured rest.</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionLabel}>Session mode</Text>
          <View style={{ gap: Spacing.sm, marginBottom: Spacing.xl }}>
            {MODES.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modeCard, mode.id === m.id && { borderColor: m.accent + '60', backgroundColor: m.accent + '12' }]}
                onPress={() => setMode(m)}
                activeOpacity={0.85}
              >
                <View style={[styles.modeIcon, { backgroundColor: m.accent + '18' }]}>
                  <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                </View>
                <View style={styles.modeInfo}>
                  <View style={styles.modeNameRow}>
                    <Text style={styles.modeName}>{m.name}</Text>
                    <View style={[styles.minuteBadge, { backgroundColor: m.accent + '20' }]}>
                      <Text style={[styles.minuteText, { color: m.accent }]}>{m.work} min</Text>
                    </View>
                  </View>
                  <Text style={styles.modeDesc}>{m.desc}</Text>
                </View>
                <View style={[styles.radioCircle, mode.id === m.id && { backgroundColor: m.accent, borderColor: m.accent }]}>
                  {mode.id === m.id && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.tipCard]}>
            <Text style={styles.tipLabel}>Focus tip</Text>
            <Text style={styles.tipText}>{WORK_TIPS[tipIndex]}</Text>
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={startSession}>
            <Text style={styles.startBtnText}>Start Focusing</Text>
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
          <View style={[styles.doneOrb, { backgroundColor: accent + '20', borderColor: accent + '40' }]}>
            <Text style={{ fontSize: 40, lineHeight: 52 }}>{mode.icon}</Text>
          </View>
          <Text style={[styles.doneTag, { color: accent }]}>Session complete</Text>
          <Text style={styles.doneTitle}>You crushed it.</Text>
          <Text style={styles.doneSub}>
            {formatDuration(totalWorkSecs > 0 ? totalWorkSecs : mode.work * 60)} of focused work in the books.
          </Text>
          <View style={styles.statsRow}>
            {[
              { label: 'Work time', value: formatDuration(totalWorkSecs > 0 ? totalWorkSecs : mode.work * 60) },
              { label: 'Cycles', value: cycleCount > 0 ? String(cycleCount) : '1' },
            ].map(({ label, value }) => (
              <View key={label} style={[styles.statCard, { backgroundColor: accent + '12', borderColor: accent + '25' }]}>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.againBtn, { backgroundColor: accent + '30', borderColor: accent + '50' }]} onPress={startSession}>
            <Text style={[styles.againBtnText, { color: '#fff' }]}>Another session</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backWellnessBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backWellnessBtnText}>Back to Mindspace</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Session ────────────────────────────────────────────────────────────────

  const totalSecs = phase === 'work' ? mode.work * 60 : mode.rest * 60
  const progress = 1 - remaining / totalSecs
  const circumference = 2 * Math.PI * 110

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.sessionHeader}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={[styles.modePill, { backgroundColor: accent + '18', borderColor: accent + '35' }]}>
          <Text style={[styles.modePillText, { color: accent }]}>{mode.icon} {mode.name}</Text>
        </View>
        <TouchableOpacity onPress={() => setPaused(p => !p)} style={styles.pauseBtn}>
          <Text style={styles.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sessionBody}>
        {/* Phase label */}
        <Text style={[styles.phaseLabel, { color: phase === 'work' ? accent : '#34D399' }]}>
          {phase === 'work' ? 'Focus time' : 'Rest - recharge'}
        </Text>

        {/* Circular timer */}
        <View style={styles.circleContainer}>
          <View style={styles.svgFallback}>
            <View style={[styles.circleTrack, { borderColor: 'rgba(255,255,255,0.06)' }]} />
            <View style={[styles.circleTime]}>
              <Text style={styles.timerBig}>{mm}:{ss}</Text>
              {cycleCount > 0 && <Text style={styles.timerSub}>{cycleCount} {cycleCount === 1 ? 'cycle' : 'cycles'} done</Text>}
            </View>
          </View>
        </View>

        {/* Tip */}
        <View style={styles.tipBoxSession}>
          <Text style={styles.tipBoxText}>{WORK_TIPS[(tipIndex + cycleCount) % WORK_TIPS.length]}</Text>
        </View>

        <TouchableOpacity onPress={() => { if (intervalRef.current) clearInterval(intervalRef.current); navigation.goBack() }}>
          <Text style={styles.endEarly}>End session early</Text>
        </TouchableOpacity>
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
  title: { fontSize: 26, fontWeight: '900', color: Colors.purple },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 1 },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  modeIcon: { width: 48, height: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  modeInfo: { flex: 1 },
  modeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  modeName: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  minuteBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  minuteText: { fontSize: 11, fontWeight: '700' },
  modeDesc: { ...Typography.caption, color: Colors.textMuted },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.cardBorder, backgroundColor: Colors.cardBg, alignItems: 'center', justifyContent: 'center' },
  tipCard: { backgroundColor: 'rgba(168,85,247,0.08)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', borderRadius: Radius.xl, padding: Spacing.md, gap: 4 },
  tipLabel: { fontSize: 11, fontWeight: '700', color: Colors.purple, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  startBtn: { backgroundColor: 'rgba(168,85,247,0.3)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)', paddingVertical: 20, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  doneCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  doneOrb: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: Spacing.sm },
  doneTag: { fontSize: 11, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  doneTitle: { ...Typography.h2, fontSize: 30, letterSpacing: -0.5 },
  doneSub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  statCard: { flex: 1, borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  statValue: { ...Typography.h3, fontSize: 22 },
  statLabel: { ...Typography.caption, color: Colors.textDim, marginTop: 4 },
  againBtn: { width: '100%', paddingVertical: 16, borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center' },
  againBtnText: { fontSize: 15, fontWeight: '700' },
  backWellnessBtn: { width: '100%', paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  backWellnessBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  sessionBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  sessionBackText: { color: Colors.textMuted, fontSize: 16 },
  modePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
  modePillText: { fontSize: 13, fontWeight: '600' },
  pauseBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  pauseText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  sessionBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.xl },
  phaseLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  circleContainer: { position: 'relative', width: 256, height: 256, alignItems: 'center', justifyContent: 'center' },
  svgFallback: { width: 256, height: 256, alignItems: 'center', justifyContent: 'center' },
  circleTrack: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 8 },
  circleTime: { alignItems: 'center' },
  timerBig: { fontSize: 52, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  timerSub: { ...Typography.caption, color: Colors.textDim, marginTop: 4 },
  tipBoxSession: { padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder, maxWidth: 300 },
  tipBoxText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  endEarly: { ...Typography.bodySmall, color: Colors.textDim },
})
