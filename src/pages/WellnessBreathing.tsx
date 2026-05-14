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

type View = 'setup' | 'session' | 'done'

// ── Main component ────────────────────────────────────────────────────────────

export default function WellnessBreathing() {
  const navigate = useNavigate()

  const [view, setView] = useState<View>('setup')
  const [pattern, setPattern] = useState(PATTERNS[0])
  const [durationSecs, setDurationSecs] = useState(180)

  const [phaseIdx, setPhaseIdx] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(0.28)
  const [cycleCount, setCycleCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const currentPhase = pattern.phases[phaseIdx]
  const progress = totalElapsed / durationSecs
  const accent = pattern.accent

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
    setTotalElapsed(0)
    setCycleCount(0)
    setPaused(false)
    setScale(pattern.phases[0].targetScale)
    setView('session')
  }

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
            <h1 className="text-3xl font-black tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #22D3EE, #818CF8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
              Breathing
            </h1>
            <p className="text-white/35 text-sm">Calm your body and mind with guided breath.</p>
          </div>
        </div>

        <button
          onClick={startSession}
          className="w-full py-5 rounded-3xl font-bold text-base text-white"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.4), rgba(129,140,248,0.4))',
            border: '1px solid rgba(34,211,238,0.4)'
          }}
        >
          Begin Session
        </button>
      </main>
    )
  }

  // ── Done view ───────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-3xl font-black text-white mb-2">Well done.</h2>
          <p className="text-white/50">
            {formatDuration(durationSecs)} completed • {cycleCount} cycles
          </p>

          <button
            onClick={() => setView('setup')}
            className="mt-6 px-6 py-3 rounded-2xl bg-white/10 text-white"
          >
            Breathe again
          </button>
        </div>
      </main>
    )
  }

  // ── Session view ────────────────────────────────────────────────────────────

  const remainingSecs = durationSecs - totalElapsed
  const mm = String(Math.floor(remainingSecs / 60)).padStart(2, '0')
  const ss = String(remainingSecs % 60).padStart(2, '0')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">

      {/* Timer */}
      <div className="fixed top-4 right-4 text-white/60">
        {mm}:{ss}
      </div>

      {/* Circle */}
      <div
        className="w-40 h-40 rounded-full"
        style={{
          transform: `scale(${scale})`,
          background: accent,
          transition: 'transform 1s ease'
        }}
      />

      {/* Phase */}
      <AnimatePresence mode="wait">
        <motion.div
          key={phaseIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center mt-10"
        >
          <h2 className="text-3xl font-bold text-white">
            {currentPhase.label}
          </h2>
          <p className="text-white/40">
            {currentPhase.instruction}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <button
        onClick={() => setPaused(p => !p)}
        className="mt-10 text-white/60"
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
    </main>
  )
}