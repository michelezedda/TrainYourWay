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
import {
  Svg, Defs, RadialGradient, Stop,
  Circle, Rect, Ellipse, Path, G,
} from 'react-native-svg'
import { getExerciseInstructions, type ExerciseInstructions } from '@/lib/gemini'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const SHEET_MAX_H = SCREEN_H * 0.92

// SVG body dimensions – each body panel occupies half the card interior
const SVG_W = Math.min(110, Math.floor((SCREEN_W - 92) / 2))
const SVG_H = Math.round(SVG_W * 298 / 120)

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

// ── Muscle body SVG helpers ────────────────────────────────────────────────────

type MuscleSet = Set<string>

function muscleFill(id: string, p: MuscleSet, s: MuscleSet, pfx: string): string {
  if (p.has(id)) return `url(#pg-${pfx})`
  if (s.has(id)) return `url(#sg-${pfx})`
  return 'transparent'
}

function SvgDefs({ pfx }: { pfx: string }) {
  return (
    <Defs>
      <RadialGradient id={`bg-${pfx}`} cx="50%" cy="30%" r="70%">
        <Stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
        <Stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
      </RadialGradient>
      <RadialGradient id={`pg-${pfx}`} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
        <Stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
        <Stop offset="100%" stopColor="#9333ea" stopOpacity={0.55} />
      </RadialGradient>
      <RadialGradient id={`sg-${pfx}`} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
        <Stop offset="0%" stopColor="#fbbf24" stopOpacity={0.95} />
        <Stop offset="100%" stopColor="#f97316" stopOpacity={0.5} />
      </RadialGradient>
    </Defs>
  )
}

function BodyBase({ pfx }: { pfx: string }) {
  return (
    <G fill={`url(#bg-${pfx})`} stroke="rgba(255,255,255,0.14)" strokeWidth={0.6} strokeLinejoin="round">
      <Circle cx={60} cy={21} r={18.5} />
      <Rect x={53} y={39} width={14} height={13} rx={5} />
      <Ellipse cx={17} cy={68} rx={16} ry={11} />
      <Ellipse cx={103} cy={68} rx={16} ry={11} />
      <Path d="M 36,54 C 24,60 24,72 26,84 L 26,102 C 26,120 30,132 34,144 L 34,158 C 30,166 26,172 24,185 L 24,196 Q 42,202 60,202 Q 78,202 96,196 L 96,185 C 94,172 90,166 86,158 L 86,144 C 90,132 94,120 94,102 L 94,84 C 96,72 96,60 84,54 Z" />
      <Rect x={6} y={62} width={20} height={74} rx={9} />
      <Rect x={94} y={62} width={20} height={74} rx={9} />
      <Rect x={8} y={133} width={17} height={58} rx={7} />
      <Rect x={95} y={133} width={17} height={58} rx={7} />
      <Ellipse cx={17} cy={197} rx={9} ry={6} />
      <Ellipse cx={103} cy={197} rx={9} ry={6} />
      <Rect x={28} y={198} width={28} height={76} rx={12} />
      <Rect x={64} y={198} width={28} height={76} rx={12} />
      <Rect x={30} y={270} width={24} height={62} rx={9} />
      <Rect x={66} y={270} width={24} height={62} rx={9} />
      <Ellipse cx={39} cy={296} rx={15} ry={6} />
      <Ellipse cx={77} cy={296} rx={15} ry={6} />
    </G>
  )
}

