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
}

interface Pattern {
  id: string
  name: string
  desc: string
  icon: string
  phases: Phase[]
  accent: string
}

// ── Patterns ──────────────────────────────────────────────────────────────────

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

type View = 'setup' | 'session' | 'done'

// ── Component ────────────────────────────────────────────────────────────────

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
  const accent = pattern.accent

  const progress = totalElapsed / durationSecs

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

  // ── SETUP VIEW ──────────────────────────────────────────────────────────────

  if (view === 'setup') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">

        <div className="flex items-center gap-3 mb-7">
          <button
            onClick={() => navigate('/wellness')}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
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
            <p className="text-white/35 text-sm">
              Calm your body and mind with guided breath.
            </p>
          </div>
        </div>

        {/* Pattern selector (fix: setPattern now used) */}
        <div className="space-y-3 mb-6">
          {PATTERNS.map(p => (
            <button
              key={p.id}
              onClick={() => setPattern(p)}
              className="w-full text-left p-4 rounded-2xl border"
              style={{
                background: pattern.id === p.id ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
                borderColor: pattern.id === p.id ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="text-white font-bold">{p.icon} {p.name}</div>
              <div className="text-white/40 text-sm">{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Duration selector (fix: setDurationSecs now used) */}
        <div className="flex gap-2 mb-6">
          {[60, 180, 300].map(sec => (
            <button
              key={sec}
              onClick={() => setDurationSecs(sec)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{
                background: durationSecs === sec ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.05)',
                color: 'white'
              }}
            >
              {sec / 60} min
            </button>
          ))}
        </div>

        <button
          onClick={startSession}
          className="w-full py-4 rounded-2xl text-white font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.4), rgba(129,140,248,0.4))'
          }}
        >
          Begin Session
        </button>
      </main>
    )
  }

  // ── DONE VIEW ───────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center text-center text-white">
        <div>
          <h2 className="text-3xl font-black mb-2">Done</h2>
          <p className="text-white/50">
            {formatDuration(durationSecs)} • {cycleCount} cycles
          </p>

          <button
            onClick={() => setView('setup')}
            className="mt-6 px-6 py-3 rounded-xl bg-white/10"
          >
            Restart
          </button>
        </div>
      </main>
    )
  }

  // ── SESSION VIEW ────────────────────────────────────────────────────────────

  const remainingSecs = durationSecs - totalElapsed
  const mm = String(Math.floor(remainingSecs / 60)).padStart(2, '0')
  const ss = String(remainingSecs % 60).padStart(2, '0')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center">

      {/* FIX: progress is now used */}
      <div className="w-64 h-1 bg-white/10 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-cyan-400"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="text-white/60 mb-4">{mm}:{ss}</div>

      <div
        className="w-40 h-40 rounded-full"
        style={{
          background: accent,
          transform: `scale(${scale})`,
          transition: 'transform 1s ease'
        }}
      />

      <div className="mt-6 text-center">
        <h2 className="text-2xl font-bold text-white">
          {currentPhase.label}
        </h2>
        <p className="text-white/40">{currentPhase.instruction}</p>
      </div>

      <button
        onClick={() => setPaused(p => !p)}
        className="mt-6 text-white/60"
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
    </main>
  )
}