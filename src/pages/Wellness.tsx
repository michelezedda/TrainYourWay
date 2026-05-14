import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { HiArrowNarrowRight, HiCheck } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'
import {
  getTodayMood, saveMood, getStreak, getWeekSessions, getSessions,
  formatDuration, type WellnessSession,
} from '@/lib/wellness'

// ── Constants ─────────────────────────────────────────────────────────────────

const MOOD_OPTIONS = [
  { value: 1 as const, emoji: '😞', label: 'Rough' },
  { value: 2 as const, emoji: '😕', label: 'Low' },
  { value: 3 as const, emoji: '😐', label: 'Okay' },
  { value: 4 as const, emoji: '🙂', label: 'Good' },
  { value: 5 as const, emoji: '😄', label: 'Great' },
]

const ENERGY_OPTIONS = [
  { value: 1 as const, label: 'Drained', icon: '🪫' },
  { value: 2 as const, label: 'Neutral', icon: '🔋' },
  { value: 3 as const, label: 'Energised', icon: '⚡' },
]

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

// ── Sub-components ────────────────────────────────────────────────────────────

function MoodDot({ mood }: { mood: number }) {
  const opt = MOOD_OPTIONS.find(m => m.value === mood)
  return <span className="text-lg">{opt?.emoji ?? '😐'}</span>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Wellness() {
  const navigate = useNavigate()
  const { user } = db.useAuth()
  const { data: profileData } = db.useQuery({
    userProfiles: { $: { where: { userId: user?.id ?? '' } } },
  })
  const userName = (profileData?.userProfiles?.[0] as { name?: string } | undefined)?.name?.split(' ')[0] ?? ''

  const [todayMood, setTodayMood] = useState(getTodayMood)
  const [streak, setStreak] = useState(getStreak)
  const [weekSessions, setWeekSessions] = useState(getWeekSessions)
  const [recentSessions, setRecentSessions] = useState(() => getSessions().slice(0, 5))
  const [checkingIn, setCheckingIn] = useState(!getTodayMood())
  const [selectedMood, setSelectedMood] = useState<1 | 2 | 3 | 4 | 5 | null>(null)
  const [selectedEnergy, setSelectedEnergy] = useState<1 | 2 | 3 | null>(null)
  const [moodSaved, setMoodSaved] = useState(false)

  useEffect(() => {
    setTodayMood(getTodayMood())
    setStreak(getStreak())
    setWeekSessions(getWeekSessions())
    setRecentSessions(getSessions().slice(0, 5))
    setCheckingIn(!getTodayMood())
  }, [])

  const handleSaveMood = () => {
    if (!selectedMood || !selectedEnergy) return
    saveMood(selectedMood, selectedEnergy)
    setTodayMood(getTodayMood())
    setMoodSaved(true)
    setTimeout(() => {
      setCheckingIn(false)
      setStreak(getStreak())
    }, 900)
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
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-white/35 text-xs font-medium uppercase tracking-wider">{getGreeting()}{userName ? `, ${userName}` : ''}</p>
              <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #22D3EE, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Mind
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
        </div>

        {/* Mood check-in */}
        <AnimatePresence mode="wait">
          {checkingIn ? (
            <motion.div
              key="checkin"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="rounded-3xl overflow-hidden mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(99,102,241,0.08) 100%)', border: '1px solid rgba(34,211,238,0.2)' }}
            >
              <div className="px-5 pt-5 pb-4">
                {moodSaved ? (
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(34,211,238,0.2)' }}>
                      <HiCheck className="w-4 h-4" style={{ color: '#22D3EE' }} />
                    </div>
                    <p className="text-white font-semibold text-sm">Check-in saved. Keep it up.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#22D3EE' }}>Daily check-in</p>
                    <p className="text-white font-bold text-base mb-4">How are you feeling right now?</p>

                    <div className="flex gap-2 mb-5">
                      {MOOD_OPTIONS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => setSelectedMood(m.value)}
                          className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all active:scale-95"
                          style={selectedMood === m.value ? {
                            background: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.4)',
                          } : {
                            background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
                          }}
                        >
                          <span className="text-xl">{m.emoji}</span>
                          <span className="text-[10px] text-white/50">{m.label}</span>
                        </button>
                      ))}
                    </div>

                    {selectedMood && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        <p className="text-white/60 text-sm font-medium mb-3">Energy level?</p>
                        <div className="flex gap-2 mb-4">
                          {ENERGY_OPTIONS.map(e => (
                            <button
                              key={e.value}
                              onClick={() => setSelectedEnergy(e.value)}
                              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-medium transition-all active:scale-95"
                              style={selectedEnergy === e.value ? {
                                background: 'rgba(129,140,248,0.15)', borderColor: 'rgba(129,140,248,0.4)', color: '#818CF8',
                              } : {
                                background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
                              }}
                            >
                              <span>{e.icon}</span> {e.label}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={handleSaveMood}
                          disabled={!selectedEnergy}
                          className="w-full py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.3), rgba(99,102,241,0.3))', border: '1px solid rgba(34,211,238,0.35)', color: '#fff' }}
                        >
                          Save check-in
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ) : todayMood && (
            <motion.div
              key="mood-done"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-4 rounded-3xl mb-5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <MoodDot mood={todayMood.mood} />
              <div className="flex-1">
                <p className="text-white/70 text-sm font-medium">
                  {MOOD_OPTIONS.find(m => m.value === todayMood.mood)?.label} · {ENERGY_OPTIONS.find(e => e.value === todayMood.energy)?.label} energy
                </p>
                <p className="text-white/30 text-xs">Today's check-in done</p>
              </div>
              <button onClick={() => setCheckingIn(true)} className="text-xs font-medium" style={{ color: '#22D3EE' }}>Edit</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
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
        </div>

        {/* Recommended session */}
        <div className="mb-6">
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
        </div>

        {/* Session grid */}
        <div className="mb-6">
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
        </div>

        {/* Today's affirmation */}
        <div className="mb-6">
          <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Today's affirmation</p>
          <div className="rounded-3xl px-5 py-5"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(34,211,238,0.07) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <span className="text-2xl block mb-3">✨</span>
            <p className="text-white font-semibold text-base leading-relaxed italic">"{affirmation}"</p>
          </div>
        </div>

        {/* Recent sessions */}
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
                    <p className="text-white/30 text-xs">{new Date(s.timestamp).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
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

      </div>
    </main>
  )
}
