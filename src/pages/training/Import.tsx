import { useState, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiChevronLeft, HiArrowNarrowRight, HiPlus } from 'react-icons/hi'
import { useNavigate, Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import ReactMarkdown from 'react-markdown'
import ExerciseModal from '@/components/ExerciseModal'
import {
  parseAnalysisSections,
  analysisComponents,
  WorkoutDayView,
  SECTION_ICONS,
} from '@/components/PlanView'
import { buildPlanComponents } from '@/lib/planComponents'
import { extractPlanFromImage, analyzeImportedPlan, improveImportedPlan } from '@/lib/gemini'
import { getNutritionProfile } from '@/lib/nutrition'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'

type Step = 'upload' | 'extracting' | 'preview' | 'saving' | 'analyzing' | 'analysis' | 'improving' | 'success'

// ── Phase messages ─────────────────────────────────────────────────────────────

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

// ── Profile context ────────────────────────────────────────────────────────────

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

function ImageCard({
  src,
  index,
  onRemove,
}: {
  src: string
  index: number
  onRemove: () => void
}) {
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

function ConfirmReplaceModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
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

// ── SuccessScreen ──────────────────────────────────────────────────────────────

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

// ── AnalysisSlideReader ────────────────────────────────────────────────────────

function AnalysisSlideReader({
  sections,
  onKeep,
  onImprove,
  hasProfile,
}: {
  sections: ReturnType<typeof parseAnalysisSections>
  onKeep: () => void
  onImprove: () => void
  hasProfile: boolean
}) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState(1)

  const go = (next: number) => {
    setDir(next > idx ? 1 : -1)
    setIdx(next)
  }

  const section = sections[idx]
  if (!section) return null
  const isLast = idx === sections.length - 1

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/30">Analysis</span>
        <div className="flex gap-1.5">
          {sections.map((_, i) => (
            <button key={i} onClick={() => go(i)}>
              <span
                className="block rounded-full h-1.5 transition-all duration-300"
                style={{ width: i === idx ? 20 : 6, background: i === idx ? '#A855F7' : 'rgba(255,255,255,0.18)' }}
              />
            </button>
          ))}
        </div>
        <span className="text-xs text-white/30 tabular-nums">{idx + 1} / {sections.length}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: dir > 0 ? 24 : -24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir > 0 ? -18 : 18, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="rounded-3xl p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              {SECTION_ICONS[section.title] ?? '📋'}
            </div>
            <h3 className="text-white font-black text-lg tracking-tight leading-tight">{section.title}</h3>
          </div>
          <div className="text-white/60 text-sm leading-relaxed">
            <ReactMarkdown components={analysisComponents}>{section.content}</ReactMarkdown>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {idx > 0 && (
          <button
            onClick={() => go(idx - 1)}
            className="px-5 py-3 rounded-2xl text-sm font-bold text-white/55 transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Back
          </button>
        )}
        <div className="flex-1" />
        {!isLast ? (
          <button
            onClick={() => go(idx + 1)}
            className="px-7 py-3 rounded-2xl text-sm font-black text-white flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.28), rgba(34,211,238,0.14))',
              border: '1px solid rgba(168,85,247,0.25)',
            }}
          >
            Next <HiArrowNarrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onKeep}
              className="px-5 py-3 rounded-2xl text-sm font-bold text-white/55 hover:bg-white/5 transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Keep as-is
            </button>
            {hasProfile && (
              <button
                onClick={onImprove}
                className="px-6 py-3 rounded-2xl text-sm font-black text-white flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #A855F7 0%, #7c3aed 100%)' }}
              >
                Improve it <HiArrowNarrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {!hasProfile && (
        <p className="text-white/25 text-xs text-center">
          Complete the{' '}
          <Link to="/questionnaire" className="text-purple-400 underline">questionnaire</Link>{' '}
          to unlock personalized improvements.
        </p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ImportPlan() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep]               = useState<Step>('upload')
  const [images, setImages]           = useState<string[]>([])
  const [extractedPlan, setExtractedPlan] = useState('')
  const [analysisSections, setAnalysisSections] = useState<ReturnType<typeof parseAnalysisSections>>([])
  const [error, setError]             = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<'save' | 'improve' | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  const profileContext = buildProfileContext()
  const hasProfile     = !!profileContext

  const previewComponents = useMemo(() => buildPlanComponents(setSelectedExercise), [])

  // ── File handling ─────────────────────────────────────────────────────────────

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    arr.slice(0, 3 - images.length).forEach(file => {
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
        userId,
        userName: 'Imported Plan',
        fitnessLevel: '',
        goals: '[]',
        equipment: '[]',
        constraints: 'imported',
        plan: planText,
        createdAt: Date.now(),
        parentPlanId: '',
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

  const requestSave    = () => { setPendingAction('save');    setShowConfirm(true) }
  const requestImprove = () => { setPendingAction('improve'); setShowConfirm(true) }

  const handleConfirmed = () => {
    setShowConfirm(false)
    if (pendingAction === 'save') void doSave()
    else if (pendingAction === 'improve') void doImprove()
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
      await savePlan(improved)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve plan')
      setStep('analysis')
    }
  }

  // ── Loading steps ─────────────────────────────────────────────────────────────

  if (step === 'extracting') return <CinematicLoader phases={EXTRACT_PHASES} />
  if (step === 'analyzing')  return <CinematicLoader phases={ANALYZE_PHASES} />
  if (step === 'improving')  return <CinematicLoader phases={IMPROVE_PHASES} />
  if (step === 'saving')     return <CinematicLoader phases={SAVE_PHASES} />

  // ── Success ───────────────────────────────────────────────────────────────────

  if (step === 'success') {
    return <SuccessScreen onStart={() => navigate('/workout', { replace: true })} />
  }

  // ── Analysis ──────────────────────────────────────────────────────────────────

  if (step === 'analysis') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">
        <AnimatePresence>
          {showConfirm && (
            <ConfirmReplaceModal onConfirm={handleConfirmed} onCancel={() => setShowConfirm(false)} />
          )}
        </AnimatePresence>
        {selectedExercise && (
          <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
        )}

        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setStep('preview')} className="text-white/40 hover:text-white transition-colors">
            <HiChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#A855F7' }}>
              AI Analysis
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight">Your Plan Report</h1>
          </div>
        </div>

        {error && (
          <div
            className="mb-5 p-3.5 rounded-2xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
          >
            {error}
          </div>
        )}

        {analysisSections.length > 0 ? (
          <AnalysisSlideReader
            sections={analysisSections}
            onKeep={requestSave}
            onImprove={requestImprove}
            hasProfile={hasProfile}
          />
        ) : (
          <div
            className="rounded-2xl p-5 text-white/40 text-sm"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            No analysis sections found.
          </div>
        )}
      </main>
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
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#A855F7' }}>
              Preview
            </p>
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

  const canExtract = images.length > 0
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

      {/* Upload zone or image grid */}
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
              className={`grid gap-3 ${
                images.length === 1
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

      {/* Extract CTA */}
      <AnimatePresence>
        {canExtract && (
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

      {/* How it works */}
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
