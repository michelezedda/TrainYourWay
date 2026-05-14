import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { HiArrowNarrowLeft, HiCheck } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { saveSession, formatDuration } from '@/lib/wellness'

// ── Constants ─────────────────────────────────────────────────────────────────

interface FocusMode {
  id: string
  name: string
  desc: string
  icon: string
  work: number
  rest: number
  accent: string
}

const MODES: FocusMode[] = [
  { id: 'pomodoro', name: 'Pomodoro', desc: '25 min work, 5 min rest', icon: '🍅', work: 25, rest: 5, accent: '#F87171' },
  { id: 'deep', name: 'Deep Work', desc: '50 min work, 10 min rest', icon: '🔬', work: 50, rest: 10, accent: '#818CF8' },
  { id: 'sprint', name: 'Sprint', desc: '15 min work, 3 min rest', icon: '⚡', work: 15, rest: 3, accent: '#FBBF24' },
  { id: 'flow', name: 'Flow State', desc: '90 min uninterrupted', icon: '🌊', work: 90, rest: 0, accent: '#22D3EE' },
]

const WORK_TIPS = [
  'Single-task. One thing at a time.',
  'Close every tab you don\'t need right now.',
  'Put your phone face-down.',
  'Noise-cancelling or silence. Your call.',
  'Write down what you\'re working on before you start.',
  'Drink water. You\'re probably dehydrated.',
  'The goal is progress, not perfection.',
  'Start with the hardest task first.',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

// ── Main component ────────────────────────────────────────────────────────────

type Phase = 'work' | 'rest'
type View = 'setup' | 'session' | 'done'

export default function WellnessFocus() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('setup')
  const [mode, setMode] = useState(MODES[0])
  const [phase, setPhase] = useState<Phase>('work')
  const [remaining, setRemaining] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)
  const [paused, setPaused] = useState(false)
  const [totalWorkSecs, setTotalWorkSecs] = useState(0)
  const [tipIndex] = useState(() => Math.floor(Math.random() * WORK_TIPS.length))

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startSession = () => {
    setPhase('work')
    setRemaining(mode.work * 60)
    setElapsed(0)
    setCycleCount(0)
    setTotalWorkSecs(0)
    setPaused(false)
    setView('session')
  }

  useEffect(() => {
    if (view !== 'session' || paused) return

    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          setPhase(prev => {
            if (prev === 'work') {
              setTotalWorkSecs(t => t + mode.work * 60)
              if (mode.rest === 0) {
                clearInterval(intervalRef.current!)
                setView('done')
                saveSession('focus', mode.work * 60)
                return 'work'
              }
              setRemaining(mode.rest * 60)
              setCycleCount(c => c + 1)
              return 'rest'
            } else {
              setRemaining(mode.work * 60)
              return 'work'
            }
          })
          return mode.rest > 0 ? mode.rest * 60 : 0
        }
        return r - 1
      })
      setElapsed(e => e + 1)
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [view, paused, mode])

  const totalSecs = phase === 'work' ? mode.work * 60 : mode.rest * 60
  const progress = 1 - remaining / totalSecs
  const accent = mode.accent

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
            <h1 className="text-3xl font-black tracking-tight" style={{ background: 'linear-gradient(135deg, #A855F7, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Focus
            </h1>
            <p className="text-white/35 text-sm">Deep work sessions with structured rest.</p>
          </div>
        </div>

        <p className="text-white/35 text-xs font-semibold uppercase tracking-wider mb-3">Session mode</p>
        <div className="space-y-2.5 mb-8">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m)}
              className="w-full text-left rounded-3xl border transition-all active:scale-[0.98]"
              style={mode.id === m.id ? {
                background: `${m.accent}18`, borderColor: `${m.accent}40`,
              } : {
                background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: `${m.accent}15` }}>
                  {m.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-bold text-base">{m.name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: `${m.accent}15`, color: m.accent }}>
                      {m.work} min
                    </span>
                  </div>
                  <p className="text-white/40 text-sm">{m.desc}</p>
                </div>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={mode.id === m.id
                    ? { background: `linear-gradient(135deg, ${m.accent}, #818CF8)` }
                    : { background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)' }}>
                  {mode.id === m.id && <HiCheck className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-3xl px-5 py-4 mb-8"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#A855F7' }}>Focus tip</p>
          <p className="text-white/65 text-sm leading-relaxed">{WORK_TIPS[tipIndex]}</p>
        </div>

        <button
          onClick={startSession}
          className="w-full py-5 rounded-3xl font-bold text-base text-white transition-all active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(129,140,248,0.4))', border: '1px solid rgba(168,85,247,0.4)' }}
        >
          Start Focusing
        </button>
      </main>
    )
  }

  // ── Done ────────────────────────────────────────────────────────────────────

  if (view === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 animate-fade-in">
        <div className="w-full max-w-sm text-center">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl"
              style={{ background: `${accent}20`, border: `2px solid ${accent}40` }}>
              {mode.icon}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>Session complete</p>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">You crushed it.</h2>
            <p className="text-white/45 text-sm mb-8 leading-relaxed">
              {formatDuration(totalWorkSecs > 0 ? totalWorkSecs : mode.work * 60)} of focused work in the books. That compounds.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'Work time', value: formatDuration(totalWorkSecs > 0 ? totalWorkSecs : mode.work * 60) },
                { label: 'Cycles', value: cycleCount > 0 ? String(cycleCount) : '1' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl px-4 py-4"
                  style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
                  <p className="text-white font-black text-2xl mb-1">{value}</p>
                  <p className="text-white/35 text-xs">{label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <button
                onClick={startSession}
                className="w-full py-4 rounded-2xl font-bold text-base text-white"
                style={{ background: `linear-gradient(135deg, ${accent}40, rgba(129,140,248,0.4))`, border: `1px solid ${accent}40` }}
              >
                Another session
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

  // ── Session ─────────────────────────────────────────────────────────────────

  const mm = pad(Math.floor(remaining / 60))
  const ss = pad(remaining % 60)
  const circumference = 2 * Math.PI * 110
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">

      {/* Header */}
      <div className="fixed top-0 inset-x-0 flex items-center justify-between px-5 py-5 z-10">
        <button
          onClick={() => navigate('/wellness')}
          className="w-10 h-10 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <HiArrowNarrowLeft className="w-5 h-5 text-white/50" />
        </button>
        <div className="px-4 py-2 rounded-full text-sm font-medium"
          style={{ background: `${accent}15`, border: `1px solid ${accent}30`, color: accent }}>
          {mode.icon} {mode.name}
        </div>
        <button
          onClick={() => setPaused(p => !p)}
          className="px-4 py-2 rounded-2xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' }}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={phase}
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="text-xs font-bold uppercase tracking-widest mb-8"
          style={{ color: phase === 'work' ? accent : '#34D399' }}
        >
          {phase === 'work' ? 'Focus time' : 'Rest - recharge'}
        </motion.p>
      </AnimatePresence>

      {/* Circular timer */}
      <div className="relative mb-10">
        <svg width="256" height="256" viewBox="0 0 256 256">
          <circle cx="128" cy="128" r="110" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="128" cy="128" r="110"
            fill="none"
            stroke={phase === 'work' ? accent : '#34D399'}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-black tabular-nums leading-none" style={{ fontSize: 56, color: 'white', letterSpacing: '-2px' }}>
            {mm}:{ss}
          </p>
          {cycleCount > 0 && (
            <p className="text-white/30 text-xs mt-2">{cycleCount} {cycleCount === 1 ? 'cycle' : 'cycles'} done</p>
          )}
        </div>
      </div>

      {/* Tip */}
      <div className="w-full max-w-xs text-center px-4 py-4 rounded-2xl mb-6"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-white/40 text-sm leading-relaxed">{WORK_TIPS[(tipIndex + cycleCount) % WORK_TIPS.length]}</p>
      </div>

      <button
        onClick={() => { clearInterval(intervalRef.current!); navigate('/wellness') }}
        className="text-sm font-medium"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        End session early
      </button>
    </main>
  )
}
