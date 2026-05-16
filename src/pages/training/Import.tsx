import { useState, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiChevronLeft, HiArrowNarrowRight, HiPlus } from 'react-icons/hi'
import { useNavigate, Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import ExerciseModal from '@/components/ExerciseModal'
import { parseAnalysisSections, WorkoutDayView } from '@/components/PlanView'
import { buildPlanComponents } from '@/lib/planComponents'
import { extractPlanFromImage, analyzeImportedPlan, improveImportedPlan } from '@/lib/gemini'
import { getNutritionProfile } from '@/lib/nutrition'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'

type Step =
  | 'upload'
  | 'extracting'
  | 'preview'
  | 'saving'
  | 'analyzing'
  | 'analysis'
  | 'improving'
  | 'improvement-reveal'
  | 'success'

// ── Cinematic phase messages ───────────────────────────────────────────────────

const EXTRACT_PHASES = [
  { icon: '📸', label: 'Reading your photos...' },
  { icon: '🔍', label: 'Detecting exercise structure...' },
  { icon: '📋', label: 'Mapping your training split...' },
  { icon: '✨', label: 'Formatting your plan...' },
]

const ANALYZE_PHASES = [
  { icon: '🧠', label: 'Analyzing training split...' },
  { icon: '📊', label: 'Evaluating volume and intensity...' },
  { icon: '🎯', label: 'Checking alignment with your goals...' },
  { icon: '💡', label: 'Building your insights...' },
]

const IMPROVE_PHASES = [
  { icon: '🔬', label: 'Understanding your profile...' },
  { icon: '⚡', label: 'Adapting exercise selection...' },
  { icon: '📈', label: 'Optimizing your progression...' },
  { icon: '🚀', label: 'Finalizing your evolved plan...' },
]

const SAVE_PHASES = [
  { icon: '💾', label: 'Saving your plan...' },
  { icon: '✅', label: 'Almost done...' },
]

// ── Analysis section design tokens ────────────────────────────────────────────

const ANALYSIS_THEME: Record<string, { icon: string; tag: string; accent: string }> = {
  'Plan Assessment': { icon: '🎯', tag: 'Plan overview', accent: '#22D3EE' },
  'Suitability for Your Goals': { icon: '📊', tag: 'Goal alignment', accent: '#A855F7' },
  'What Works Well': { icon: '✅', tag: 'Strengths', accent: '#10b981' },
  'What Could Be Better': { icon: '🔧', tag: 'Optimization areas', accent: '#f59e0b' },
  'Verdict': { icon: '⚡', tag: 'Coach recommendation', accent: '#ec4899' },
}

const ANALYSIS_TIPS: Record<string, string> = {
  'Plan Assessment': 'Structure determines sustainability. A plan you understand is one you will actually follow.',
  'Suitability for Your Goals': 'Alignment between your plan and your goals is the single biggest driver of results.',
  'What Works Well': 'Building on existing strengths is smarter and more motivating than rebuilding from scratch.',
  'What Could Be Better': 'Small structural improvements compound over weeks into measurably better outcomes.',
  'Verdict': 'The best plan is the one calibrated to who you are right now, not who you want to be.',
}

const IMPROVEMENT_ACCENTS = ['#A855F7', '#22D3EE', '#10b981', '#f59e0b', '#ec4899']

// ── Enhanced markdown renderer for analysis slides ────────────────────────────

const analysisMarkdown: Components = {
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-white mt-5 mb-2 first:mt-0 flex items-center gap-2">
      <span className="w-1 h-4 rounded-full flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, #A855F7, #22D3EE)' }} />
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="leading-[1.8] mb-4" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15 }}>{children}</p>
  ),
  ul: ({ children }) => <ul className="space-y-3 mb-4">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15 }}>
      <span className="w-1.5 h-1.5 rounded-full mt-2.5 flex-shrink-0" style={{ background: '#A855F7' }} />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function buildProfileContext(): string {
  const profile = getNutritionProfile()
  if (!profile) return ''
  const lines: string[] = [
    `- Goals: ${profile.goals.join(', ')}`,
    `- Training: ${profile.daysPerWeek} days/week`,
  ]
  if (profile.dietType) lines.push(`- Diet: ${profile.dietType}`)
  if (profile.allergies.length > 0) lines.push(`- Allergies: ${profile.allergies.join(', ')}`)
  return lines.join('\n')
}

