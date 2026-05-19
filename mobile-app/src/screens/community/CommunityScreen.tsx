import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image,
} from 'react-native'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNickname } from '@/lib/nickname'
import { GRADE_COLOR } from '@/lib/healthScore'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'
import GradientText from '@/components/GradientText'

type Tab = 'finds' | 'leaderboard'

interface CommunityFind {
  id: string
  barcode: string
  productName: string
  brand: string
  grade: string
  gradeColor: string
  imageUrl: string
  sharedBy: string
  sharedAt: number
}

interface LeaderboardEntry {
  id: string
  userId: string
  nickname: string
  workoutStreak: number
  mealStreak: number
  updatedAt: number
}

function formatDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function FindsTab() {
  const userId = getUserId()
  const { data } = db.useQuery({ communityFinds: {} })

  const finds = ((data?.communityFinds ?? []) as CommunityFind[])
    .sort((a, b) => b.sharedAt - a.sharedAt)
    .slice(0, 20)

  if (!finds.length) {
    return (
      <GlassCard style={styles.emptyCard}>
        <Text style={{ fontSize: 40, lineHeight: 52 }}>🌿</Text>
        <Text style={styles.emptyTitle}>No healthy finds yet</Text>
        <Text style={styles.emptyDesc}>
          Scan A or B grade products in the Food Scanner and share them to start the feed.
        </Text>
      </GlassCard>
    )
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {finds.map(f => {
        const isMe = f.sharedBy === userId
        const color = (GRADE_COLOR as Record<string, string>)[f.grade] ?? '#22c55e'
        return (
          <View key={f.id} style={styles.findCard}>
            <View style={styles.findRow}>
              {f.imageUrl ? (
                <Image source={{ uri: f.imageUrl }} style={styles.findImage} resizeMode="cover" />
              ) : (
                <View style={styles.findImagePlaceholder}>
                  <Text style={{ fontSize: 22 }}>🛒</Text>
                </View>
              )}
              <View style={styles.findInfo}>
                {f.brand ? <Text style={styles.findBrand}>{f.brand}</Text> : null}
                <Text style={styles.findName} numberOfLines={1}>{f.productName || 'Unknown'}</Text>
                <Text style={styles.findMeta}>
                  by {isMe ? 'you' : getNickname(f.sharedBy)} · {formatDate(f.sharedAt)}
                </Text>
              </View>
              <View style={[styles.gradeBadge, { backgroundColor: color + '22' }]}>
                <Text style={[styles.gradeText, { color }]}>{f.grade}</Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

function LeaderboardTab() {
  const userId = getUserId()
  const { data } = db.useQuery({ leaderboardEntries: {} })

  const entries = ((data?.leaderboardEntries ?? []) as LeaderboardEntry[])
    .sort((a, b) => (b.workoutStreak + b.mealStreak) - (a.workoutStreak + a.mealStreak))
    .slice(0, 10)

  if (!entries.length) {
    return (
      <GlassCard style={styles.emptyCard}>
        <Text style={{ fontSize: 40, lineHeight: 52 }}>🏆</Text>
        <Text style={styles.emptyTitle}>Leaderboard coming soon</Text>
        <Text style={styles.emptyDesc}>
          Visit Settings to register on the leaderboard and share your streaks.
        </Text>
      </GlassCard>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <View style={{ gap: Spacing.sm }}>
      {entries.map((e, i) => {
        const isMe = e.userId === userId
        const total = e.workoutStreak + e.mealStreak
        return (
          <View key={e.id} style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
            <Text style={styles.medal}>{medals[i] ?? `#${i + 1}`}</Text>
            <View style={styles.leaderInfo}>
              <Text style={styles.leaderName}>{e.nickname}{isMe ? ' (you)' : ''}</Text>
              <View style={styles.streakRow}>
                <Text style={[styles.streakBadge, { color: Colors.purple }]}>{e.mealStreak}d meals</Text>
                <Text style={[styles.streakBadge, { color: Colors.cyan }]}>{e.workoutStreak}d workouts</Text>
              </View>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.totalNum}>{total}</Text>
              <Text style={styles.totalLabel}>total days</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

export default function CommunityScreen() {
  const [tab, setTab] = useState<Tab>('finds')

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <GradientText style={styles.headerTitle}>Community</GradientText>
        <Text style={styles.headerSub}>Healthy finds and top streaks.</Text>
      </View>

      <View style={styles.tabContainer}>
        <View style={styles.tabRow}>
          {(['finds', 'leaderboard'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'finds' ? '🌿 Finds' : '🏆 Leaderboard'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {tab === 'finds' ? <FindsTab /> : <LeaderboardTab />}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  headerSub: { ...Typography.bodySmall, color: Colors.textMuted, marginTop: 2 },
  tabContainer: { padding: Spacing.md, paddingBottom: 0 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.purpleDim },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.purpleLight },
  scroll: { padding: Spacing.md, gap: Spacing.sm },
  emptyCard: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyTitle: { ...Typography.h3 },
  emptyDesc: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  findCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  findImage: { width: 56, height: 56, borderRadius: Radius.lg, flexShrink: 0 },
  findImagePlaceholder: {
    width: 56, height: 56, borderRadius: Radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  findInfo: { flex: 1 },
  findBrand: { fontSize: 10, color: Colors.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  findName: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
  findMeta: { fontSize: 10, color: Colors.textDim, marginTop: 2 },
  gradeBadge: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  gradeText: { fontSize: 18, fontWeight: '900' },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  leaderRowMe: { borderColor: Colors.purpleBorder, backgroundColor: Colors.purpleDim },
  medal: { fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0 },
  leaderInfo: { flex: 1 },
  leaderName: { ...Typography.body, fontWeight: '600', color: Colors.textPrimary },
  streakRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  streakBadge: { fontSize: 10, fontWeight: '600' },
  totalCol: { alignItems: 'flex-end', flexShrink: 0 },
  totalNum: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  totalLabel: { fontSize: 10, color: Colors.textDim },
})
