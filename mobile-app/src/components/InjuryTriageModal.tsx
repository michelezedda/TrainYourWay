import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated,
  ScrollView, Dimensions,
} from 'react-native'
import { GestureDetector, Gesture } from 'react-native-gesture-handler'
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, interpolate, Extrapolation,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import {
  type InjuryLocation, type InjurySeverity, type InjuryState, getInjuryAdvice,
} from '@/lib/injuryStore'
import { Colors, Spacing, Radius } from '@/theme'

const SCREEN_H = Dimensions.get('window').height

const LOCATIONS: { key: InjuryLocation; label: string; icon: string }[] = [
  { key: 'knee', label: 'Knee', icon: '🦵' },
  { key: 'shoulder', label: 'Shoulder', icon: '💪' },
  { key: 'lower back', label: 'Lower Back', icon: '🔙' },
  { key: 'wrist', label: 'Wrist', icon: '✋' },
  { key: 'hip', label: 'Hip', icon: '🍑' },
  { key: 'ankle', label: 'Ankle', icon: '🦶' },
  { key: 'neck', label: 'Neck', icon: '🧣' },
  { key: 'other', label: 'Other', icon: '💫' },
]

const SEVERITIES: { key: InjurySeverity; label: string; desc: string; icon: string }[] = [
  { key: 'mild', label: 'Mild', desc: 'Slight discomfort, no sharp pain', icon: '🟢' },
  { key: 'moderate', label: 'Moderate', desc: 'Noticeable pain during movement', icon: '🟡' },
  { key: 'sharp', label: 'Sharp', desc: 'Intense pain, hard to ignore', icon: '🔴' },
]

interface Props {
  visible: boolean
  injuryState: InjuryState | null
  onClose: () => void
  onActivate: (state: InjuryState) => void
}

