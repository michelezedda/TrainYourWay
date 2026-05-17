import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { HiArrowNarrowRight } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '@/lib/db'

const FEATURES = [
  {
    icon: '🏋️', badge: 'Personalized', title: 'Workout Plans',
    desc: 'Built around your goals, equipment, body type, and schedule.',
    color: '#A855F7', bg: 'linear-gradient(135deg, rgba(168,85,247,0.13) 0%, rgba(168,85,247,0.05) 100%)',
    border: 'rgba(168,85,247,0.25)', glow: '0 0 40px rgba(168,85,247,0.22)',
  },
  {
    icon: '🎯', badge: 'Built-In', title: 'Smart Coaching',
    desc: 'Form cues, session tips, and coaching insights woven into every workout.',
    color: '#22D3EE', bg: 'linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(34,211,238,0.04) 100%)',
    border: 'rgba(34,211,238,0.22)', glow: '0 0 40px rgba(34,211,238,0.2)',
  },
  {
    icon: '📈', badge: 'Auto-Evolving', title: 'Smart Progress',
    desc: 'Your plan adapts and levels up every 4 weeks automatically.',
    color: '#10b981', bg: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.04) 100%)',
    border: 'rgba(16,185,129,0.22)', glow: '0 0 40px rgba(16,185,129,0.2)',
  },
  {
    icon: '🥗', badge: 'Nutrition', title: 'Food Tracking',
    desc: 'Macros, calories, food scanner, and daily nutrition insights.',
    color: '#f97316', bg: 'linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(249,115,22,0.04) 100%)',
    border: 'rgba(249,115,22,0.22)', glow: '0 0 40px rgba(249,115,22,0.2)',
  },
]

const GOALS = ['Weight Loss', 'Muscle Gain', 'Athletic Performance', 'Strength', 'Flexibility']

const STATS = [
  { value: 'Gym & Home', label: 'Flexible Training' },
  { value: 'Beginner-Friendly', label: 'Easy To Start' },
  { value: 'Focused', label: 'Goal-Based Training' },
]

const floatVariants = [
  { y: [0, -10, 0], duration: 5.5 },
  { y: [0, -8, 0], duration: 6.8 },
  { y: [0, -12, 0], duration: 4.9 },
  { y: [0, -7, 0], duration: 7.2 },
]

