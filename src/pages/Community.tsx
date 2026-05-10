import { useState } from 'react'
import GlassCard from '@/components/GlassCard'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { getNickname } from '@/lib/nickname'
import { GRADE_COLOR } from '@/lib/healthScore'

type Tab = 'finds' | 'leaderboard'

// ── Finds tab ─────────────────────────────────────────────────────────────────

function FindsTab() {
  const userId = getUserId()
  const { data } = db.useQuery({ communityFinds: {} })

  const finds = ((data?.communityFinds ?? []) as Array<{
    id: string
    barcode: string
    productName: string
    brand: string
    grade: string
    gradeColor: string
    imageUrl: string
    sharedBy: string
    sharedAt: number
  }>)
    .sort((a, b) => b.sharedAt - a.sharedAt)
    .slice(0, 20)

  if (!finds.length) {
    return (
      <GlassCard className="text-center py-12">
        <div className="text-4xl mb-4">🌿</div>
        <h3 className="text-white font-bold mb-2">No healthy finds yet</h3>
        <p className="text-white/40 text-sm leading-relaxed">
          Scan A or B grade products in the Food Scanner and share them to start the feed.
        </p>
      </GlassCard>
    )
  }

  return (
    <div className="space-y-3">
      {finds.map(f => {
        const isMe = f.sharedBy === userId
        const color = (GRADE_COLOR as Record<string, string>)[f.grade] ?? '#22c55e'
        return (
          <GlassCard key={f.id} padding={false}>
            <div className="flex items-center gap-4 p-4">
              {f.imageUrl ? (
                <img
                  src={f.imageUrl}
                  alt={f.productName}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  🛒
                </div>
              )}
              <div className="flex-1 min-w-0">
                {f.brand && (
                  <p className="text-white/40 text-[10px] uppercase tracking-wider truncate">{f.brand}</p>
                )}
                <p className="text-white font-semibold text-sm truncate">{f.productName || 'Unknown'}</p>
                <p className="text-white/30 text-[10px] mt-0.5">
                  by {isMe ? 'you' : getNickname(f.sharedBy)} · {new Date(f.sharedAt).toLocaleDateString()}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg"
                style={{ background: color + '22', color }}
              >
                {f.grade}
              </div>
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}

// ── Leaderboard tab ───────────────────────────────────────────────────────────

function LeaderboardTab() {
  const userId = getUserId()
  const { data } = db.useQuery({ leaderboardEntries: {} })

  const entries = ((data?.leaderboardEntries ?? []) as Array<{
    id: string
    userId: string
    nickname: string
    workoutStreak: number
    mealStreak: number
    updatedAt: number
  }>)
    .sort((a, b) => (b.workoutStreak + b.mealStreak) - (a.workoutStreak + a.mealStreak))
    .slice(0, 10)

  if (!entries.length) {
    return (
      <GlassCard className="text-center py-12">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="text-white font-bold mb-2">Leaderboard coming soon</h3>
        <p className="text-white/40 text-sm leading-relaxed">
          Visit the Me page to register on the leaderboard and share your streaks.
        </p>
      </GlassCard>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-2">
      {entries.map((e, i) => {
        const isMe = e.userId === userId
        const total = e.workoutStreak + e.mealStreak
        return (
          <GlassCard
            key={e.id}
            padding={false}
            className={isMe ? 'ring-1 ring-purple-500/30' : ''}
          >
            <div className="flex items-center gap-3 p-4">
              <span className="text-xl w-8 text-center flex-shrink-0">
                {medals[i] ?? `#${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">
                  {e.nickname}{isMe ? ' (you)' : ''}
                </p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px]" style={{ color: '#A855F7' }}>
                    {e.mealStreak}d meals
                  </span>
                  <span className="text-[10px]" style={{ color: '#22D3EE' }}>
                    {e.workoutStreak}d workouts
                  </span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-black text-xl tabular-nums">{total}</p>
                <p className="text-white/30 text-[10px]">total days</p>
              </div>
            </div>
          </GlassCard>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Community() {
  const [tab, setTab] = useState<Tab>('finds')

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-black gradient-text mb-1">COMMUNITY</h1>
        <p className="text-white/40 text-sm">Healthy finds and top streaks</p>
      </div>

      <div
        className="flex gap-1 p-1 rounded-2xl mb-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {(['finds', 'leaderboard'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={tab === t
              ? { background: 'rgba(255,255,255,0.1)', color: '#fff' }
              : { color: 'rgba(255,255,255,0.4)' }
            }
          >
            {t === 'finds' ? 'Healthy Finds' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {tab === 'finds' ? <FindsTab /> : <LeaderboardTab />}
    </main>
  )
}
