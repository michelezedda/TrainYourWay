import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { HiArrowNarrowLeft } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSession, formatDuration } from '@/lib/wellness'

// ── Session definitions ───────────────────────────────────────────────────────

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
        "Your mind will wander. That's fine. Gently return.",
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
        "Let thoughts pass like clouds. You're the sky.",
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
        "It's time to let the day go. You did enough.",
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
        "Your mind is slowing. That's perfect.",
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
  reset: {
    type: 'meditation',
    title: 'Quick Reset',
    desc: 'A 3-minute mental refresh.',
    icon: '⚡',
    accent: '#10B981',
    accentRgb: '16,185,129',
    durationOptions: [3, 5],
    scripts: [
      [
        'Close your eyes. Take one slow breath.',
        'Feel your feet flat on the floor. Grounded.',
        'Let your shoulders drop away from your ears.',
        'Breathe in... and release.',
        'Notice the room around you. You are here.',
        'You are present. Capable. Okay.',
        'One more breath in slowly... and out.',
        'Open your eyes when ready.',
      ],
    ],
  },
  stress: {
    type: 'meditation',
    title: 'Stress Relief',
    desc: 'Release tension, breathe deeply.',
    icon: '🌿',
    accent: '#F59E0B',
    accentRgb: '245,158,11',
    durationOptions: [5, 10, 15],
    scripts: [
      [
        'Notice where the stress is sitting in your body.',
        'Breathe into that tight spot. Gently.',
        'As you exhale, imagine the tension leaving.',
        'Your jaw. Your shoulders. Your hands. Soften.',
        "You don't have to solve anything right now.",
        'This moment is yours. Just breathe.',
        'The pressure is temporary. You are not it.',
        'Let the next breath be a little slower.',
        'And the next even slower still.',
        'Rest here. You are okay.',
      ],
    ],
  },
}

// ── Soundscape engine ─────────────────────────────────────────────────────────

type SoundscapeId = 'drone' | 'rain' | 'ocean' | 'bowls'

const SOUNDSCAPES: { id: SoundscapeId; label: string; icon: string }[] = [
  { id: 'drone', label: 'Drone', icon: '♬' },
  { id: 'rain', label: 'Rain', icon: '🌧' },
  { id: 'ocean', label: 'Ocean', icon: '🌊' },
  { id: 'bowls', label: 'Bowls', icon: '🎵' },
]

function createDronescape(audioCtx: AudioContext): () => void {
  const master = audioCtx.createGain()
  master.gain.setValueAtTime(0, audioCtx.currentTime)
  master.gain.linearRampToValueAtTime(0.045, audioCtx.currentTime + 5)
  master.connect(audioCtx.destination)

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

function createRainscape(audioCtx: AudioContext): () => void {
  const master = audioCtx.createGain()
  master.gain.setValueAtTime(0, audioCtx.currentTime)
  master.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 3)
  master.connect(audioCtx.destination)

  const bufLen = audioCtx.sampleRate * 2
  const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = audioCtx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2800
  filter.Q.value = 0.35

  source.connect(filter)
  filter.connect(master)
  source.start()

  return () => {
    master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2)
    setTimeout(() => { try { source.stop(); master.disconnect() } catch (_e) {} }, 2500)
  }
}

function createOceanscape(audioCtx: AudioContext): () => void {
  const master = audioCtx.createGain()
  master.gain.setValueAtTime(0, audioCtx.currentTime)
  master.gain.linearRampToValueAtTime(0.14, audioCtx.currentTime + 4)
  master.connect(audioCtx.destination)

  const bufLen = audioCtx.sampleRate * 4
  const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1

  const source = audioCtx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = audioCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900

  const lfo = audioCtx.createOscillator()
  const lfoGain = audioCtx.createGain()
  lfo.frequency.value = 0.11
  lfoGain.gain.value = 500
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  lfo.start()

  source.connect(filter)
  filter.connect(master)
  source.start()

  return () => {
    master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.5)
    setTimeout(() => { try { source.stop(); lfo.stop(); master.disconnect() } catch (_e) {} }, 3000)
  }
}

function createBowlscape(audioCtx: AudioContext): () => void {
  const master = audioCtx.createGain()
  master.gain.setValueAtTime(0, audioCtx.currentTime)
  master.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 2)
  master.connect(audioCtx.destination)

  const freqs = [146.8, 220.0, 293.7, 440.0]

  const playBowlAt = (freq: number, startAt: number, dur: number) => {
    try {
      const osc = audioCtx.createOscillator()
      const g = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(0, startAt)
      g.gain.linearRampToValueAtTime(0.85, startAt + 0.07)
      g.gain.exponentialRampToValueAtTime(0.001, startAt + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(startAt)
      osc.stop(startAt + dur + 0.5)
    } catch (_e) {}
  }

  const playPair = () => {
    if (audioCtx.state === 'closed') return
    const shuffled = [...freqs].sort(() => Math.random() - 0.5)
    const t = audioCtx.currentTime
    playBowlAt(shuffled[0], t, 8)
    playBowlAt(shuffled[1], t + 2.5, 7)
  }

  playPair()
  const timerId = setInterval(playPair, 12000)

  return () => {
    clearInterval(timerId)
    master.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2)
    setTimeout(() => { try { master.disconnect() } catch (_e) {} }, 3000)
  }
}

// ── Floating particles ────────────────────────────────────────────────────────

