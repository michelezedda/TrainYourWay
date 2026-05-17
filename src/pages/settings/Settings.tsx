import { useState, useRef } from 'react'
import { HiPencil, HiChevronRight, HiLogout, HiTrash, HiCamera } from 'react-icons/hi'
import { useNavigate } from 'react-router-dom'
import { db } from '@/lib/db'
import { getUserId, setAuthUserId } from '@/lib/userId'
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'
import { HiQuestionMarkCircle } from 'react-icons/hi'
import { Link } from 'react-router-dom'
import { useLocale } from '@/context/LocaleContext'
import { clearAllLocalData } from '@/lib/clearUserData'
import { motion } from 'framer-motion'

const AVATAR_KEY = 'tyw_avatar'

function readAndResizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const SIZE = 300
        const canvas = document.createElement('canvas')
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')!
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Settings() {
  const userId = getUserId()
  const navigate = useNavigate()

  const { user } = db.useAuth()

  // Queries — used for delete-account logic (must cover every entity in the schema)
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


  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false)
  const [startOverBusy, setStartOverBusy] = useState(false)
  const [editingField, setEditingField] = useState<null | 'name'>(null)
  const [editValue, setEditValue] = useState('')
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission())
  const { unit, setUnit } = useLocale()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem(AVATAR_KEY))
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const dataUrl = await readAndResizeImage(file)
      localStorage.setItem(AVATAR_KEY, dataUrl)
      setAvatarUrl(dataUrl)
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = () => {
    localStorage.removeItem(AVATAR_KEY)
    setAvatarUrl(null)
  }

  const saveProfileField = async (field: 'name', value: string) => {
    if (!userProfile) return
    await db.transact(db.tx.userProfiles[userProfile.id].update({ [field]: value.trim() }))
    setEditingField(null)
  }

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission()
    setNotifPermission(result)
  }

  const handleStartOver = async () => {
    setStartOverBusy(true)
    try {
      const txns = (planData?.workoutPlans ?? []).map((r: { id: string }) => db.tx.workoutPlans[r.id].delete())
      if (txns.length > 0) await db.transact(txns)
      localStorage.removeItem('uplift_nutrition_profile')
      Object.keys(localStorage)
        .filter(k => k.startsWith('uplift_weights_'))
        .forEach(k => localStorage.removeItem(k))
      navigate('/questionnaire', { state: { startOver: true }, replace: true })
    } finally {
      setStartOverBusy(false)
      setShowStartOverConfirm(false)
    }
  }

  const handleLogout = async () => {
    await db.auth.signOut()
    navigate('/', { replace: true })
  }

  const handleDeleteAccount = async () => {
    setDeleteBusy(true)
    try {
      // Delete every DB record tied to this user
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

      // Wipe all local state — must happen before signOut so userId is still available
      clearAllLocalData(userId)
      setAuthUserId(null)

      await db.auth.signOut()
      navigate('/', { replace: true })
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-black gradient-text">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Manage your profile and account.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="space-y-6"
      >

        {/* Profile */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Profile</p>
          <div className="glass-card overflow-hidden">
            {/* Avatar hero row */}
            <div className="px-5 py-5 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => void handleAvatarChange(e)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative flex-shrink-0 group"
                disabled={avatarUploading}
                aria-label="Change profile picture"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover"
                    style={{ border: '2.5px solid rgba(168,85,247,0.4)' }}
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black"
                    style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: 'white' }}
                  >
                    {avatarUploading ? (
                      <span className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      (userProfile?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()
                    )}
                  </div>
                )}
                <div
                  className="absolute inset-0 rounded-full flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100 group-active:opacity-100"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  {avatarUploading
                    ? <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    : <HiCamera className="w-6 h-6 text-white" />
                  }
                </div>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-white truncate leading-tight">
                  {userProfile?.name ?? 'Set your name'}
                </p>
                <p className="text-sm text-white/40 truncate mt-0.5">{user?.email}</p>
                {avatarUrl && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="text-xs text-white/25 hover:text-red-400/70 transition-colors mt-1.5"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {/* Name row */}
            <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-xs text-white/35 mb-1.5">Display Name</p>
              {editingField === 'name' ? (
                <div className="flex gap-2">
                  <input
                    className="input-glass !py-2 flex-1"
                    autoFocus
                    style={{ fontSize: 16 }}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveProfileField('name', editValue) }}
                  />
                  <button
                    onClick={() => void saveProfileField('name', editValue)}
                    className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingField(null)} className="text-sm text-white/35 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">{userProfile?.name ?? 'Not set'}</span>
                  {userProfile && (
                    <button
                      onClick={() => { setEditingField('name'); setEditValue(userProfile.name ?? '') }}
                      className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors"
                    >
                      <HiPencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Email row */}
            <div className="px-5 py-4">
              <p className="text-xs text-white/35 mb-1.5">Email</p>
              <span className="text-sm text-white/50">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Training & Nutrition */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Training & Nutrition</p>
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => setShowStartOverConfirm(true)}
              className="w-full flex items-center justify-between px-5 py-4 transition-colors active:scale-[0.98]"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-white/80">Start Over</p>
                <p className="text-xs text-white/35 mt-0.5">Generate a completely new plan</p>
              </div>
              <HiChevronRight className="w-5 h-5 text-white/25 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Notifications</p>
          <div className="glass-card px-5 py-4">
            {notifPermission === 'granted' ? (
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-300/90">Notifications enabled</p>
                  <p className="text-xs text-white/35 mt-0.5">You'll receive goal and workout reminders</p>
                </div>
              </div>
            ) : notifPermission === 'denied' ? (
              <div>
                <p className="text-sm text-white/60 font-medium">Notifications blocked</p>
                <p className="text-xs text-white/35 mt-1">Open your device settings to enable them.</p>
              </div>
            ) : (
              <button
                onClick={() => void handleEnableNotifications()}
                className="flex items-center justify-between w-full"
              >
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: '#c084fc' }}>Enable goal alerts</p>
                  <p className="text-xs text-white/35 mt-0.5">Stay on track with reminders</p>
                </div>
                <HiChevronRight className="w-5 h-5 text-white/25" />
              </button>
            )}
          </div>
        </div>

        {/* Preferences */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Preferences</p>
          <div className="glass-card px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/80">Measurement Units</p>
              <p className="text-xs text-white/35 mt-0.5">Weight, height, and body metrics</p>
            </div>
            <div className="flex rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
              {(['metric', 'imperial'] as const).map((u, i) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-3.5 py-2 text-xs font-medium transition-colors ${unit === u ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-white/40 hover:text-white/70'} ${i === 0 ? 'border-r border-white/10' : ''}`}
                >
                  {u === 'metric' ? 'Metric' : 'Imperial'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy & Account */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Account</p>
          <div className="glass-card overflow-hidden">
            <button
              onClick={() => void handleLogout()}
              className="w-full flex items-center justify-between px-5 py-4 transition-colors active:scale-[0.98]"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-sm font-medium text-white/70">Log Out</p>
              <HiLogout className="w-5 h-5 text-white/25" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between px-5 py-4 transition-colors active:scale-[0.98]"
            >
              <p className="text-sm font-medium text-red-400/80">Delete Account</p>
              <HiTrash className="w-5 h-5 text-red-400/35" />
            </button>
          </div>
        </div>

        <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <Link
          to="/support"
          className="inline-flex items-center gap-2 text-sm transition-colors pb-12"
          style={{ color: 'rgba(255,255,255,0.32)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.32)')}
        >
          <HiQuestionMarkCircle className="w-4 h-4" />
          Need help or have feedback?
        </Link>
      </motion.div>

      {/* Start Over confirmation modal */}
      {showStartOverConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => !startOverBusy && setShowStartOverConfirm(false)}
        >
          <div
            className="glass-card w-full max-w-sm p-6 space-y-5 mb-20"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Start over?</h3>
              <p className="text-sm text-white/45 leading-relaxed">
                Your current plan will be removed and you'll go through onboarding again to generate a fresh one.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowStartOverConfirm(false)}
                disabled={startOverBusy}
                className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-white/60 transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleStartOver()}
                disabled={startOverBusy}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.85), rgba(34,211,238,0.7))' }}
              >
                {startOverBusy ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : 'Yes, start over'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => !deleteBusy && setShowDeleteConfirm(false)}
        >
          <div
            className="glass-card w-full max-w-sm p-6 space-y-5 mb-20"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Delete account?</h3>
              <p className="text-sm text-white/45 leading-relaxed">
                This permanently deletes all your data including meals, workouts, streaks, and scan history. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteBusy}
                className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-white/60 transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteAccount()}
                disabled={deleteBusy}
                className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'rgba(239,68,68,0.8)' }}
              >
                {deleteBusy ? (
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
