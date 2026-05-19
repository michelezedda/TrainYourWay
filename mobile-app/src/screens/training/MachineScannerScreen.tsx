import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Image, Animated, Easing,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { analyzeMachineImage, type MachineAnalysis } from '@/lib/gemini'
import { Colors, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'

type State = 'idle' | 'loading' | 'result' | 'error'
type ResultTab = 'guide' | 'muscles' | 'safety'

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Identified', medium: 'Likely match', low: 'Uncertain',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#34d399', medium: '#f59e0b', low: '#94a3b8',
}

const MUSCLE_EMOJI_MAP: [string, string][] = [
  ['pec', '💪'], ['chest', '💪'],
  ['lat', '🔹'], ['rhom', '🔹'], ['trap', '🔹'],
  ['delt', '🔸'], ['shoulder', '🔸'],
  ['bicep', '💪'], ['tricep', '💪'],
  ['quad', '🦵'], ['hamstring', '🦵'], ['glute', '🍑'], ['calf', '🦵'], ['leg', '🦵'],
  ['core', '🎯'], ['ab', '🎯'],
  ['back', '🔹'], ['forearm', '💪'],
]

function getMuscleEmoji(muscle: string): string {
  const lower = muscle.toLowerCase()
  for (const [key, emoji] of MUSCLE_EMOJI_MAP) {
    if (lower.includes(key)) return emoji
  }
  return '💪'
}

const TABS: { id: ResultTab; label: string }[] = [
  { id: 'guide', label: 'Guide' },
  { id: 'muscles', label: 'Muscles' },
  { id: 'safety', label: 'Safety' },
]

const FEATURE_CARDS = [
  { icon: '🤖', label: 'AI Recognition', desc: 'Identifies any gym machine from a photo' },
  { icon: '📋', label: 'Step-by-step Guide', desc: 'Setup and exercise instructions' },
  { icon: '💪', label: 'Muscle Map', desc: 'Primary and secondary muscles worked' },
  { icon: '⚠️', label: 'Safety Tips', desc: 'Common mistakes and pro advice' },
]

const HOW_STEPS = [
  { icon: '📷', title: 'Take a photo', desc: 'Any gym machine or equipment' },
  { icon: '🤖', title: 'AI analyses it', desc: 'Powered by Google Gemini' },
  { icon: '📋', title: 'Get your guide', desc: 'Setup, steps, muscles and safety' },
]

function SpinningRing() {
  const spin = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }),
    ).start()
  }, [spin])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={ringStyles.container}>
      <Animated.View style={[ringStyles.spinWrap, { transform: [{ rotate }] }]}>
        <LinearGradient
          colors={['#A855F7', '#22D3EE', 'rgba(168,85,247,0.1)', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={ringStyles.ring}
        />
      </Animated.View>
      <View style={ringStyles.inner}>
        <Text style={{ fontSize: 28 }}>🏋️</Text>
      </View>
    </View>
  )
}

const ringStyles = StyleSheet.create({
  container: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  spinWrap: { position: 'absolute', width: 80, height: 80 },
  ring: { width: 80, height: 80, borderRadius: 40 },
  inner: {
    position: 'absolute', width: 73, height: 73, borderRadius: 37,
    backgroundColor: '#050510', alignItems: 'center', justifyContent: 'center',
  },
})

