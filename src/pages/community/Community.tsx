import { useState } from 'react'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { useLocale } from '@/context/LocaleContext'
import { getNickname } from '@/lib/nickname'
import { GRADE_COLOR } from '@/lib/healthScore'

type Tab = 'finds' | 'leaderboard'

function FindsTab() {
  const userId = getUserId()
  const { data } = db.useQuery({ communityFinds: {} })
  const { formatDate } = useLocale()

  const finds = ((data?.communityFinds ?? []) as Array<{
    id: string; barcode: string; productName: string; brand: string
    grade: string; gradeColor: string; imageUrl: string; sharedBy: string; sharedAt: number
  }>).sort((a, b) => b.sharedAt - a.sharedAt).slice(0, 20)

  if (!finds.length) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="text-4xl mb-4">🌿</div>
        <h3 className="text-white font-bold mb-2">No healthy finds yet</h3>
        <p className="text-white/40 text-sm leading-relaxed">
          Scan A or B grade products in the Food Scanner and share them to start the feed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {finds.map(f => {
        const isMe = f.sharedBy === userId
        const color = (GRADE_COLOR as Record<string, string>)[f.grade] ?? '#22c55e'
        return (
          <div key={f.id} className="glass-card p-0">
            <div className="flex items-center gap-4 p-4">
              {f.imageUrl ? (
                <img src={f.imageUrl} alt={f.productName} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>🛒</div>
              )}
              <div className="flex-1 min-w-0">
                {f.brand && <p className="text-white/40 text-[10px] uppercase tracking-wider truncate">{f.brand}</p>}
                <p className="text-white font-semibold text-sm truncate">{f.productName || 'Unknown'}</p>
                <p className="text-white/30 text-[10px] mt-0.5">
                  by {isMe ? 'you' : getNickname(f.sharedBy)} · {formatDate(new Date(f.sharedAt))}
                </p>
              </div>
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-lg"
                style={{ background: color + '22', color }}
              >
                {f.grade}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function LeaderboardTab() {
  const userId = getUserId()
  const { data } = db.useQuery({ leaderboardEntries: {} })

  const entries = ((data?.leaderboardEntries ?? []) as Array<{
    id: string; userId: string; nickname: string; workoutStreak: number; mealStreak: number; updatedAt: number
  }>).sort((a, b) => (b.workoutStreak + b.mealStreak) - (a.workoutStreak + a.mealStreak)).slice(0, 10)

  if (!entries.length) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="text-white font-bold mb-2">Leaderboard coming soon</h3>
        <p className="text-white/40 text-sm leading-relaxed">
          Visit Settings to register on the leaderboard and share your streaks.
        </p>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-2.5">
      {entries.map((e, i) => {
        const isMe = e.userId === userId
        const total = e.workoutStreak + e.mealStreak
        return (
          <div
            key={e.id}
            className="glass-card p-0"
            style={isMe ? { border: '1px solid rgba(168,85,247,0.35)' } : undefined}
          >
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="text-xl w-8 text-center flex-shrink-0">
                {medals[i] ?? <span className="text-sm font-bold text-white/40">#{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">
                  {e.nickname}{isMe ? ' (you)' : ''}
                </p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] font-medium" style={{ color: '#A855F7' }}>{e.mealStreak}d meals</span>
                  <span className="text-[10px] font-medium" style={{ color: '#22D3EE' }}>{e.workoutStreak}d workouts</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white font-black text-2xl tabular-nums">{total}</p>
                <p className="text-white/30 text-[10px]">total days</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function Community() {
  const [tab, setTab] = useState<Tab>('finds')

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <div className="mb-5">
        <h1 className="text-3xl font-black tracking-tight gradient-text">Community</h1>
        <p className="text-white/40 text-sm mt-1">Healthy finds and top streaks.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 p-1 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {(['finds', 'leaderboard'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
            style={tab === t
              ? { background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }
              : { color: 'rgba(255,255,255,0.38)' }
            }
          >
            {t === 'finds' ? '🌿 Finds' : '🏆 Leaderboard'}
          </button>
        ))}
      </div>

      {tab === 'finds' ? <FindsTab /> : <LeaderboardTab />}
    </main>
  )
}
