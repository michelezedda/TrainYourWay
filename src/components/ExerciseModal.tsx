import { useState, useEffect } from 'react'
import { FaYoutube } from 'react-icons/fa'
import { motion, AnimatePresence } from 'framer-motion'
import { getExerciseInstructions, type ExerciseInstructions } from '@/lib/gemini'
import MuscleMap from './MuscleMap'

// ── Difficulty config ─────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  Beginner: {
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.22)',
    filled: 1,
    label: 'Beginner',
  },
  Intermediate: {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.22)',
    filled: 2,
    label: 'Intermediate',
  },
  Advanced: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.22)',
    filled: 3,
    label: 'Advanced',
  },
} as const

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
      style={{ color: 'rgba(255,255,255,0.28)' }}>
      {children}
    </p>
  )
}

function DifficultyCard({ difficulty, reason }: {
  difficulty?: ExerciseInstructions['difficulty']
  reason?: string
}) {
  if (!difficulty) return null
  const cfg = DIFFICULTY_CONFIG[difficulty]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="rounded-2xl p-4"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <div className="flex items-center gap-3">
        {/* Three-dot difficulty indicator */}
        <div className="flex gap-1.5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i <= cfg.filled ? 10 : 8,
                height: i <= cfg.filled ? 10 : 8,
                background: i <= cfg.filled ? cfg.color : 'rgba(255,255,255,0.1)',
                boxShadow: i <= cfg.filled ? `0 0 6px ${cfg.color}80` : 'none',
              }}
            />
          ))}
        </div>
        <span className="text-sm font-bold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
      {reason && (
        <p className="text-sm leading-relaxed mt-2.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {reason}
        </p>
      )}
    </motion.div>
  )
}

function SetupCard({ setup }: { setup: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 }}
      className="flex gap-3.5 rounded-2xl p-4"
      style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)' }}
    >
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.3)' }}>
        🎯
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: 'rgba(192,132,252,0.8)' }}>
          Starting Position
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
          {setup}
        </p>
      </div>
    </motion.div>
  )
}

function StepsSection({ steps }: { steps: ExerciseInstructions['steps'] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <SectionLabel>How to do it</SectionLabel>
      <div className="space-y-3">
        {steps.map(({ step, title, description }) => (
          <div key={step} className="flex gap-3.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
              style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff', boxShadow: '0 0 14px rgba(168,85,247,0.3)' }}
            >
              {step}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-white font-semibold text-sm leading-snug">{title}</p>
              <p className="text-sm leading-relaxed mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function TipsSection({ tips }: { tips: string[] }) {
  if (!tips.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="rounded-2xl p-4"
      style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.14)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
        style={{ color: 'rgba(34,211,238,0.7)' }}>
        Pro Tips
      </p>
      <div className="space-y-2.5">
        {tips.map((tip, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="text-[10px] mt-1 flex-shrink-0" style={{ color: '#22d3ee' }}>✦</span>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {tip}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function MistakesSection({ avoid }: { avoid: string[] }) {
  if (!avoid.length) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="rounded-2xl p-4"
      style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.14)' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
        style={{ color: 'rgba(239,68,68,0.7)' }}>
        Common Mistakes
      </p>
      <div className="space-y-2.5">
        {avoid.map((item, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="text-[10px] mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }}>✕</span>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center py-12 gap-4">
      <div className="relative w-12 h-12">
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            background: 'conic-gradient(from 0deg, #A855F7, #22D3EE, transparent)',
            padding: 2,
          }}
        >
          <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center text-lg">💪</div>
      </div>
      <div className="text-center">
        <p className="text-white/60 text-sm font-medium">Analyzing exercise...</p>
        <p className="text-white/25 text-xs mt-1">Loading form, muscles, and tips</p>
      </div>
    </div>
  )
}


// ── Main modal ────────────────────────────────────────────────────────────────

export default function ExerciseModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [instructions, setInstructions] = useState<ExerciseInstructions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const query = encodeURIComponent(`${name} exercise proper form tutorial`)

  useEffect(() => {
    setLoading(true)
    setError(false)
    setInstructions(null)
    getExerciseInstructions(name)
      .then(setInstructions)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [name])

  const hasMuscles = !!(
    instructions?.primaryMuscles?.length || instructions?.secondaryMuscles?.length
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(3,0,20,0.82)', backdropFilter: 'blur(18px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 42 }}
        className="w-full max-w-lg mx-auto overflow-hidden"
        style={{
          borderRadius: '28px 28px 0 0',
          background: 'linear-gradient(160deg, rgba(20,10,40,0.98) 0%, rgba(5,5,20,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Sticky header */}
        <div
          className="flex items-start justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
              style={{ color: 'rgba(168,85,247,0.65)' }}>
              How to do
            </p>
            <h3 className="text-xl font-black text-white tracking-tight leading-tight truncate">
              {name}
            </h3>
          </div>

          {/* Stats chips - visible once loaded */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <AnimatePresence>
              {instructions?.difficulty && (
                <motion.span
                  key="diff"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    background: DIFFICULTY_CONFIG[instructions.difficulty].bg,
                    color: DIFFICULTY_CONFIG[instructions.difficulty].color,
                    border: `1px solid ${DIFFICULTY_CONFIG[instructions.difficulty].border}`,
                  }}
                >
                  {instructions.difficulty}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 overscroll-contain pb-20">
          <div className="px-5 py-5 space-y-5 pb-8">

            {/* Loading state */}
            {loading && <LoadingState />}

            {/* Error state */}
            {!loading && error && (
              <div className="text-center py-10">
                <p className="text-4xl mb-3">😕</p>
                <p className="text-white/50 text-sm font-medium">Could not load instructions.</p>
                <p className="text-white/25 text-xs mt-1">Try the YouTube link below.</p>
              </div>
            )}

            {/* Content */}
            {!loading && instructions && (
              <>
                {/* Muscles Worked */}
                {hasMuscles && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 }}
                    className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <MuscleMap
                      primaryMuscles={instructions.primaryMuscles ?? []}
                      secondaryMuscles={instructions.secondaryMuscles ?? []}
                    />
                  </motion.div>
                )}

                {/* Difficulty */}
                <DifficultyCard
                  difficulty={instructions.difficulty}
                  reason={instructions.difficultyReason}
                />

                {/* Setup */}
                <SetupCard setup={instructions.setup} />

                {/* Steps */}
                <StepsSection steps={instructions.steps} />

                {/* Tips */}
                <TipsSection tips={instructions.tips} />

                {/* Common mistakes */}
                <MistakesSection avoid={instructions.avoid} />
              </>
            )}

            {/* YouTube link - always shown */}
            <motion.a
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: loading ? 0 : 0.34 }}
              href={`https://www.youtube.com/results?search_query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              <FaYoutube className="w-4 h-4" style={{ color: '#ef4444' }} />
              Watch on YouTube
            </motion.a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
