import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { extractPlanFromImage, analyzeImportedPlan, improveImportedPlan } from '@/lib/gemini'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import type { RootStackParamList } from '@/navigation/types'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

type Nav = NativeStackNavigationProp<RootStackParamList>

export default function ImportScreen() {
  const navigation = useNavigation<Nav>()
  const userId = getUserId()
  const [planText, setPlanText] = useState('')
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0].base64) {
      setLoading(true)
      setError(null)
      try {
        const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`
        const extracted = await extractPlanFromImage(dataUrl)
        setPlanText(extracted)
        setMode('text')
      } catch (e) {
        setError('Failed to extract plan from image. Please try pasting the text manually.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleAnalyze = async () => {
    if (!planText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeImportedPlan(planText, '')
      setAnalysis(result)
    } catch (e) {
      setError('Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleImproveAndSave = async () => {
    if (!planText.trim()) return
    setLoading(true)
    setError(null)
    try {
      const improved = await improveImportedPlan(planText, '')
      const planId = id()
      await db.transact(
        db.tx.workoutPlans[planId].update({
          userId,
          userName: 'Imported Plan',
          fitnessLevel: 'intermediate',
          goals: '[]',
          equipment: '[]',
          constraints: '',
          plan: improved,
          createdAt: Date.now(),
        }),
      )
      navigation.replace('Results', { planId, plan: improved })
    } catch (e) {
      setError('Failed to improve and save plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAsIs = async () => {
    if (!planText.trim()) return
    setLoading(true)
    try {
      const planId = id()
      await db.transact(
        db.tx.workoutPlans[planId].update({
          userId,
          userName: 'Imported Plan',
          fitnessLevel: 'intermediate',
          goals: '[]',
          equipment: '[]',
          constraints: '',
          plan: planText,
          createdAt: Date.now(),
        }),
      )
      navigation.replace('Results', { planId, plan: planText })
    } catch (e) {
      setError('Failed to save plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Plan</Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.desc}>
            Import a workout plan from an image or paste the text directly.
          </Text>

          <View style={styles.tabRow}>
            {(['text', 'image'] as const).map(m => (
              <TouchableOpacity key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)}>
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'text' ? 'Paste Text' : 'Scan Image'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'image' ? (
            <TouchableOpacity style={styles.photoBtn} onPress={pickImage} activeOpacity={0.7}>
              <Text style={{ fontSize: 32, lineHeight: 42 }}>📷</Text>
              <Text style={styles.photoBtnText}>Take or select a photo of your plan</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Paste your plan text</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={planText}
                onChangeText={setPlanText}
                placeholder="Paste your workout plan here..."
                placeholderTextColor={Colors.textDim}
                multiline
                numberOfLines={12}
                underlineColorAndroid="transparent"
                selectionColor="#A855F7"
              />
            </View>
          )}

          {planText.trim().length > 0 && (
            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>Plan ready to import</Text>
              <View style={styles.actionBtns}>
                <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} disabled={loading}>
                  <Text style={styles.analyzeBtnText}>Analyse Plan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.improveBtn} onPress={handleImproveAndSave} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.improveBtnText}>Improve + Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAsIs} disabled={loading}>
                  <Text style={styles.saveBtnText}>Save As-Is</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {analysis && (
            <View style={styles.analysisCard}>
              <Text style={styles.analysisTitle}>AI Analysis</Text>
              <Text style={styles.analysisText}>{analysis}</Text>
            </View>
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
          {loading && !analysis && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.purple} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

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
  scroll: { padding: Spacing.md, gap: Spacing.md },
  desc: { ...Typography.body, color: Colors.textMuted },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.purpleDim },
  tabText: { ...Typography.body, color: Colors.textMuted, fontWeight: '600' },
  tabTextActive: { color: Colors.purpleLight },
  photoBtn: { borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, borderStyle: 'dashed', paddingVertical: 40, alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.cardBg },
  photoBtnText: { ...Typography.body, color: Colors.textMuted },
  field: { gap: Spacing.sm },
  label: { ...Typography.label },
  input: { backgroundColor: Colors.cardBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, color: Colors.textPrimary, fontSize: 15, paddingHorizontal: Spacing.md, paddingVertical: 12 },
  textarea: { minHeight: 200, textAlignVertical: 'top' },
  actionsCard: { backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, gap: Spacing.md },
  actionsTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  actionBtns: { gap: 10 },
  analyzeBtn: { paddingVertical: 12, borderRadius: Radius.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.purpleBorder, backgroundColor: Colors.purpleDim },
  analyzeBtnText: { color: Colors.purpleLight, fontWeight: '600' },
  improveBtn: { paddingVertical: 12, borderRadius: Radius.xl, alignItems: 'center', backgroundColor: Colors.purple },
  improveBtnText: { color: '#fff', fontWeight: '700' },
  saveBtn: { paddingVertical: 12, borderRadius: Radius.xl, alignItems: 'center', backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  saveBtnText: { color: Colors.textMuted, fontWeight: '600' },
  analysisCard: { backgroundColor: 'rgba(168,85,247,0.06)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', padding: Spacing.md, gap: Spacing.sm },
  analysisTitle: { ...Typography.label },
  analysisText: { ...Typography.body, color: Colors.textMuted },
  errorText: { color: '#ef4444', fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center' },
  loadingText: { ...Typography.body, color: Colors.textMuted },
})
