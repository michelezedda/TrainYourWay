import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowNarrowLeft } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSession, formatDuration } from '@/lib/wellness'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Phase {
  label: string
  instruction: string
  duration: number
  targetScale: number
  isExpand: boolean
}

interface Pattern {
  id: string
  name: string
  desc: string
  icon: string
  timing: string
  phases: Phase[]
  accent: string
  accentRgb: string
}

// ── Patterns ──────────────────────────────────────────────────────────────────

const PATTERNS: Pattern[] = [
  {
    id: 'calm',
    name: 'Calm Breath',
    desc: 'Slow the mind and melt tension',
    icon: '🌊',
    timing: '4s in · 6s out',
    accent: '#22D3EE',
    accentRgb: '34,211,238',
    phases: [
      { label: 'Inhale', instruction: 'Breathe in slowly through your nose', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Exhale', instruction: 'Let it go, fully and gently', duration: 6, targetScale: 0.28, isExpand: false },
    ],
  },
  {
    id: 'box',
    name: 'Box Breathing',
    desc: 'Used by athletes and Navy SEALs',
    icon: '⬜',
    timing: '4s · 4s · 4s · 4s',
    accent: '#818CF8',
    accentRgb: '129,140,248',
    phases: [
      { label: 'Inhale', instruction: 'Fill your lungs completely', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Hold', instruction: 'Hold at the top, stay still', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Exhale', instruction: 'Release slowly, all the way out', duration: 4, targetScale: 0.28, isExpand: false },
      { label: 'Hold', instruction: 'Rest here at the bottom', duration: 4, targetScale: 0.28, isExpand: false },
    ],
  },
  {
    id: '478',
    name: '4-7-8',
    desc: 'Activate your rest response',
    icon: '🌙',
    timing: '4s · 7s · 8s',
    accent: '#6366F1',
    accentRgb: '99,102,241',
    phases: [
      { label: 'Inhale', instruction: 'Breathe in through your nose', duration: 4, targetScale: 1, isExpand: true },
      { label: 'Hold', instruction: 'Hold the breath, be still', duration: 7, targetScale: 1, isExpand: true },
      { label: 'Exhale', instruction: 'Exhale fully through your mouth', duration: 8, targetScale: 0.28, isExpand: false },
    ],
  },
]

// ── Floating particles ────────────────────────────────────────────────────────

function FloatingParticles({ accentRgb }: { accentRgb: string }) {
  const pts = [
    { x: 30, dur: 7, delay: 0.5 },
    { x: 44, dur: 9, delay: 2.2 },
    { x: 56, dur: 8, delay: 1.0 },
    { x: 68, dur: 11, delay: 3.1 },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {pts.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2,
            height: 2,
            left: `${p.x}%`,
            bottom: '38%',
            background: `rgba(${accentRgb},0.45)`,
          }}
          animate={{
            y: [0, -(70 + i * 28)],
            opacity: [0, 0.55, 0],
            x: [i % 2 === 0 ? 8 : -8, i % 2 === 0 ? 20 : -20],
          }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type View = 'setup' | 'session' | 'done'

export default function WellnessBreathing() {
  const navigate = useNavigate()

  const [view, setView] = useState<View>('setup')
  const [pattern, setPattern] = useState(PATTERNS[0])
  const [durationSecs, setDurationSecs] = useState(180)

  const [phaseIdx, setPhaseIdx] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(0.28)
  const [cycleCount, setCycleCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentPhase = pattern.phases[phaseIdx]
  const { accent, accentRgb } = pattern
  const progress = totalElapsed / durationSecs

  // Reset phase elapsed when phase changes
  useEffect(() => {
    setPhaseElapsed(0)
  }, [phaseIdx])

  const nextPhase = useCallback(() => {
    setPhaseIdx(prev => {
      const next = (prev + 1) % pattern.phases.length
      if (next === 0) setCycleCount(c => c + 1)
      setScale(pattern.phases[next].targetScale)
      return next
    })
  }, [pattern.phases])

  useEffect(() => {
    if (view !== 'session' || paused) return

    let phaseTime = 0

    intervalRef.current = setInterval(() => {
      setTotalElapsed(t => {
        if (t + 1 >= durationSecs) {
          clearInterval(intervalRef.current!)
          setView('done')
          saveSession('breathing', durationSecs)
          return t + 1
        }
        return t + 1
      })

      phaseTime += 1
      setPhaseElapsed(phaseTime)

      if (phaseTime >= currentPhase.duration) {
        phaseTime = 0
        nextPhase()
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [view, paused, currentPhase, durationSecs, nextPhase])

  const startSession = () => {
    setPhaseIdx(0)
    setPhaseElapsed(0)
    setTotalElapsed(0)
    setCycleCount(0)
    setPaused(false)
    setScale(pattern.phases[0].targetScale)
    setView('session')
  }

  // ── SETUP ───────────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">
        <div className="flex items-center gap-3 mb-8">
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
              style={{ background: 'linear-gradient(135deg, #22D3EE, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              Breathing
            </h1>
            <p className="text-white/35 text-sm">Calm your body and mind with guided breath.</p>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Choose a technique</p>
        <div className="space-y-3 mb-8">
          {PATTERNS.map(p => {
            const sel = pattern.id === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPattern(p)}
                className="w-full text-left px-5 py-4 rounded-3xl border transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: sel ? `rgba(${p.accentRgb},0.1)` : 'rgba(255,255,255,0.04)',
                  borderColor: sel ? `rgba(${p.accentRgb},0.4)` : 'rgba(255,255,255,0.08)',
                  boxShadow: sel ? `0 0 20px rgba(${p.accentRgb},0.08)` : 'none',
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <div className="text-white font-bold text-base">{p.name}</div>
                      <div className="text-white/45 text-sm mt-0.5">{p.desc}</div>
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: sel ? `rgba(${p.accentRgb},0.15)` : 'rgba(255,255,255,0.06)',
                      color: sel ? p.accent : 'rgba(255,255,255,0.35)',
                    }}
                  >
                    {p.timing}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Duration</p>
        <div className="flex gap-2.5 mb-8">
          {[60, 180, 300, 600].map(sec => (
            <button
              key={sec}
              onClick={() => setDurationSecs(sec)}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold border transition-all duration-200"
              style={durationSecs === sec ? {
                background: `rgba(${pattern.accentRgb},0.15)`,
                borderColor: `rgba(${pattern.accentRgb},0.4)`,
                color: pattern.accent,
              } : {
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              {sec / 60} min
            </button>
          ))}
        </div>

        <button
          onClick={startSession}
          className="w-full py-5 rounded-3xl font-bold text-base text-white transition-all active:scale-[0.98]"
          style={{
            background: `linear-gradient(135deg, rgba(${pattern.accentRgb},0.5), rgba(${pattern.accentRgb},0.2))`,
            border: `1px solid rgba(${pattern.accentRgb},0.4)`,
            boxShadow: `0 0 30px rgba(${pattern.accentRgb},0.15)`,
          }}
        >
          Begin Session
        </button>
      </main>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────

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
              className="w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-5xl"
              style={{
                background: `radial-gradient(circle, rgba(${accentRgb},0.2) 0%, rgba(${accentRgb},0.06) 70%)`,
                border: `1.5px solid rgba(${accentRgb},0.3)`,
                boxShadow: `0 0 50px rgba(${accentRgb},0.18)`,
              }}
            >
              {pattern.icon}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>
              Session complete
            </p>
            <h2 className="text-4xl font-black text-white tracking-tight mb-3">Well done.</h2>
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-white/45 text-sm">{formatDuration(durationSecs)}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/45 text-sm">{cycleCount} cycle{cycleCount !== 1 ? 's' : ''}</span>
            </div>
            <p className="text-white/28 text-xs leading-relaxed mb-8 max-w-xs mx-auto">
              Your nervous system has calmed. Carry this stillness with you.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <button
              onClick={startSession}
              className="w-full py-4 rounded-2xl font-semibold text-white border transition-all active:scale-[0.98]"
              style={{ background: `rgba(${accentRgb},0.1)`, borderColor: `rgba(${accentRgb},0.3)` }}
            >
              Breathe again
            </button>
            <button
              onClick={() => navigate('/wellness')}
              className="w-full py-4 rounded-2xl font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              Back to Mindspace
            </button>
          </motion.div>
        </div>
      </main>
    )
  }

  // ── SESSION ─────────────────────────────────────────────────────────────────

  const remainingSecs = durationSecs - totalElapsed
  const mm = String(Math.floor(remainingSecs / 60)).padStart(2, '0')
  const ss = String(remainingSecs % 60).padStart(2, '0')

  // Organic easing: ease-out for expand, ease-in for contract
  const phaseEasing = currentPhase.isExpand
    ? `cubic-bezier(0.25, 0.46, 0.45, 0.94)`
    : `cubic-bezier(0.55, 0.05, 0.68, 0.19)`
  const orbTransition = `transform ${currentPhase.duration}s ${phaseEasing}`

  const phaseProgress = phaseElapsed / currentPhase.duration

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 40%, rgba(${accentRgb},0.07) 0%, transparent 60%)` }}
    >
      {/* Ambient background that breathes with the orb */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 70% at 50% 50%, rgba(${accentRgb},0.05) 0%, transparent 100%)`,
          transform: `scale(${0.65 + scale * 0.55})`,
          transition: orbTransition,
        }}
      />

      <FloatingParticles accentRgb={accentRgb} />

      {/* Top overall progress bar */}
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
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white/50"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 14 }}
        >
          {paused ? '▶' : '⏸'}
        </button>
      </div>

      {/* Breathing orb - 4 concentric layers */}
      <div className="relative flex items-center justify-center mb-12">
        {/* Aurora outer ring - independent slow pulse */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          animate={{ scale: [1, 1.06, 0.98, 1], opacity: [0.12, 0.2, 0.1, 0.12] }}
          transition={{ duration: 12, ease: 'easeInOut', repeat: Infinity }}
          style={{
            width: 340, height: 340,
            background: `radial-gradient(circle, rgba(${accentRgb},0.08) 0%, transparent 65%)`,
            filter: 'blur(8px)',
          }}
        />
        {/* Outer halo */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 300, height: 300,
            background: `radial-gradient(circle, rgba(${accentRgb},0.07) 0%, transparent 68%)`,
            transform: `scale(${scale})`,
            transition: orbTransition,
          }}
        />
        {/* Middle ring */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 210, height: 210,
            border: `1px solid rgba(${accentRgb},0.18)`,
            transform: `scale(${scale})`,
            transition: orbTransition,
          }}
        />
        {/* Core orb */}
        <div
          className="rounded-full"
          style={{
            width: 160, height: 160,
            background: `radial-gradient(circle at 38% 38%, rgba(${accentRgb},0.95), rgba(${accentRgb},0.3))`,
            boxShadow: `0 0 35px rgba(${accentRgb},0.28), 0 0 80px rgba(${accentRgb},0.1), inset 0 1px 1px rgba(255,255,255,0.18)`,
            transform: `scale(${scale})`,
            transition: orbTransition,
          }}
        />
      </div>

      {/* Phase label and instruction */}
      <div className="text-center px-8 mb-6 min-h-[72px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={phaseIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center"
          >
            <p
              className="text-xs font-bold uppercase tracking-[0.25em] mb-2.5"
              style={{ color: accent }}
            >
              {currentPhase.label}
            </p>
            <p className="text-white/50 text-base leading-relaxed font-light">
              {currentPhase.instruction}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Cycle counter */}
      <AnimatePresence>
        {cycleCount > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-white/22 text-xs tracking-wide mb-4"
          >
            {cycleCount} cycle{cycleCount !== 1 ? 's' : ''} completed
          </motion.p>
        )}
      </AnimatePresence>

      {/* Phase progress bar - bottom of screen */}
      <div className="fixed bottom-0 left-0 right-0 h-[3px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <motion.div
          className="h-full"
          style={{ background: `linear-gradient(90deg, rgba(${accentRgb},0.35), ${accent})` }}
          animate={{ width: `${phaseProgress * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
        />
      </div>
    </main>
  )
}
