import { useState, useEffect, useRef, useCallback } from 'react'
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
    durationOptions: [5, 10, 15, 20, 30],
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

// ── Ambient audio drone (sleep only) ─────────────────────────────────────────

function startAmbientDrone(audioCtx: AudioContext): () => void {
  const master = audioCtx.createGain()
  master.gain.setValueAtTime(0, audioCtx.currentTime)
  master.gain.linearRampToValueAtTime(0.045, audioCtx.currentTime + 5)
  master.connect(audioCtx.destination)

  // F2 / F3 / C4 - pure, non-dissonant intervals for calming effect
  const config: Array<{ freq: number; gain: number }> = [
    { freq: 87.3, gain: 0.55 },
    { freq: 174.6, gain: 0.30 },
    { freq: 261.6, gain: 0.15 },
  ]

  const oscillators = config.map(({ freq, gain: gainVal }) => {
    const osc = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.value = gainVal
    osc.connect(g)
    g.connect(master)
    osc.start()
    return osc
  })

  return () => {
    master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5)
    setTimeout(() => {
      oscillators.forEach(o => { try { o.stop() } catch (_e) {} })
      master.disconnect()
    }, 3000)
  }
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
  const [musicOn, setMusicOn] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stopDroneRef = useRef<(() => void) | null>(null)

  const script = def.scripts[scriptIdx]
  const lineInterval = Math.floor(durationSecs / script.length)

  const stopAmbient = useCallback(() => {
    if (stopDroneRef.current) {
      stopDroneRef.current()
      stopDroneRef.current = null
    }
    setMusicOn(false)
  }, [])

  const toggleMusic = useCallback(() => {
    if (musicOn) {
      stopAmbient()
    } else {
      try {
        const ctx = audioCtxRef.current ?? new AudioContext()
        audioCtxRef.current = ctx
        if (ctx.state === 'suspended') void ctx.resume()
        stopDroneRef.current = startAmbientDrone(ctx)
        setMusicOn(true)
      } catch (_e) {}
    }
  }, [musicOn, stopAmbient])

  useEffect(() => {
    if (view !== 'session' || paused) return
    intervalRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1
        if (next >= durationSecs) {
          clearInterval(intervalRef.current!)
          saveSession(def.type, durationSecs)
          stopAmbient()
          setView('done')
          return next
        }
        setLineIdx(Math.min(Math.floor(next / lineInterval), script.length - 1))
        return next
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, durationSecs, lineInterval, script.length, def.type, stopAmbient])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { stopAmbient() }
  }, [stopAmbient])

  const remaining = durationSecs - elapsed
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const { accent, accentRgb } = def

  // ── Setup ───────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">
        <div className="flex items-center gap-3 mb-7">
          <button
            onClick={() => navigate('/wellness')}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <HiArrowNarrowLeft className="w-5 h-5 text-white/60" />
          </button>
          <div>
            <h1
              className="text-3xl font-black tracking-tight"
              style={{ background: `linear-gradient(135deg, ${accent}, rgba(34,211,238,0.9))`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {def.title}
            </h1>
            <p className="text-white/35 text-sm">{def.desc}</p>
          </div>
        </div>

        <div
          className="flex flex-col items-center py-12 mb-8 rounded-3xl relative overflow-hidden"
          style={{ background: `rgba(${accentRgb},0.06)`, border: `1px solid rgba(${accentRgb},0.14)` }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(${accentRgb},0.1) 0%, transparent 70%)` }}
          />
          <div
            className="text-6xl mb-4 relative z-10"
            style={{ filter: `drop-shadow(0 0 20px rgba(${accentRgb},0.4))` }}
          >
            {def.icon}
          </div>
          <p className="text-white/50 text-sm text-center max-w-xs leading-relaxed px-6 relative z-10">
            {def.type === 'meditation'
              ? "Find a quiet spot. Sit comfortably or lie down. Close your eyes when you're ready."
              : "Get into bed. Dim your lights. Let go of the day."}
          </p>
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Session length</p>
        <div className={`grid gap-2 mb-8 ${def.durationOptions.length >= 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {def.durationOptions.map(mins => (
            <button
              key={mins}
              onClick={() => setDurationSecs(mins * 60)}
              className="py-3 rounded-2xl border text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              style={durationSecs === mins * 60 ? {
                background: `rgba(${accentRgb},0.15)`,
                borderColor: `rgba(${accentRgb},0.4)`,
                color: accent,
              } : {
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              {mins} min
            </button>
          ))}
        </div>

        <button
          onClick={() => { setElapsed(0); setLineIdx(0); setPaused(false); setView('session') }}
          className="w-full py-5 rounded-3xl font-bold text-base text-white transition-all active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, rgba(${accentRgb},0.45), rgba(34,211,238,0.25))`,
            border: `1px solid rgba(${accentRgb},0.4)`,
            boxShadow: `0 0 30px rgba(${accentRgb},0.12)`,
          }}
        >
          Begin {def.title}
        </button>
      </main>
    )
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <div
              className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
              style={{
                background: `radial-gradient(circle, rgba(${accentRgb},0.18) 0%, rgba(${accentRgb},0.06) 70%)`,
                border: `1.5px solid rgba(${accentRgb},0.3)`,
                boxShadow: `0 0 50px rgba(${accentRgb},0.18)`,
              }}
            >
              {def.icon}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Complete</p>
            <h2 className="text-4xl font-black text-white tracking-tight mb-2">
              {def.type === 'sleep' ? 'Rest well.' : 'Beautiful.'}
            </h2>
            <p className="text-white/40 text-sm mb-8 leading-relaxed">
              {formatDuration(durationSecs)} of {def.title.toLowerCase()}.{' '}
              {def.type === 'meditation' ? 'Your mind just got some much-needed space.' : 'Let go and drift off.'}
            </p>
            <button
              onClick={() => navigate('/wellness')}
              className="w-full py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, rgba(${accentRgb},0.35), rgba(34,211,238,0.2))`,
                border: `1px solid rgba(${accentRgb},0.35)`,
              }}
            >
              Back to Mind
            </button>
          </motion.div>
        </div>
      </main>
    )
  }

  // ── Session ─────────────────────────────────────────────────────────────────

  const progress = elapsed / durationSecs

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden relative"
      style={{ background: `radial-gradient(ellipse at 50% 30%, rgba(${accentRgb},0.09) 0%, transparent 65%)` }}
    >
      {/* Ambient glow layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(${accentRgb},0.04) 0%, transparent 100%)` }}
      />

      {/* Top progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
          style={{ background: `linear-gradient(90deg, rgba(${accentRgb},0.5), ${accent})` }}
        />
      </div>

      {/* Header */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 py-5 z-10">
        <button
          onClick={() => navigate('/wellness')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <HiArrowNarrowLeft className="w-5 h-5 text-white/50" />
        </button>

        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: paused ? 'rgba(255,255,255,0.3)' : accent,
              boxShadow: paused ? 'none' : `0 0 5px ${accent}`,
            }}
          />
          <span className="text-white/55 text-sm font-mono tabular-nums">{mm}:{ss}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Ambient music toggle - sleep sessions only */}
          {def.type === 'sleep' && (
            <button
              onClick={toggleMusic}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all"
              style={{
                background: musicOn ? `rgba(${accentRgb},0.2)` : 'rgba(255,255,255,0.06)',
                border: musicOn ? `1px solid rgba(${accentRgb},0.4)` : '1px solid rgba(255,255,255,0.1)',
                color: musicOn ? accent : 'rgba(255,255,255,0.4)',
                fontSize: 16,
              }}
              title={musicOn ? 'Turn off ambient sound' : 'Turn on ambient sound'}
            >
              ♫
            </button>
          )}
          <button
            onClick={() => setPaused(p => !p)}
            className="px-4 py-2 rounded-2xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Icon orb with pulsing ambient ring */}
      <div className="relative flex items-center justify-center mb-14">
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 3.5, ease: 'easeInOut', repeat: Infinity }}
          style={{
            width: 260, height: 260,
            background: `radial-gradient(circle, rgba(${accentRgb},0.15) 0%, transparent 70%)`,
          }}
        />
        <div
          className="w-32 h-32 rounded-full flex items-center justify-center text-5xl relative z-10"
          style={{
            background: `radial-gradient(circle at 35% 35%, rgba(${accentRgb},0.22), rgba(${accentRgb},0.06))`,
            border: `1.5px solid rgba(${accentRgb},0.25)`,
            boxShadow: `0 0 40px rgba(${accentRgb},0.2)`,
          }}
        >
          {def.icon}
        </div>
      </div>

      {/* Guided text */}
      <div className="text-center max-w-sm px-4 mb-14 min-h-[80px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
            className="text-white/72 text-xl leading-relaxed font-light text-center"
            style={{ fontStyle: 'italic' }}
          >
            {script[lineIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 items-center">
        {script.map((_, i) => (
          <motion.div
            key={i}
            className="h-[5px] rounded-full"
            animate={{ width: i === lineIdx ? 20 : 5 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={{ background: i <= lineIdx ? accent : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </div>
    </main>
  )
}
