import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'
import { Link } from 'react-router-dom'

export default function Personal() {
  const userId   = getUserId()
  const navigate = useNavigate()

  const { user } = db.useAuth()

  // Queries — kept for delete-account logic even when not displayed
  const { data: mealData }    = db.useQuery({ mealEntries:        { $: { where: { userId } } } })
  const { data: workoutData } = db.useQuery({ workoutCompletions: { $: { where: { userId } } } })
  const { data: lbData }      = db.useQuery({ leaderboardEntries: { $: { where: { userId } } } })
  const { data: waterData }   = db.useQuery({ waterLogs:          { $: { where: { userId } } } })
  const { data: planData }    = db.useQuery({ workoutPlans:       { $: { where: { userId } } } })
  const { data: ticketData }  = db.useQuery({ supportTickets:     { $: { where: { userId } } } })
  const { data: ratingData }  = db.useQuery({ gymRatings:         { $: { where: { userId } } } })
  const { data: findsData }   = db.useQuery({ communityFinds:     { $: { where: { sharedBy: userId } } } })
  const { data: profileData } = db.useQuery({ userProfiles:       { $: { where: { userId } } } })

  const userProfile = (profileData?.userProfiles ?? [])[0] as { id: string; name?: string } | undefined

  const allPlans   = (planData?.workoutPlans ?? []) as Array<{ id: string; plan: string; userName: string; fitnessLevel: string; goals: string; equipment: string; createdAt: number }>
  const latestPlan = [...allPlans].sort((a, b) => b.createdAt - a.createdAt)[0]

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy]               = useState(false)
  const [editingField, setEditingField]            = useState<null | 'name'>(null)
  const [editValue, setEditValue]                  = useState('')
  const [notifPermission, setNotifPermission]      = useState(() => getNotificationPermission())

  const saveProfileField = async (field: 'name', value: string) => {
    if (!userProfile) return
    await db.transact(db.tx.userProfiles[userProfile.id].update({ [field]: value.trim() }))
    setEditingField(null)
  }

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission()
    setNotifPermission(result)
  }

  const handleLogout = async () => {
    await db.auth.signOut()
    navigate('/', { replace: true })
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
      ]
      if (txns.length > 0) await db.transact(txns)
      const KEYS = ['tyw_user_id', 'uplift_nutrition_profile', 'tyw_scan_history', 'tyw_notif_seen', 'tyw_lb_ts', 'tyw_notif_ts']
      KEYS.forEach(k => localStorage.removeItem(k))
      await db.auth.signOut()
      navigate('/', { replace: true })
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-black gradient-text">Settings</h1>
        <p className="text-white/40 text-sm">Manage your profile and account.</p>
      </div>

      <div className="space-y-6">

        {/* Profile */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Profile</p>
          <div className="glass-card p-4 space-y-3">
            {/* Avatar + email header */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/8">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: 'white' }}
              >
                {(userProfile?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {userProfile?.name ?? 'Set your name'}
                </p>
                <p className="text-xs text-white/40 truncate">{user?.email}</p>
              </div>
            </div>

            {/* Name */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/40 w-20 flex-shrink-0">Name</span>
              {editingField === 'name' ? (
                <div className="flex-1 flex gap-2">
                  <input
                    className="input-glass !py-1.5 !text-sm flex-1"
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveProfileField('name', editValue) }}
                  />
                  <button
                    onClick={() => void saveProfileField('name', editValue)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingField(null)} className="text-xs text-white/35 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-white/70">{userProfile?.name ?? 'Not set'}</span>
                  {userProfile && (
                    <button
                      onClick={() => { setEditingField('name'); setEditValue(userProfile.name ?? '') }}
                      className="text-white/30 hover:text-white/60 transition-colors ml-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Email (read-only) */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/40 w-20 flex-shrink-0">Email</span>
              <span className="text-sm text-white/50 flex-1 truncate">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Training & Nutrition */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Training & Nutrition</p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if (!latestPlan) { navigate('/questionnaire'); return }
                navigate('/reevaluate', {
                  state: {
                    planId:       latestPlan.id,
                    originalPlan: latestPlan.plan,
                    userName:     latestPlan.userName,
                    fitnessLevel: latestPlan.fitnessLevel ?? '',
                    goals:        latestPlan.goals ?? '[]',
                    equipment:    latestPlan.equipment ?? '[]',
                  },
                })
              }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-sm text-white/70">Edit Training Goals</span>
              <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <Link
              to="/questionnaire"
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-sm text-white/70">Start Over </span>
              <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Notifications */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Notifications</p>
          <div
            className="px-4 py-3.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {notifPermission === 'granted' ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-sm text-green-300/80">Notifications enabled</span>
              </div>
            ) : notifPermission === 'denied' ? (
              <p className="text-sm text-white/40">
                Notifications are blocked. Open your device settings to enable them.
              </p>
            ) : (
              <button
                onClick={() => void handleEnableNotifications()}
                className="text-sm font-medium"
                style={{ color: '#c084fc' }}
              >
                Enable goal alerts
              </button>
            )}
          </div>
        </div>

        {/* Privacy & Account */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Privacy & Account</p>
          <div className="space-y-2">
            <button
              onClick={() => void handleLogout()}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-sm text-white/70">Log Out</span>
              <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
            >
              <span className="text-sm text-red-400/80">Delete Account</span>
              <svg className="w-4 h-4 text-red-400/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={() => !deleteBusy && setShowDeleteConfirm(false)}
        >
          <div
            className="glass-card w-full max-w-sm p-6 space-y-4 mb-20"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-base font-bold text-white mb-1">Delete account?</h3>
              <p className="text-sm text-white/45 leading-relaxed">
                This permanently deletes all your data including meals, workouts, streaks, and scan history. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteBusy}
                className="flex-1 py-2.5 rounded-2xl text-sm font-medium text-white/60 transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteAccount()}
                disabled={deleteBusy}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
