import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { id } from '@instantdb/react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { draftSupportTicket } from '@/lib/gemini'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'
import GradientText from '@/components/GradientText'

const CATEGORIES = [
  { label: 'Coaching tips', icon: '💡', desc: 'A tip seemed wrong or unhelpful' },
  { label: 'Plan generation', icon: '📋', desc: 'Plan failed or looks incorrect' },
  { label: 'Diet tracker', icon: '🍎', desc: 'Food logging or nutrition issue' },
  { label: 'App bug', icon: '🐛', desc: 'Something is broken' },
  { label: 'Data or history', icon: '📊', desc: 'Plans or history missing/wrong' },
  { label: 'Other', icon: '💬', desc: 'Anything else' },
]

type Step = 'category' | 'details' | 'done'

interface StoredTicket {
  id: string
  category: string
  description: string
  draft: string
  status: string
  createdAt: number
}

function TicketCard({ ticket }: { ticket: StoredTicket }) {
  const [expanded, setExpanded] = useState(false)
  const isSolved = ticket.status === 'solved'
  return (
    <View style={ticketStyles.card}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} style={ticketStyles.header} activeOpacity={0.85}>
        <View style={ticketStyles.headerLeft}>
          <View style={[ticketStyles.statusDot, { backgroundColor: isSolved ? '#22c55e' : '#f59e0b' }]} />
          <Text style={ticketStyles.category}>{ticket.category}</Text>
        </View>
        <Text style={ticketStyles.status}>{isSolved ? 'Solved' : 'Open'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={ticketStyles.body}>
          <Text style={ticketStyles.description}>{ticket.description}</Text>
          {ticket.draft ? <Text style={ticketStyles.draft}>{ticket.draft}</Text> : null}
        </View>
      )}
    </View>
  )
}

const ticketStyles = StyleSheet.create({
  card: { backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  category: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
  status: { ...Typography.caption, color: Colors.textMuted },
  body: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.separator, gap: Spacing.sm },
  description: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  draft: { ...Typography.bodySmall, color: Colors.textMuted, fontStyle: 'italic', lineHeight: 20 },
})