function parseWhatChanged(plan: string): string[] {
  const section = plan.match(/## What Changed([\s\S]*?)(?=\n## |$)/i)?.[1] ?? ''
  return section
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('-'))
    .map(l => l.replace(/^-\s*/, '').trim())
    .filter(Boolean)
}

function getImprovementIcon(text: string): string {
  const t = text.toLowerCase()
  if (/recovery|rest day|recover/.test(t)) return '🔄'
  if (/volume|overtraining|overload/.test(t)) return '📊'
  if (/progression|progress/.test(t)) return '📈'
  if (/balance|balanced|distribut|imbalance/.test(t)) return '⚖️'
  if (/muscle|strength|hypertrophy/.test(t)) return '💪'
  if (/schedule|spacing|timing|frequency/.test(t)) return '📅'
  if (/equipment|dumbbell|barbell|machine/.test(t)) return '🏋️'
  if (/intensity|effort|load/.test(t)) return '⚡'
  if (/cardio|endurance|aerobic/.test(t)) return '🏃'
  if (/personal|tailor|custom|profile/.test(t)) return '🎯'
  if (/warm|cool|mobil|flexib/.test(t)) return '🧘'
  return '✨'
}

// ── Slide layout primitives ───────────────────────────────────────────────────

function SlideWrap({ children }: { children: React.ReactNode }) {
  return <div className="pb-52" style={{ minHeight: '72vh' }}>{children}</div>
}

