import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions, Linking, ActivityIndicator,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { LinearGradient } from 'expo-linear-gradient'
import { getExerciseInstructions, type ExerciseInstructions } from '@/lib/gemini'

const { height: SCREEN_H } = Dimensions.get('window')
const SHEET_MAX_H = SCREEN_H * 0.92

// ── Difficulty config ─────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  Beginner: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.22)', filled: 1 },
  Intermediate: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', filled: 2 },
  Advanced: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.22)', filled: 3 },
} as const

const MUSCLE_DISPLAY: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', rear_delts: 'Rear Delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', hip_flexors: 'Hip Flexors',
  adductors: 'Inner Thigh', quads: 'Quads', calves_front: 'Tibialis',
  traps: 'Traps', rhomboids: 'Rhomboids', lats: 'Lats',
  lower_back: 'Lower Back', glutes: 'Glutes', hamstrings: 'Hamstrings',
  calves: 'Calves',
}

function displayMuscle(id: string) {
  return MUSCLE_DISPLAY[id] ?? id.replace(/_/g, ' ')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>
}

function MuscleChips({
  primaryMuscles, secondaryMuscles,
}: { primaryMuscles: string[]; secondaryMuscles: string[] }) {
  const total = primaryMuscles.length + secondaryMuscles.length
  if (!total) return null
  return (
    <View style={s.muscleCard}>
      <View style={s.muscleHeader}>
        <Text style={s.muscleTitle}>Muscles Worked</Text>
        <View style={s.muscleCountChip}>
          <Text style={s.muscleCountText}>{total} muscle{total !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      {primaryMuscles.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={s.primaryLabel}>Primary</Text>
          <View style={s.chipRow}>
            {primaryMuscles.map(id => (
              <View key={id} style={s.chipPrimary}>
                <Text style={s.chipPrimaryText}>{displayMuscle(id)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {secondaryMuscles.length > 0 && (
        <View>
          <Text style={s.secondaryLabel}>Secondary</Text>
          <View style={s.chipRow}>
            {secondaryMuscles.map(id => (
              <View key={id} style={s.chipSecondary}>
                <Text style={s.chipSecondaryText}>{displayMuscle(id)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

function DifficultyCard({ difficulty, reason }: {
  difficulty?: ExerciseInstructions['difficulty']
  reason?: string
}) {
  if (!difficulty) return null
  const cfg = DIFFICULTY_CONFIG[difficulty]
  return (
    <View style={[s.diffCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <View style={s.diffRow}>
        <View style={s.diffDots}>
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                s.diffDot,
                i <= cfg.filled
                  ? { backgroundColor: cfg.color, width: 10, height: 10 }
                  : { backgroundColor: 'rgba(255,255,255,0.1)', width: 8, height: 8 },
              ]}
            />
          ))}
        </View>
        <Text style={[s.diffLabel, { color: cfg.color }]}>{difficulty}</Text>
      </View>
      {reason ? <Text style={s.diffReason}>{reason}</Text> : null}
    </View>
  )
}

function SetupCard({ setup }: { setup: string }) {
  return (
    <View style={s.setupCard}>
      <View style={s.setupIconBox}>
        <Text style={{ fontSize: 16 }}>🎯</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.setupLabel}>Starting Position</Text>
        <Text style={s.setupText}>{setup}</Text>
      </View>
    </View>
  )
}

function StepsSection({ steps }: { steps: ExerciseInstructions['steps'] }) {
  return (
    <View>
      <SectionLabel>How to do it</SectionLabel>
      <View style={{ gap: 12 }}>
        {steps.map(({ step, title, description }) => (
          <View key={step} style={s.stepRow}>
            <LinearGradient
              colors={['#A855F7', '#22D3EE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.stepNum}
            >
              <Text style={s.stepNumText}>{step}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>{title}</Text>
              <Text style={s.stepDesc}>{description}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function TipsSection({ tips }: { tips: string[] }) {
  if (!tips.length) return null
  return (
    <View style={s.tipsCard}>
      <Text style={s.tipsLabel}>Pro Tips</Text>
      <View style={{ gap: 10 }}>
        {tips.map((tip, i) => (
          <View key={i} style={s.tipRow}>
            <Text style={s.tipStar}>✦</Text>
            <Text style={s.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function MistakesSection({ avoid }: { avoid: string[] }) {
  if (!avoid.length) return null
  return (
    <View style={s.mistakesCard}>
      <Text style={s.mistakesLabel}>Common Mistakes</Text>
      <View style={{ gap: 10 }}>
        {avoid.map((item, i) => (
          <View key={i} style={s.mistakeRow}>
            <Text style={s.mistakeX}>✕</Text>
            <Text style={s.mistakeText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function LoadingSpinner() {
  return (
    <View style={s.loadingWrap}>
      <View style={s.spinnerOuter}>
        <ActivityIndicator color="#A855F7" size="large" />
      </View>
      <Text style={s.loadingTitle}>Analyzing exercise...</Text>
      <Text style={s.loadingSubtitle}>Loading form, muscles, and tips</Text>
    </View>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  name: string
  visible: boolean
  onClose: () => void
}

export default function ExerciseModal({ name, visible, onClose }: Props) {
  const [instructions, setInstructions] = useState<ExerciseInstructions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showDemo, setShowDemo] = useState(false)

  const translateY = useSharedValue(SCREEN_H)
  const backdropOpacity = useSharedValue(0)
  const dragY = useSharedValue(0)

  const doClose = useCallback(() => {
    translateY.value = withTiming(SCREEN_H, { duration: 220 }, () => runOnJS(onClose)())
    backdropOpacity.value = withTiming(0, { duration: 220 })
  }, [onClose])

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { stiffness: 420, damping: 42 })
      backdropOpacity.value = withTiming(1, { duration: 220 })
      dragY.value = 0
      setLoading(true)
      setError(false)
      setInstructions(null)
      setShowDemo(false)
      getExerciseInstructions(name)
        .then(setInstructions)
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }, [visible, name])

  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      if (e.translationY > 0) {
        dragY.value = e.translationY
      }
    })
    .onEnd(e => {
      if (e.velocityY > 450 || e.translationY > 140) {
        runOnJS(doClose)()
      } else {
        dragY.value = withSpring(0, { stiffness: 500, damping: 40 })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dragY.value,
      [0, 200],
      [backdropOpacity.value, 0],
      Extrapolation.CLAMP,
    ),
  }))

  const query = encodeURIComponent(`${name} exercise proper form tutorial`)

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={doClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, s.backdrop, backdropStyle]} />

      {/* Sheet wrapper - positioned at bottom */}
      <View style={s.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[s.sheet, sheetStyle]}>

          {/* Drag handle */}
          <GestureDetector gesture={panGesture}>
            <View style={s.dragHandle}>
              <View style={s.handleBar} />
            </View>
          </GestureDetector>

          {/* Header */}
          <View style={s.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.howToLabel}>How to do</Text>
              <Text style={s.exerciseName} numberOfLines={2}>{name}</Text>
            </View>
            <View style={s.headerRight}>
              {instructions?.difficulty && (
                <View style={[
                  s.diffChip,
                  {
                    backgroundColor: DIFFICULTY_CONFIG[instructions.difficulty].bg,
                    borderColor: DIFFICULTY_CONFIG[instructions.difficulty].border,
                  },
                ]}>
                  <Text style={[s.diffChipText, { color: DIFFICULTY_CONFIG[instructions.difficulty].color }]}>
                    {instructions.difficulty}
                  </Text>
                </View>
              )}
              <TouchableOpacity onPress={doClose} style={s.closeBtn} activeOpacity={0.7}>
                <Text style={s.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scrollable content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces
          >
            {loading && <LoadingSpinner />}

            {!loading && error && (
              <View style={s.errorWrap}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
                <Text style={s.errorTitle}>Could not load instructions.</Text>
                <Text style={s.errorSub}>Try the YouTube link below.</Text>
              </View>
            )}

            {!loading && instructions && (
              <>
                {(instructions.primaryMuscles?.length > 0 || instructions.secondaryMuscles?.length > 0) && (
                  <MuscleChips
                    primaryMuscles={instructions.primaryMuscles ?? []}
                    secondaryMuscles={instructions.secondaryMuscles ?? []}
                  />
                )}

                <DifficultyCard difficulty={instructions.difficulty} reason={instructions.difficultyReason} />

                {instructions.setup ? <SetupCard setup={instructions.setup} /> : null}

                {instructions.steps?.length > 0 && <StepsSection steps={instructions.steps} />}

                {instructions.tips?.length > 0 && <TipsSection tips={instructions.tips} />}

                {instructions.avoid?.length > 0 && <MistakesSection avoid={instructions.avoid} />}
              </>
            )}

            {/* Watch Demo toggle */}
            <TouchableOpacity
              onPress={() => setShowDemo(d => !d)}
              style={[s.demoBtn, showDemo && s.demoBtnActive]}
              activeOpacity={0.85}
            >
              <Text style={s.demoPlay}>▶</Text>
              <Text style={[s.demoBtnText, showDemo && s.demoBtnTextActive]}>
                {showDemo ? 'Hide Demo' : 'Watch Demo'}
              </Text>
            </TouchableOpacity>

            {showDemo && (
              <TouchableOpacity
                style={s.youtubeBtn}
                onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${query}`)}
                activeOpacity={0.85}
              >
                <Text style={s.youtubeIcon}>▶</Text>
                <Text style={s.youtubeBtnText}>Open on YouTube</Text>
              </TouchableOpacity>
            )}

            {/* YouTube link always shown */}
            <TouchableOpacity
              style={s.ytLinkBtn}
              onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${query}`)}
              activeOpacity={0.8}
            >
              <Text style={[s.youtubeIcon, { color: '#ef4444', fontSize: 16 }]}>▶</Text>
              <Text style={s.ytLinkText}>Watch on YouTube</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(3,0,20,0.82)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_MAX_H,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(14,7,30,0.99)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  howToLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: 'rgba(168,85,247,0.65)',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  diffChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  diffChipText: { fontSize: 10, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '700' },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },

  // Loading
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  spinnerOuter: { marginBottom: 4 },
  loadingTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  loadingSubtitle: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },

  // Error
  errorWrap: { alignItems: 'center', paddingVertical: 40 },
  errorTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  errorSub: { color: 'rgba(255,255,255,0.25)', fontSize: 12 },

  // Muscles
  muscleCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  muscleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  muscleTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.3)',
  },
  muscleCountChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
  },
  muscleCountText: { fontSize: 10, fontWeight: '600', color: 'rgba(168,85,247,0.8)' },
  primaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(244,63,94,0.7)',
    marginBottom: 8,
  },
  secondaryLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(251,191,36,0.65)',
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(244,63,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.28)',
  },
  chipPrimaryText: { fontSize: 11, fontWeight: '600', color: '#f87171' },
  chipSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
  },
  chipSecondaryText: { fontSize: 11, fontWeight: '600', color: '#fcd34d' },

  // Difficulty
  diffCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diffDots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  diffDot: { borderRadius: 5 },
  diffLabel: { fontSize: 13, fontWeight: '700' },
  diffReason: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginTop: 10 },

  // Setup
  setupCard: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(168,85,247,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.18)',
  },
  setupIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    flexShrink: 0,
  },
  setupLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(192,132,252,0.8)',
    marginBottom: 6,
  },
  setupText: { fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 20 },

  // Section label
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.28)',
    marginBottom: 12,
  },

  // Steps
  stepRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
  },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 20 },
  stepDesc: { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginTop: 2 },

  // Tips
  tipsCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(34,211,238,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.14)',
  },
  tipsLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: 'rgba(34,211,238,0.7)',
    marginBottom: 12,
  },
  tipRow: { flexDirection: 'row', gap: 10 },
  tipStar: { color: '#22d3ee', fontSize: 10, marginTop: 3, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },

  // Mistakes
  mistakesCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.14)',
  },
  mistakesLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: 'rgba(239,68,68,0.7)',
    marginBottom: 12,
  },
  mistakeRow: { flexDirection: 'row', gap: 10 },
  mistakeX: { color: '#ef4444', fontSize: 10, marginTop: 3, flexShrink: 0 },
  mistakeText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },

  // Demo / YouTube buttons
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  demoBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.45)',
  },
  demoPlay: { color: 'rgba(192,132,252,0.75)', fontSize: 12 },
  demoBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(192,132,252,0.75)' },
  demoBtnTextActive: { color: '#c084fc' },

  youtubeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  youtubeIcon: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  youtubeBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(239,68,68,0.8)' },

  ytLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  ytLinkText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
})
