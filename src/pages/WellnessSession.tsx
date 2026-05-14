import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { HiArrowNarrowLeft } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSession, formatDuration } from '@/lib/wellness'

// ── Session content ───────────────────────────────────────────────────────────

interface SessionDef {
  type: 'meditation' | 'sleep'
  title: string
  desc: string
  icon: string
  accent: string
  accentRgb: string
  durationOptions: number[]
  scripts: string[][]
}

const SESSIONS: Record<string, SessionDef> = {
  meditation: {
    type: 'meditation',
    title: 'Meditation',
    desc: 'A guided pause for your mind.',
    icon: '🧘',
    accent: '#818CF8',
    accentRgb: '129,140,248',
    durationOptions: [5, 10, 15, 20],
    scripts: [
      [
        'Close your eyes gently. Let your hands rest.',
        'Notice the weight of your body. Breathe naturally.',
        'With each breath out, let the tension ease.',
        'Your mind will wander. That\'s fine. Gently return.',
        'You have nowhere to be right now. Only here.',
        'Soften your jaw. Your shoulders. Your hands.',
        'Notice the sounds around you without reacting.',
        'You are safe. You are still. You are enough.',
        'When ready, take a deep breath in.',
        'And slowly open your eyes.',
      ],
      [
        'Take a slow breath in through your nose.',
        'Hold for a moment at the top.',
        'Release completely through your mouth.',
        'Feel the floor beneath you. Feel supported.',
        'Scan your body from head to toe. Just observe.',
        'Notice any tight spots without trying to fix them.',
        'Send a breath to wherever feels heavy.',
        'Return to the rhythm. In and out.',
        'Let thoughts pass like clouds. You\'re the sky.',
        'Rest here for as long as you need.',
      ],
    ],
  },
  sleep: {
    type: 'sleep',
    title: 'Sleep',
    desc: 'Wind down and prepare for deep rest.',
    icon: '🌙',
    accent: '#6366F1',
    accentRgb: '99,102,241',
    durationOptions: [10, 15, 20, 30],
    scripts: [
      [
        'It\'s time to let the day go. You did enough.',
        'Lie down comfortably. Let your body feel heavy.',
        'Close your eyes. There is nothing you need to do.',
        'Breathe in slowly... and out even slower.',
        'Your body knows how to rest. Trust it.',
        'Let your legs feel heavy. Your arms too.',
        'Notice the coolness of the air as you inhale.',
        'Warmth as you exhale. In and out.',
        'Tomorrow can wait. Tonight belongs to rest.',
        'Drift down, slowly, into sleep.',
      ],
      [
        'Breathe in for 4... and out for 8.',
        'Again. In... and out, slow and complete.',
        'Your mind is slowing. That\'s perfect.',
        'Picture a calm, dark sky full of quiet stars.',
        'You are sinking deeper into the mattress.',
        'Each breath takes you a little further down.',
        'Quieter. Slower. Softer.',
        'There is nothing to solve right now.',
        'Just your breath. Just this moment.',
        'Sleep is already here.',
      ],
    ],
  },
}

// ── Main component ────────────────────────────────────────────────────────────

type View = 'setup' | 'session' | 'done'