function ImportStickyNav({
  slideIdx, total, isFirst, isLast,
  nextLabel, doneLabel, secondaryLabel,
  onNext, onBack, onDone, onSecondary,
}: {
  slideIdx: number; total: number; isFirst: boolean; isLast: boolean
  nextLabel?: string; doneLabel: string; secondaryLabel?: string
  onNext: () => void; onBack: () => void; onDone: () => void; onSecondary?: () => void
}) {
  return (
    <div className="fixed inset-x-0 md:left-56 z-40 px-4 md:px-8 bottom-28 md:bottom-6">
      <div className="max-w-lg mx-auto">
        <div
          className="rounded-3xl px-4 pt-3 pb-4"
          style={{
            background: 'rgba(3,0,20,0.92)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(168,85,247,0.07)',
          }}
        >
          <div className="flex justify-center gap-1 mb-3">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === slideIdx ? 20 : 5,
                  height: 5,
                  background: i === slideIdx
                    ? 'linear-gradient(90deg, #A855F7, #22D3EE)'
                    : i < slideIdx ? 'rgba(168,85,247,0.42)' : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>

          {isLast && secondaryLabel ? (
            <div className="space-y-2">
              <button
                onClick={onDone}
                className="w-full h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                  color: '#fff',
                  boxShadow: '0 4px 24px rgba(168,85,247,0.5)',
                }}
              >
                {doneLabel} <HiArrowNarrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onSecondary}
                className="w-full h-10 rounded-2xl text-sm font-bold transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {secondaryLabel}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={onBack}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                >
                  <HiChevronLeft className="w-5 h-5" />
                </button>
              )}
              {isLast ? (
                <button
                  onClick={onDone}
                  className="flex-1 h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #A855F7, #22D3EE)',
                    color: '#fff',
                    boxShadow: '0 4px 24px rgba(168,85,247,0.5)',
                  }}
                >
                  {doneLabel} <HiArrowNarrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="flex-1 h-12 rounded-2xl font-black text-sm transition-all active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
                >
                  {nextLabel ?? 'Next'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CinematicLoader ────────────────────────────────────────────────────────────

function CinematicLoader({ phases }: { phases: { icon: string; label: string }[] }) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % phases.length), 2400)
    return () => clearInterval(t)
  }, [phases.length])

  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="relative w-28 h-28 mb-10">
        <div
          className="absolute inset-0 rounded-full animate-spin-slow"
          style={{
            background: 'conic-gradient(from 0deg, #A855F7 0%, #22D3EE 40%, transparent 65%, #A855F7 100%)',
            padding: '3px',
          }}
        >
          <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{ duration: 0.28 }}
            className="absolute inset-0 flex items-center justify-center text-3xl"
          >
            {phases[idx].icon}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.26 }}
          className="text-2xl font-black text-white tracking-tight mb-3"
        >
          {phases[idx].label}
        </motion.p>
      </AnimatePresence>

      <p className="text-white/35 text-sm mb-8">This usually takes 15-30 seconds</p>

      <div className="flex gap-2">
        {phases.map((_, i) => (
          <span
            key={i}
            className="block rounded-full h-1.5 transition-all duration-500"
            style={{
              width: i === idx ? 24 : 6,
              background: i === idx ? '#A855F7' : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>
    </main>
  )
}

// ── ImageCard ──────────────────────────────────────────────────────────────────

function ImageCard({ src, index, onRemove }: { src: string; index: number; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.84, y: -10 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="relative rounded-2xl overflow-hidden bg-white/5"
      style={{ aspectRatio: '3/4', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      <img src={src} alt={`Plan photo ${index + 1}`} className="w-full h-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/70 to-transparent" />
      <span className="absolute top-3 left-3 text-[10px] font-black text-white/75 uppercase tracking-widest">
        Photo {index + 1}
      </span>
      <button
        onClick={onRemove}
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white/80 hover:text-white transition-all"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.14)' }}
      >
        ✕
      </button>
    </motion.div>
  )
}

// ── ConfirmReplaceModal ────────────────────────────────────────────────────────

function ConfirmReplaceModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-32 sm:pb-0"
      style={{ background: 'rgba(5,5,16,0.88)', backdropFilter: 'blur(16px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-sm rounded-3xl p-7"
        style={{ background: 'rgba(18,8,36,0.98)', border: '1px solid rgba(168,85,247,0.22)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5 mx-auto"
          style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.22)' }}
        >
          🔄
        </div>
        <h3 className="text-xl font-black text-white text-center mb-2 tracking-tight">
          Replace your current plan?
        </h3>
        <p className="text-white/45 text-sm text-center leading-relaxed mb-7">
          Your current AI-generated plan will be replaced by this imported plan. Your workout history stays intact.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white/55 transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl text-sm font-black text-white"
            style={{ background: 'linear-gradient(135deg, #A855F7 0%, #7c3aed 100%)' }}
          >
            Import Plan
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Success screen (save-only flow) ───────────────────────────────────────────

function SuccessScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
        className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl mb-8"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(34,211,238,0.12))',
          border: '1px solid rgba(168,85,247,0.28)',
        }}
      >
        🏆
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="text-3xl font-black text-white tracking-tight mb-3"
      >
        Plan imported.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.34 }}
        className="text-white/45 text-sm leading-relaxed mb-10 max-w-xs"
      >
        Your new training program is ready. Time to put in the work.
      </motion.p>
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44 }}
        onClick={onStart}
        className="btn-primary !px-12 !py-4 text-base font-black"
      >
        Start Training
      </motion.button>
    </main>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYSIS REVEAL
// ══════════════════════════════════════════════════════════════════════════════

function AnalysisHeroSlide({ sectionCount }: { sectionCount: number }) {
  return (
    <SlideWrap>
      <div className="flex flex-col items-center text-center space-y-8 pt-6">
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.06 }}
          className="w-32 h-32 rounded-3xl flex items-center justify-center"
          style={{
            fontSize: 64,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.18))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 80px rgba(168,85,247,0.38), 0 0 130px rgba(168,85,247,0.14)',
          }}
        >
          🧠
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#A855F7' }}>
            Analysis complete
          </p>
          <h1
            className="font-black text-white tracking-tight leading-[1.06] mb-4"
            style={{ fontSize: 'clamp(2.4rem, 10vw, 4.2rem)' }}
          >
            Your plan<br />is reviewed.
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-[260px] mx-auto">
            We have analyzed {sectionCount} key areas of your uploaded program.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="flex gap-4 items-center"
        >
          {[
            { label: 'Areas reviewed', value: String(sectionCount) },
            { label: '100%', value: 'Optimized' },
          ].map(({ label, value }, i) => (
            <div key={label} className={`text-center ${i > 0 ? 'border-l border-white/[0.08] pl-4' : ''}`}>
              <p className="font-black text-white leading-none" style={{ fontSize: 'clamp(1.15rem, 4.5vw, 1.6rem)' }}>
                {value}
              </p>
              <p className="text-white/30 text-[9px] uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </SlideWrap>
  )
}

function AnalysisInsightSlide({ section }: { section: { title: string; content: string } }) {
  const theme = ANALYSIS_THEME[section.title] ?? { icon: '📋', tag: 'Insight', accent: '#A855F7' }
  const tip = ANALYSIS_TIPS[section.title]
  const { accent } = theme

  return (
    <SlideWrap>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
            style={{
              background: `linear-gradient(135deg, ${accent}28, ${accent}10)`,
              border: `1px solid ${accent}38`,
            }}
          >
            {theme.icon}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
            {theme.tag}
          </p>
          <h2
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(2rem, 8vw, 3.2rem)' }}
          >
            {section.title}
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="px-5 py-5">
            <ReactMarkdown components={analysisMarkdown}>{section.content}</ReactMarkdown>
          </div>
        </motion.div>

        {tip && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex gap-3 px-4 py-4 rounded-2xl"
            style={{ background: `${accent}0e`, border: `1px solid ${accent}28` }}
          >
            <span className="text-lg flex-shrink-0">💡</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: accent }}>
                Coach insight
              </p>
              <p className="text-white/65 text-sm leading-relaxed">{tip}</p>
            </div>
          </motion.div>
        )}
      </div>
    </SlideWrap>
  )
}

