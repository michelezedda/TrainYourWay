import { useState } from 'react'
import { id } from '@instantdb/react'
import GlassCard from '@/components/GlassCard'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { calcStreak } from '@/lib/streaks'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftBack(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

export default function Personal() {
  const today = toDateStr(new Date())
  const userId = getUserId()
  const [logging, setLogging] = useState(false)

  const { data: mealData }    = db.useQuery({ mealEntries:        { $: { where: { userId } } } })
  const { data: workoutData } = db.useQuery({ workoutCompletions: { $: { where: { userId } } } })

  const mealEntries  = (mealData?.mealEntries ?? []) as Array<{ date: string }>
  const completions  = (workoutData?.workoutCompletions ?? []) as Array<{ date: string }>

  const mealDates    = [...new Set(mealEntries.map(e => e.date))]
  const workoutDates = [...new Set(completions.map(e => e.date))]

  const mealStreak       = calcStreak(mealDates, today)
  const workoutStreak    = calcStreak(workoutDates, today)
  const alreadyLoggedToday = workoutDates.includes(today)

  const logWorkout = async () => {
    if (alreadyLoggedToday || logging) return
    setLogging(true)
    await db.transact(
      db.tx.workoutCompletions[id()].update({ userId, date: today, createdAt: Date.now() })
    )
    setLogging(false)
  }

  const last7 = Array.from({ length: 7 }, (_, i) => shiftBack(today, 6 - i))
  const last7Set = new Set(last7)
  const mealsThisWeek    = mealEntries.filter(e => last7Set.has(e.date)).length
  const workoutsThisWeek = workoutDates.filter(d => last7Set.has(d)).length

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-black gradient-text mb-1">MY STREAKS</h1>
        <p className="text-white/40 text-sm">Stay consistent. Every day counts.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <StreakCard
          label="Meal Streak"
          icon={<ForkIcon />}
          streak={mealStreak}
          loggedDates={mealDates}
          today={today}
          gradient="linear-gradient(135deg, #A855F7, #ec4899)"
        />
        <StreakCard
          label="Workout Streak"
          icon={<BoltIcon />}
          streak={workoutStreak}
          loggedDates={workoutDates}
          today={today}
          gradient="linear-gradient(135deg, #22D3EE, #34d399)"
          action={
            <button
              onClick={() => void logWorkout()}
              disabled={alreadyLoggedToday || logging}
              className="btn-primary w-full !py-2 !text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {alreadyLoggedToday ? 'Logged today' : logging ? '...' : "Log today's workout"}
            </button>
          }
        />
      </div>

      <GlassCard>
        <p className="text-white/30 text-[9px] uppercase tracking-widest mb-4">This week</p>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p
              className="text-3xl font-black tabular-nums"
              style={{ background: 'linear-gradient(135deg, #A855F7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {mealsThisWeek}
            </p>
            <p className="text-white/40 text-xs mt-0.5">meals logged</p>
          </div>
          <div>
            <p
              className="text-3xl font-black tabular-nums"
              style={{ background: 'linear-gradient(135deg, #22D3EE, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {workoutsThisWeek}
            </p>
            <p className="text-white/40 text-xs mt-0.5">workouts done</p>
          </div>
        </div>
      </GlassCard>
    </main>
  )
}
