import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { HiArrowNarrowRight } from 'react-icons/hi'
import { motion } from 'framer-motion'
import { db } from '@/lib/db'
import {
  getStreak, getWeekSessions, getSessions,
  formatDuration, type WellnessSession,
} from '@/lib/wellness'
import { useMood, MOODS } from '@/context/MoodContext'
import { useLocale } from '@/context/LocaleContext'

const SESSION_CARDS = [
  {
    id: 'breathing', icon: '🌬️', label: 'Breathing', desc: 'Calm your nervous system',
    color: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.25)', accent: '#22D3EE',
    to: '/wellness/breathing',
  },
  {
    id: 'meditation', icon: '🧘', label: 'Meditate', desc: 'Guided mental rest',
    color: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)', accent: '#818CF8',
    to: '/wellness/meditate',
  },
  {
    id: 'sleep', icon: '🌙', label: 'Sleep', desc: 'Wind down tonight',
    color: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', accent: '#6366F1',
    to: '/wellness/sleep',
  },
  {
    id: 'focus', icon: '🎯', label: 'Focus', desc: 'Deep work sessions',
    color: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', accent: '#A855F7',
    to: '/wellness/focus',
  },
  {
    id: 'journal', icon: '📔', label: 'Journal', desc: 'Reflect and release',
    color: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)', accent: '#34D399',
    to: '/wellness/journal',
  },
  {
    id: 'affirmation', icon: '✨', label: 'Affirm', desc: 'Positive mindset',
    color: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', accent: '#FBBF24',
    to: '/wellness/affirmations',
  },
]

const AFFIRMATIONS = [
  'Your consistency is building something great.',
  'Rest is part of the process, not a break from it.',
  "You don't need to earn your peace today.",
  'Small steps compound into massive results.',
  'Your mind is as important as your body.',
  "Progress isn't always visible, but it's always happening.",
  'You are stronger than you think.',
  'Recovery is where growth really happens.',
  "It's okay to take things one breath at a time.",
  'Every day you show up is a win.',
  'Be patient with yourself. Transformation takes time.',
  'The work you do in silence speaks loudest.',
  'Your effort today is tomorrow\'s baseline.',
  'Rest is productive. Stillness has power.',
  'You are more resilient than yesterday.',
  'Breathe. You are exactly where you need to be.',
  'Strength includes knowing when to slow down.',
  'Your best looks different every day. Both are valid.',
  'The comeback is always stronger than the setback.',
  'Take care of your mind and your body will follow.',
]

const SESSION_TYPE_LABELS: Record<string, string> = {
  breathing: '🌬️ Breathing',
  meditation: '🧘 Meditation',
  sleep: '🌙 Sleep',
  focus: '🎯 Focus',
  journal: '📔 Journal',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getDailyAffirmation(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  )
  return AFFIRMATIONS[dayOfYear % AFFIRMATIONS.length]
}