function ImportAnalysisReveal({
  sections, hasProfile, onKeep, onImprove,
}: {
  sections: { title: string; content: string }[]
  hasProfile: boolean
  onKeep: () => void
  onImprove: () => void
}) {
  const [slideIdx, setSlideIdx] = useState(0)
  const [dir, setDir] = useState(1)

  const total = 1 + sections.length
  const isLast = slideIdx === total - 1

  const go = (next: number) => { setDir(next > slideIdx ? 1 : -1); setSlideIdx(next) }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={slideIdx}
          initial={{ opacity: 0, x: dir > 0 ? 28 : -28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir > 0 ? -18 : 18, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
          {slideIdx === 0
            ? <AnalysisHeroSlide sectionCount={sections.length} />
            : <AnalysisInsightSlide section={sections[slideIdx - 1]} />
          }
        </motion.div>
      </AnimatePresence>

      <ImportStickyNav
        slideIdx={slideIdx}
        total={total}
        isFirst={slideIdx === 0}
        isLast={isLast}
        nextLabel="Next insight"
        doneLabel={hasProfile ? 'Improve My Plan' : 'Keep My Plan'}
        secondaryLabel={hasProfile && isLast ? 'Keep My Plan' : undefined}
        onNext={() => go(slideIdx + 1)}
        onBack={() => go(slideIdx - 1)}
        onDone={hasProfile ? onImprove : onKeep}
        onSecondary={hasProfile ? onKeep : undefined}
      />
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPROVEMENT REVEAL
// ══════════════════════════════════════════════════════════════════════════════

function ImprovementHeroSlide({ itemCount }: { itemCount: number }) {
  return (
    <SlideWrap>
      <div className="flex flex-col items-center text-center space-y-8 pt-6">
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.06 }}
          className="w-32 h-32 rounded-3xl flex items-center justify-center"
          style={{
            fontSize: 64,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.18))',
            border: '1px solid rgba(168,85,247,0.45)',
            boxShadow: '0 0 80px rgba(168,85,247,0.38), 0 0 130px rgba(168,85,247,0.14)',
          }}
        >
          🚀
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: '#22D3EE' }}>
            Your AI coach evolved your plan
          </p>
          <h1
            className="font-black text-white tracking-tight leading-[1.06] mb-4"
            style={{ fontSize: 'clamp(2.4rem, 10vw, 4.2rem)' }}
          >
            Plan<br />upgraded.
          </h1>
          <p className="text-white/45 text-base leading-relaxed max-w-[260px] mx-auto">
            {itemCount > 0
              ? `${itemCount} targeted improvement${itemCount !== 1 ? 's' : ''} were made to your program.`
              : 'Your uploaded plan has been tailored to your profile and goals.'
            }
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-2"
        >
          {[{ label: 'Personalized', icon: '🎯' }, { label: 'Optimized', icon: '⚡' }, { label: 'Yours', icon: '🏆' }].map(({ label, icon }) => (
            <span
              key={label}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)', color: '#c084fc' }}
            >
              {icon} {label}
            </span>
          ))}
        </motion.div>
      </div>
    </SlideWrap>
  )
}

