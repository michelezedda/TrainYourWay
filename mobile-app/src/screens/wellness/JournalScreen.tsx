import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { saveJournalEntry, getJournalEntries, saveSession, type JournalEntry } from '@/lib/wellness'
import { useLocale } from '@/context/LocaleContext'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'
import GradientText from '@/components/GradientText'

const PROMPTS = [
  'What made you smile today?',
  "What's one thing you're grateful for right now?",
  "What's been weighing on your mind lately?",
  'How would you describe your energy this week?',
  "What's a small win you had recently?",
  'What would make today feel like a success?',
  "What are you most proud of this month?",
  "What's something you want to let go of?",
  'How are you taking care of yourself right now?',
  'What does your body need from you today?',
  'Describe your ideal recovery day.',
  'What thought patterns have you noticed this week?',
  'What are three things going well in your life?',
  'How has training been affecting your mood?',
  'What boundaries do you want to set this week?',
  "What's one thing you'd tell yourself from a month ago?",
  'How do you feel physically vs emotionally today?',
  'What motivated you to show up this week?',
  'Who in your life is lifting you up right now?',
  "What's your intention for the rest of this week?",
]

const MOOD_TAGS = [
  { id: 'grateful', label: 'Grateful', emoji: '🙏', color: '#34D399' },
  { id: 'motivated', label: 'Motivated', emoji: '🔥', color: '#F87171' },
  { id: 'calm', label: 'Calm', emoji: '🌊', color: '#22D3EE' },
  { id: 'tired', label: 'Tired', emoji: '😴', color: '#818CF8' },
  { id: 'anxious', label: 'Anxious', emoji: '😰', color: '#FBBF24' },
  { id: 'proud', label: 'Proud', emoji: '💪', color: '#A855F7' },
  { id: 'reflective', label: 'Reflective', emoji: '🪞', color: '#6366F1' },
  { id: 'hopeful', label: 'Hopeful', emoji: '🌱', color: '#10B981' },
]