export default function Landing() {
  const navigate = useNavigate()
  const { user } = db.useAuth()
  const [activeFeature, setActiveFeature] = useState(0)
  const [goalIdx, setGoalIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActiveFeature(i => (i + 1) % FEATURES.length), 2800)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setGoalIdx(i => (i + 1) % GOALS.length), 2400)
    return () => clearInterval(t)
  }, [])

  if (user) return <Navigate to="/dashboard" replace />

  const activeF = FEATURES[activeFeature]

  return (
    <main className="relative min-h-screen bg-[#030014] overflow-hidden">

      {/* ── Animated background ──────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 40, 0], scale: [1, 1.12, 0.94, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute"
          style={{
            top: '-18%', left: '-12%', width: '60%', height: '60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.24) 0%, transparent 65%)',
            filter: 'blur(80px)',
          }}
        />
        <motion.div
          animate={{ x: [0, -35, 25, 0], y: [0, 30, -40, 0], scale: [1.06, 0.94, 1.14, 1.06] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute"
          style={{
            bottom: '-22%', right: '-12%', width: '60%', height: '60%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 65%)',
            filter: 'blur(80px)',
          }}
        />
        <motion.div
          animate={{ x: [0, 18, -14, 0], y: [0, 14, -18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute"
          style={{
            top: '35%', left: '30%', width: '35%', height: '35%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MOBILE LAYOUT (hidden md+)                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden relative z-10 flex flex-col min-h-screen px-5 pt-12 pb-8">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-5"
        >
          <h1 className="text-[3.2rem] font-black gradient-text leading-none tracking-tight">UPLYFT</h1>
          <p className="text-white/35 text-xs font-semibold uppercase tracking-widest mt-1.5">Train. Evolve. Repeat.</p>
        </motion.div>

        {/* Headline with cycling goal */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="mb-5"
        >
          <p className="text-[1.6rem] font-black text-white leading-tight tracking-tight">
            Your AI coach,<br />built for{' '}
            <span
              className="inline-block"
              style={{ overflow: 'hidden', verticalAlign: 'bottom', height: '1.25em' }}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={goalIdx}
                  initial={{ y: '110%', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: '-110%', opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.4, 0, 0.2, 1] }}
                  className="block"
                  style={{
                    background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}
                >
                  {GOALS[goalIdx]}.
                </motion.span>
              </AnimatePresence>
            </span>
          </p>
        </motion.div>

        {/* Cycling feature card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.18 }}
          className="flex-1 mb-4"
          style={{ minHeight: 160, maxHeight: 220 }}
        >
          <div className="relative h-full">
            <AnimatePresence mode="wait">
              {FEATURES.map((f, i) => i === activeFeature && (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.93, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -14 }}
                  transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
                  className="min-h-[200px] absolute inset-0 rounded-3xl p-5 flex flex-col justify-between"
                  style={{
                    background: f.bg,
                    border: `1px solid ${f.border}`,
                    boxShadow: `${f.glow}, inset 0 1.5px 0 rgba(255,255,255,0.1)`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{f.icon}</span>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{
                        background: `${f.color}22`,
                        color: f.color,
                        border: `1px solid ${f.color}44`,
                      }}
                    >
                      {f.badge}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-black text-xl leading-tight mb-1.5">{f.title}</p>
                    <p className="text-white/55 text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mt-3">
            {FEATURES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveFeature(i)}
                className="rounded-full transition-all duration-400"
                style={{
                  width: i === activeFeature ? 22 : 6,
                  height: 6,
                  background: i === activeFeature ? FEATURES[i].color : 'rgba(255,255,255,0.18)',
                  boxShadow: i === activeFeature ? `0 0 8px ${FEATURES[i].color}` : 'none',
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Stats list */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          {STATS.map(({ value, label }, i) => (
            <div
              key={label}
              className="flex items-center justify-between px-1 py-4"
              style={{ borderBottom: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
            >
              <p className="text-white/40 text-xs uppercase tracking-widest font-medium">{label}</p>
              <p className="text-white font-black text-sm">{value}</p>
            </div>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="space-y-3"
        >
          <button
            onClick={() => navigate('/questionnaire')}
            className="btn-primary w-full justify-center text-base py-4"
          >
            Build My Plan
            <HiArrowNarrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="w-full py-3.5 rounded-2xl text-sm font-medium transition-all duration-200 active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            Already have an account?{' '}
            <span style={{ color: '#c084fc', fontWeight: 600 }}>Log in</span>
          </button>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DESKTOP / TABLET LAYOUT (hidden below md)                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex relative z-10 min-h-screen">

        {/* ── Left: hero panel ──────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center px-12 lg:px-16 xl:px-20 py-16"
          style={{ width: 'min(50%, 560px)', flexShrink: 0 }}>

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-2.5 mb-6 px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.22)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#A855F7', boxShadow: '0 0 6px #A855F7' }} />
              <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#c084fc' }}>
                AI-Powered Fitness
              </span>
            </div>
            <h1
              className="font-black leading-none tracking-tight mb-3"
              style={{ fontSize: 'clamp(3.2rem, 5vw, 5.2rem)', background: 'linear-gradient(135deg, #A855F7 0%, #22D3EE 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              UPLYFT
            </h1>
          </motion.div>

          {/* Headline with cycling goal */}
          <motion.div
            initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="mb-8"
          >
            <h2
              className="font-black text-white tracking-tight leading-[1.08] mb-4"
              style={{ fontSize: 'clamp(2rem, 3.2vw, 3rem)' }}
            >
              Your AI fitness coach,<br />
              <span className="text-white/35">built for </span>
              <span
                className="inline-block"
                style={{ overflow: 'hidden', verticalAlign: 'bottom', height: '1.15em' }}
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={goalIdx}
                    initial={{ y: '110%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-110%', opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    className="block"
                    style={{
                      background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}
                  >
                    {GOALS[goalIdx]}.
                  </motion.span>
                </AnimatePresence>
              </span>
            </h2>
            <p className="text-white/45 text-base leading-relaxed max-w-sm">
              Personalized workout plans, AI coaching, auto-evolving programs, and smart nutrition — all in one place.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex gap-12 mb-10"
          >
            {STATS.map(({ value, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <p className="text-white font-black text-xl leading-none mb-1.5">{value}</p>
                <p className="text-white/35 text-[11px] tracking-widest uppercase">{label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            className="space-y-3 max-w-sm"
          >
            <motion.button
              onClick={() => navigate('/questionnaire')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full justify-center text-lg py-5"
            >
              Build My Plan
              <HiArrowNarrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button
              onClick={() => navigate('/auth')}
              whileHover={{ scale: 1.01, borderColor: 'rgba(192,132,252,0.3)', color: 'rgba(255,255,255,0.7)' }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-2xl text-sm font-medium transition-colors duration-200"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              Already have an account?{' '}
              <span style={{ color: '#c084fc', fontWeight: 600 }}>Log in</span>
            </motion.button>
          </motion.div>
        </div>

        {/* ── Right: feature showcase ────────────────────────────────────────── */}
        <div className="flex-1 flex items-center justify-center px-8 lg:px-12 xl:px-16 py-16">
          <div className="w-full max-w-[520px]">

            {/* Section label */}
            <motion.p
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[11px] font-bold uppercase tracking-[0.18em] mb-5"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Everything you need
            </motion.p>

            {/* 2x2 Feature card grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {FEATURES.map((f, i) => {
                const active = i === activeFeature
                const float = floatVariants[i]
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 28, scale: 0.93 }}
                    animate={{
                      opacity: 1, y: 0, scale: 1,
                    }}
                    transition={{ delay: 0.18 + i * 0.1, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    onClick={() => setActiveFeature(i)}
                    className="rounded-3xl cursor-pointer"
                    style={{
                      background: active ? f.bg : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? f.border : 'rgba(255,255,255,0.07)'}`,
                      boxShadow: active
                        ? `${f.glow}, inset 0 1.5px 0 rgba(255,255,255,0.1)`
                        : 'inset 0 1px 0 rgba(255,255,255,0.05)',
                      transition: 'background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease',
                    }}
                  >
                    <motion.div
                      animate={{ y: float.y }}
                      transition={{ duration: float.duration, repeat: Infinity, ease: 'easeInOut', repeatType: 'mirror' }}
                      className="p-5"
                    >
                      {/* Icon + badge row */}
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{
                            background: active ? `${f.color}18` : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${active ? f.color + '30' : 'rgba(255,255,255,0.08)'}`,
                            transition: 'background 0.5s ease, border-color 0.5s ease',
                          }}
                        >
                          {f.icon}
                        </div>
                        <motion.div
                          animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.75 }}
                          transition={{ duration: 0.3 }}
                        >
                          <span
                            className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: `${f.color}20`, color: f.color, border: `1px solid ${f.color}40` }}
                          >
                            {f.badge}
                          </span>
                        </motion.div>
                      </div>

                      {/* Text */}
                      <p
                        className="font-bold leading-tight mb-1.5 transition-colors duration-500"
                        style={{ fontSize: '0.95rem', color: active ? '#fff' : 'rgba(255,255,255,0.65)' }}
                      >
                        {f.title}
                      </p>
                      <p
                        className="text-xs leading-relaxed transition-all duration-500"
                        style={{ color: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)' }}
                      >
                        {f.desc}
                      </p>
                    </motion.div>
                  </motion.div>
                )
              })}
            </div>

            {/* Bottom progress indicator */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-2 mt-5 px-1"
            >
              <div className="flex gap-1.5">
                {FEATURES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveFeature(i)}
                    className="rounded-full transition-all duration-400"
                    style={{
                      width: i === activeFeature ? 20 : 5,
                      height: 5,
                      background: i === activeFeature ? activeF.color : 'rgba(255,255,255,0.15)',
                      boxShadow: i === activeFeature ? `0 0 6px ${activeF.color}` : 'none',
                    }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-white/25 ml-1">
                {activeFeature + 1} of {FEATURES.length}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

    </main>
  )
}
