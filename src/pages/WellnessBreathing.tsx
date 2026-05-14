import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowNarrowLeft, HiCheck } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSession, formatDuration } from '@/lib/wellness'

// ── Patterns ──────────────────────────────────────────────────────────────────

interface Phase {
  label: string
  instruction: string
  duration: number
  targetScale: number
}

interface Pattern {
  id: string
  name: string
  desc: string
  icon: string
  phases: Phase[]
  accent: string
}

const PATTERNS: Pattern[] = [
  {
    id: 'calm',
    name: 'Calm Breath',
    desc: 'Slow the mind in 30 seconds',
    icon: '🌊',
    accent: '#22D3EE',
    phases: [
      { label: 'Inhale', instruction: 'Breathe in slowly through your nose', duration: 4, targetScale: 1 },
      { label: 'Exhale', instruction: 'Let it go, fully and gently', duration: 6, targetScale: 0.28 },
    ],
  },
  {
    id: 'box',
    name: 'Box Breathing',
    desc: 'Used by athletes and Navy SEALs',
    icon: '⬜',
    accent: '#818CF8',
    phases: [
      { label: 'Inhale', instruction: 'Fill your lungs completely', duration: 4, targetScale: 1 },
      { label: 'Hold', instruction: 'Hold at the top, stay still', duration: 4, targetScale: 1 },
      { label: 'Exhale', instruction: 'Release slowly, all the way out', duration: 4, targetScale: 0.28 },
      { label: 'Hold', instruction: 'Rest here at the bottom', duration: 4, targetScale: 0.28 },
    ],
  },
  {
    id: '478',
    name: '4-7-8',
    desc: 'Activate your rest response',
    icon: '🌙',
    accent: '#6366F1',
    phases: [
      { label: 'Inhale', instruction: 'Breathe in through your nose', duration: 4, targetScale: 1 },
      { label: 'Hold', instruction: 'Hold the breath, be still', duration: 7, targetScale: 1 },
      { label: 'Exhale', instruction: 'Exhale fully through your mouth', duration: 8, targetScale: 0.28 },
    ],
  },
]