export default function MachineScannerScreen() {
  const navigation = useNavigation()
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [guide, setGuide] = useState<MachineAnalysis | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ResultTab>('guide')
  const [checkedSetup, setCheckedSetup] = useState<Set<number>>(new Set())
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  const tabOpacity = useRef(new Animated.Value(1)).current
  const tabTranslateY = useRef(new Animated.Value(0)).current

  const toggleSetup = useCallback((i: number) => {
    setCheckedSetup(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  }, [])

  const toggleStep = useCallback((i: number) => {
    setCheckedSteps(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  }, [])

  const switchTab = useCallback((tab: ResultTab) => {
    Animated.timing(tabOpacity, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setActiveTab(tab)
      tabTranslateY.setValue(8)
      Animated.parallel([
        Animated.timing(tabOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(tabTranslateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start()
    })
  }, [tabOpacity, tabTranslateY])

  const analyze = useCallback(async (dataUrl: string, uri: string) => {
    setState('loading')
    setGuide(null)
    setError('')
    setPreview(uri)
    try {
      const result = await analyzeMachineImage(dataUrl)
      setGuide(result)
      setState('result')
      setActiveTab('guide')
      setCheckedSetup(new Set())
      setCheckedSteps(new Set())
      tabOpacity.setValue(1)
      tabTranslateY.setValue(0)
    } catch {
      setError('Could not analyse the image. Make sure the photo clearly shows the equipment.')
      setState('error')
    }
  }, [tabOpacity, tabTranslateY])

  const takePhoto = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 })
    if (!result.canceled && result.assets[0].base64) {
      void analyze(`data:image/jpeg;base64,${result.assets[0].base64}`, result.assets[0].uri)
    }
  }, [analyze])

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0].base64) {
      void analyze(`data:image/jpeg;base64,${result.assets[0].base64}`, result.assets[0].uri)
    }
  }, [analyze])

  const reset = useCallback(() => {
    setState('idle')
    setPreview(null)
    setGuide(null)
    setError('')
    setCheckedSetup(new Set())
    setCheckedSteps(new Set())
  }, [])

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <SpinningRing />
          <Text style={styles.loadingTitle}>Identifying equipment...</Text>
          <Text style={styles.loadingSub}>Reading machine type and settings</Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── Result ────────────────────────────────────────────────────────────────────

  if (state === 'result' && guide) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {preview && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(5,5,16,0.95)']}
                style={styles.previewOverlay}
              >
                <View style={styles.previewBottom}>
                  <Text style={styles.machineName} numberOfLines={2}>{guide.machineName}</Text>
                  <View style={[styles.confidenceBadge, { borderColor: `${CONFIDENCE_COLOR[guide.confidence]}44` }]}>
                    <Text style={[styles.confidenceText, { color: CONFIDENCE_COLOR[guide.confidence] }]}>
                      {CONFIDENCE_LABEL[guide.confidence]}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabRow}>
            {TABS.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => switchTab(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Animated.View style={{ opacity: tabOpacity, transform: [{ translateY: tabTranslateY }] }}>

            {/* Guide tab */}
            {activeTab === 'guide' && (
              <View style={styles.tabContent}>
                {guide.setup.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Setup the machine</Text>
                    {guide.setup.map((item, i) => {
                      const done = checkedSetup.has(i)
                      return (
                        <TouchableOpacity
                          key={i}
                          style={[styles.checkRow, done ? styles.checkRowDoneGreen : styles.checkRowDefault]}
                          onPress={() => toggleSetup(i)}
                          activeOpacity={0.85}
                        >
                          <View style={[styles.checkBubble, done && styles.checkBubbleGreen]}>
                            <Text style={[styles.checkBubbleNum, done && styles.checkBubbleDoneText]}>
                              {done ? '✓' : String(i + 1)}
                            </Text>
                          </View>
                          <Text style={[styles.checkItemText, done && styles.checkItemDoneSetup]}>
                            {item}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Exercise steps</Text>
                  {guide.steps.map((item, i) => {
                    const done = checkedSteps.has(i)
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.checkRow, done ? styles.checkRowDonePurple : styles.checkRowDefault]}
                        onPress={() => toggleStep(i)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.checkBubble}>
                          <Text style={styles.checkBubbleNum}>
                            {done ? '✓' : String(i + 1)}
                          </Text>
                        </View>
                        <Text style={[styles.checkItemText, done && styles.checkItemDoneStep]}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <View style={styles.hintCard}>
                  <Text style={styles.hintText}>
                    Tap each step to check it off as you go. Start with setup, then move into the exercise.
                  </Text>
                </View>
              </View>
            )}

            {/* Muscles tab */}
            {activeTab === 'muscles' && (
              <View style={styles.tabContent}>
                {guide.targetMuscles.primary.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Primary muscles</Text>
                    <View style={styles.chipWrap}>
                      {guide.targetMuscles.primary.map(m => (
                        <View key={m} style={styles.chipPrimary}>
                          <Text style={{ fontSize: 18 }}>{getMuscleEmoji(m)}</Text>
                          <Text style={styles.chipPrimaryText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {guide.targetMuscles.secondary.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Secondary muscles</Text>
                    <View style={styles.chipWrap}>
                      {guide.targetMuscles.secondary.map(m => (
                        <View key={m} style={styles.chipSecondary}>
                          <Text style={{ fontSize: 14 }}>{getMuscleEmoji(m)}</Text>
                          <Text style={styles.chipSecondaryText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.feelCard}>
                  <Text style={styles.feelLabel}>What to feel</Text>
                  <Text style={styles.feelBody}>
                    Focus on the primary muscles throughout each rep. Secondary muscles assist and stabilise - you'll feel them less but they protect your joints and help you lift safely.
                  </Text>
                </View>
              </View>
            )}

            {/* Safety tab */}
            {activeTab === 'safety' && (
              <View style={styles.tabContent}>
                {guide.mistakes.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Avoid these mistakes</Text>
                    {guide.mistakes.map((item, i) => (
                      <View key={i} style={styles.mistakeRow}>
                        <Text style={styles.mistakeX}>✕</Text>
                        <Text style={styles.mistakeText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {guide.tips.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Pro tips</Text>
                    {guide.tips.map((item, i) => (
                      <View key={i} style={styles.proTipRow}>
                        <Text style={styles.proTipCheck}>✓</Text>
                        <Text style={styles.proTipText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          <TouchableOpacity onPress={reset} activeOpacity={0.92} style={styles.scanAnotherWrap}>
            <LinearGradient
              colors={['#A855F7', '#22D3EE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanAnotherBtn}
            >
              <Ionicons name="camera-outline" size={16} color="#fff" />
              <Text style={styles.scanAnotherText}>Scan another machine</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Idle / Error ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.idleHeader}>
          <GradientText style={styles.idleTitle}>Machine Scanner</GradientText>
          <Text style={styles.idleSubtitle}>Take a photo of any gym machine for step-by-step instructions.</Text>
        </View>

        {/* Hero card */}
        <LinearGradient
          colors={['rgba(168,85,247,0.2)', 'rgba(34,211,238,0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroWatermark}>🏋️</Text>
          <Text style={styles.heroPowered}>Powered by Gemini AI</Text>
          <Text style={styles.heroTitleLine}>Identify any gym</Text>
          <GradientText style={styles.heroTitleGrad}>machine instantly</GradientText>
          <Text style={styles.heroDesc}>
            Take or upload a photo of any gym equipment and get a complete guide covering setup, exercise steps, targeted muscles, and safety tips.
          </Text>
          <TouchableOpacity onPress={takePhoto} activeOpacity={0.9} style={{ marginTop: 20 }}>
            <LinearGradient
              colors={['#A855F7', '#22D3EE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroPhotoBtn}
            >
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.heroPhotoBtnText}>Take a Photo</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.heroUploadBtn}>
            <Ionicons name="image-outline" size={16} color="rgba(255,255,255,0.6)" />
            <Text style={styles.heroUploadText}>Upload from library</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Feature cards 2x2 */}
        <View style={styles.featureGrid}>
          {[0, 2].map(offset => (
            <View key={offset} style={styles.featureRow}>
              {FEATURE_CARDS.slice(offset, offset + 2).map(f => (
                <View key={f.label} style={styles.featureCard}>
                  <Text style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</Text>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>
          <View style={styles.howRow}>
            {HOW_STEPS.map(step => (
              <View key={step.title} style={styles.howStep}>
                <View style={styles.howIcon}>
                  <Text style={{ fontSize: 20 }}>{step.icon}</Text>
                </View>
                <Text style={styles.howStepTitle}>{step.title}</Text>
                <Text style={styles.howStepDesc}>{step.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Error banner */}
        {state === 'error' && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* For best results */}
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.tipsTitle}>For best results</Text>
          <View style={styles.tipsRow}>
            {[
              { icon: '💡', tip: 'Good lighting' },
              { icon: '📐', tip: 'Full machine visible' },
              { icon: '🔍', tip: 'Clear and in focus' },
            ].map(({ icon, tip }) => (
              <View key={tip} style={styles.tipCard}>
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={styles.tipCardText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 24 },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingTitle: { ...Typography.h3, marginTop: 8 },
  loadingSub: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.4)' },

  // Result - preview
  previewWrap: {
    borderRadius: Radius.xl, overflow: 'hidden', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  previewImg: { width: '100%', height: 192 },
  previewOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  previewBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  machineName: { color: '#fff', fontWeight: '900', fontSize: 20, lineHeight: 24, flex: 1 },
  confidenceBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full,
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexShrink: 0,
  },
  confidenceText: { fontSize: 10, fontWeight: '700' },

  // Tabs
  tabRow: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(168,85,247,0.2)' },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.38)' },
  tabTextActive: { color: '#c084fc' },

  // Tab content
  tabContent: { gap: 20 },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', paddingHorizontal: 4,
  },

  // Interactive check rows
  checkRowDefault: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
  },
  checkRowDoneGreen: {
    backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)',
  },
  checkRowDonePurple: {
    backgroundColor: 'rgba(168,85,247,0.07)', borderColor: 'rgba(168,85,247,0.25)',
  },
  checkRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1,
  },
  checkBubble: {
    width: 24, height: 24, borderRadius: 12, flexShrink: 0, marginTop: 2,
    backgroundColor: 'rgba(168,85,247,0.15)', borderWidth: 1.5, borderColor: 'rgba(168,85,247,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkBubbleGreen: { backgroundColor: '#22c55e', borderWidth: 0 },
  checkBubbleNum: { fontSize: 11, fontWeight: '700', color: '#c084fc' },
  checkBubbleDoneText: { color: '#fff' },
  checkItemText: { fontSize: 14, lineHeight: 22, flex: 1, color: 'rgba(255,255,255,0.75)' },
  checkItemDoneSetup: { color: 'rgba(255,255,255,0.3)', textDecorationLine: 'line-through' },
  checkItemDoneStep: { color: 'rgba(255,255,255,0.35)' },

  hintCard: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  hintText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 18 },

  // Muscles
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16,
    backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)',
  },
  chipPrimaryText: { fontSize: 14, fontWeight: '600', color: '#d8b4fe' },
  chipSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipSecondaryText: { fontSize: 14, color: 'rgba(255,255,255,0.55)' },
  feelCard: {
    paddingHorizontal: 16, paddingVertical: 16, borderRadius: 16,
    backgroundColor: 'rgba(168,85,247,0.06)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.15)',
  },
  feelLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(168,85,247,0.6)', textTransform: 'uppercase', marginBottom: 6,
  },
  feelBody: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },

  // Safety
  mistakeRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)',
  },
  mistakeX: { color: '#f87171', fontSize: 14, fontWeight: '700', marginTop: 2 },
  mistakeText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20, flex: 1 },
  proTipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.06)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
  },
  proTipCheck: { color: '#4ade80', fontSize: 14, fontWeight: '700', marginTop: 2 },
  proTipText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20, flex: 1 },

  // Scan another
  scanAnotherWrap: { marginTop: 8, marginBottom: 8 },
  scanAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 16,
  },
  scanAnotherText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Idle header
  idleHeader: { marginBottom: 24 },
  idleTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5, color: '#fff' },
  idleSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 20 },

  // Hero card
  heroCard: {
    borderRadius: Radius.xl, marginBottom: 20, padding: 24,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.28)', overflow: 'hidden',
    position: 'relative',
  },
  heroWatermark: {
    position: 'absolute', right: 16, top: 16,
    fontSize: 80, lineHeight: 104, opacity: 0.08,
  },
  heroPowered: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    color: 'rgba(168,85,247,0.7)', textTransform: 'uppercase', marginBottom: 12,
  },
  heroTitleLine: { fontSize: 20, fontWeight: '900', color: '#fff', lineHeight: 26 },
  heroTitleGrad: { fontSize: 20, fontWeight: '900', color: '#fff', lineHeight: 26, marginBottom: 8 },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginTop: 4 },
  heroPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 16, paddingVertical: 16,
  },
  heroPhotoBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  heroUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)', borderRadius: 16, paddingVertical: 16, marginTop: 12,
  },
  heroUploadText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  // Feature cards
  featureGrid: { gap: 12, marginBottom: 20 },
  featureRow: { flexDirection: 'row', gap: 12 },
  featureCard: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  featureLabel: { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 18 },
  featureDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, lineHeight: 16 },

  // How it works
  howCard: {
    marginBottom: 20, borderRadius: 16, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  howTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 16,
  },
  howRow: { flexDirection: 'row', gap: 8 },
  howStep: { flex: 1, alignItems: 'center', gap: 8 },
  howIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  howStepTitle: { fontSize: 11, fontWeight: '600', color: '#fff', textAlign: 'center', lineHeight: 14 },
  howStepDesc: { fontSize: 10, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 14 },

  // Error banner
  errorBanner: {
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 20,
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  errorBannerText: { fontSize: 14, color: 'rgba(239,68,68,0.8)', lineHeight: 20, textAlign: 'center' },

  // For best results
  tipsTitle: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, paddingHorizontal: 4,
  },
  tipsRow: { flexDirection: 'row', gap: 8 },
  tipCard: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tipCardText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
})
