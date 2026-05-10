import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { id } from '@instantdb/react'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import WeeklyInsights from '@/components/WeeklyInsights'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { calcStreak } from '@/lib/streaks'
import { getNickname } from '@/lib/nickname'
import { generateStreakStory, shareOrDownload } from '@/lib/storyCanvas'
import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'
import { getScanHistory } from '@/lib/openFoodFacts'
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftBack(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAILY_GOAL = 8
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function WeekDots({ loggedDates, today, gradient }: { loggedDates: string[]; today: string; gradient: string }) {
  const dateSet = new Set(loggedDates)
  const last7 = Array.from({ length: 7 }, (_, i) => shiftBack(today, 6 - i))

  return (
    <div className="flex items-end gap-1.5 mt-4">
      {last7.map((dateStr) => {
        const dayLetter = DAY_LETTERS[new Date(dateStr + 'T12:00:00').getDay()]
        const filled = dateSet.has(dateStr)
        const isToday = dateStr === today
        return (
          <div key={dateStr} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-6 h-6 rounded-full transition-all duration-300 ${isToday ? 'ring-2 ring-white/20' : ''}`}
              style={{
                background: filled ? gradient : 'rgba(255,255,255,0.07)',
                boxShadow: filled ? '0 0 8px rgba(168,85,247,0.35)' : 'none',
              }}
            />
            <span className="text-[9px] text-white/25 font-medium uppercase">{dayLetter}</span>
          </div>
        )
      })}
    </div>
  )
}

interface StreakCardProps {
  label: string
  icon: React.ReactNode
  streak: number
  loggedDates: string[]
  today: string
  gradient: string
  action?: React.ReactNode
}

function StreakCard({ label, icon, streak, loggedDates, today, gradient, action }: StreakCardProps) {
  const isAlive = streak > 0

  return (
    <GlassCard padding={false} className="flex flex-col">
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            {icon}
          </div>
          <span className="text-white/50 text-xs font-medium leading-tight">{label}</span>
        </div>

        <div className="flex items-baseline gap-1 mb-0.5">
          <span
            className="text-5xl font-black tabular-nums leading-none"
            style={isAlive
              ? { background: gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
              : { color: 'rgba(255,255,255,0.15)' }
            }
          >
            {streak}
          </span>
        </div>
        <span className="text-white/30 text-xs mb-1">day streak</span>

        <WeekDots loggedDates={loggedDates} today={today} gradient={gradient} />

        {action && <div className="mt-4">{action}</div>}
      </div>
    </GlassCard>
  )
}

function WaterSection({ userId, today }: { userId: string; today: string }) {
  const { data } = db.useQuery({
    waterLogs: { $: { where: { userId, date: today } } },
  })

  const logs = (data?.waterLogs ?? []) as Array<{ id: string; glasses: number }>
  const existing = logs[0]
  const glasses = existing?.glasses ?? 0
  const pct = Math.min(glasses / DAILY_GOAL, 1)

  const setGlasses = async (next: number) => {
    const clamped = Math.max(0, next)
    if (existing) {
      await db.transact(db.tx.waterLogs[existing.id].update({ glasses: clamped }))
    } else if (clamped > 0) {
      await db.transact(
        db.tx.waterLogs[id()].update({ userId, date: today, glasses: clamped, createdAt: Date.now() })
      )
    }
  }

  return (
    <GlassCard padding={false}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(34,211,238,0.1)' }}
            >
              <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 3C12 3 5 10 5 15a7 7 0 0014 0c0-5-7-12-7-12z" />
              </svg>
            </div>
            <span className="text-white/50 text-xs font-medium">Daily Water</span>
          </div>
          <span className="text-white/30 text-xs">{glasses} / {DAILY_GOAL} glasses</span>
        </div>

        <div className="h-1.5 rounded-full mb-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct * 100}%`,
              background: 'linear-gradient(90deg, #22D3EE, #34d399)',
              boxShadow: pct > 0 ? '0 0 8px rgba(34,211,238,0.4)' : 'none',
            }}
          />
        </div>

        <div className="flex gap-1.5 mb-5">
          {Array.from({ length: DAILY_GOAL }, (_, i) => {
            const filled = i < glasses
            return (
              <button
                key={i}
                onClick={() => void setGlasses(filled && i === glasses - 1 ? glasses - 1 : i + 1)}
                className="flex-1 flex flex-col items-center gap-0.5 group"
                aria-label={`${i + 1} glass${i > 0 ? 'es' : ''}`}
              >
                <svg className="w-full max-w-[28px] transition-all duration-200" viewBox="0 0 24 28" fill="none">
                  <path
                    d="M4 2h16l-2 22H6L4 2z"
                    stroke={filled ? '#22D3EE' : 'rgba(255,255,255,0.15)'}
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    fill={filled ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.03)'}
                    style={{ transition: 'all 0.2s' }}
                  />
                  {filled && (
                    <path d="M5.5 10h13l-1.2 14H6.7L5.5 10z" fill="rgba(34,211,238,0.25)" />
                  )}
                </svg>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => void setGlasses(glasses - 1)}
            disabled={glasses === 0}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white/50 border border-white/10
                       hover:text-white/80 hover:border-white/20 hover:bg-white/5 disabled:opacity-25
                       disabled:cursor-not-allowed transition-all"
          >
            -
          </button>
          <span
            className="text-2xl font-black tabular-nums w-12 text-center"
            style={glasses > 0
              ? { background: 'linear-gradient(135deg, #22D3EE, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
              : { color: 'rgba(255,255,255,0.2)' }
            }
          >
            {glasses}
          </span>
          <button
            onClick={() => void setGlasses(glasses + 1)}
            className="flex-1 py-2 rounded-xl text-sm font-bold border transition-all"
            style={{ color: '#22D3EE', borderColor: 'rgba(34,211,238,0.3)', background: 'rgba(34,211,238,0.08)' }}
          >
            +
          </button>
        </div>

        {glasses >= DAILY_GOAL && (
          <p className="text-center text-xs mt-3 font-medium" style={{ color: '#34d399' }}>
            Daily goal reached!
          </p>
        )}
      </div>
    </GlassCard>
  )
}

function ForkIcon() {
  return (
    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 3v6a3 3 0 006 0V3M6 9v12M15 3a6 6 0 016 6v12" />
    </svg>
  )
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function DropIcon() {
  return (
    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3C12 3 5 10 5 15a7 7 0 0014 0c0-5-7-12-7-12z" />
    </svg>
  )
}

function FlameIcon() {
  return (
    <svg className="w-4 h-4" style={{ color: '#fb923c' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  )
}

function RunIcon() {
  return (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 5.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-5 8.5l1-4 3 3 2-3 3 2M7 18l2-2m4 2l-1-3" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

const STEP_GOAL  = 8000
const SLEEP_GOAL = 7

function HealthLogSection({ userId, today }: { userId: string; today: string }) {
  const { data } = db.useQuery({ healthLogs: { $: { where: { userId, date: today } } } })
  const logs = (data?.healthLogs ?? []) as Array<{ id: string; steps: number; sleepHours: number }>
  const existing = logs[0]
  const steps      = existing?.steps      ?? 0
  const sleepHours = existing?.sleepHours ?? 0

  const upsert = async (patch: { steps?: number; sleepHours?: number }) => {
    const next = { steps, sleepHours, ...patch }
    if (existing) {
      await db.transact(db.tx.healthLogs[existing.id].update(next))
    } else {
      await db.transact(db.tx.healthLogs[id()].update({ userId, date: today, ...next, createdAt: Date.now() }))
    }
  }

  const stepPct  = Math.min(steps / STEP_GOAL, 1)
  const sleepPct = Math.min(sleepHours / SLEEP_GOAL, 1)

  return (
    <GlassCard padding={false}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}>
            <RunIcon />
          </div>
          <span className="text-white/50 text-xs font-medium">Today's Health</span>
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/40">Steps</span>
            <span className="text-[11px] text-white/55">{steps.toLocaleString()} / {STEP_GOAL.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full mb-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stepPct * 100}%`, background: 'linear-gradient(90deg, #34d399, #22D3EE)', boxShadow: stepPct > 0 ? '0 0 8px rgba(52,211,153,0.4)' : 'none' }} />
          </div>
          <div className="flex gap-2">
            {[2000, 4000, 6000, 8000, 10000].map(v => (
              <button key={v} onClick={() => void upsert({ steps: v })}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: steps >= v ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                  color: steps >= v ? '#34d399' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${steps >= v ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                {v >= 1000 ? `${v / 1000}k` : v}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-white/40">Sleep</span>
            <span className="text-[11px] text-white/55">{sleepHours}h / {SLEEP_GOAL}h</span>
          </div>
          <div className="h-1.5 rounded-full mb-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${sleepPct * 100}%`, background: 'linear-gradient(90deg, #818cf8, #c084fc)', boxShadow: sleepPct > 0 ? '0 0 8px rgba(129,140,248,0.4)' : 'none' }} />
          </div>
          <div className="flex gap-2">
            {[5, 6, 7, 8, 9].map(h => (
              <button key={h} onClick={() => void upsert({ sleepHours: h })}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: sleepHours === h ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)',
                  color: sleepHours === h ? '#818cf8' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${sleepHours === h ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                {h}h
              </button>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-white/20 text-center">Manual entry. Automated sync available in the native app.</p>
      </div>
    </GlassCard>
  )
}

interface ShareStreakButtonProps {
  mealStreak: number
  workoutStreak: number
  mealDates: string[]
  workoutDates: string[]
  today: string
}

function ShareStreakButton({ mealStreak, workoutStreak, mealDates, workoutDates, today }: ShareStreakButtonProps) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'shared'>('idle')

  const handleShare = async () => {
    if (status !== 'idle') return
    setStatus('generating')
    try {
      const file = await generateStreakStory(mealStreak, workoutStreak, mealDates, workoutDates, today)
      await shareOrDownload(file, `My UPLIFT Streaks - ${Math.max(mealStreak, workoutStreak)} days`)
      setStatus('shared')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle')
      } else {
        setStatus('idle')
      }
    }
  }

  return (
    <button
      onClick={() => void handleShare()}
      disabled={status === 'generating'}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-medium transition-all border"
      style={{
        background: status === 'shared' ? 'rgba(34,197,94,0.1)' : 'rgba(168,85,247,0.1)',
        borderColor: status === 'shared' ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)',
        color: status === 'shared' ? '#86efac' : '#d8b4fe',
        opacity: status === 'generating' ? 0.7 : 1,
      }}
    >
      {status === 'generating' ? (
        <>
          <LoadingSpinner size="sm" />
          <span>Generating story...</span>
        </>
      ) : status === 'shared' ? (
        <span>Streak story saved!</span>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share My Streaks</span>
        </>
      )}
    </button>
  )
}

export default function Personal() {
  const today = toDateStr(new Date())
  const userId = getUserId()
  const navigate = useNavigate()

  const { user }             = db.useAuth()
  const { data: mealData }    = db.useQuery({ mealEntries:        { $: { where: { userId } } } })
  const { data: workoutData } = db.useQuery({ workoutCompletions: { $: { where: { userId } } } })
  const { data: lbData }      = db.useQuery({ leaderboardEntries: { $: { where: { userId } } } })
  const { data: waterData }   = db.useQuery({ waterLogs:          { $: { where: { userId } } } })
  const { data: healthData }  = db.useQuery({ healthLogs:          { $: { where: { userId } } } })
  const { data: planData }    = db.useQuery({ workoutPlans:        { $: { where: { userId } } } })
  const { data: ticketData }  = db.useQuery({ supportTickets:      { $: { where: { userId } } } })
  const { data: ratingData }  = db.useQuery({ gymRatings:          { $: { where: { userId } } } })
  const { data: findsData }   = db.useQuery({ communityFinds:      { $: { where: { sharedBy: userId } } } })

  const { data: profileData } = db.useQuery({ userProfiles: { $: { where: { userId } } } })
  const userProfile = (profileData?.userProfiles ?? [])[0] as { id: string; name?: string; country?: string; language?: string } | undefined

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [editingField, setEditingField] = useState<null | 'name' | 'country' | 'language'>(null)
  const [editValue, setEditValue] = useState('')
  const [notifPermission, setNotifPermission] = useState(() => getNotificationPermission())

  const saveProfileField = async (field: 'name' | 'country' | 'language', value: string) => {
    if (!userProfile) return
    await db.transact(db.tx.userProfiles[userProfile.id].update({ [field]: value.trim() }))
    setEditingField(null)
  }

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission()
    setNotifPermission(result)
  }

  const mealEntries  = (mealData?.mealEntries ?? []) as Array<{ date: string; kcal?: number; protein?: number; carbs?: number; fat?: number }>
  const completions  = (workoutData?.workoutCompletions ?? []) as Array<{ date: string }>

  const mealDates    = [...new Set(mealEntries.map(e => e.date))]
  const workoutDates = [...new Set(completions.map(e => e.date))]

  const nutritionProfile = useMemo(() => getNutritionProfile(), [])
  const targets = useMemo(
    () => nutritionProfile ? calculateTargets(nutritionProfile) : { kcal: 2000, protein: 150, carbs: 200, fat: 65 },
    [nutritionProfile],
  )
  const scanHistory = useMemo(() => getScanHistory(), [])

  const todayProtein = useMemo(
    () => mealEntries.filter(e => e.date === today).reduce((s, e) => s + (e.protein ?? 0), 0),
    [mealEntries, today],
  )

  const mealStreak         = calcStreak(mealDates, today)
  const workoutStreak      = calcStreak(workoutDates, today)
  const alreadyLoggedToday = workoutDates.includes(today)

  // Hydration streak: days where glasses >= DAILY_GOAL
  const waterEntries = (waterData?.waterLogs ?? []) as Array<{ date: string; glasses: number }>
  const hydratedDates = [...new Set(waterEntries.filter(e => e.glasses >= DAILY_GOAL).map(e => e.date))]
  const hydrationStreak = calcStreak(hydratedDates, today)

  // Protein streak: days where daily protein >= 90% of target
  const proteinByDate = new Map<string, number>()
  mealEntries.forEach(e => proteinByDate.set(e.date, (proteinByDate.get(e.date) ?? 0) + (e.protein ?? 0)))
  const proteinHitDates = [...new Set(
    [...proteinByDate.entries()]
      .filter(([, g]) => targets.protein > 0 && g >= targets.protein * 0.9)
      .map(([d]) => d)
  )]
  const proteinStreak = calcStreak(proteinHitDates, today)

  // Activity + sleep streaks from healthLogs
  const healthEntries = (healthData?.healthLogs ?? []) as Array<{ date: string; steps: number; sleepHours: number }>
  const activeStepDates = [...new Set(healthEntries.filter(e => e.steps >= STEP_GOAL).map(e => e.date))]
  const goodSleepDates  = [...new Set(healthEntries.filter(e => e.sleepHours >= SLEEP_GOAL).map(e => e.date))]
  const activityStreak  = calcStreak(activeStepDates, today)
  const sleepStreak     = calcStreak(goodSleepDates, today)

  const logWorkout = async () => {
    if (alreadyLoggedToday) return
    await db.transact(
      db.tx.workoutCompletions[id()].update({ userId, date: today, createdAt: Date.now() })
    )
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
      const KEYS = ['tyw_user_id','uplift_nutrition_profile','tyw_scan_history','tyw_notif_seen','tyw_lb_ts','tyw_notif_ts']
      KEYS.forEach(k => localStorage.removeItem(k))
      await db.auth.signOut()
      navigate('/', { replace: true })
    } finally {
      setDeleteBusy(false)
    }
  }

  // Auto-update leaderboard entry (throttled to once per hour)
  useEffect(() => {
    if (!lbData || !mealData || !workoutData) return
    const LB_KEY = 'tyw_lb_ts'
    const now = Date.now()
    if (now - parseInt(localStorage.getItem(LB_KEY) ?? '0') < 3_600_000) return
    localStorage.setItem(LB_KEY, String(now))
    const nickname = getNickname(userId)
    const existing = ((lbData.leaderboardEntries ?? []) as Array<{ id: string }>)[0]
    const payload = { userId, nickname, workoutStreak, mealStreak, updatedAt: now }
    void (existing
      ? db.transact(db.tx.leaderboardEntries[existing.id].update(payload))
      : db.transact(db.tx.leaderboardEntries[id()].update(payload))
    )
  }, [lbData, mealData, workoutData, userId, workoutStreak, mealStreak])

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text mb-1">MY STREAKS</h1>
        <p className="text-white/40 text-sm">Stay consistent. Every day counts.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <StreakCard label="Meals"     icon={<ForkIcon />}  streak={mealStreak}      loggedDates={mealDates}      today={today} gradient="linear-gradient(135deg,#A855F7,#ec4899)" />
        <StreakCard label="Workouts"  icon={<BoltIcon />}  streak={workoutStreak}   loggedDates={workoutDates}   today={today} gradient="linear-gradient(135deg,#22D3EE,#34d399)" />
        <StreakCard label="Hydration" icon={<DropIcon />}  streak={hydrationStreak} loggedDates={hydratedDates}  today={today} gradient="linear-gradient(135deg,#22D3EE,#06b6d4)" />
        <StreakCard label="Protein"   icon={<FlameIcon />} streak={proteinStreak}   loggedDates={proteinHitDates} today={today} gradient="linear-gradient(135deg,#f97316,#facc15)" />
      </div>

      {(activityStreak > 0 || sleepStreak > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {activityStreak > 0 && <StreakCard label="Activity" icon={<RunIcon />}  streak={activityStreak} loggedDates={activeStepDates} today={today} gradient="linear-gradient(135deg,#34d399,#22D3EE)" />}
          {sleepStreak > 0    && <StreakCard label="Sleep"    icon={<MoonIcon />} streak={sleepStreak}    loggedDates={goodSleepDates}  today={today} gradient="linear-gradient(135deg,#818cf8,#c084fc)" />}
        </div>
      )}

      <button
        onClick={() => void logWorkout()}
        disabled={alreadyLoggedToday}
        className="btn-primary w-full mb-4 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {alreadyLoggedToday ? 'Workout logged today' : "Log today's workout"}
      </button>

      {/* Share streak story */}
      <div className="mb-4">
        <ShareStreakButton
          mealStreak={mealStreak}
          workoutStreak={workoutStreak}
          mealDates={mealDates}
          workoutDates={workoutDates}
          today={today}
        />
      </div>

      <div className="mb-3">
        <WaterSection userId={userId} today={today} />
      </div>

      <div className="mb-3">
        <HealthLogSection userId={userId} today={today} />
      </div>

      <div className="mb-4">
        <WeeklyInsights
          mealEntries={mealEntries}
          targets={targets}
          scanHistory={scanHistory}
          todayProtein={Math.round(todayProtein)}
          today={today}
        />
      </div>

      <div className="mt-4 space-y-2.5">
        <Link
          to="/history"
          className="flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 flex items-center justify-center rounded-xl text-base"
              style={{ background: 'rgba(168,85,247,0.15)' }}
            >
              <svg className="w-4 h-4" style={{ color: '#c084fc' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-white/80">History</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Past plans and workouts</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <Link
          to="/community"
          className="flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 flex items-center justify-center rounded-xl text-base"
              style={{ background: 'rgba(34,211,238,0.12)' }}
            >
              <svg className="w-4 h-4" style={{ color: '#22d3ee' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-white/80">Community</p>
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Healthy finds and leaderboard</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Settings */}
      <div className="mt-8 space-y-6">

        {/* Profile section */}
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
                  <button onClick={() => void saveProfileField('name', editValue)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>Save</button>
                  <button onClick={() => setEditingField(null)} className="text-xs text-white/35 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-white/70">{userProfile?.name ?? 'Not set'}</span>
                  {userProfile && (
                    <button onClick={() => { setEditingField('name'); setEditValue(userProfile.name ?? '') }}
                      className="text-white/30 hover:text-white/60 transition-colors ml-2">
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

            {/* Country */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/40 w-20 flex-shrink-0">Country</span>
              {editingField === 'country' ? (
                <div className="flex-1 flex gap-2">
                  <input
                    className="input-glass !py-1.5 !text-sm flex-1"
                    autoFocus
                    placeholder="e.g. United States"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void saveProfileField('country', editValue) }}
                  />
                  <button onClick={() => void saveProfileField('country', editValue)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                    style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>Save</button>
                  <button onClick={() => setEditingField(null)} className="text-xs text-white/35 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-white/70">{userProfile?.country || 'Not set'}</span>
                  {userProfile && (
                    <button onClick={() => { setEditingField('country'); setEditValue(userProfile.country ?? '') }}
                      className="text-white/30 hover:text-white/60 transition-colors ml-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Language */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/40 w-20 flex-shrink-0">Language</span>
              {editingField === 'language' ? (
                <div className="flex-1 flex gap-2 flex-wrap">
                  {[
                    { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' },
                    { value: 'fr', label: 'French' },  { value: 'de', label: 'German' },
                    { value: 'pt', label: 'Portuguese' }, { value: 'it', label: 'Italian' },
                  ].map(({ value, label }) => (
                    <button key={value}
                      onClick={() => void saveProfileField('language', value)}
                      className={`text-xs px-2.5 py-1 rounded-xl border transition-all ${
                        (userProfile?.language ?? 'en') === value
                          ? 'border-purple-500/60 bg-purple-500/15 text-purple-300'
                          : 'border-white/10 bg-white/5 text-white/50 hover:text-white/80'
                      }`}
                    >{label}</button>
                  ))}
                  <button onClick={() => setEditingField(null)} className="text-xs text-white/35 px-2">Cancel</button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-sm text-white/70 capitalize">{userProfile?.language ?? 'en'}</span>
                  {userProfile && (
                    <button onClick={() => setEditingField('language')}
                      className="text-white/30 hover:text-white/60 transition-colors ml-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Training & Nutrition */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-3 px-1">Training & Nutrition</p>
          <div className="space-y-2">
            <Link
              to="/reevaluate"
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-sm text-white/70">Edit Training Goals</span>
              <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/questionnaire"
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <span className="text-sm text-white/70">Edit Diet Preferences</span>
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
              <button onClick={() => void handleEnableNotifications()} className="text-sm font-medium" style={{ color: '#c084fc' }}>
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
            className="glass-card w-full max-w-sm p-6 space-y-4"
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