function FrontMuscles({ p, s, pfx }: { p: MuscleSet; s: MuscleSet; pfx: string }) {
  const f = (id: string) => muscleFill(id, p, s, pfx)
  return (
    <G strokeWidth={0} stroke="none">
      <Ellipse cx={43} cy={80} rx={18} ry={15} fill={f('chest')} />
      <Ellipse cx={77} cy={80} rx={18} ry={15} fill={f('chest')} />
      <Ellipse cx={17} cy={68} rx={12} ry={10} fill={f('front_delts')} />
      <Ellipse cx={103} cy={68} rx={12} ry={10} fill={f('front_delts')} />
      <Ellipse cx={11} cy={99} rx={8} ry={21} fill={f('biceps')} />
      <Ellipse cx={109} cy={99} rx={8} ry={21} fill={f('biceps')} />
      <Ellipse cx={12} cy={154} rx={7} ry={17} fill={f('forearms')} />
      <Ellipse cx={108} cy={154} rx={7} ry={17} fill={f('forearms')} />
      <Rect x={49} y={106} width={10} height={12} rx={2.5} fill={f('abs')} />
      <Rect x={61} y={106} width={10} height={12} rx={2.5} fill={f('abs')} />
      <Rect x={49} y={121} width={10} height={12} rx={2.5} fill={f('abs')} />
      <Rect x={61} y={121} width={10} height={12} rx={2.5} fill={f('abs')} />
      <Rect x={49} y={136} width={10} height={12} rx={2.5} fill={f('abs')} />
      <Rect x={61} y={136} width={10} height={12} rx={2.5} fill={f('abs')} />
      <Ellipse cx={33} cy={128} rx={9} ry={16} transform="rotate(-15 33 128)" fill={f('obliques')} />
      <Ellipse cx={87} cy={128} rx={9} ry={16} transform="rotate(15 87 128)" fill={f('obliques')} />
      <Ellipse cx={46} cy={166} rx={11} ry={8} fill={f('hip_flexors')} />
      <Ellipse cx={74} cy={166} rx={11} ry={8} fill={f('hip_flexors')} />
      <Ellipse cx={42} cy={232} rx={14} ry={31} fill={f('quads')} />
      <Ellipse cx={78} cy={232} rx={14} ry={31} fill={f('quads')} />
      <Ellipse cx={53} cy={226} rx={8} ry={26} fill={f('adductors')} />
      <Ellipse cx={67} cy={226} rx={8} ry={26} fill={f('adductors')} />
      <Ellipse cx={40} cy={276} rx={8} ry={17} fill={f('calves_front')} />
      <Ellipse cx={78} cy={276} rx={8} ry={17} fill={f('calves_front')} />
    </G>
  )
}

function BackMuscles({ p, s, pfx }: { p: MuscleSet; s: MuscleSet; pfx: string }) {
  const f = (id: string) => muscleFill(id, p, s, pfx)
  return (
    <G strokeWidth={0} stroke="none">
      <Path d="M 60,52 L 94,70 L 80,90 L 60,94 L 40,90 L 26,70 Z" fill={f('traps')} />
      <Ellipse cx={17} cy={68} rx={12} ry={10} fill={f('rear_delts')} />
      <Ellipse cx={103} cy={68} rx={12} ry={10} fill={f('rear_delts')} />
      <Ellipse cx={60} cy={93} rx={18} ry={12} fill={f('rhomboids')} />
      <Path d="M 26,82 L 8,136 L 33,148 L 48,106 Z" fill={f('lats')} />
      <Path d="M 94,82 L 112,136 L 87,148 L 72,106 Z" fill={f('lats')} />
      <Ellipse cx={9} cy={98} rx={9} ry={23} fill={f('triceps')} />
      <Ellipse cx={111} cy={98} rx={9} ry={23} fill={f('triceps')} />
      <Ellipse cx={12} cy={154} rx={7} ry={17} fill={f('forearms')} />
      <Ellipse cx={108} cy={154} rx={7} ry={17} fill={f('forearms')} />
      <Ellipse cx={50} cy={142} rx={9} ry={20} fill={f('lower_back')} />
      <Ellipse cx={70} cy={142} rx={9} ry={20} fill={f('lower_back')} />
      <Ellipse cx={43} cy={172} rx={17} ry={17} fill={f('glutes')} />
      <Ellipse cx={77} cy={172} rx={17} ry={17} fill={f('glutes')} />
      <Ellipse cx={42} cy={232} rx={14} ry={31} fill={f('hamstrings')} />
      <Ellipse cx={78} cy={232} rx={14} ry={31} fill={f('hamstrings')} />
      <Ellipse cx={41} cy={278} rx={11} ry={21} fill={f('calves')} />
      <Ellipse cx={79} cy={278} rx={11} ry={21} fill={f('calves')} />
    </G>
  )
}