const DURATIONS = [
  { label: '1 min', seconds: 60 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
]

// ── Main component ────────────────────────────────────────────────────────────

type View = 'setup' | 'session' | 'done'

export default function WellnessBreathing() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('setup')
  const [pattern, setPattern] = useState(PATTERNS[0])
  const [durationSecs, setDurationSecs] = useState(180)

  // Session state
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(0.28)
  const [cycleCount, setCycleCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentPhase = pattern.phases[phaseIdx]
  const progress = totalElapsed / durationSecs

  const nextPhase = useCallback(() => {
    setPhaseIdx(prev => {
      const next = (prev + 1) % pattern.phases.length
      if (next === 0) setCycleCount(c => c + 1)
      setScale(pattern.phases[next].targetScale)
      return next
    })
    setPhaseElapsed(0)
  }, [pattern.phases])

  useEffect(() => {
    if (view !== 'session' || paused) return
    intervalRef.current = setInterval(() => {
      setPhaseElapsed(e => {
        if (e + 1 >= currentPhase.duration) {
          nextPhase()
          return 0
        }
        return e + 1
      })
      setTotalElapsed(t => {
        if (t + 1 >= durationSecs) {
          clearInterval(intervalRef.current!)
          setView('done')
          saveSession('breathing', durationSecs)
          return t + 1
        }
        return t + 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, currentPhase.duration, durationSecs, nextPhase])

  const startSession = () => {
    setPhaseIdx(0)
    setPhaseElapsed(0)
    setTotalElapsed(0)
    setCycleCount(0)
    setPaused(false)
    setScale(pattern.phases[0].targetScale)
    setView('session')
  }

  const transitionDuration = currentPhase.duration
  const accent = pattern.accent

  // ── Setup view ──────────────────────────────────────────────────────────────

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
            <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #22D3EE, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Breathing
            </h1>
            <p className="text-white/35 text-sm">Calm your body and mind with guided breath.</p>
          </div>
        </div>

        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Choose a technique</p>
        <div className="space-y-3 mb-7">
          {PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => setPattern(p)}
              className="w-full text-left rounded-3xl border transition-all active:scale-[0.98]"
              style={pattern.id === p.id ? {
                background: 'rgba(34,211,238,0.1)', borderColor: 'rgba(34,211,238,0.35)',
              } : {
                background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: pattern.id === p.id ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)' }}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-base">{p.name}</p>
                  <p className="text-white/40 text-sm mt-0.5">{p.desc}</p>
                  <div className="flex gap-1.5 mt-2">
                    {p.phases.map((ph, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}>
                        {ph.label} {ph.duration}s
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={pattern.id === p.id ? { background: 'linear-gradient(135deg, #22D3EE, #818CF8)' } : { background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)' }}>
                  {pattern.id === p.id && <HiCheck className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Session duration</p>
        <div className="grid grid-cols-4 gap-2 mb-8">
          {DURATIONS.map(d => (
            <button
              key={d.seconds}
              onClick={() => setDurationSecs(d.seconds)}
              className="py-3 rounded-2xl border text-sm font-semibold transition-all"
              style={durationSecs === d.seconds ? {
                background: 'rgba(34,211,238,0.15)', borderColor: 'rgba(34,211,238,0.4)', color: '#22D3EE',
              } : {
                background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={startSession}
          className="w-full py-5 rounded-3xl font-bold text-base text-white transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.4), rgba(129,140,248,0.4))', border: '1px solid rgba(34,211,238,0.4)' }}
        >
          Begin Session
        </button>
      </main>
    )
  }

  // ── Done view ───────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="w-full max-w-sm text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
              style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.25), rgba(129,140,248,0.2))', border: '2px solid rgba(34,211,238,0.4)' }}>
              🌊
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#22D3EE' }}>Session complete</p>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">Well done.</h2>
            <p className="text-white/45 text-sm mb-8 leading-relaxed">
              {formatDuration(durationSecs)} of {pattern.name} - {cycleCount} breath {cycleCount === 1 ? 'cycle' : 'cycles'} completed.
              Your nervous system thanks you.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'Time', value: formatDuration(durationSecs) },
                { label: 'Cycles', value: String(cycleCount) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl px-4 py-4"
                  style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>
                  <p className="text-white font-black text-2xl tabular-nums mb-1">{value}</p>
                  <p className="text-white/35 text-xs">{label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <button
                onClick={() => { setView('setup'); setTotalElapsed(0) }}
                className="w-full py-4 rounded-2xl font-bold text-base text-white"
                style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.35), rgba(129,140,248,0.35))', border: '1px solid rgba(34,211,238,0.35)' }}
              >
                Breathe again
              </button>
              <button
                onClick={() => navigate('/wellness')}
                className="w-full py-4 rounded-2xl text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                Back to Mind
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    )
  }

  // ── Session view ────────────────────────────────────────────────────────────

  const remainingSecs = durationSecs - totalElapsed
  const mm = String(Math.floor(remainingSecs / 60)).padStart(2, '0')
  const ss = String(remainingSecs % 60).padStart(2, '0')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.04) 0%, transparent 70%)' }}>

      {/* Header */}
      <div className="fixed top-0 inset-x-0 flex items-center justify-between px-5 py-5 z-10">
        <button
          onClick={() => navigate('/wellness')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <HiArrowNarrowLeft className="w-5 h-5 text-white/50" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
          <span className="text-white/60 text-sm font-medium tabular-nums">{mm}:{ss}</span>
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          className="px-4 py-2 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Breathing circle */}
      <div className="relative flex items-center justify-center mb-12">
        {/* Outer glow ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 280, height: 280,
            background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
            transform: `scale(${0.5 + scale * 0.6})`,
            transition: `transform ${transitionDuration}s ease-in-out`,
          }}
        />
        {/* Middle ring */}
        <div
          className="absolute rounded-full border"
          style={{
            width: 220, height: 220,
            borderColor: `${accent}30`,
            transform: `scale(${0.4 + scale * 0.7})`,
            transition: `transform ${transitionDuration}s ease-in-out`,
          }}
        />
        {/* Inner circle */}
        <div
          className="absolute rounded-full"
          style={{
            width: 160, height: 160,
            background: `radial-gradient(circle at 40% 40%, ${accent}40 0%, ${accent}18 60%, transparent 100%)`,
            border: `2px solid ${accent}55`,
            boxShadow: `0 0 60px ${accent}25, inset 0 0 40px ${accent}10`,
            transform: `scale(${scale})`,
            transition: `transform ${transitionDuration}s ease-in-out`,
          }}
        />
        {/* Center dot */}
        <div className="relative z-10 text-center pointer-events-none">
          <p className="text-white/20 text-xs font-medium tabular-nums">{pattern.icon}</p>
        </div>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phaseIdx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-10"
        >
          <p className="text-4xl font-black text-white tracking-tight mb-2"
            style={{ color: accent }}>{currentPhase.label}</p>
          <p className="text-white/40 text-sm leading-relaxed max-w-[240px]">{currentPhase.instruction}</p>
        </motion.div>
      </AnimatePresence>

      {/* Phase progress dots */}
      <div className="flex gap-2 mb-8">
        {pattern.phases.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: i === phaseIdx ? 24 : 6,
              height: 6,
              background: i === phaseIdx ? accent : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="w-full max-w-xs h-0.5 rounded-full overflow-hidden mb-6"
        style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: 'linear' }}
          style={{ background: `linear-gradient(90deg, ${accent}, #818CF8)` }}
        />
      </div>

      {/* Cycle counter */}
      <p className="text-white/25 text-xs">{cycleCount > 0 ? `${cycleCount} ${cycleCount === 1 ? 'cycle' : 'cycles'} completed` : pattern.name}</p>
    </main>
  )
}