function ImprovementItemSlide({ item, index }: { item: string; index: number }) {
  const icon = getImprovementIcon(item)
  const accent = IMPROVEMENT_ACCENTS[index % IMPROVEMENT_ACCENTS.length]

  // Split on first capital-letter sentence boundary after a full stop
  const splitIdx = item.search(/(?<=[.!?])\s+[A-Z]/)
  const headline = splitIdx > 0 ? item.slice(0, splitIdx + 1) : item
  const detail = splitIdx > 0 ? item.slice(splitIdx + 1) : ''

  return (
    <SlideWrap>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4"
            style={{
              background: `linear-gradient(135deg, ${accent}28, ${accent}10)`,
              border: `1px solid ${accent}38`,
            }}
          >
            {icon}
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
            Improvement {index + 1}
          </p>
          <h2
            className="font-black text-white tracking-tight leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 7.5vw, 2.8rem)' }}
          >
            {headline}
          </h2>
        </motion.div>

        {detail && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-3xl px-5 py-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-white/65 text-base leading-relaxed">{detail}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 px-4 py-3.5 rounded-2xl"
          style={{ background: `${accent}0e`, border: `1px solid ${accent}28` }}
        >
          <span className="text-sm flex-shrink-0 mt-0.5">⚡</span>
          <p className="text-white/55 text-sm leading-relaxed">
            This change is calibrated to your specific fitness profile and goals.
          </p>
        </motion.div>
      </div>
    </SlideWrap>
  )
}

function ImprovementReveal({ items, onStart }: { items: string[]; onStart: () => void }) {
  const [slideIdx, setSlideIdx] = useState(0)
  const [dir, setDir] = useState(1)

  const slideItems = items.length > 0 ? items : ['Your plan has been tailored to your profile and goals.']
  const total = 1 + slideItems.length
  const isLast = slideIdx === total - 1

  const go = (next: number) => { setDir(next > slideIdx ? 1 : -1); setSlideIdx(next) }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={slideIdx}
          initial={{ opacity: 0, x: dir > 0 ? 28 : -28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir > 0 ? -18 : 18, scale: 0.98 }}
          transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
          {slideIdx === 0
            ? <ImprovementHeroSlide itemCount={items.length} />
            : <ImprovementItemSlide item={slideItems[slideIdx - 1]} index={slideIdx - 1} />
          }
        </motion.div>
      </AnimatePresence>

      <ImportStickyNav
        slideIdx={slideIdx}
        total={total}
        isFirst={slideIdx === 0}
        isLast={isLast}
        nextLabel="See next improvement"
        doneLabel="Start Training"
        onNext={() => go(slideIdx + 1)}
        onBack={() => go(slideIdx - 1)}
        onDone={onStart}
      />
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function ImportPlan() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [images, setImages] = useState<string[]>([])
  const [extractedPlan, setExtractedPlan] = useState('')
  const [analysisSections, setAnalysisSections] = useState<ReturnType<typeof parseAnalysisSections>>([])
  const [whatChangedItems, setWhatChangedItems] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<'save' | 'improve' | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  const profileContext = buildProfileContext()
  const hasProfile = !!profileContext

  const previewComponents = useMemo(() => buildPlanComponents(setSelectedExercise), [])

  // ── File handling ─────────────────────────────────────────────────────────────

  const addFiles = (files: FileList | File[]) => {
    Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 3 - images.length)
      .forEach(file => {
        const reader = new FileReader()
        reader.onload = () => {
          setImages(prev => prev.length < 3 ? [...prev, reader.result as string] : prev)
        }
        reader.readAsDataURL(file)
      })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    addFiles(e.dataTransfer.files)
  }

  const removeImage = (i: number) => setImages(prev => prev.filter((_, idx) => idx !== i))

  // ── Core actions ──────────────────────────────────────────────────────────────

  const savePlan = async (planText: string) => {
    const planId = id()
    const userId = getUserId()
    await db.transact(
      db.tx.workoutPlans[planId].update({
        userId, userName: 'Imported Plan', fitnessLevel: '',
        goals: '[]', equipment: '[]', constraints: 'imported',
        plan: planText, createdAt: Date.now(), parentPlanId: '',
      }),
    )
    return planId
  }

  const handleExtract = async () => {
    if (images.length === 0) return
    setStep('extracting')
    setError(null)
    try {
      const results = await Promise.all(images.map(img => extractPlanFromImage(img)))
      setExtractedPlan(results.join('\n\n'))
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract plan from image')
      setStep('upload')
    }
  }

  const requestSave = () => { setPendingAction('save'); setShowConfirm(true) }
  const requestImprove = () => { setPendingAction('improve'); setShowConfirm(true) }

  const handleConfirmed = () => {
    setShowConfirm(false)
    if (pendingAction === 'save') void doSave()
    if (pendingAction === 'improve') void doImprove()
  }

  const doSave = async (planText = extractedPlan) => {
    setStep('saving')
    setError(null)
    try {
      await savePlan(planText)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
      setStep('preview')
    }
  }

  const handleAnalyze = async () => {
    setStep('analyzing')
    setError(null)
    try {
      const raw = await analyzeImportedPlan(extractedPlan, profileContext)
      setAnalysisSections(parseAnalysisSections(raw))
      setStep('analysis')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze plan')
      setStep('preview')
    }
  }

  const doImprove = async () => {
    setStep('improving')
    setError(null)
    try {
      const improved = await improveImportedPlan(extractedPlan, profileContext)
      const items = parseWhatChanged(improved)
      await savePlan(improved)
      setWhatChangedItems(items)
      setStep('improvement-reveal')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve plan')
      setStep('analysis')
    }
  }

  // ── Loading steps ─────────────────────────────────────────────────────────────

  if (step === 'extracting') return <CinematicLoader phases={EXTRACT_PHASES} />
  if (step === 'analyzing') return <CinematicLoader phases={ANALYZE_PHASES} />
  if (step === 'improving') return <CinematicLoader phases={IMPROVE_PHASES} />
  if (step === 'saving') return <CinematicLoader phases={SAVE_PHASES} />

  // ── Success (save-only path) ──────────────────────────────────────────────────

  if (step === 'success') {
    return <SuccessScreen onStart={() => navigate('/workout', { replace: true })} />
  }

  // ── Improvement reveal (improve path) ────────────────────────────────────────

  if (step === 'improvement-reveal') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6">
        <ImprovementReveal
          items={whatChangedItems}
          onStart={() => navigate('/workout', { replace: true })}
        />
      </main>
    )
  }

  // ── Analysis reveal ───────────────────────────────────────────────────────────

  if (step === 'analysis') {
    return (
      <>
        <AnimatePresence>
          {showConfirm && (
            <ConfirmReplaceModal onConfirm={handleConfirmed} onCancel={() => setShowConfirm(false)} />
          )}
        </AnimatePresence>
        {selectedExercise && (
          <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
        )}
        <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6">
          {analysisSections.length > 0 ? (
            <ImportAnalysisReveal
              sections={analysisSections}
              hasProfile={hasProfile}
              onKeep={requestSave}
              onImprove={requestImprove}
            />
          ) : (
            <div
              className="rounded-2xl p-5 text-white/40 text-sm"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              No analysis sections found.
              {!hasProfile && (
                <p className="mt-3 text-xs">
                  Complete the{' '}
                  <Link to="/questionnaire" className="text-purple-400 underline">questionnaire</Link>{' '}
                  to unlock personalized improvements.
                </p>
              )}
            </div>
          )}
        </main>
      </>
    )
  }

  // ── Preview ───────────────────────────────────────────────────────────────────

  if (step === 'preview') {
    return (
      <main className="w-full md:max-w-2xl lg:max-w-3xl md:mx-auto px-4 pt-6 pb-nav">
        <AnimatePresence>
          {showConfirm && (
            <ConfirmReplaceModal onConfirm={handleConfirmed} onCancel={() => setShowConfirm(false)} />
          )}
        </AnimatePresence>
        {selectedExercise && (
          <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
        )}

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setStep('upload')} className="text-white/40 hover:text-white transition-colors">
            <HiChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#A855F7' }}>Preview</p>
            <h1 className="text-2xl font-black text-white tracking-tight">Your Imported Plan</h1>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 p-3.5 rounded-2xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            {error}
          </div>
        )}

        <div className="mb-6">
          <WorkoutDayView plan={extractedPlan} planComponents={previewComponents} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-3xl p-6 mb-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h2 className="text-white font-black text-lg mb-1.5 tracking-tight">What would you like to do?</h2>
          <p className="text-white/40 text-sm mb-5 leading-relaxed">
            Save this plan as-is, or let the AI analyze how well it matches your profile and goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={requestSave}
              className="flex-1 py-4 rounded-2xl text-sm font-bold text-white/65 transition-all hover:bg-white/5 active:scale-[0.97]"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            >
              Save As-Is
            </button>
            <button
              onClick={() => void handleAnalyze()}
              className="flex-1 py-4 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
              style={{ background: 'linear-gradient(135deg, #A855F7 0%, #7c3aed 100%)' }}
            >
              Analyze This Plan <HiArrowNarrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </main>
    )
  }

  // ── Upload ────────────────────────────────────────────────────────────────────

  const canAddMore = images.length < 3

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-3 mb-10">
        <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white transition-colors">
          <HiChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#A855F7' }}>Import</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Upload Your Plan</h1>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-5 p-3.5 rounded-2xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {images.length === 0 ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="mb-6"
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="w-full flex flex-col items-center justify-center gap-5 py-16 rounded-3xl transition-all duration-200 cursor-pointer active:scale-[0.99]"
              style={{
                background: 'rgba(168,85,247,0.04)',
                borderWidth: '2px',
                borderStyle: 'dashed',
                borderColor: 'rgba(168,85,247,0.22)',
              }}
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
              >
                📸
              </div>
              <div className="text-center px-4">
                <p className="text-white font-black text-xl mb-1.5 tracking-tight">Upload plan photos</p>
                <p className="text-white/40 text-sm leading-relaxed">
                  Handwritten notes, printed programs, app screenshots
                </p>
                <p className="text-white/25 text-xs mt-2">Up to 3 photos - tap or drag and drop</p>
              </div>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="imagegrid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-6 space-y-3"
          >
            <div
              className={`grid gap-3 ${images.length === 1
                ? 'grid-cols-1 max-w-[200px] mx-auto'
                : images.length === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
                }`}
            >
              <AnimatePresence>
                {images.map((src, i) => (
                  <ImageCard key={`${i}-${src.slice(-12)}`} src={src} index={i} onRemove={() => removeImage(i)} />
                ))}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs text-white/35">
                {images.length} / 3 {images.length === 1 ? 'photo' : 'photos'} added
              </span>
              {canAddMore && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3.5 rounded-xl transition-all hover:bg-white/5"
                  style={{ color: '#A855F7', border: '1px solid rgba(168,85,247,0.25)' }}
                >
                  <HiPlus className="w-3.5 h-3.5" /> Add photo
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {images.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            onClick={() => void handleExtract()}
            className="w-full py-5 rounded-2xl text-base font-black text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform mb-7"
            style={{ background: 'linear-gradient(135deg, #A855F7 0%, #7c3aed 100%)' }}
          >
            Extract My Plan <HiArrowNarrowRight className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs font-bold uppercase tracking-widest text-white/30">How it works</span>
        </div>
        {[
          { icon: '📸', s: '1', text: 'Upload 1-3 photos of your workout plan' },
          { icon: '✨', s: '2', text: 'AI reads and reformats it in app style' },
          { icon: '🔍', s: '3', text: 'Optionally analyze how well it fits your goals' },
          { icon: '🚀', s: '4', text: 'Optionally improve it using your full profile' },
        ].map(({ icon, s, text }) => (
          <div
            key={s}
            className="flex items-center gap-4 px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))',
                border: '1px solid rgba(168,85,247,0.3)',
              }}
            >
              {s}
            </span>
            <span className="text-lg flex-shrink-0">{icon}</span>
            <span className="text-white/50 text-sm">{text}</span>
          </div>
        ))}
      </motion.div>
    </main>
  )
}