function MuscleMap({ primaryMuscles, secondaryMuscles }: {
  primaryMuscles: string[]
  secondaryMuscles: string[]
}) {
  const total = primaryMuscles.length + secondaryMuscles.length
  if (!total) return null

  const p = new Set(primaryMuscles)
  const sec = new Set(secondaryMuscles)

  return (
    <View style={s.muscleCard}>
      {/* Header row */}
      <View style={s.muscleHeader}>
        <Text style={s.muscleTitle}>Muscles Worked</Text>
        <View style={s.muscleCountChip}>
          <Text style={s.muscleCountText}>{total} muscle{total !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Front + Back side by side */}
      <View style={s.muscleSvgRow}>
        <View style={s.muscleSvgCol}>
          <Svg width={SVG_W} height={SVG_H} viewBox="0 0 120 298">
            <SvgDefs pfx="f" />
            <BodyBase pfx="f" />
            <FrontMuscles p={p} s={sec} pfx="f" />
          </Svg>
          <Text style={s.svgLabel}>Front</Text>
        </View>

        <View style={s.muscleDivider} />

        <View style={s.muscleSvgCol}>
          <Svg width={SVG_W} height={SVG_H} viewBox="0 0 120 298">
            <SvgDefs pfx="b" />
            <BodyBase pfx="b" />
            <BackMuscles p={p} s={sec} pfx="b" />
          </Svg>
          <Text style={s.svgLabel}>Back</Text>
        </View>
      </View>

      {/* Chip legend */}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>
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

  const demoQuery = encodeURIComponent(`${name} exercise demo`)
  const ytQuery = encodeURIComponent(`${name} exercise proper form tutorial`)

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={doClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFillObject, s.backdrop, backdropStyle]} />

      {/* Sheet wrapper */}
      <View style={s.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[s.sheet, sheetStyle]}>

          {/* Drag handle */}
          <GestureDetector gesture={panGesture}>
            <View style={s.dragHandle}>
              <View style={s.handleBar} />
            </View>
          </GestureDetector>

          {/* Header - no difficulty chip here */}
          <View style={s.header}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.howToLabel}>How to do</Text>
              <Text style={s.exerciseName} numberOfLines={2}>{name}</Text>
            </View>
            <TouchableOpacity onPress={doClose} style={s.closeBtn} activeOpacity={0.7}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
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
                  <MuscleMap
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

            {/* Watch Demo */}
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${demoQuery}`)}
              style={s.demoBtn}
              activeOpacity={0.85}
            >
              <Text style={s.demoPlay}>▶</Text>
              <Text style={s.demoBtnText}>Watch Demo</Text>
            </TouchableOpacity>

            {/* Watch on YouTube */}
            <TouchableOpacity
              style={s.ytLinkBtn}
              onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${ytQuery}`)}
              activeOpacity={0.8}
            >
              <Text style={s.ytIcon}>▶</Text>
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
    backgroundColor: 'rgba(22,14,48,0.97)',
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
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexShrink: 0,
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

  // Muscle map card
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
    marginBottom: 16,
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
  muscleSvgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  muscleSvgCol: {
    alignItems: 'center',
    gap: 6,
  },
  muscleDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  svgLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.2)',
  },
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

  // Watch Demo button
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
  demoPlay: { color: 'rgba(192,132,252,0.75)', fontSize: 12 },
  demoBtnText: { fontSize: 14, fontWeight: '600', color: 'rgba(192,132,252,0.75)' },

  // Watch on YouTube button
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
  ytIcon: { fontSize: 16, color: '#ef4444' },
  ytLinkText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
})
