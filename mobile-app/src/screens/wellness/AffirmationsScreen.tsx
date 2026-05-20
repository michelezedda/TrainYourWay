import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GradientText from '@/components/GradientText'
import BackButton from '@/components/BackButton'

interface Affirmation {
  text: string
  category: string
  icon: string
  color: string
}

const AFFIRMATIONS: Affirmation[] = [
  { text: 'Your consistency is building something great.', category: 'Progress', icon: '📈', color: '#A855F7' },
  { text: 'Rest is part of the process, not a break from it.', category: 'Recovery', icon: '🌙', color: '#6366F1' },
  { text: "You don't need to earn your peace today.", category: 'Self-care', icon: '🕊️', color: '#22D3EE' },
  { text: 'Small steps compound into massive results.', category: 'Mindset', icon: '⚡', color: '#FBBF24' },
  { text: 'Your mind is as important as your body.', category: 'Balance', icon: '🧠', color: '#818CF8' },
  { text: "Progress isn't always visible, but it's always happening.", category: 'Patience', icon: '🌱', color: '#34D399' },
  { text: 'You are stronger than you think.', category: 'Strength', icon: '💪', color: '#F87171' },
  { text: 'Recovery is where growth really happens.', category: 'Recovery', icon: '🔄', color: '#6366F1' },
  { text: "It's okay to take things one breath at a time.", category: 'Calm', icon: '🌊', color: '#22D3EE' },
  { text: 'Every day you show up is a win.', category: 'Progress', icon: '🏆', color: '#FBBF24' },
  { text: 'Be patient with yourself. Transformation takes time.', category: 'Patience', icon: '🦋', color: '#A855F7' },
  { text: 'The work you do in silence speaks loudest.', category: 'Commitment', icon: '🎯', color: '#818CF8' },
  { text: "Your effort today is tomorrow's baseline.", category: 'Mindset', icon: '📊', color: '#34D399' },
  { text: 'Rest is productive. Stillness has power.', category: 'Recovery', icon: '🌿', color: '#10B981' },
  { text: 'You are more resilient than yesterday.', category: 'Growth', icon: '🔥', color: '#F87171' },
  { text: 'Breathe. You are exactly where you need to be.', category: 'Calm', icon: '🌬️', color: '#22D3EE' },
  { text: 'Strength includes knowing when to slow down.', category: 'Balance', icon: '⚖️', color: '#818CF8' },
  { text: 'Your best looks different every day. Both are valid.', category: 'Self-care', icon: '💛', color: '#FBBF24' },
  { text: 'The comeback is always stronger than the setback.', category: 'Resilience', icon: '⬆️', color: '#A855F7' },
  { text: 'Take care of your mind and your body will follow.', category: 'Mindset', icon: '🧘', color: '#6366F1' },
  { text: 'You are enough, exactly as you are right now.', category: 'Self-worth', icon: '✨', color: '#FBBF24' },
  { text: 'Every rep, every breath, every choice adds up.', category: 'Commitment', icon: '💪', color: '#F87171' },
  { text: 'Discipline is self-love in its most honest form.', category: 'Growth', icon: '🌟', color: '#A855F7' },
  { text: 'Your body is capable of more than your mind believes.', category: 'Strength', icon: '🦾', color: '#34D399' },
  { text: "Showing up on hard days is what separates you.", category: 'Resilience', icon: '🛡️', color: '#818CF8' },
]

const CATEGORIES = ['All', ...Array.from(new Set(AFFIRMATIONS.map(a => a.category)))]

export default function AffirmationsScreen() {
  const navigation = useNavigation()
  const [activeCategory, setActiveCategory] = useState('All')
  const [cardIdx, setCardIdx] = useState(() => {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000)
    return dayOfYear % AFFIRMATIONS.length
  })

  const filtered = activeCategory === 'All' ? AFFIRMATIONS : AFFIRMATIONS.filter(a => a.category === activeCategory)
  const safeIdx = cardIdx % filtered.length
  const current = filtered[safeIdx]

  const goNext = () => setCardIdx(i => (i + 1) % filtered.length)
  const goPrev = () => setCardIdx(i => (i - 1 + filtered.length) % filtered.length)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTextCol}>
          <GradientText style={styles.title} colors={['#FBBF24', '#A855F7']}>Affirmations</GradientText>
          <Text style={styles.subtitle}>Words that remind you who you are.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
          <View style={styles.categoryRow}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
                onPress={() => { setActiveCategory(cat); setCardIdx(0) }}
                activeOpacity={0.8}
              >
                <Text style={[styles.catChipText, activeCategory === cat && styles.catChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Main card */}
        <View style={[styles.mainCard, { backgroundColor: current.color + '18', borderColor: current.color + '35' }]}>
          <View style={[styles.iconBox, { backgroundColor: current.color + '18', borderColor: current.color + '28' }]}>
            <Text style={{ fontSize: 28 }}>{current.icon}</Text>
          </View>
          <Text style={styles.affirmText}>"{current.text}"</Text>
          <View style={styles.cardFooter}>
            <View style={[styles.categoryBadge, { backgroundColor: current.color + '18', borderColor: current.color + '28' }]}>
              <Text style={[styles.categoryBadgeText, { color: current.color }]}>{current.category}</Text>
            </View>
            <Text style={styles.counterText}>{safeIdx + 1} / {filtered.length}</Text>
          </View>
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navBtn} onPress={goPrev} activeOpacity={0.8}>
            <Text style={styles.navBtnText}>← Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.navBtn, styles.navBtnPrimary]} onPress={goNext} activeOpacity={0.8}>
            <Text style={styles.navBtnPrimaryText}>Next →</Text>
          </TouchableOpacity>
        </View>

        {/* Full list */}
        <Text style={styles.sectionLabel}>All affirmations</Text>
        <View style={{ gap: Spacing.sm }}>
          {filtered.map((aff, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setCardIdx(i)}
              style={[styles.listItem, i === safeIdx && { backgroundColor: aff.color + '14', borderColor: aff.color + '35' }]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18, flexShrink: 0 }}>{aff.icon}</Text>
              <View style={styles.listItemInfo}>
                <Text style={styles.listItemText}>{aff.text}</Text>
                <Text style={[styles.listItemCat, { color: aff.color }]}>{aff.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTextCol: { flex: 1 },
  backBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.md, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  backBtnText: { color: Colors.textMuted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '900', color: '#FBBF24' },
  subtitle: { ...Typography.bodySmall, color: Colors.textMuted },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  categoryRow: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  catChipActive: { backgroundColor: Colors.purpleDim, borderColor: Colors.purpleBorder },
  catChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  catChipTextActive: { color: Colors.purpleLight },
  mainCard: { borderRadius: Radius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md, minHeight: 200 },
  iconBox: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  affirmText: { ...Typography.h3, fontSize: 19, lineHeight: 28, color: Colors.textPrimary, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  categoryBadgeText: { fontSize: 11, fontWeight: '600' },
  counterText: { ...Typography.caption, color: Colors.textDim },
  navRow: { flexDirection: 'row', gap: Spacing.sm },
  navBtn: { flex: 1, paddingVertical: 16, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  navBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  navBtnPrimary: { backgroundColor: Colors.purpleDim, borderColor: Colors.purpleBorder },
  navBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: Colors.purpleLight },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.xl, backgroundColor: Colors.cardBg, borderWidth: 1, borderColor: Colors.cardBorder },
  listItemInfo: { flex: 1, gap: 2 },
  listItemText: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  listItemCat: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
})
