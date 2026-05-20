import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MeStackParamList } from '@/navigation/types'
import { db } from '@/lib/db'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'

type NavProp = NativeStackNavigationProp<MeStackParamList>

interface MenuSection {
  label: string
  items: MenuItem[]
}

interface MenuItem {
  icon: string
  title: string
  desc: string
  screen: keyof MeStackParamList
  accent?: string
}

const SECTIONS: MenuSection[] = [
  {
    label: 'Discover',
    items: [
      {
        icon: '🌿',
        title: 'Community',
        desc: 'Healthy food finds and top streaks',
        screen: 'Community',
        accent: '#22c55e',
      },
    ],
  },
  {
    label: 'Support',
    items: [
      {
        icon: '🎫',
        title: 'Help & Support',
        desc: 'Report issues or ask for assistance',
        screen: 'Support',
        accent: '#f59e0b',
      },
    ],
  },
]

export default function MoreHomeScreen() {
  const navigation = useNavigation<NavProp>()
  const { user } = db.useAuth()

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0f0a2e', Colors.bg]}
        locations={[0, 0.65]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSub}>{user?.email ?? 'Not signed in'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('MachineScanner')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 28 }}>🏋️</Text>
            <Text style={styles.quickLabel}>Gym Machine</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('Community')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 28 }}>🌿</Text>
            <Text style={styles.quickLabel}>Community</Text>
          </TouchableOpacity>
        </View>

        {SECTIONS.map(section => (
          <View key={section.label}>
            <Text style={styles.sectionLabel}>{section.label}</Text>
            <GlassCard style={{ gap: 0 }}>
              {section.items.map((item, idx) => (
                <View key={item.screen}>
                  {idx > 0 && <View style={styles.separator} />}
                  <TouchableOpacity
                    style={styles.menuRow}
                    onPress={() => navigation.navigate(item.screen)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.iconBox, { backgroundColor: (item.accent ?? Colors.purple) + '18' }]}>
                      <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    </View>
                    <View style={styles.menuInfo}>
                      <Text style={styles.menuTitle}>{item.title}</Text>
                      <Text style={styles.menuDesc}>{item.desc}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </GlassCard>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.separator },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  scroll: { padding: Spacing.md, gap: Spacing.md },
  quickRow: { flexDirection: 'row', gap: Spacing.sm },
  quickBtn: {
    flex: 1, alignItems: 'center', gap: 6, paddingVertical: Spacing.md,
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  quickLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textAlign: 'center' },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textDim,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 12 },
  iconBox: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  menuInfo: { flex: 1 },
  menuTitle: { ...Typography.body, fontWeight: '700', color: Colors.textPrimary },
  menuDesc: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: Colors.textDim },
  separator: { height: 1, backgroundColor: Colors.separator },
})