function FloatingParticles({ accentRgb }: { accentRgb: string }) {
  const pts = [
    { x: 22, dur: 8, delay: 0 },
    { x: 38, dur: 11, delay: 2.1 },
    { x: 52, dur: 9, delay: 0.7 },
    { x: 66, dur: 13, delay: 3.5 },
    { x: 78, dur: 10, delay: 1.8 },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {pts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2 + (i % 2),
            height: 2 + (i % 2),
            left: `${p.x}%`,
            top: '58%',
            background: `rgba(${accentRgb},0.55)`,
          }}
          animate={{
            y: [0, -(100 + i * 30)],
            opacity: [0, 0.65, 0],
            x: [0, i % 2 === 0 ? 14 : -14],
          }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
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
  const [durationSecs, setDurationSecs] = useState((def.durationOptions[1] ?? def.durationOptions[0]) * 60)
  const [scriptIdx] = useState(() => Math.floor(Math.random() * def.scripts.length))
  const [lineIdx, setLineIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [activeSoundscape, setActiveSoundscape] = useState<SoundscapeId | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const stopSoundRef = useRef<(() => void) | null>(null)

  const script = def.scripts[scriptIdx]
  const lineInterval = Math.floor(durationSecs / script.length)

  const stopAmbient = useCallback(() => {
    if (stopSoundRef.current) {
      stopSoundRef.current()
      stopSoundRef.current = null
    }
    setActiveSoundscape(null)
  }, [])

  const setSoundscape = useCallback((id: SoundscapeId | null) => {
    if (stopSoundRef.current) {
      stopSoundRef.current()
      stopSoundRef.current = null
    }
    setActiveSoundscape(null)
    if (id === null) return
    try {
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') void ctx.resume()
      if (id === 'drone') stopSoundRef.current = createDronescape(ctx)
      else if (id === 'rain') stopSoundRef.current = createRainscape(ctx)
      else if (id === 'ocean') stopSoundRef.current = createOceanscape(ctx)
      else if (id === 'bowls') stopSoundRef.current = createBowlscape(ctx)
      setActiveSoundscape(id)
    } catch (_e) {}
  }, [])

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
            {def.type === 'sleep'
              ? 'Get into bed. Dim your lights. Let go of the day.'
              : 'Find a quiet spot. Sit comfortably or lie down. Ambient sound available during session.'}
          </p>
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Session length</p>
        <div
          className="grid gap-2 mb-8"
          style={{ gridTemplateColumns: `repeat(${def.durationOptions.length}, 1fr)` }}
        >
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(${accentRgb},0.04) 0%, transparent 100%)` }}
      />

      <FloatingParticles accentRgb={accentRgb} />

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

        <button
          onClick={() => setPaused(p => !p)}
          className="px-4 py-2 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Layered orb */}
      <div className="relative flex items-center justify-center mb-10">
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 3.5, ease: 'easeInOut', repeat: Infinity }}
          style={{
            width: 260, height: 260,
            background: `radial-gradient(circle, rgba(${accentRgb},0.15) 0%, transparent 70%)`,
          }}
        />
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity, delay: 1.2 }}
          style={{ width: 196, height: 196, border: `1px solid rgba(${accentRgb},0.22)` }}
        />
        <motion.div
          className="w-32 h-32 rounded-full flex items-center justify-center text-5xl relative z-10"
          animate={{ opacity: [0.92, 1, 0.92] }}
          transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
          style={{
            background: `radial-gradient(circle at 35% 35%, rgba(${accentRgb},0.22), rgba(${accentRgb},0.06))`,
            border: `1.5px solid rgba(${accentRgb},0.25)`,
            boxShadow: `0 0 40px rgba(${accentRgb},0.2)`,
          }}
        >
          {def.icon}
        </motion.div>
      </div>

      {/* Guided text */}
      <div className="text-center max-w-sm px-4 mb-10 min-h-[80px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
            className="text-white/75 text-xl leading-relaxed font-light text-center"
            style={{ fontStyle: 'italic' }}
          >
            {script[lineIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 items-center mb-6">
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

      {/* Soundscape picker */}
      <div className="flex items-center gap-2 mb-5">
        <button
          aria-label="No sound"
          onClick={() => setSoundscape(null)}
          className="flex flex-col items-center justify-center gap-0.5 w-[50px] py-2.5 rounded-xl transition-all"
          style={activeSoundscape === null
            ? { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.22)' }
            : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
          }
        >
          <span className="text-xs font-bold" style={{ color: activeSoundscape === null ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)' }}>
            off
          </span>
        </button>
        {SOUNDSCAPES.map(sc => (
          <button
            key={sc.id}
            aria-label={sc.label}
            onClick={() => setSoundscape(activeSoundscape === sc.id ? null : sc.id)}
            className="flex flex-col items-center justify-center gap-0.5 w-[50px] py-2.5 rounded-xl transition-all"
            style={activeSoundscape === sc.id
              ? { background: `rgba(${accentRgb},0.18)`, border: `1px solid rgba(${accentRgb},0.4)` }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{sc.icon}</span>
            <span
              className="text-[10px] font-medium"
              style={{ color: activeSoundscape === sc.id ? accent : 'rgba(255,255,255,0.28)' }}
            >
              {sc.label}
            </span>
          </button>
        ))}
      </div>

      <button
        onClick={() => { if (intervalRef.current) clearInterval(intervalRef.current); stopAmbient(); navigate('/wellness') }}
        className="text-sm font-medium"
        style={{ color: 'rgba(255,255,255,0.22)' }}
      >
        End session early
      </button>
    </main>
  )
}