export default function InjuryTriageModal({ visible, injuryState, onClose, onActivate }: Props) {
  const translateY = useSharedValue(SCREEN_H)
  const backdropOpacity = useSharedValue(0)
  const dragY = useSharedValue(0)

  const [step, setStep] = useState(0)
  const [location, setLocation] = useState<InjuryLocation | null>(null)
  const [severity, setSeverity] = useState<InjurySeverity | null>(null)
  const [worsens, setWorsens] = useState<boolean | null>(null)

  const stepOpacity = useRef(new Animated.Value(1)).current
  const stepTranslate = useRef(new Animated.Value(0)).current

  const resetState = () => {
    setStep(0)
    setLocation(null)
    setSeverity(null)
    setWorsens(null)
  }

  const doClose = useCallback(() => {
    translateY.value = withTiming(SCREEN_H, { duration: 220 }, () => runOnJS(onClose)())
    backdropOpacity.value = withTiming(0, { duration: 220 })
  }, [onClose])

  useEffect(() => {
    if (visible) {
      resetState()
      translateY.value = withSpring(0, { stiffness: 420, damping: 42 })
      backdropOpacity.value = withTiming(1, { duration: 220 })
    }
  }, [visible])

  const animateStepChange = (nextStep: number) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(stepTranslate, { toValue: -20, duration: 140, useNativeDriver: true }),
      ]),
    ]).start(() => {
      stepTranslate.setValue(20)
      setStep(nextStep)
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(stepTranslate, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start()
    })
  }

  const handleLocation = (loc: InjuryLocation) => {
    setLocation(loc)
    setTimeout(() => animateStepChange(1), 120)
  }

  const handleSeverity = (sev: InjurySeverity) => {
    setSeverity(sev)
    setTimeout(() => animateStepChange(2), 120)
  }

  const handleWorsens = (val: boolean) => {
    setWorsens(val)
    setTimeout(() => animateStepChange(3), 120)
  }

  const injuryStatePreview: InjuryState | null =
    location && severity && worsens !== null
      ? { active: true, location, severity, worsensWithMovement: worsens, startedAt: Date.now() }
      : null

  const advice = injuryStatePreview ? getInjuryAdvice(injuryStatePreview) : null

  const panGesture = Gesture.Pan()
    .onUpdate(e => { if (e.translationY > 0) dragY.value = e.translationY })
    .onEnd(e => {
      if (e.velocityY > 450 || e.translationY > 140) runOnJS(doClose)()
      else dragY.value = withSpring(0, { stiffness: 500, damping: 40 })
    })

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
  }))

  const dragHandleOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(dragY.value, [0, 80], [1, 0.4], Extrapolation.CLAMP),
  }))

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.root}>
        <Reanimated.View style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={doClose} activeOpacity={1} />
        </Reanimated.View>

        <Reanimated.View style={[styles.sheet, sheetStyle]}>
          <GestureDetector gesture={panGesture}>
            <Reanimated.View style={[styles.dragHandle, dragHandleOpacity]}>
              <View style={styles.handle} />
            </Reanimated.View>
          </GestureDetector>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Text style={{ fontSize: 20 }}>🩹</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Injury Triage</Text>
                <Text style={styles.headerSub}>Quick check to adapt your training</Text>
              </View>
              <TouchableOpacity onPress={doClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Progress dots */}
            <View style={styles.progressRow}>
              {[0, 1, 2, 3].map(i => (
                <View
                  key={i}
                  style={[styles.progressBar, { backgroundColor: i <= step ? 'rgba(245,158,11,0.8)' : 'rgba(255,255,255,0.1)' }]}
                />
              ))}
            </View>

            {/* Step content */}
            <Animated.View style={[styles.stepWrap, { opacity: stepOpacity, transform: [{ translateX: stepTranslate }] }]}>

              {/* Step 0: Location */}
              {step === 0 && (
                <View>
                  <Text style={styles.stepQ}>Where does it hurt?</Text>
                  <View style={styles.locationGrid}>
                    {LOCATIONS.map(({ key, label, icon }) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => handleLocation(key)}
                        style={[
                          styles.locationBtn,
                          location === key && styles.locationBtnSelected,
                        ]}
                        activeOpacity={0.75}
                      >
                        <Text style={{ fontSize: 22 }}>{icon}</Text>
                        <Text style={styles.locationLabel}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Step 1: Severity */}
              {step === 1 && (
                <View>
                  <Text style={styles.stepQ}>How bad is it?</Text>
                  <View style={{ gap: 10 }}>
                    {SEVERITIES.map(({ key, label, desc, icon }) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => handleSeverity(key)}
                        style={[
                          styles.severityBtn,
                          severity === key && styles.severityBtnSelected,
                        ]}
                        activeOpacity={0.75}
                      >
                        <Text style={{ fontSize: 22 }}>{icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.severityLabel}>{label}</Text>
                          <Text style={styles.severityDesc}>{desc}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Step 2: Worsens with movement */}
              {step === 2 && (
                <View>
                  <Text style={styles.stepQ}>Does it get worse when you move?</Text>
                  <Text style={styles.stepHint}>Be honest - this helps us keep you safe.</Text>
                  <View style={styles.worsensRow}>
                    <TouchableOpacity
                      onPress={() => handleWorsens(true)}
                      style={[
                        styles.worsensBtn,
                        worsens === true && styles.worsensBtnYes,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 36, marginBottom: 8 }}>😬</Text>
                      <Text style={styles.worsensLabel}>Yes, it does</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleWorsens(false)}
                      style={[
                        styles.worsensBtn,
                        worsens === false && styles.worsensBtnNo,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 36, marginBottom: 8 }}>🙂</Text>
                      <Text style={styles.worsensLabel}>Stays the same</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Step 3: Summary */}
              {step === 3 && advice && injuryStatePreview && (
                <View>
                  <View style={styles.summaryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 18 }}>{advice.intensity === 'rest' ? '🛑' : '⚠️'}</Text>
                      <Text style={[styles.summaryTitle, { color: advice.intensity === 'rest' ? '#fca5a5' : '#fde68a' }]}>
                        {advice.intensity === 'rest' ? 'Full Rest Recommended' : 'Reduced Training Mode'}
                      </Text>
                    </View>
                    <Text style={styles.summaryMessage}>{advice.message}</Text>
                  </View>

                  <View style={styles.adviceCols}>
                    <View style={[styles.adviceCol, styles.adviceColAvoid]}>
                      <Text style={[styles.adviceColTitle, { color: '#f87171' }]}>AVOID</Text>
                      {advice.avoid.slice(0, 4).map(item => (
                        <Text key={item} style={styles.adviceItem}>
                          <Text style={{ color: 'rgba(248,113,113,0.7)' }}>✕ </Text>{item}
                        </Text>
                      ))}
                    </View>
                    <View style={[styles.adviceCol, styles.adviceColFocus]}>
                      <Text style={[styles.adviceColTitle, { color: '#86efac' }]}>FOCUS</Text>
                      {advice.focus.slice(0, 4).map(item => (
                        <Text key={item} style={styles.adviceItem}>
                          <Text style={{ color: 'rgba(134,239,172,0.7)' }}>✦ </Text>{item}
                        </Text>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => { if (injuryStatePreview) onActivate(injuryStatePreview) }}
                    style={styles.activateBtn}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['rgba(245,158,11,0.9)', 'rgba(234,88,12,0.9)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.activateBtnGrad}
                    >
                      <Text style={styles.activateBtnText}>Activate Recovery Mode</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={doClose} style={styles.cancelLink} activeOpacity={0.7}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </Reanimated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: 'rgba(10,5,30,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(245,158,11,0.2)',
    maxHeight: SCREEN_H * 0.92,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  dragHandle: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  scrollContent: { paddingHorizontal: Spacing.md, paddingBottom: 48 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4, paddingBottom: 16 },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  closeX: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },

  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  progressBar: { flex: 1, height: 2, borderRadius: 1 },

  stepWrap: { minHeight: 260 },
  stepQ: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  stepHint: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 20, marginTop: -10 },

  locationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationBtn: {
    width: '23%',
    alignItems: 'center', gap: 6, paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  locationBtnSelected: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  locationLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  severityBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  severityBtnSelected: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  severityLabel: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 2 },
  severityDesc: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  worsensRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  worsensBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  worsensBtnYes: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  worsensBtnNo: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  worsensLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },

  summaryCard: {
    borderRadius: 16, padding: 16, marginBottom: 16,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  summaryTitle: { fontSize: 13, fontWeight: '700' },
  summaryMessage: { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },

  adviceCols: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  adviceCol: { flex: 1, borderRadius: 14, padding: 12 },
  adviceColAvoid: { backgroundColor: 'rgba(239,68,68,0.07)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  adviceColFocus: { backgroundColor: 'rgba(34,197,94,0.07)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.15)' },
  adviceColTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  adviceItem: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, lineHeight: 16 },

  activateBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  activateBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  activateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelLink: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
})
