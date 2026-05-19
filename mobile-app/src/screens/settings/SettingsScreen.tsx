import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
  ActivityIndicator, TextInput, Image, Modal, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { db } from '@/lib/db'
import { getUserId, setAuthUserId } from '@/lib/userId'
import { useLocale } from '@/context/LocaleContext'
import { clearAllLocalData } from '@/lib/clearUserData'
import { storageGetAsync, storageSetAsync, storageRemoveAsync } from '@/lib/storage'
import { getNotificationPermission, requestNotificationPermission, type PermissionStatus } from '@/lib/notifications'
import { Colors, Spacing, Radius, Typography } from '@/theme'
import GlassCard from '@/components/GlassCard'
import GradientText from '@/components/GradientText'
import type { MeStackParamList } from '@/navigation/types'

type Nav = NativeStackNavigationProp<MeStackParamList, 'MeHome'>

const AVATAR_KEY = 'tyw_avatar'

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>
}

function RowChevron() {
  return <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
}

function Divider() {
  return <View style={styles.divider} />
}

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>()
  const userId = getUserId()
  const { unit, setUnit } = useLocale()
  const { user } = db.useAuth()

  const { data: mealData }    = db.useQuery({ mealEntries:        { $: { where: { userId } } } })
  const { data: workoutData } = db.useQuery({ workoutCompletions: { $: { where: { userId } } } })
  const { data: lbData }      = db.useQuery({ leaderboardEntries: { $: { where: { userId } } } })
  const { data: waterData }   = db.useQuery({ waterLogs:          { $: { where: { userId } } } })
  const { data: planData }    = db.useQuery({ workoutPlans:        { $: { where: { userId } } } })
  const { data: ticketData }  = db.useQuery({ supportTickets:      { $: { where: { userId } } } })
  const { data: ratingData }  = db.useQuery({ gymRatings:          { $: { where: { userId } } } })
  const { data: findsData }   = db.useQuery({ communityFinds:      { $: { where: { sharedBy: userId } } } })
  const { data: profileData } = db.useQuery({ userProfiles:        { $: { where: { userId } } } })
  const { data: healthData }  = db.useQuery({ healthLogs:          { $: { where: { userId } } } })

  const userProfile = (profileData?.userProfiles ?? [])[0] as { id: string; name?: string } | undefined

  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('undetermined')
  const [loggingOut, setLoggingOut] = useState(false)
  const [showStartOver, setShowStartOver] = useState(false)
  const [startOverBusy, setStartOverBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    storageGetAsync(AVATAR_KEY).then(v => setAvatarUri(v || null))
    getNotificationPermission().then(setNotifStatus)
  }, [])

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access in your device settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const uri = asset.uri
      await storageSetAsync(AVATAR_KEY, uri)
      setAvatarUri(uri)
    }
  }

  const handleRemoveAvatar = async () => {
    await storageRemoveAsync(AVATAR_KEY)
    setAvatarUri(null)
  }

  const handleSaveName = async () => {
    if (!nameInput.trim() || !userProfile) return
    setSavingName(true)
    try {
      await db.transact(db.tx.userProfiles[userProfile.id].update({ name: nameInput.trim() }))
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
  }

  const handleStartOver = async () => {
    setStartOverBusy(true)
    try {
      const txns = (planData?.workoutPlans ?? []).map((r: { id: string }) => db.tx.workoutPlans[r.id].delete())
      if (txns.length > 0) await db.transact(txns)
      await clearAllLocalData(userId)
    } finally {
      setStartOverBusy(false)
      setShowStartOver(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await db.auth.signOut()
    } finally {
      setLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteBusy(true)
    try {
      const txns = [
        ...(mealData?.mealEntries        ?? []).map((r: { id: string }) => db.tx.mealEntries[r.id].delete()),
        ...(workoutData?.workoutCompletions ?? []).map((r: { id: string }) => db.tx.workoutCompletions[r.id].delete()),
        ...(lbData?.leaderboardEntries   ?? []).map((r: { id: string }) => db.tx.leaderboardEntries[r.id].delete()),
        ...(waterData?.waterLogs         ?? []).map((r: { id: string }) => db.tx.waterLogs[r.id].delete()),
        ...(planData?.workoutPlans       ?? []).map((r: { id: string }) => db.tx.workoutPlans[r.id].delete()),
        ...(ticketData?.supportTickets   ?? []).map((r: { id: string }) => db.tx.supportTickets[r.id].delete()),
        ...(ratingData?.gymRatings       ?? []).map((r: { id: string }) => db.tx.gymRatings[r.id].delete()),
        ...(findsData?.communityFinds    ?? []).map((r: { id: string }) => db.tx.communityFinds[r.id].delete()),
        ...(profileData?.userProfiles    ?? []).map((r: { id: string }) => db.tx.userProfiles[r.id].delete()),
        ...(healthData?.healthLogs       ?? []).map((r: { id: string }) => db.tx.healthLogs[r.id].delete()),
      ]
      if (txns.length > 0) await db.transact(txns)
      await clearAllLocalData(userId)
      setAuthUserId(null)
      await db.auth.signOut()
    } finally {
      setDeleteBusy(false)
    }
  }

  const initials = ((userProfile?.name ?? user?.email ?? '?')[0] ?? '?').toUpperCase()

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.pageHeader}>
          <GradientText style={styles.pageTitle}>Settings</GradientText>
          <Text style={styles.pageSubtitle}>Manage your profile and account.</Text>
        </View>

        {/* Profile section */}
        <SectionLabel>Profile</SectionLabel>
        <GlassCard style={styles.card}>
          {/* Avatar row */}
          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} style={styles.avatarBtn}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <LinearGradient colors={['#A855F7', '#22D3EE']} style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={styles.avatarInfo}>
              <Text style={styles.profileName} numberOfLines={1}>
                {userProfile?.name ?? 'Set your name'}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
              {avatarUri && (
                <TouchableOpacity onPress={handleRemoveAvatar} activeOpacity={0.7}>
                  <Text style={styles.removePhoto}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Divider />

          {/* Display name */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            {editingName ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSaveName()}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  placeholder="Your name"
                  underlineColorAndroid="transparent"
                  selectionColor="#A855F7"
                />
                <TouchableOpacity
                  onPress={() => void handleSaveName()}
                  disabled={savingName}
                  style={styles.saveBtn}
                  activeOpacity={0.8}
                >
                  {savingName
                    ? <ActivityIndicator size="small" color="#c084fc" />
                    : <Text style={styles.saveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingName(false)} style={styles.cancelBtn}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.fieldValueRow}>
                <Text style={styles.fieldValue}>{userProfile?.name ?? 'Not set'}</Text>
                {userProfile && (
                  <TouchableOpacity
                    onPress={() => { setEditingName(true); setNameInput(userProfile.name ?? '') }}
                    style={styles.editBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.35)" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <Divider />

          {/* Email */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValueDim}>{user?.email}</Text>
          </View>
        </GlassCard>

        {/* Training & Nutrition */}
        <SectionLabel>Training & Nutrition</SectionLabel>
        <GlassCard style={styles.card}>
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setShowStartOver(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Start Over</Text>
              <Text style={styles.menuDesc}>Generate a completely new plan</Text>
            </View>
            <RowChevron />
          </TouchableOpacity>
        </GlassCard>

        {/* Discover */}
        <SectionLabel>Discover</SectionLabel>
        <GlassCard style={{ ...styles.card, padding: 0 }}>
          <TouchableOpacity
            style={styles.menuRowPadded}
            onPress={() => navigation.navigate('Community')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <Text style={{ fontSize: 18 }}>🌿</Text>
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Community</Text>
              <Text style={styles.menuDesc}>Healthy food finds and top streaks</Text>
            </View>
            <RowChevron />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.menuRowPadded}
            onPress={() => navigation.navigate('MachineScanner')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(168,85,247,0.15)' }]}>
              <Text style={{ fontSize: 18 }}>🏋️</Text>
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Machine Scanner</Text>
              <Text style={styles.menuDesc}>AI guide for any gym machine</Text>
            </View>
            <RowChevron />
          </TouchableOpacity>
        </GlassCard>

        {/* Notifications */}
        <SectionLabel>Notifications</SectionLabel>
        <GlassCard style={styles.card}>
          {notifStatus === 'granted' ? (
            <View style={styles.notifRow}>
              <View style={styles.notifDot} />
              <View>
                <Text style={styles.notifEnabledText}>Notifications enabled</Text>
                <Text style={styles.menuDesc}>You'll receive goal and workout reminders</Text>
              </View>
            </View>
          ) : notifStatus === 'denied' ? (
            <View>
              <Text style={styles.menuTitle}>Notifications blocked</Text>
              <Text style={styles.menuDesc}>Open your device settings to enable them.</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => void handleEnableNotifications()}
              activeOpacity={0.7}
            >
              <View style={styles.menuInfo}>
                <Text style={[styles.menuTitle, { color: '#c084fc' }]}>Enable goal alerts</Text>
                <Text style={styles.menuDesc}>Stay on track with reminders</Text>
              </View>
              <RowChevron />
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* Preferences */}
        <SectionLabel>Preferences</SectionLabel>
        <GlassCard style={styles.card}>
          <View style={styles.unitsRow}>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Measurement Units</Text>
              <Text style={styles.menuDesc}>Weight, height, and body metrics</Text>
            </View>
            <View style={styles.unitToggle}>
              {(['metric', 'imperial'] as const).map((u, i) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[
                    styles.unitBtn,
                    i === 0 && styles.unitBtnLeft,
                    i === 1 && styles.unitBtnRight,
                    unit === u && styles.unitBtnActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
                    {u === 'metric' ? 'Metric' : 'Imperial'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </GlassCard>

        {/* Account */}
        <SectionLabel>Account</SectionLabel>
        <GlassCard style={{ ...styles.card, padding: 0 }}>
          <TouchableOpacity
            style={styles.menuRowPadded}
            onPress={() => navigation.navigate('Support')}
            activeOpacity={0.7}
          >
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Help & Support</Text>
              <Text style={styles.menuDesc}>Report issues or ask for assistance</Text>
            </View>
            <RowChevron />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.menuRowPadded}
            onPress={() => void handleLogout()}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>Log Out</Text>
            </View>
            {loggingOut
              ? <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
              : <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.3)" />
            }
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.menuRowPadded}
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuInfo}>
              <Text style={[styles.menuTitle, { color: 'rgba(248,113,113,0.8)' }]}>Delete Account</Text>
            </View>
            <Ionicons name="trash-outline" size={18} color="rgba(248,113,113,0.35)" />
          </TouchableOpacity>
        </GlassCard>

        <Text style={styles.version}>UPLYFT v1.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Start Over modal */}
      <Modal
        visible={showStartOver}
        transparent
        animationType="fade"
        onRequestClose={() => !startOverBusy && setShowStartOver(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !startOverBusy && setShowStartOver(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Start over?</Text>
            <Text style={styles.modalBody}>
              Your current plan will be removed and you'll go through onboarding again to generate a fresh one.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowStartOver(false)}
                disabled={startOverBusy}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn]}
                onPress={() => void handleStartOver()}
                disabled={startOverBusy}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['rgba(168,85,247,0.85)', 'rgba(34,211,238,0.7)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.modalBtnGrad}
                >
                  {startOverBusy
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.modalBtnPrimaryText}>Yes, start over</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !deleteBusy && setShowDeleteConfirm(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !deleteBusy && setShowDeleteConfirm(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalBody}>
              This permanently deletes all your data including meals, workouts, streaks, and scan history. This cannot be undone.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowDeleteConfirm(false)}
                disabled={deleteBusy}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDelete]}
                onPress={() => void handleDeleteAccount()}
                disabled={deleteBusy}
                activeOpacity={0.85}
              >
                {deleteBusy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.modalBtnPrimaryText}>Delete everything</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: Spacing.md, paddingBottom: 116 },
  pageHeader: { marginBottom: 20 },
  pageTitle: {
    fontSize: 24, fontWeight: '900', color: Colors.purple, letterSpacing: -0.5,
  },
  pageSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 20, paddingHorizontal: 4,
  },
  card: { marginBottom: 0 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 0 },
  avatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    marginBottom: 4,
  },
  avatarBtn: { position: 'relative', flexShrink: 0 },
  avatarImg: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: 'rgba(168,85,247,0.4)',
  },
  avatarPlaceholder: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 26, fontWeight: '900' },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#A855F7',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  avatarInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  profileEmail: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  removePhoto: { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 6 },
  fieldRow: { paddingVertical: 12 },
  fieldLabel: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 6 },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  fieldValueDim: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: {
    flex: 1, height: 38, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
    color: '#fff', fontSize: 14,
  },
  saveBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  saveBtnText: { color: '#c084fc', fontSize: 13, fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  cancelBtnText: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRowPadded: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 4, paddingVertical: 14,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  menuDesc: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ade80', flexShrink: 0,
  },
  notifEnabledText: { fontSize: 14, fontWeight: '500', color: 'rgba(134,239,172,0.9)' },
  unitsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unitToggle: {
    flexDirection: 'row', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', flexShrink: 0,
  },
  unitBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  unitBtnLeft: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  unitBtnRight: {},
  unitBtnActive: { backgroundColor: 'rgba(168,85,247,0.2)' },
  unitBtnText: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.4)' },
  unitBtnTextActive: { color: '#d8b4fe' },
  version: {
    textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.15)',
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md, paddingBottom: 40,
  },
  modalCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: Colors.cardBg,
    borderRadius: 28,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: 24, gap: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  modalBody: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 22 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, borderRadius: 20, overflow: 'hidden' },
  modalBtnCancel: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalBtnDelete: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.8)',
  },
  modalBtnCancelText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },
  modalBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalBtnGrad: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
})