function EntryCard({ entry, open, onToggle }: { entry: JournalEntry; open: boolean; onToggle: () => void }) {
  const tag = MOOD_TAGS.find(t => t.id === entry.moodTag)
  const { formatDate } = useLocale()
  return (
    <View style={entryStyles.card}>
      <TouchableOpacity onPress={onToggle} style={entryStyles.header} activeOpacity={0.85}>
        <View style={entryStyles.headerLeft}>
          <View style={entryStyles.dateRow}>
            <Text style={entryStyles.date}>{formatDate(entry.timestamp, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            {tag && (
              <View style={[entryStyles.tagBadge, { backgroundColor: tag.color + '20', borderColor: tag.color + '40' }]}>
                <Text style={[entryStyles.tagText, { color: tag.color }]}>{tag.emoji} {tag.label}</Text>
              </View>
            )}
          </View>
          <Text style={entryStyles.prompt} numberOfLines={1}>{entry.prompt}</Text>
        </View>
        <Text style={entryStyles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={entryStyles.body}>
          <Text style={entryStyles.promptItalic}>{entry.prompt}</Text>
          <Text style={entryStyles.content}>{entry.content}</Text>
        </View>
      )}
    </View>
  )
}

const entryStyles = StyleSheet.create({
  card: { backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: Spacing.md, gap: Spacing.sm },
  headerLeft: { flex: 1, gap: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  date: { ...Typography.body, color: Colors.textSecondary, fontWeight: '600' },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '700' },
  prompt: { ...Typography.caption, color: Colors.textDim },
  chevron: { color: Colors.textDim, fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.separator, gap: 8, paddingTop: 12 },
  promptItalic: { ...Typography.caption, color: Colors.textDim, fontStyle: 'italic' },
  content: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
})

type ViewType = 'write' | 'done'

export default function JournalScreen() {
  const navigation = useNavigation()
  const [viewType, setViewType] = useState<ViewType>('write')
  const [content, setContent] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [openEntry, setOpenEntry] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
  const prompt = PROMPTS[dayOfYear % PROMPTS.length]

  useEffect(() => {
    getJournalEntries().then(setEntries)
  }, [])

  const handleSave = async () => {
    if (!content.trim() || !selectedTag) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 300))
    await saveJournalEntry({ date: new Date().toISOString().slice(0, 10), prompt, content: content.trim(), moodTag: selectedTag })
    await saveSession('journal', Math.max(60, content.trim().split(' ').length * 3))
    const updated = await getJournalEntries()
    setEntries(updated)
    setSaving(false)
    setViewType('done')
  }

  const tag = MOOD_TAGS.find(t => t.id === selectedTag)
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  // ── Done ───────────────────────────────────────────────────────────────────

  if (viewType === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <GradientText containerStyle={{ flex: 1 }} style={styles.headerTitle} colors={['#34D399', '#22D3EE']}>Journal</GradientText>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.doneHero}>
            <Text style={{ fontSize: 48, lineHeight: 60 }}>📔</Text>
            <Text style={styles.doneTitle}>Entry saved.</Text>
            <Text style={styles.doneSub}>Writing it down makes it real. Come back tomorrow.</Text>
          </View>

          {entries.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Past entries</Text>
              <View style={{ gap: Spacing.sm }}>
                {entries.slice(0, 6).map(e => (
                  <EntryCard key={e.id} entry={e} open={openEntry === e.id} onToggle={() => setOpenEntry(openEntry === e.id ? null : e.id)} />
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => { setContent(''); setSelectedTag(null); setViewType('write') }}>
            <Text style={styles.primaryBtnText}>Write another entry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.ghostBtnText}>Back to Mindspace</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <GradientText style={styles.headerTitle} colors={['#34D399', '#22D3EE']}>Journal</GradientText>
          <Text style={styles.subtitle}>Reflect. Release. Grow.</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <GlassCard style={styles.promptCard}>
            <Text style={styles.promptLabel}>Today's prompt</Text>
            <Text style={styles.promptText}>{prompt}</Text>
          </GlassCard>

          <View>
            <Text style={styles.sectionLabel}>How are you feeling?</Text>
            <View style={styles.tagRow}>
              {MOOD_TAGS.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTag(selectedTag === t.id ? null : t.id)}
                  style={[styles.tagChip, selectedTag === t.id && { backgroundColor: t.color + '20', borderColor: t.color + '55' }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tagChipText, selectedTag === t.id && { color: t.color }]}>{t.emoji} {t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={styles.sectionLabel}>Your thoughts</Text>
            <TextInput
              style={[styles.textarea, content.length > 0 && styles.textareaActive]}
              value={content}
              onChangeText={setContent}
              placeholder="Write freely. No judgment, no edits. Just you..."
              placeholderTextColor={Colors.textDim}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              underlineColorAndroid="transparent"
              selectionColor="#A855F7"
            />
            <View style={styles.wordRow}>
              <Text style={styles.wordCount}>{wordCount} words</Text>
              {content.length > 0 && <Text style={styles.keepGoing}>Keep going...</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!content.trim() || !selectedTag || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!content.trim() || !selectedTag || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save entry{tag && !saving ? ` ${tag.emoji}` : ''}</Text>
            }
          </TouchableOpacity>

          {!selectedTag && content.trim().length > 0 && (
            <Text style={styles.tagReminder}>Pick a mood tag to save</Text>
          )}

          {entries.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Past entries</Text>
              <View style={{ gap: Spacing.sm }}>
                {entries.slice(0, 5).map(e => (
                  <EntryCard key={e.id} entry={e} open={openEntry === e.id} onToggle={() => setOpenEntry(openEntry === e.id ? null : e.id)} />
                ))}
              </View>
            </>
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
  headerTextCol: { flex: 1 },
  subtitle: { ...Typography.caption, color: Colors.textMuted },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  promptCard: { borderColor: 'rgba(52,211,153,0.2)', backgroundColor: 'rgba(52,211,153,0.08)' },
  promptLabel: { fontSize: 11, fontWeight: '800', color: '#34D399', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  promptText: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary, lineHeight: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  tagChipText: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  textarea: { backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder, color: Colors.textPrimary, fontSize: 15, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 160 },
  textareaActive: { borderColor: 'rgba(52,211,153,0.3)' },
  wordRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  wordCount: { ...Typography.caption, color: Colors.textDim },
  keepGoing: { ...Typography.caption, color: Colors.textDim },
  saveBtn: { backgroundColor: 'rgba(52,211,153,0.35)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', paddingVertical: 20, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tagReminder: { textAlign: 'center', ...Typography.caption, color: Colors.textDim },
  doneHero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  doneTitle: { ...Typography.h2, fontSize: 28 },
  doneSub: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  primaryBtn: { backgroundColor: 'rgba(52,211,153,0.3)', borderRadius: Radius.xl, borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)', paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 14, alignItems: 'center', backgroundColor: Colors.cardBg, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.cardBorder },
  ghostBtnText: { color: Colors.textMuted, fontWeight: '600' },
})
