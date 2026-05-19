import { useState, useEffect, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, Easing, ScrollView, Dimensions,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { LinearGradient } from 'expo-linear-gradient'
import Markdown from 'react-native-markdown-display'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { markOnboardingSeen } from '@/lib/onboarding'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'
import type { RootStackParamList } from '@/navigation/types'
import type { WorkoutFormData } from '@/lib/gemini'

type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'Results'>

const { width: W } = Dimensions.get('window')
const CARD_PAD = 16
const BAR_W_CARD = W - 40 - CARD_PAD * 2
const BAR_W_TIMELINE = W - 40 - 14 * 2

// ── Design data ───────────────────────────────────────────────────────────────

const GOAL_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Weight Loss': { color: '#fdba74', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.28)', icon: '🔥' },
  'Muscle Gain': { color: '#93c5fd', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.28)', icon: '💪' },
  'Body Recomposition': { color: '#a5b4fc', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.28)', icon: '⚡' },
  'Strength': { color: '#fca5a5', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.28)', icon: '🏋️' },
  'Endurance': { color: '#67e8f9', bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.28)', icon: '🏃' },
  'Athletic Performance': { color: '#fde047', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.28)', icon: '🏆' },
  'Flexibility': { color: '#c4b5fd', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.28)', icon: '🧘' },
  'General Fitness': { color: '#86efac', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.28)', icon: '💚' },
  'Stress Relief': { color: '#f9a8d4', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.28)', icon: '🌿' },
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
}

const SECTION_THEME: Record<string, { icon: string; label: string; accent: string }> = {
  'Profile Assessment': { icon: '📊', label: 'Profile breakdown', accent: '#A855F7' },
  'Workout Space Analysis': { icon: '🏠', label: 'Space analysis', accent: '#22D3EE' },
  'Space Recommendations': { icon: '💡', label: 'Pro recommendations', accent: '#f59e0b' },
  'Dietary Assessment': { icon: '🥗', label: 'Nutrition strategy', accent: '#10b981' },
  'What to Expect': { icon: '🎯', label: 'Your roadmap', accent: '#ec4899' },
  'Your Progress': { icon: '📈', label: 'Progress snapshot', accent: '#A855F7' },
}

const DID_YOU_KNOW: Record<string, string> = {
  'Profile Assessment': 'Consistency beats intensity every time. Showing up is 80% of the result.',
  'Workout Space Analysis': 'Home workouts are just as effective as gym sessions when the programming is right.',
  'Space Recommendations': 'Adding just one or two pieces of equipment unlocks dozens of exercise variations.',
  'Dietary Assessment': 'Nutrition drives up to 70% of body composition results.',
  'What to Expect': 'Most people see visible changes within 4 to 6 weeks. The first 2 weeks are about building the habit.',
}

const TRAINING_MOTIVATION: Record<string, string> = {
  '2': 'Two focused sessions a week is enough to build real progress.',
  '3': 'Three sessions per week is the science-backed sweet spot for sustainable adaptation.',
  '4': 'Four days hits the ideal balance between training stimulus and recovery.',
  '5': 'Five sessions shows serious commitment. Recovery is built in.',
  '6': 'Six training days. Elite dedication. Sleep and nutrition now carry equal weight.',
}

const GOAL_TAGLINE: Record<string, string> = {
  'Weight Loss': 'Every rep burns. Every session compounds. The results you want are built in the reps you do not skip.',
  'Muscle Gain': 'Muscle is earned one rep at a time. Train hard, sleep harder, eat consistently.',
  'Body Recomposition': 'Losing fat while building muscle takes patience and precision. Your plan delivers both.',
  'Strength': 'Every lift makes you harder to stop. This is where real strength gets built.',
  'Endurance': 'Your lungs and legs will adapt faster than you think. Keep moving.',
  'Athletic Performance': 'Great athletes are built in training sessions like these. This is where it starts.',
  'Flexibility': 'Flexibility is freedom. Every session unlocks a little more range.',
  'General Fitness': 'Consistent beats perfect. Every single time. Show up.',
  'Stress Relief': 'Movement is the best medicine. Your plan is the prescription.',
}