export default function WellnessSession() {
  const navigate = useNavigate()
  const { type: typeParam } = useParams<{ type: string }>()
  const { pathname } = useLocation()
  const resolvedType = typeParam ?? (pathname.includes('sleep') ? 'sleep' : 'meditation')
  const def = SESSIONS[resolvedType] ?? SESSIONS.meditation

  const [view, setView] = useState<View>('setup')
  const [durationSecs, setDurationSecs] = useState(def.durationOptions[1] * 60)
  const [scriptIdx] = useState(() => Math.floor(Math.random() * def.scripts.length))
  const [lineIdx, setLineIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const script = def.scripts[scriptIdx]
  const lineInterval = Math.floor(durationSecs / script.length)

  useEffect(() => {
    if (view !== 'session' || paused) return
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= durationSecs) {
          clearInterval(intervalRef.current!)
          saveSession(def.type, durationSecs)
          setView('done')
          return next
        }
        setLineIdx(Math.min(Math.floor(next / lineInterval), script.length - 1))
        return next
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, durationSecs, lineInterval, script.length, def.type])

  const remaining = durationSecs - elapsed
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const { accent, accentRgb } = def

  // ── Setup ───────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
        <div className="flex items-center gap-3 mb-7">
          <button onClick={() => navigate('/wellness')}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <HiArrowNarrowLeft className="w-5 h-5 text-white/60" />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ background: `linear-gradient(135deg, ${accent}, rgba(34,211,238,0.9))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {def.title}
            </h1>
            <p className="text-white/35 text-sm">{def.desc}</p>
          </div>
        </div>

        <div className="flex flex-col items-center py-10 mb-8 rounded-3xl"
          style={{ background: `rgba(${accentRgb},0.06)`, border: `1px solid rgba(${accentRgb},0.15)` }}>
          <div className="text-6xl mb-4">{def.icon}</div>
          <p className="text-white/50 text-sm text-center max-w-xs leading-relaxed px-4">
            {def.type === 'meditation'
              ? 'Find a quiet spot. Sit comfortably or lie down. Close your eyes when you\'re ready.'
              : 'Get into bed. Dim your lights. Let go of the day.'}
          </p>
        </div>

        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Session length</p>
        <div className="grid grid-cols-4 gap-2 mb-8">
          {def.durationOptions.map(mins => (
            <button
              key={mins}
              onClick={() => setDurationSecs(mins * 60)}
              className="py-3 rounded-2xl border text-sm font-semibold transition-all"
              style={durationSecs === mins * 60 ? {
                background: `rgba(${accentRgb},0.15)`, borderColor: `rgba(${accentRgb},0.4)`, color: accent,
              } : {
                background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
              }}
            >
              {mins} min
            </button>
          ))}
        </div>

        <button
          onClick={() => { setElapsed(0); setLineIdx(0); setPaused(false); setView('session') }}
          className="w-full py-5 rounded-3xl font-bold text-base text-white transition-all active:scale-[0.98]"
          style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.4), rgba(34,211,238,0.3))`, border: `1px solid rgba(${accentRgb},0.4)` }}
        >
          Begin {def.title}
        </button>
      </main>
    )
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="w-full max-w-sm text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 280 }}>
            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
              style={{ background: `rgba(${accentRgb},0.15)`, border: `2px solid rgba(${accentRgb},0.35)` }}>
              {def.icon}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Complete</p>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">
              {def.type === 'sleep' ? 'Rest well.' : 'Beautiful.'}
            </h2>
            <p className="text-white/45 text-sm mb-8 leading-relaxed">
              {formatDuration(durationSecs)} of {def.title.toLowerCase()} done.{' '}
              {def.type === 'meditation' ? 'Your mind just got some much-needed space.' : 'Let go and drift off.'}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/wellness')}
                className="w-full py-4 rounded-2xl font-bold text-base text-white"
                style={{ background: `linear-gradient(135deg, rgba(${accentRgb},0.35), rgba(34,211,238,0.25))`, border: `1px solid rgba(${accentRgb},0.35)` }}
              >
                Back to Mind
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    )
  }

  // ── Session ─────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: `radial-gradient(ellipse at center, rgba(${accentRgb},0.05) 0%, transparent 70%)` }}>

      {/* Header */}
      <div className="fixed top-0 inset-x-0 flex items-center justify-between px-5 py-5 z-10">
        <button onClick={() => navigate('/wellness')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <HiArrowNarrowLeft className="w-5 h-5 text-white/50" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
          <span className="text-white/60 text-sm font-medium tabular-nums">{mm}:{ss}</span>
        </div>
        <button onClick={() => setPaused(p => !p)}
          className="px-4 py-2 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Ambient pulse */}
      <div className="relative mb-12">
        <div className="absolute inset-0 rounded-full animate-pulse-slow"
          style={{ background: `radial-gradient(circle, rgba(${accentRgb},0.18) 0%, transparent 70%)`, width: 240, height: 240, transform: 'translate(-50%,-50%)', left: '50%', top: '50%' }} />
        <div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl relative z-10"
          style={{ background: `rgba(${accentRgb},0.12)`, border: `2px solid rgba(${accentRgb},0.25)` }}>
          {def.icon}
        </div>
      </div>

      {/* Guided text */}
      <div className="text-center max-w-xs px-4 mb-16">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
            className="text-white/75 text-xl leading-relaxed font-light text-center"
            style={{ fontStyle: 'italic' }}
          >
            {script[lineIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {script.map((_, i) => (
          <div key={i} className="rounded-full transition-all duration-700"
            style={{
              width: i === lineIdx ? 20 : 5,
              height: 5,
              background: i <= lineIdx ? accent : 'rgba(255,255,255,0.12)',
            }} />
        ))}
      </div>
    </main>
  )
}
