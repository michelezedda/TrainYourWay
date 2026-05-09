import { useState, useRef, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { id } from '@instantdb/react'
import ReactMarkdown from 'react-markdown'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
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

type Step = 'upload' | 'extracting' | 'preview' | 'confirm-analyze' | 'analyzing' | 'analysis' | 'confirm-improve' | 'improving'

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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-white/40 hover:text-white transition-colors">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

function LoadingScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
      <div className="text-center">
        <div className="mb-8"><LoadingSpinner size="lg" /></div>
        <h2 className="text-2xl font-bold text-white mb-3">
          {title}<span className="animate-pulse">...</span>
        </h2>
        <p className="text-white/50">{subtitle}</p>
      </div>
    </main>
  )
}

// Analysis sections, shown one at a time (slides)
function AnalysisReader({
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
  const section = sections[idx]
  if (!section) return null
  const isLast = idx === sections.length - 1

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <span className="text-white/30 text-xs uppercase tracking-wider">Analysis</span>
        <div className="flex gap-1.5">
          {sections.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className="transition-all duration-200">
              <span className={`block rounded-full ${
                i === idx ? 'w-4 h-1.5 bg-purple-400' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'
              }`} />
            </button>
          ))}
        </div>
        <span className="text-white/30 text-xs">{idx + 1} / {sections.length}</span>
      </div>

      <GlassCard>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{SECTION_ICONS[section.title] ?? '📋'}</span>
          <h3 className="text-white font-bold text-base">{section.title}</h3>
        </div>
        <ReactMarkdown components={analysisComponents}>{section.content}</ReactMarkdown>
      </GlassCard>

      <div className="flex gap-3">
        {idx > 0 && (
          <button onClick={() => setIdx(i => i - 1)} className="btn-ghost !px-5 !py-2.5 !text-sm">
            Back
          </button>
        )}
        <div className="flex-1" />
        {!isLast ? (
          <button onClick={() => setIdx(i => i + 1)} className="btn-primary !px-6 !py-2.5 !text-sm">
            Next
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onKeep} className="btn-ghost !px-5 !py-2.5 !text-sm">
              Keep as-is
            </button>
            {hasProfile && (
              <button
                onClick={onImprove}
                className="btn-primary !px-5 !py-2.5 !text-sm flex items-center gap-2"
              >
                Improve it
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportPlan() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep]         = useState<Step>('upload')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [extractedPlan, setExtractedPlan] = useState('')
  const [analysisSections, setAnalysisSections] = useState<ReturnType<typeof parseAnalysisSections>>([])
  const [error, setError]       = useState<string | null>(null)

  const profileContext = buildProfileContext()
  const hasProfile     = !!profileContext

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)

  const previewComponents = useMemo(
    () => buildPlanComponents(setSelectedExercise),
    [],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImageDataUrl(result)
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImageDataUrl(result)
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleExtract = async () => {
    if (!imageDataUrl) return
    setStep('extracting')
    setError(null)
    try {
      const plan = await extractPlanFromImage(imageDataUrl)
      setExtractedPlan(plan)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract plan from image')
      setStep('upload')
    }
  }

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

  const handleKeepPlan = async (planText = extractedPlan) => {
    try {
      const planId = await savePlan(planText)
      navigate('/results', { state: { plan: planText, planId }, replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
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

  const handleImprove = async () => {
    setStep('improving')
    setError(null)
    try {
      const improved = await improveImportedPlan(extractedPlan, profileContext)
      const planId = await savePlan(improved)
      navigate('/results', { state: { plan: improved, planId }, replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve plan')
      setStep('analysis')
    }
  }

  // ── Loading screens ───────────────────────────────────────────────────────────

  if (step === 'extracting') {
    return <LoadingScreen title="Reading your plan" subtitle="Extracting and reformatting from your photo" />
  }
  if (step === 'analyzing') {
    return <LoadingScreen title="Analyzing your plan" subtitle="Evaluating structure, fit, and opportunities" />
  }
  if (step === 'improving') {
    return <LoadingScreen title="Improving your plan" subtitle="Tailoring it to your profile and goals" />
  }

  // ── Analysis step ─────────────────────────────────────────────────────────────

  if (step === 'analysis') {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <BackButton onClick={() => setStep('preview')} />
          <div>
            <h1 className="text-2xl font-bold gradient-text">Plan Analysis</h1>
            <p className="text-white/40 text-sm mt-0.5">Here's what we found about this plan</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {analysisSections.length > 0 ? (
          <AnalysisReader
            sections={analysisSections}
            onKeep={() => void handleKeepPlan()}
            onImprove={handleImprove}
            hasProfile={hasProfile}
          />
        ) : (
          <GlassCard>
            <p className="text-white/50 text-sm">No analysis sections found.</p>
          </GlassCard>
        )}

        {!hasProfile && (
          <p className="text-white/25 text-xs text-center mt-5">
            Complete the{' '}
            <Link to="/questionnaire" className="text-purple-400 hover:text-purple-300 underline">
              questionnaire
            </Link>{' '}
            to unlock personalized improvements.
          </p>
        )}
      </main>
    )
  }

  // ── Preview step ──────────────────────────────────────────────────────────────

  if (step === 'preview') {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 animate-fade-in">
        {selectedExercise && (
          <ExerciseModal name={selectedExercise} onClose={() => setSelectedExercise(null)} />
        )}
        <div className="flex items-center gap-3 mb-6">
          <BackButton onClick={() => setStep('upload')} />
          <div>
            <h1 className="text-2xl font-bold gradient-text">Your Imported Plan</h1>
            <p className="text-white/40 text-sm mt-0.5">We extracted and formatted it in Uplift style</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Plan preview using WorkoutDayView — exactly as it appears in Results */}
        <div className="mb-8">
          <WorkoutDayView plan={extractedPlan} planComponents={previewComponents} />
        </div>

        {/* Action bar */}
        <GlassCard>
          <p className="text-white font-semibold mb-1">What would you like to do?</p>
          <p className="text-white/40 text-sm mb-5">
            You can keep this plan as-is, or let Uplift analyze it to see how well it fits your goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => void handleKeepPlan()}
              className="btn-ghost !px-6 !py-3 flex-1 text-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save as-is
            </button>
            <button
              onClick={() => void handleAnalyze()}
              className="btn-primary !px-6 !py-3 flex-1 text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analyze this plan
            </button>
          </div>
        </GlassCard>
      </main>
    )
  }

  // ── Upload step (default) ─────────────────────────────────────────────────────

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <BackButton onClick={() => navigate(-1)} />
        <div>
          <h1 className="text-2xl font-bold gradient-text">Import a Plan</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Upload a photo and we'll reformat it in Uplift style
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
          {error}
        </div>
      )}

      <GlassCard className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {imagePreview ? (
          <div className="space-y-4">
            <img
              src={imagePreview}
              alt="Plan photo"
              className="w-full rounded-2xl object-cover max-h-80 border border-white/10"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setImageDataUrl(null); setImagePreview(null) }}
                className="btn-ghost !px-4 !py-2.5 !text-sm"
              >
                Remove
              </button>
              <button
                onClick={() => void handleExtract()}
                className="btn-primary !px-6 !py-2.5 !text-sm flex-1 flex items-center justify-center gap-2"
              >
                Extract plan
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="w-full flex flex-col items-center justify-center gap-4 py-16 rounded-2xl border-2 border-dashed
                       border-white/15 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              📸
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Upload a photo of your plan</p>
              <p className="text-white/40 text-sm">Handwritten, printed, app screenshot, or whiteboard</p>
              <p className="text-white/25 text-xs mt-1">Click or drag and drop</p>
            </div>
          </button>
        )}
      </GlassCard>

      {/* What happens next */}
      <div
        className="rounded-2xl border border-white/8 divide-y divide-white/6"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        {[
          { step: '1', icon: '📸', text: 'We read the photo and extract your full plan' },
          { step: '2', icon: '✨', text: 'It gets reformatted in Uplift style — day selector, exercise cards, all of it' },
          { step: '3', icon: '🔍', text: 'Optionally, we analyze how well the plan fits your goals' },
          { step: '4', icon: '🚀', text: 'Optionally, we improve it using everything we know about you' },
        ].map(({ step: s, icon, text }) => (
          <div key={s} className="flex items-center gap-4 px-5 py-3.5">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(34,211,238,0.2))', border: '1px solid rgba(168,85,247,0.3)' }}
            >
              {s}
            </span>
            <span className="text-lg flex-shrink-0">{icon}</span>
            <span className="text-white/55 text-sm">{text}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