function getRecommendation(weekSessions: WellnessSession[]): typeof SESSION_CARDS[0] {
  const h = new Date().getHours()
  const types = weekSessions.map(s => s.type)
  if (h >= 21 || h < 6) return SESSION_CARDS.find(s => s.id === 'sleep')!
  if (h <= 9 && !types.includes('breathing')) return SESSION_CARDS.find(s => s.id === 'breathing')!
  if (!types.includes('journal')) return SESSION_CARDS.find(s => s.id === 'journal')!
  if (!types.includes('breathing')) return SESSION_CARDS.find(s => s.id === 'breathing')!
  if (!types.includes('meditation')) return SESSION_CARDS.find(s => s.id === 'meditation')!
  return SESSION_CARDS.find(s => s.id === 'focus')!
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Wellness() {
  const { user } = db.useAuth()
  const { data: profileData } = db.useQuery({
    userProfiles: { $: { where: { userId: user?.id ?? '' } } },
  })
  const userName = (profileData?.userProfiles?.[0] as { name?: string } | undefined)?.name?.split(' ')[0] ?? ''

  const { mood, selectMood } = useMood()
  const { formatDateWithWeekday } = useLocale()
  const [moodAnim, setMoodAnim] = useState<{ idx: number; tick: number } | null>(null)
  const [streak, setStreak] = useState(getStreak)
  const [weekSessions, setWeekSessions] = useState(getWeekSessions)
  const [recentSessions, setRecentSessions] = useState(() => getSessions().slice(0, 5))

  useEffect(() => {
    setStreak(getStreak())
    setWeekSessions(getWeekSessions())
    setRecentSessions(getSessions().slice(0, 5))
  }, [])

  const handleMoodClick = (i: number) => {
    if (mood === i) return
    setMoodAnim(prev => ({ idx: i, tick: (prev?.tick ?? 0) + 1 }))
    setTimeout(() => setMoodAnim(null), 700)
    selectMood(i)
  }

  const weekMinutes = Math.round(weekSessions.reduce((acc, s) => acc + s.duration, 0) / 60)
  const rec = getRecommendation(weekSessions)
  const affirmation = getDailyAffirmation()

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">

      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute -top-40 -right-20 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-20 -left-20 w-80 h-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-white/35 text-xs font-medium uppercase tracking-wider">{getGreeting()}{userName ? `, ${userName}` : ''}</p>
              <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #22D3EE, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Mindspace
              </h1>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)' }}>
                <span className="text-sm">🔥</span>
                <span className="text-xs font-bold" style={{ color: '#22D3EE' }}>{streak} day streak</span>
              </div>
            )}
          </div>
          <p className="text-white/35 text-sm">Your space for mental recovery and growth.</p>
        </motion.div>

        {/* Mood check-in */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden mb-5"
          style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(99,102,241,0.08) 100%)', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          <div className="px-5 pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#22D3EE' }}>How are you feeling today?</p>
            <div className="flex gap-2">
              {MOODS.map((m, i) => {
                const isAnimating = moodAnim?.idx === i
                const isSelected = mood === i
                return (
                  <button
                    key={isAnimating ? `${i}-${moodAnim!.tick}` : i}
                    onClick={() => handleMoodClick(i)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all duration-200"
                    style={{
                      background: isSelected ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.04)',
                      border: isSelected ? '1px solid rgba(34,211,238,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      boxShadow: isSelected ? '0 0 16px rgba(34,211,238,0.12)' : 'none',
                      animation: isAnimating ? `mood-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both` : undefined,
                      transformOrigin: 'center bottom',
                      cursor: isSelected ? 'default' : 'pointer',
                    }}
                  >
                    <span
                      className="text-2xl leading-none"
                      style={{
                        display: 'inline-block',
                        animation: isAnimating ? `${m.anim} ${m.dur} ease both` : undefined,
                      }}
                    >
                      {m.emoji}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: isSelected ? '#22D3EE' : 'rgba(255,255,255,0.35)' }}>
                      {m.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="grid grid-cols-3 gap-2.5 mb-6"
        >
          {[
            { label: 'Day streak', value: String(streak), icon: '🔥', color: '#FBBF24' },
            { label: 'Sessions this week', value: String(weekSessions.length), icon: '🧘', color: '#22D3EE' },
            { label: 'Mins this week', value: String(weekMinutes), icon: '⏱️', color: '#818CF8' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="rounded-2xl px-2 py-4 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-lg mb-1">{icon}</p>
              <p className="font-black text-xl tabular-nums leading-none mb-1" style={{ color }}>{value}</p>
              <p className="text-white/30 text-[10px] leading-tight">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Recommended session */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Recommended for now</p>
          <Link to={rec.to} className="block rounded-3xl overflow-hidden active:scale-[0.98] transition-all"
            style={{ background: `linear-gradient(135deg, ${rec.color} 0%, rgba(0,0,0,0) 100%)`, border: `1px solid ${rec.border}` }}>
            <div className="px-5 py-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: rec.color, border: `1px solid ${rec.border}` }}>
                {rec.icon}
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-lg">{rec.label}</p>
                <p className="text-white/50 text-sm">{rec.desc}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)' }}>
                <HiArrowNarrowRight className="w-5 h-5 text-white/60" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Session grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
          className="mb-6"
        >
          <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">All sessions</p>
          <div className="grid grid-cols-2 gap-2.5">
            {SESSION_CARDS.map(card => (
              <Link
                key={card.id}
                to={card.to}
                className="block rounded-3xl overflow-hidden active:scale-[0.97] transition-all"
                style={{ background: card.color, border: `1px solid ${card.border}` }}
              >
                <div className="px-4 py-4">
                  <span className="text-3xl block mb-3">{card.icon}</span>
                  <p className="text-white font-bold text-sm mb-0.5">{card.label}</p>
                  <p className="text-white/40 text-xs">{card.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Today's affirmation */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.32 }}
          className="mb-6"
        >
          <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Today's affirmation</p>
          <div className="rounded-3xl px-5 py-5"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(34,211,238,0.07) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <span className="text-2xl block mb-3">✨</span>
            <p className="text-white font-semibold text-base leading-relaxed italic">"{affirmation}"</p>
          </div>
        </motion.div>

        {/* Recent sessions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.38 }}
        >
        {recentSessions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/35 text-xs font-semibold uppercase tracking-wider">Recent sessions</p>
            </div>
            <div className="space-y-2">
              {recentSessions.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-lg flex-shrink-0">{SESSION_TYPE_LABELS[s.type]?.split(' ')[0] ?? '🧘'}</span>
                  <div className="flex-1">
                    <p className="text-white/75 text-sm font-medium">{SESSION_TYPE_LABELS[s.type]?.slice(2) ?? s.type}</p>
                    <p className="text-white/30 text-xs">{formatDateWithWeekday(new Date(s.timestamp))}</p>
                  </div>
                  <span className="text-white/35 text-xs font-medium">{formatDuration(s.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no sessions */}
        {recentSessions.length === 0 && (
          <div className="rounded-3xl px-5 py-8 text-center mb-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="text-4xl mb-3">🌱</div>
            <p className="text-white/50 font-semibold text-sm">Your wellness journey starts here.</p>
            <p className="text-white/30 text-xs mt-1 leading-relaxed">Complete your first session to start building your streak.</p>
          </div>
        )}
        </motion.div>

      </div>
    </main>
  )
}
