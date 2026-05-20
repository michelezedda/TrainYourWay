import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { reevaluateWorkoutPlan, generateReevaluationAnalysis, type ReevaluationData } from '@/lib/gemini'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import BackButton from '@/components/BackButton'
import type { TrainingStackParamList, RootStackParamList } from '@/navigation/types'

type Route = RouteProp<TrainingStackParamList, 'Reevaluate'>
type RootNav = NativeStackNavigationProp<RootStackParamList>

const DIFFICULTIES = ['Too easy', 'Just right', 'Too hard']
const ADHERENCE = ['Every session', 'Most sessions', 'Some sessions', 'Very few sessions']
const TIME_ON_PLAN = ['1-2 weeks', '3-4 weeks', '4-6 weeks', '6-8 weeks', '2+ months']
const GOALS = ['Weight Loss', 'Muscle Gain', 'Strength', 'Endurance', 'Flexibility']

function ToggleChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function ReevaluateScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<RootNav>()
  const route = useRoute<Route>()
  const { planId, originalPlan, userName, fitnessLevel, goals, equipment } = route.params
  const userId = getUserId()

  const [timeOnPlan, setTimeOnPlan] = useState('')
  const [adherence, setAdherence] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [physicalFeel, setPhysicalFeel] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [currentHeight, setCurrentHeight] = useState('')
  const [exercisesToRemove, setExercisesToRemove] = useState('')
  const [newInjuries, setNewInjuries] = useState('')
  const [newGoals, setNewGoals] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = timeOnPlan && adherence && difficulty && physicalFeel && currentWeight && currentHeight

  const handleGenerate = async () => {
    if (!canSubmit) return
    setGenerating(true)
    setError(null)
    try {
      const data: ReevaluationData = {
        originalPlanId: planId,
        originalPlan,
        userName,
        fitnessLevel,
        goals: JSON.parse(goals) as string[],
        equipment: JSON.parse(equipment) as string[],
        timeOnPlan,
        adherence,
        currentWeight,
        currentHeight,
        originalWeight: currentWeight,
        originalHeight: currentHeight,
        physicalFeel,
        difficulty,
        exercisesToRemove,
        newInjuries,
        newGoals,
      }

      const newPlan = await reevaluateWorkoutPlan(data)
      const planDbId = id()
      await db.transact(
        db.tx.workoutPlans[planDbId].update({
          userId,
          userName: `${userName}: Next Phase`,
          fitnessLevel,
          goals,
          equipment,
          constraints: newInjuries || '',
          plan: newPlan,
          createdAt: Date.now(),
          parentPlanId: planId,
        }),
      )
      navigation.replace('Results', { planId: planDbId, plan: newPlan })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Evolve Your Plan</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.desc}>
            After 4-8 weeks on the same plan, evolution drives continued progress. Tell us how it went.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Time on current plan</Text>
            <View style={styles.chipRow}>
              {TIME_ON_PLAN.map(t => <ToggleChip key={t} label={t} selected={timeOnPlan === t} onPress={() => setTimeOnPlan(t)} />)}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Session adherence</Text>
            <View style={styles.chipRow}>
              {ADHERENCE.map(a => <ToggleChip key={a} label={a} selected={adherence === a} onPress={() => setAdherence(a)} />)}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Perceived difficulty</Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map(d => <ToggleChip key={d} label={d} selected={difficulty === d} onPress={() => setDifficulty(d)} />)}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>How do you feel physically?</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={physicalFeel}
              onChangeText={setPhysicalFeel}
              placeholder="e.g. Stronger, more energy, some soreness..."
              placeholderTextColor={Colors.textDim}
              multiline
              numberOfLines={3}
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
          </View>

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>Current weight (kg)</Text>
              <TextInput style={styles.input} value={currentWeight} onChangeText={setCurrentWeight} placeholder="75" placeholderTextColor={Colors.textDim} keyboardType="numeric" underlineColorAndroid="transparent" selectionColor="#A855F7" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Current height (cm)</Text>
              <TextInput style={styles.input} value={currentHeight} onChangeText={setCurrentHeight} placeholder="175" placeholderTextColor={Colors.textDim} keyboardType="numeric" underlineColorAndroid="transparent" selectionColor="#A855F7" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Exercises to remove (optional)</Text>
            <TextInput
              style={styles.input}
              value={exercisesToRemove}
              onChangeText={setExercisesToRemove}
              placeholder="e.g. Burpees, Romanian deadlifts..."
              placeholderTextColor={Colors.textDim}
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>New injuries or limitations (optional)</Text>
            <TextInput
              style={styles.input}
              value={newInjuries}
              onChangeText={setNewInjuries}
              placeholder="e.g. Mild knee pain..."
              placeholderTextColor={Colors.textDim}
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>New goal focus areas (optional)</Text>
            <View style={styles.chipRow}>
              {GOALS.map(g => (
                <ToggleChip key={g} label={g} selected={newGoals.includes(g)}
                  onPress={() => setNewGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} />
              ))}
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.generateBtn, (!canSubmit || generating) && styles.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={!canSubmit || generating}
            activeOpacity={0.85}
          >
            {generating
              ? <><ActivityIndicator color="#fff" style={{ marginRight: 8 }} /><Text style={styles.generateBtnText}>Generating...</Text></>
              : <Text style={styles.generateBtnText}>Generate Evolved Plan</Text>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTitle: { ...Typography.h3, flex: 1 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
  scroll: { padding: Spacing.md, gap: Spacing.lg },
  desc: { ...Typography.body, color: Colors.textMuted },
  field: { gap: Spacing.sm },
  label: { ...Typography.label },
  input: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder,
    color: Colors.textPrimary, fontSize: 16, paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  chipSelected: { backgroundColor: Colors.purpleDim, borderColor: Colors.purpleBorder },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  chipTextSelected: { color: Colors.purpleLight, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 14 },
  generateBtn: { flexDirection: 'row', backgroundColor: Colors.purple, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  generateBtnDisabled: { opacity: 0.4 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