export default function SupportScreen() {
  const insets = useSafeAreaInsets()
  const userId = getUserId()
  const [view, setView] = useState<'new' | 'tickets'>('new')
  const [step, setStep] = useState<Step>('category')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data } = db.useQuery({ supportTickets: { $: { where: { userId } } } })
  const tickets = (data?.supportTickets ?? []) as StoredTicket[]

  const handleDraft = async () => {
    if (!description.trim() || !selectedCategory) return
    setDrafting(true)
    try {
      const result = await draftSupportTicket(selectedCategory, description)
      setDraft(result)
    } catch {
      setDraft('')
    } finally {
      setDrafting(false)
    }
  }

  const handleSubmit = async () => {
    if (!description.trim() || !selectedCategory) return
    setSubmitting(true)
    try {
      await db.transact(
        db.tx.supportTickets[id()].update({
          userId,
          category: selectedCategory,
          description: description.trim(),
          draft: draft.trim(),
          status: 'open',
          createdAt: Date.now(),
        }),
      )
      setStep('done')
    } catch {
      // stay on details
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setStep('category')
    setSelectedCategory('')
    setDescription('')
    setDraft('')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <GradientText style={styles.headerTitle}>Support</GradientText>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, view === 'new' && styles.tabActive]} onPress={() => setView('new')}>
            <Text style={[styles.tabText, view === 'new' && styles.tabTextActive]}>New ticket</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, view === 'tickets' && styles.tabActive]} onPress={() => setView('tickets')}>
            <Text style={[styles.tabText, view === 'tickets' && styles.tabTextActive]}>My tickets</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tickets view */}
      {view === 'tickets' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {tickets.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={{ fontSize: 32, lineHeight: 42 }}>📭</Text>
              <Text style={styles.emptyTitle}>No tickets yet</Text>
              <Text style={styles.emptyDesc}>Your support tickets will appear here.</Text>
            </GlassCard>
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {tickets.sort((a, b) => b.createdAt - a.createdAt).map(t => (
                <TicketCard key={t.id} ticket={t} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* New ticket view */}
      {view === 'new' && (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Done state */}
            {step === 'done' && (
              <GlassCard style={styles.doneCard}>
                <Text style={{ fontSize: 48, lineHeight: 60 }}>✅</Text>
                <Text style={styles.doneTitle}>Ticket submitted!</Text>
                <Text style={styles.doneSub}>We'll review your report and get back to you soon.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={reset}>
                  <Text style={styles.primaryBtnText}>Submit another</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setView('tickets')}>
                  <Text style={styles.ghostBtnText}>View my tickets</Text>
                </TouchableOpacity>
              </GlassCard>
            )}

            {/* Category step */}
            {step === 'category' && (
              <>
                <Text style={styles.stepTitle}>What's the issue?</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.label}
                      style={[styles.categoryCard, selectedCategory === c.label && styles.categoryCardActive]}
                      onPress={() => setSelectedCategory(c.label)}
                      activeOpacity={0.85}
                    >
                      <Text style={{ fontSize: 24, marginBottom: 4 }}>{c.icon}</Text>
                      <Text style={styles.categoryLabel}>{c.label}</Text>
                      <Text style={styles.categoryDesc}>{c.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.primaryBtn, !selectedCategory && styles.primaryBtnDisabled]}
                  onPress={() => selectedCategory && setStep('details')}
                  disabled={!selectedCategory}
                >
                  <Text style={styles.primaryBtnText}>Next</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Details step */}
            {step === 'details' && (
              <>
                <View style={styles.stepHeader}>
                  <TouchableOpacity onPress={() => setStep('category')} style={styles.backChip}>
                    <Text style={styles.backChipText}>← {selectedCategory}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.stepTitle}>Describe what happened</Text>

                <TextInput
                  style={[styles.textarea, description.length > 0 && styles.textareaActive]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the issue in as much detail as possible..."
                  placeholderTextColor={Colors.textDim}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  underlineColorAndroid="transparent"
                  selectionColor="#A855F7"
                />

                <TouchableOpacity
                  style={[styles.draftBtn, (!description.trim() || drafting) && styles.draftBtnDisabled]}
                  onPress={handleDraft}
                  disabled={!description.trim() || drafting}
                >
                  {drafting ? <ActivityIndicator color={Colors.purpleLight} /> : <Text style={styles.draftBtnText}>AI - Improve description</Text>}
                </TouchableOpacity>

                {draft.length > 0 && (
                  <GlassCard style={styles.draftCard}>
                    <Text style={styles.draftLabel}>AI-improved description</Text>
                    <Text style={styles.draftText}>{draft}</Text>
                    <TouchableOpacity onPress={() => setDescription(draft)} style={styles.useDraftBtn}>
                      <Text style={styles.useDraftText}>Use this version</Text>
                    </TouchableOpacity>
                  </GlassCard>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, (!description.trim() || submitting) && styles.primaryBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={!description.trim() || submitting}
                >
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit report</Text>}
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator, gap: Spacing.sm },
  headerTitle: { ...Typography.h3 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.cardBg, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.purpleDim },
  tabText: { ...Typography.body, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.purpleLight },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  stepTitle: { ...Typography.h3, fontSize: 20 },
  stepHeader: { marginBottom: 4 },
  backChip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backChipText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  categoryCard: { width: '47.5%', padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  categoryCardActive: { backgroundColor: Colors.purpleDim, borderColor: Colors.purpleBorder },
  categoryLabel: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  categoryDesc: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  textarea: { backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, color: Colors.textPrimary, fontSize: 15, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 140 },
  textareaActive: { borderColor: Colors.purpleBorder },
  draftBtn: { paddingVertical: 14, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.purpleBorder, backgroundColor: Colors.purpleDim, alignItems: 'center' },
  draftBtnDisabled: { opacity: 0.4 },
  draftBtnText: { color: Colors.purpleLight, fontWeight: '600', fontSize: 14 },
  draftCard: { gap: Spacing.sm },
  draftLabel: { ...Typography.label },
  draftText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  useDraftBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.purpleDim, borderWidth: 1, borderColor: Colors.purpleBorder },
  useDraftText: { fontSize: 13, color: Colors.purpleLight, fontWeight: '600' },
  primaryBtn: { backgroundColor: Colors.purple, borderRadius: Radius.xl, paddingVertical: 16, alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  ghostBtnText: { color: Colors.textMuted, fontWeight: '600' },
  emptyCard: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyTitle: { ...Typography.h3 },
  emptyDesc: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  doneCard: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  doneTitle: { ...Typography.h2, fontSize: 28 },
  doneSub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
})