const TIMELINE: Record<string, [string, string, string]> = {
  'Weight Loss': ['Energy improves, routine clicks', 'First visible changes, clothes fit differently', 'Significant body composition shift'],
  'Muscle Gain': ['Strength baselines set, soreness fades', 'Noticeable strength jump, shape emerging', 'Real muscle development, visible definition'],
  'Body Recomposition': ['Body adapts, energy levels up', 'Fat shifts, muscle firms up', 'Leaner and stronger at the same weight'],
  'Strength': ['CNS adapts, lifts feel smoother', 'Measurable PRs, form sharpens', 'Baseline strength 20 to 30% higher than day one'],
  'Endurance': ['Cardiovascular efficiency building fast', 'Pace improves, recovery speeds up', 'Stamina transformation you will feel everywhere'],
  'General Fitness': ['Energy and mood lift within the first week', 'Stamina improves, daily movement gets easier', 'A fitter, stronger version of you'],
  'Stress Relief': ['Post-workout calm kicks in from session one', 'Sleep improves, stress response softens', 'Movement becomes your most reliable mood reset'],
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ── Per-slide entrance hook ───────────────────────────────────────────────────

function useSlideEntrance() {
  const eyebrowAnim = useRef(new Animated.Value(0)).current
  const titleAnim = useRef(new Animated.Value(0)).current
  const ease = Easing.bezier(0.4, 0, 0.2, 1)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(eyebrowAnim, { toValue: 1, duration: 300, delay: 50, easing: ease, useNativeDriver: true }),
      Animated.timing(titleAnim, { toValue: 1, duration: 340, delay: 120, easing: ease, useNativeDriver: true }),
    ]).start()
  }, [])

  const eyebrowStyle = {
    opacity: eyebrowAnim,
    transform: [{ translateY: eyebrowAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  }
  const titleStyle = {
    opacity: titleAnim,
    transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  }
  return { eyebrowStyle, titleStyle }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAnalysisSections(text: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = []
  const lines = text.split('\n')
  let current: { title: string; lines: string[] } | null = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push({ title: current.title, content: current.lines.join('\n').trim() })
      current = { title: line.replace(/^## /, '').trim(), lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push({ title: current.title, content: current.lines.join('\n').trim() })
  return sections.filter(s => s.content.length > 0)
}

function parseTrainingDays(plan: string): Set<number> {
  const result = new Set<number>()
  const schedSection = plan.match(/## Weekly Schedule([\s\S]*?)(?=\n## |$)/i)?.[1] ?? ''
  if (schedSection) {
    DAY_FULL.forEach((day, i) => {
      const m = schedSection.match(new RegExp(`\\*\\*${day}:?\\*\\*:?\\s*([^\\n]+)`, 'i'))
      if (!m) return
      const activity = m[1].replace(/·.*$/, '').trim()
      if (!/\brest\b/i.test(activity)) result.add(i)
    })
    if (result.size > 0) return result
  }
  for (const line of plan.split('\n')) {
    const trimmed = line.trimStart()
    if (!/^#{2,3}\s/.test(trimmed)) continue
    const dayIdx = DAY_FULL.findIndex(d => new RegExp(`\\b${d}\\b`, 'i').test(trimmed))
    if (dayIdx === -1) continue
    if (/\brest\b/i.test(trimmed)) continue
    result.add(dayIdx)
  }
  return result
}

// ── Animated bar ──────────────────────────────────────────────────────────────

function BarFill({ pct, color, delay = 0, maxWidth = BAR_W_CARD }: {
  pct: number; color: string; delay?: number; maxWidth?: number
}) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: pct * maxWidth, duration: 1100, delay, useNativeDriver: false }).start()
  }, [pct, maxWidth])
  return (
    <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
      <Animated.View style={{ height: 8, width: anim, backgroundColor: color, borderRadius: 4 }} />
    </View>
  )
}

// ── Slide 0: Celebration ──────────────────────────────────────────────────────

function CelebrationSlide({ formData, userName }: { formData?: WorkoutFormData; userName: string }) {
  const goals = formData?.goals ?? []
  const primaryGoal = goals[0] ?? 'General Fitness'
  const goalMeta = GOAL_META[primaryGoal]
  const scale = useRef(new Animated.Value(0.1)).current
  const contentOpacity = useRef(new Animated.Value(0)).current
  const contentY = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 14 }),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(contentY, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]),
    ]).start()
  }, [])

  return (
    <View style={s.slideCenter}>
      <Animated.View style={[s.heroIcon, { transform: [{ scale }] }]}>
        <LinearGradient colors={['rgba(168,85,247,0.3)', 'rgba(34,211,238,0.2)']} style={s.heroIconGrad}>
          <Text style={{ fontSize: 56, lineHeight: 70 }}>{goalMeta?.icon ?? '🏋️'}</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }], alignItems: 'center', gap: 28 }}>
        <Text style={s.eyebrow}>Your plan is ready</Text>
        <Text style={s.heroTitle}>
          {userName ? `${userName},\nyou're all set.` : 'Your results\nare in.'}
        </Text>
        {formData && (
          <Text style={s.heroPlan}>{formData.planName || 'Custom Program'} - built around you.</Text>
        )}

        {goals.length > 0 && (
          <View style={s.badgeRow}>
            {goals.map(g => {
              const m = GOAL_META[g]
              return (
                <View key={g} style={[s.badge, { backgroundColor: m?.bg ?? 'rgba(255,255,255,0.08)', borderColor: m?.border ?? 'rgba(255,255,255,0.15)' }]}>
                  <Text style={{ fontSize: 12 }}>{m?.icon}</Text>
                  <Text style={[s.badgeText, { color: m?.color ?? Colors.textSecondary }]}>{g}</Text>
                </View>
              )
            })}
          </View>
        )}

        {formData && (
          <View style={s.statsRow}>
            {[
              { label: 'Days/wk', value: String(formData.workoutDays.length) },
              { label: 'Per session', value: `${formData.sessionDuration}m` },
              { label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel },
            ].map(({ label, value }, i) => (
              <View key={label} style={[s.statItem, i > 0 && s.statItemBorder]}>
                <Text style={s.statValue}>{value}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  )
}

// ── Slide 1: Profile stats ────────────────────────────────────────────────────

function ProfileStatsSlide({ formData }: { formData: WorkoutFormData }) {
  const { eyebrowStyle, titleStyle } = useSlideEntrance()
  const bmi = (() => {
    const w = parseFloat(formData.weight)
    const h = parseFloat(formData.height) / 100
    if (!w || !h) return null
    const v = w / (h * h)
    const cat = v < 18.5 ? 'Underweight' : v < 25 ? 'Healthy' : v < 30 ? 'Overweight' : 'High'
    return { value: +(v.toFixed(1)), cat }
  })()
  const bmiColor = bmi?.cat === 'Healthy' ? '#22D3EE' : bmi?.cat === 'Underweight' ? '#A855F7' : '#f59e0b'
  const levelColor: Record<string, string> = { beginner: '#22D3EE', intermediate: '#A855F7', advanced: '#f59e0b' }

  return (
    <View style={s.slideContent}>
      <Animated.Text style={[s.eyebrow, { color: '#ec4899' }, eyebrowStyle]}>Your profile</Animated.Text>
      <Animated.Text style={[s.slideTitle, titleStyle]}>Built for{'\n'}your body.</Animated.Text>

      {bmi && (
        <View style={[s.bmiCard, { backgroundColor: `${bmiColor}12`, borderColor: `${bmiColor}30` }]}>
          <View style={[s.bmiCircle, { borderColor: bmiColor }]}>
            <Text style={[s.bmiValue, { color: bmiColor }]}>{bmi.value}</Text>
            <Text style={s.bmiUnit}>BMI</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.bmiCat, { color: bmiColor }]}>{bmi.cat}</Text>
            <Text style={s.bmiSub}>Body Mass Index</Text>
            <Text style={s.bmiNote}>
              {bmi.cat === 'Healthy'
                ? 'Right in the target zone. Your plan builds on this.'
                : 'Your plan is calibrated to move you toward your optimal range.'}
            </Text>
          </View>
        </View>
      )}

      <View style={s.statsGrid}>
        {[
          { label: 'Level', value: LEVEL_LABELS[formData.fitnessLevel] ?? formData.fitnessLevel, color: levelColor[formData.fitnessLevel] ?? Colors.purple },
          { label: 'Sessions', value: `${formData.workoutDays.length}x/wk`, color: Colors.purple },
          { label: 'Per Session', value: `${formData.sessionDuration}m`, color: Colors.cyan },
        ].map(({ label, value, color }) => (
          <View key={label} style={s.statsGridItem}>
            <Text style={[s.statsGridValue, { color }]}>{value}</Text>
            <Text style={s.statsGridLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={[s.insightBox, { backgroundColor: 'rgba(236,72,153,0.07)', borderColor: 'rgba(236,72,153,0.2)' }]}>
        <Text style={{ fontSize: 16 }}>🎯</Text>
        <Text style={[s.insightText, { flex: 1 }]}>Every set, rep, and rest period in your plan is calculated for your exact fitness level and schedule.</Text>
      </View>
    </View>
  )
}

// ── Slide N: AI analysis section ──────────────────────────────────────────────

const mdStyles = {
  body: { color: 'rgba(255,255,255,0.65)' as string, fontSize: 14, lineHeight: 22 },
  heading2: { color: '#fff' as string, fontWeight: '800' as const, fontSize: 15, marginTop: 16, marginBottom: 6 },
  bullet_list: { marginLeft: 0 },
  list_item: { color: 'rgba(255,255,255,0.65)' as string, marginBottom: 3 },
  strong: { color: '#fff' as string, fontWeight: '700' as const },
}

function AnalysisSectionSlide({ section }: { section: { title: string; content: string } }) {
  const theme = SECTION_THEME[section.title] ?? { icon: '📋', label: 'Insight', accent: '#A855F7' }
  const didYouKnow = DID_YOU_KNOW[section.title]
  const { eyebrowStyle, titleStyle } = useSlideEntrance()

  return (
    <View style={s.slideContent}>
      <View style={[s.sectionIcon, { backgroundColor: `${theme.accent}28`, borderColor: `${theme.accent}38` }]}>
        <Text style={{ fontSize: 24 }}>{theme.icon}</Text>
      </View>
      <Animated.Text style={[s.eyebrow, { color: theme.accent }, eyebrowStyle]}>{theme.label}</Animated.Text>
      <Animated.Text style={[s.slideTitle, { fontSize: 32 }, titleStyle]}>{section.title}</Animated.Text>

      <View style={s.mdCard}>
        <Markdown style={mdStyles}>{section.content}</Markdown>
      </View>

      {didYouKnow && (
        <View style={[s.insightBox, { backgroundColor: `${theme.accent}0e`, borderColor: `${theme.accent}2e` }]}>
          <Text style={{ fontSize: 16 }}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.insightBoxLabel, { color: theme.accent }]}>Did you know?</Text>
            <Text style={s.insightText}>{didYouKnow}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

// ── Training week slide ───────────────────────────────────────────────────────

function TrainingWeekSlide({ formData, plan }: { formData?: WorkoutFormData; plan?: string }) {
  const { eyebrowStyle, titleStyle } = useSlideEntrance()
  const days = formData?.workoutDays.length ?? 3
  const mins = parseInt(formData?.sessionDuration ?? '45', 10)
  const totalMins = days * mins
  const totalStr = totalMins >= 90 ? `${(totalMins / 60).toFixed(1)}h` : `${totalMins}m`
  const motivation = TRAINING_MOTIVATION[String(days)] ?? 'Your schedule is built for consistent forward progress.'

  const trainingIndices = useMemo<Set<number>>(() => {
    if (plan) {
      const parsed = parseTrainingDays(plan)
      if (parsed.size > 0) return parsed
    }
    if (!formData) return new Set()
    const fallback = new Set<number>()
    for (const d of formData.workoutDays) {
      const idx = DAY_FULL.indexOf(d)
      if (idx >= 0) fallback.add(idx)
    }
    return fallback
  }, [plan, formData])

  const cellScales = useRef(DAY_LABELS.map(() => new Animated.Value(0.2))).current
  useEffect(() => {
    Animated.stagger(55, cellScales.map(sc =>
      Animated.spring(sc, { toValue: 1, useNativeDriver: true, tension: 380, friction: 22 }),
    )).start()
  }, [])

  return (
    <View style={s.slideContent}>
      <Animated.Text style={[s.eyebrow, { color: Colors.cyan }, eyebrowStyle]}>Training structure</Animated.Text>
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }, titleStyle]}>
        <Text style={s.heroNum}>{days}</Text>
        <Text style={s.heroNumSub}>sessions{'\n'}per week</Text>
      </Animated.View>

      <View style={s.dayGrid}>
        {DAY_LABELS.map((label, i) => (
          <Animated.View key={i} style={[s.dayCell, { transform: [{ scale: cellScales[i] }] }]}>
            {trainingIndices.has(i) ? (
              <LinearGradient colors={['#A855F7', '#22D3EE']} style={s.dayCellGrad}>
                <Text style={s.dayCellLabelActive}>{label}</Text>
              </LinearGradient>
            ) : (
              <Text style={s.dayCellLabel}>{label}</Text>
            )}
          </Animated.View>
        ))}
      </View>

      <View style={s.statsGrid}>
        {[
          { label: 'Per session', value: `${formData?.sessionDuration ?? '?'}m`, color: Colors.purple },
          { label: 'Total per week', value: totalStr, color: Colors.cyan },
        ].map(({ label, value, color }) => (
          <View key={label} style={[s.statsGridItem, { paddingVertical: 20 }]}>
            <Text style={[s.heroNum2, { color }]}>{value}</Text>
            <Text style={s.statsGridLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {formData && (() => {
        const custom = formData.equipment.filter(eq => eq !== 'Full Gym Access')
        if (!custom.length) return null
        return (
          <View style={{ gap: 8 }}>
            <Text style={[Typography.caption, { color: Colors.textDim }]}>YOUR EQUIPMENT</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {custom.slice(0, 6).map(eq => (
                <View key={eq} style={s.equipChip}>
                  <Text style={s.equipChipText}>{eq}</Text>
                </View>
              ))}
              {custom.length > 6 && (
                <View style={s.equipChip}>
                  <Text style={s.equipChipText}>+{custom.length - 6} more</Text>
                </View>
              )}
            </View>
          </View>
        )
      })()}

      <View style={[s.insightBox, { backgroundColor: 'rgba(34,211,238,0.07)', borderColor: 'rgba(34,211,238,0.2)' }]}>
        <Text style={{ fontSize: 16 }}>⚡</Text>
        <Text style={[s.insightText, { flex: 1 }]}>{motivation}</Text>
      </View>
    </View>
  )
}

// ── Nutrition preview slide ───────────────────────────────────────────────────

function NutritionSlide({ goals }: { goals: string[] }) {
  const { eyebrowStyle, titleStyle } = useSlideEntrance()
  const profile = getNutritionProfile()
  if (!profile) return null
  const t = calculateTargets(profile)

  const macros = [
    { label: 'Protein', value: t.protein, color: '#22D3EE', pct: (t.protein * 4) / t.kcal },
    { label: 'Carbs', value: t.carbs, color: '#A855F7', pct: (t.carbs * 4) / t.kcal },
    { label: 'Fat', value: t.fat, color: '#f97316', pct: (t.fat * 9) / t.kcal },
  ]

  return (
    <View style={s.slideContent}>
      <Animated.Text style={[s.eyebrow, { color: '#10b981' }, eyebrowStyle]}>Daily nutrition</Animated.Text>
      <Animated.Text style={[s.slideTitle, titleStyle]}>Your fuel{'\n'}locked in.</Animated.Text>

      <View style={s.kcalCard}>
        <Text style={s.kcalLabel}>Daily calorie target</Text>
        <GradientText style={s.kcalValue} colors={['#10b981', '#22D3EE']}>{t.kcal.toLocaleString()}</GradientText>
        <Text style={s.kcalUnit}>kcal per day</Text>
      </View>

      <View style={s.macroCard}>
        {macros.map(({ label, value, color, pct }, i) => (
          <View key={label} style={[i < macros.length - 1 && { marginBottom: 18 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <Text style={s.macroLabel}>{label}</Text>
              <Text style={[s.macroValue, { color }]}>
                {value}g{'  '}
                <Text style={s.macroPct}>{Math.round(pct * 100)}%</Text>
              </Text>
            </View>
            <BarFill pct={pct} color={color} delay={i * 110} maxWidth={BAR_W_CARD} />
          </View>
        ))}
      </View>

      <View style={[s.insightBox, { backgroundColor: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.22)' }]}>
        <Text style={{ fontSize: 16 }}>🥗</Text>
        <Text style={[s.insightText, { flex: 1 }]}>
          {goals[0] === 'Weight Loss'
            ? 'Protein keeps you full while the deficit burns fat. Hit your target every day.'
            : goals[0] === 'Muscle Gain'
            ? 'A calorie surplus fuels muscle synthesis. These targets give you the edge.'
            : 'Hit your daily targets consistently and results will follow.'}
        </Text>
      </View>
    </View>
  )
}

// ── Transformation timeline slide ─────────────────────────────────────────────

function TransformationSlide({ goals }: { goals: string[] }) {
  const { eyebrowStyle, titleStyle } = useSlideEntrance()
  const primaryGoal = goals[0] ?? 'General Fitness'
  const tl = TIMELINE[primaryGoal] ?? ['Building momentum', 'Visible progress', 'Transformation complete']

  const milestones = [
    { week: 'Week 1-2', label: 'Momentum', desc: tl[0], color: '#22D3EE', pct: 0.15 },
    { week: 'Month 1', label: 'Progress', desc: tl[1], color: '#A855F7', pct: 0.48 },
    { week: 'Month 3', label: 'Transformation', desc: tl[2], color: '#f59e0b', pct: 0.9 },
  ]

  return (
    <View style={s.slideContent}>
      <Animated.Text style={[s.eyebrow, { color: '#f59e0b' }, eyebrowStyle]}>What to expect</Animated.Text>
      <Animated.Text style={[s.slideTitle, titleStyle]}>Your{'\n'}roadmap.</Animated.Text>

      {milestones.map(({ week, label, desc, color, pct }, i) => (
        <View key={week} style={[s.timelineCard, { backgroundColor: `${color}0d`, borderColor: `${color}24` }]}>
          <View style={s.timelineHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.timelineDot, { backgroundColor: color }]} />
              <Text style={[s.timelineWeek, { color }]}>{week}</Text>
            </View>
            <Text style={s.timelineLabel}>{label}</Text>
          </View>
          <BarFill pct={pct} color={color} delay={200 + i * 160} maxWidth={BAR_W_TIMELINE} />
          <Text style={s.timelineDesc}>{desc}</Text>
        </View>
      ))}

      <View style={[s.insightBox, { backgroundColor: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.2)' }]}>
        <Text style={{ fontSize: 16 }}>📈</Text>
        <Text style={[s.insightText, { flex: 1 }]}>Most people see their first real shift around week 3 to 4. Stay consistent - the compounding effect is real.</Text>
      </View>
    </View>
  )
}

// ── Ready slide ───────────────────────────────────────────────────────────────

function ReadySlide({ formData }: { formData?: WorkoutFormData }) {
  const primaryGoal = formData?.goals[0] ?? 'General Fitness'
  const tagline = GOAL_TAGLINE[primaryGoal] ?? 'Consistent effort beats perfect planning. Start now.'
  const scale = useRef(new Animated.Value(0.1)).current
  const contentOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 14 }),
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    ]).start()
  }, [])

  return (
    <View style={s.slideCenter}>
      <Animated.View style={[s.heroIcon, { borderRadius: 64, transform: [{ scale }] }]}>
        <LinearGradient colors={['rgba(168,85,247,0.3)', 'rgba(34,211,238,0.2)']} style={s.heroIconGrad}>
          <Text style={{ fontSize: 56, lineHeight: 70 }}>🚀</Text>
        </LinearGradient>
      </Animated.View>

      <Animated.View style={{ opacity: contentOpacity, alignItems: 'center', gap: 16 }}>
        <Text style={s.eyebrow}>All set</Text>
        <Text style={s.heroTitle}>Time to do{'\n'}the work.</Text>
        <Text style={[s.heroPlan, { textAlign: 'center', maxWidth: 280 }]}>{tagline}</Text>

        <View style={s.featuresGrid}>
          {[
            { icon: '📋', label: 'Full Workout Plan', desc: 'Your complete program', color: Colors.purple },
            { icon: '🎯', label: 'Smart Coaching', desc: 'Tips built into every session', color: Colors.cyan },
            { icon: '🥗', label: 'Nutrition Tracker', desc: 'Hit your macro targets', color: '#10b981' },
            { icon: '📈', label: 'Progress History', desc: 'Track every milestone', color: '#f59e0b' },
          ].map(({ icon, label, desc, color }) => (
            <View key={label} style={[s.featureCard, { backgroundColor: `${color}0d`, borderColor: `${color}22` }]}>
              <Text style={{ fontSize: 24 }}>{icon}</Text>
              <Text style={s.featureLabel}>{label}</Text>
              <Text style={s.featureDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const { plan, analysis, formData: formDataStr } = route.params
  const userId = getUserId()

  const { data: profileData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })
  const userName = useMemo(() => {
    const profiles = (profileData?.userProfiles ?? []) as Array<{ name?: string }>
    return profiles[0]?.name?.split(' ')[0] ?? ''
  }, [profileData])

  const formData = useMemo<WorkoutFormData | undefined>(() => {
    try { return formDataStr ? JSON.parse(formDataStr) as WorkoutFormData : undefined } catch { return undefined }
  }, [formDataStr])

  const analysisSections = useMemo(() =>
    analysis ? parseAnalysisSections(analysis) : [], [analysis])

  const hasNutrition = useMemo(() => !!getNutritionProfile(), [])

  // Build slide index map
  const SLIDE_CELEBRATION = 0
  const SLIDE_PROFILE = formData ? 1 : -1
  const SLIDE_AI_START = formData ? 2 : 1
  const AI_COUNT = analysisSections.length
  const SLIDE_TRAINING = SLIDE_AI_START + AI_COUNT
  const SLIDE_NUTRITION = hasNutrition ? SLIDE_TRAINING + 1 : -1
  const SLIDE_TRANSFORM = SLIDE_TRAINING + (hasNutrition ? 2 : 1)
  const SLIDE_READY = SLIDE_TRANSFORM + 1
  const TOTAL = SLIDE_READY + 1

  const [slideIdx, setSlideIdx] = useState(0)
  const slideOpacity = useRef(new Animated.Value(1)).current
  const slideY = useRef(new Animated.Value(0)).current
  const progressWidth = useRef(new Animated.Value(((1) / TOTAL) * (W - 32))).current
  const scrollRef = useRef<ScrollView>(null)

  function goTo(next: number) {
    const ease = Easing.bezier(0.4, 0, 0.2, 1)
    const dir = next > slideIdx ? 1 : -1
    Animated.parallel([
      Animated.timing(slideOpacity, { toValue: 0, duration: 140, easing: ease, useNativeDriver: true }),
      Animated.timing(slideY, { toValue: dir * -24, duration: 140, easing: ease, useNativeDriver: true }),
    ]).start(() => {
      setSlideIdx(next)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
      slideY.setValue(dir * 24)
      Animated.parallel([
        Animated.timing(slideOpacity, { toValue: 1, duration: 240, easing: ease, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 0, duration: 240, easing: ease, useNativeDriver: true }),
      ]).start()
    })
    Animated.timing(progressWidth, {
      toValue: ((next + 1) / TOTAL) * (W - 32),
      duration: 380,
      easing: ease,
      useNativeDriver: false,
    }).start()
  }

  const isFirst = slideIdx === 0
  const isLast = slideIdx === SLIDE_READY
  const isAI = slideIdx >= SLIDE_AI_START && slideIdx < SLIDE_TRAINING

  const nextLabel = (() => {
    if (isFirst) return 'See My Results'
    if (slideIdx === SLIDE_PROFILE) return AI_COUNT > 0 ? 'View Analysis' : 'Training Split'
    if (isAI && slideIdx === SLIDE_TRAINING - 1) return 'Training Split'
    if (slideIdx === SLIDE_TRAINING) return hasNutrition ? 'Check Nutrition' : 'What to Expect'
    if (slideIdx === SLIDE_NUTRITION) return 'What to Expect'
    if (slideIdx === SLIDE_TRANSFORM) return 'Ready'
    return 'Next'
  })()

  const renderSlide = () => {
    if (slideIdx === SLIDE_CELEBRATION) return <CelebrationSlide formData={formData} userName={userName} />
    if (slideIdx === SLIDE_PROFILE && formData) return <ProfileStatsSlide formData={formData} />
    if (isAI) {
      const section = analysisSections[slideIdx - SLIDE_AI_START]
      if (section) return <AnalysisSectionSlide section={section} />
    }
    if (slideIdx === SLIDE_TRAINING) return <TrainingWeekSlide formData={formData} plan={plan} />
    if (slideIdx === SLIDE_NUTRITION) return <NutritionSlide goals={formData?.goals ?? []} />
    if (slideIdx === SLIDE_TRANSFORM) return <TransformationSlide goals={formData?.goals ?? []} />
    if (slideIdx === SLIDE_READY) return <ReadySlide formData={formData} />
    return null
  }

  return (
    <SafeAreaView style={s.container}>
      <LinearGradient colors={['#0f0a2e', Colors.bg]} locations={[0, 0.45]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      {/* Top progress bar */}
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { width: progressWidth }]} />
      </View>

      {/* Slide counter */}
      <View style={s.topRow}>
        <Text style={s.slideCounter}>{slideIdx + 1} / {TOTAL}</Text>
        <View style={s.dotsRow}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[
              s.dot,
              i === slideIdx ? s.dotActive : i < slideIdx ? s.dotDone : s.dotInactive,
            ]} />
          ))}
        </View>
      </View>

      {/* Slide content */}
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: slideOpacity, transform: [{ translateY: slideY }] }}>
          {renderSlide()}
        </Animated.View>
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Sticky bottom nav */}
      <View style={s.stickyNav}>
        <View style={s.navInner}>
          <View style={s.navDotsRow}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[
                s.navDot,
                {
                  width: i === slideIdx ? 20 : 5,
                  backgroundColor: i === slideIdx
                    ? Colors.purple
                    : i < slideIdx ? 'rgba(168,85,247,0.42)' : 'rgba(255,255,255,0.1)',
                },
              ]} />
            ))}
          </View>

          <View style={s.btnRow}>
            {!isFirst && (
              <TouchableOpacity style={s.backBtn} onPress={() => goTo(slideIdx - 1)} activeOpacity={0.7}>
                <Text style={s.backBtnText}>‹</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.nextBtnWrap}
              onPress={() => {
                if (isLast) {
                  void markOnboardingSeen(userId)
                  navigation.reset({
                    index: 0,
                    routes: [{
                      name: 'App',
                      state: { routes: [{ name: 'Workout' }], index: 0 },
                    }],
                  })
                } else {
                  goTo(slideIdx + 1)
                }
              }}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#A855F7', '#22D3EE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.nextBtn}>
                <Text style={s.nextBtnText}>{isLast ? 'View My Full Plan  →' : nextLabel}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16 },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: Colors.purple },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
  slideCounter: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 0.8 },
  dotsRow: { flexDirection: 'row', gap: 4 },
  dot: { height: 5, borderRadius: 2.5 },
  dotActive: { width: 20, backgroundColor: Colors.purple },
  dotDone: { width: 5, backgroundColor: 'rgba(168,85,247,0.42)' },
  dotInactive: { width: 5, backgroundColor: 'rgba(255,255,255,0.1)' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4 },

  // Slide layouts
  slideCenter: { alignItems: 'center', gap: 32, paddingTop: 8 },
  slideContent: { gap: 24, paddingTop: 4 },

  // Hero icon
  heroIcon: {
    width: 128, height: 128, borderRadius: 28, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.45)',
    shadowColor: Colors.purple, shadowRadius: 40, shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  heroIconGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Typography
  eyebrow: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2.2,
    textTransform: 'uppercase', color: Colors.purple, textAlign: 'center',
  },
  heroTitle: {
    fontSize: 42, fontWeight: '900', color: Colors.textPrimary,
    letterSpacing: -1, textAlign: 'center', lineHeight: 46,
  },
  heroPlan: { fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 24 },
  slideTitle: { fontSize: 44, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5, lineHeight: 50 },
  heroNum: { fontSize: 56, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -2 },
  heroNum2: { fontSize: 29, fontWeight: '900', letterSpacing: -0.5 },
  heroNumSub: { fontSize: 15, color: 'rgba(255,255,255,0.22)', fontWeight: '500', lineHeight: 19 },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  badgeText: { fontSize: 13, fontWeight: '700' },

  // Stats row (celebration)
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statItem: { alignItems: 'center' },
  statItemBorder: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.08)', paddingLeft: 16 },
  statValue: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 3 },

  // BMI card
  bmiCard: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1 },
  bmiCircle: { width: 76, height: 76, borderRadius: 38, borderWidth: 6, alignItems: 'center', justifyContent: 'center' },
  bmiValue: { fontSize: 20, fontWeight: '900' },
  bmiUnit: { fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  bmiCat: { fontSize: 18, fontWeight: '900' },
  bmiSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  bmiNote: { fontSize: 11, color: Colors.textDim, lineHeight: 15, marginTop: 5 },

  // Stats grid
  statsGrid: { flexDirection: 'row', gap: 8 },
  statsGridItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 4 },
  statsGridValue: { fontSize: 13, fontWeight: '700' },
  statsGridLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Section icon
  sectionIcon: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Markdown card
  mdCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16 },

  // Insight box
  insightBox: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'flex-start' },
  insightBoxLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
  insightText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 18 },

  // Day grid
  dayGrid: { flexDirection: 'row', gap: 5 },
  dayCell: { flex: 1, height: 50, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  dayCellGrad: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  dayCellLabel: { fontSize: 13, fontWeight: '800', color: 'rgba(255,255,255,0.2)' },
  dayCellLabelActive: { fontSize: 13, fontWeight: '800', color: '#fff' },

  // Equipment chips
  equipChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  equipChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },

  // Calorie card
  kcalCard: { backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', padding: 24, alignItems: 'center' },
  kcalLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  kcalValue: { fontSize: 64, fontWeight: '900', color: '#10b981', letterSpacing: -2 },
  kcalUnit: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 4 },

  // Macro card
  macroCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: CARD_PAD },
  macroLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  macroValue: { fontSize: 20, fontWeight: '900' },
  macroPct: { fontSize: 12, color: Colors.textDim, fontWeight: '500' },

  // Timeline
  timelineCard: { padding: 14, borderRadius: 16, borderWidth: 1, gap: 10 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineWeek: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  timelineLabel: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  timelineDesc: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 18 },

  // Features grid
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  featureCard: { width: '47%', padding: 14, borderRadius: 16, borderWidth: 1, gap: 6 },
  featureLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  featureDesc: { fontSize: 10, color: Colors.textDim },

  // Bottom nav
  stickyNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 28, paddingHorizontal: 16, paddingTop: 12,
  },
  navInner: {
    maxWidth: 420, alignSelf: 'center', width: '100%',
    backgroundColor: 'rgba(3,0,20,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 24,
  },
  navDotsRow: { flexDirection: 'row', gap: 4, justifyContent: 'center', marginBottom: 10 },
  navDot: { height: 5, borderRadius: 2.5 },
  btnRow: { flexDirection: 'row', gap: 8 },
  backBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 22, fontWeight: '400', lineHeight: 26 },
  nextBtnWrap: { flex: 1 },
  nextBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
