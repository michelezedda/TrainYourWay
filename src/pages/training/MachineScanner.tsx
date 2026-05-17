import { useRef, useState } from 'react'
import { HiCamera, HiPhotograph } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { analyzeMachineImage, type MachineAnalysis } from '@/lib/gemini'

type State = 'idle' | 'loading' | 'result' | 'error'
type ResultTab = 'guide' | 'muscles' | 'safety'

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Identified', medium: 'Likely match', low: 'Uncertain',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#34d399', medium: '#f59e0b', low: '#94a3b8',
}

const MUSCLE_EMOJI_MAP: [string, string][] = [
  ['pec', '💪'], ['chest', '💪'],
  ['lat', '🔹'], ['rhom', '🔹'], ['trap', '🔹'],
  ['delt', '🔸'], ['shoulder', '🔸'],
  ['bicep', '💪'], ['tricep', '💪'],
  ['quad', '🦵'], ['hamstring', '🦵'], ['glute', '🍑'], ['calf', '🦵'], ['leg', '🦵'],
  ['core', '🎯'], ['ab', '🎯'],
  ['back', '🔹'], ['forearm', '💪'],
]

function getMuscleEmoji(muscle: string): string {
  const lower = muscle.toLowerCase()
  for (const [key, emoji] of MUSCLE_EMOJI_MAP) {
    if (lower.includes(key)) return emoji
  }
  return '💪'
}

const TABS: { id: ResultTab; label: string }[] = [
  { id: 'guide', label: 'Guide' },
  { id: 'muscles', label: 'Muscles' },
  { id: 'safety', label: 'Safety' },
]

const FEATURE_CARDS = [
  { icon: '🤖', label: 'AI Recognition', desc: 'Identifies any gym machine from a photo' },
  { icon: '📋', label: 'Step-by-step Guide', desc: 'Setup and exercise instructions' },
  { icon: '💪', label: 'Muscle Map', desc: 'Primary and secondary muscles worked' },
  { icon: '⚠️', label: 'Safety Tips', desc: 'Common mistakes and pro advice' },
]

const HOW_STEPS = [
  { icon: '📷', title: 'Take a photo', desc: 'Any gym machine or equipment' },
  { icon: '🤖', title: 'AI analyses it', desc: 'Powered by Google Gemini' },
  { icon: '📋', title: 'Get your guide', desc: 'Setup, steps, muscles and safety' },
]

export default function MachineScanner() {
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [guide, setGuide] = useState<MachineAnalysis | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<ResultTab>('guide')
  const [checkedSetup, setCheckedSetup] = useState<Set<number>>(new Set())
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const toggleSetup = (i: number) =>
    setCheckedSetup(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  const toggleStep = (i: number) =>
    setCheckedSteps(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      void analyze(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const analyze = async (dataUrl: string) => {
    setState('loading')
    setGuide(null)
    setError('')
    try {
      const result = await analyzeMachineImage(dataUrl)
      setGuide(result)
      setState('result')
      setActiveTab('guide')
      setCheckedSetup(new Set())
      setCheckedSteps(new Set())
    } catch {
      setError('Could not analyse the image. Make sure the photo clearly shows the equipment.')
      setState('error')
    }
  }

  const reset = () => {
    setState('idle')
    setPreview(null)
    setGuide(null)
    setError('')
    setCheckedSetup(new Set())
    setCheckedSteps(new Set())
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full animate-spin-slow"
              style={{ background: 'conic-gradient(from 0deg, #A855F7 0%, #22D3EE 45%, transparent 65%, #A855F7 100%)', padding: '2.5px' }}
            >
              <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🏋️</div>
          </div>
          <p className="text-white font-semibold">Identifying equipment...</p>
          <p className="text-white/40 text-sm mt-1">Reading machine type and settings</p>
        </div>
      </main>
    )
  }

  // ── Result ───────────────────────────────────────────────────────────────────

  if (state === 'result' && guide) {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">

        {/* Preview with overlaid machine name */}
        {preview && (
          <div className="rounded-3xl overflow-hidden relative mb-4" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
            <img src={preview} alt="Machine" className="w-full h-48 object-cover" />
            <div
              className="absolute inset-x-0 bottom-0 px-4 py-4"
              style={{ background: 'linear-gradient(transparent, rgba(5,5,16,0.95))' }}
            >
              <div className="flex items-end justify-between gap-3">
                <p className="text-white font-black text-xl leading-tight">{guide.machineName}</p>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                  style={{
                    background: 'rgba(0,0,0,0.5)',
                    color: CONFIDENCE_COLOR[guide.confidence],
                    border: `1px solid ${CONFIDENCE_COLOR[guide.confidence]}44`,
                  }}
                >
                  {CONFIDENCE_LABEL[guide.confidence]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={activeTab === tab.id
                ? { background: 'rgba(168,85,247,0.2)', color: '#c084fc' }
                : { color: 'rgba(255,255,255,0.38)' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Guide tab */}
            {activeTab === 'guide' && (
              <div className="space-y-5">
                {guide.setup.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-3 px-1">Setup the machine</p>
                    <div className="space-y-2">
                      {guide.setup.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => toggleSetup(i)}
                          className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 active:scale-[0.98]"
                          style={{
                            background: checkedSetup.has(i) ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${checkedSetup.has(i) ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200"
                            style={{
                              background: checkedSetup.has(i) ? '#22c55e' : 'rgba(168,85,247,0.15)',
                              border: checkedSetup.has(i) ? 'none' : '1.5px solid rgba(168,85,247,0.4)',
                            }}
                          >
                            <span className="text-xs font-bold" style={{ color: checkedSetup.has(i) ? '#fff' : '#c084fc' }}>
                              {checkedSetup.has(i) ? '✓' : i + 1}
                            </span>
                          </div>
                          <p
                            className="text-sm leading-relaxed transition-colors duration-200"
                            style={{
                              color: checkedSetup.has(i) ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)',
                              textDecoration: checkedSetup.has(i) ? 'line-through' : 'none',
                            }}
                          >
                            {item}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-3 px-1">Exercise steps</p>
                  <div className="space-y-2">
                    {guide.steps.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => toggleStep(i)}
                        className="w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 active:scale-[0.98]"
                        style={{
                          background: checkedSteps.has(i) ? 'rgba(168,85,247,0.07)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${checkedSteps.has(i) ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200"
                          style={{ background: 'rgba(168,85,247,0.15)', border: '1.5px solid rgba(168,85,247,0.4)' }}
                        >
                          <span className="text-xs font-bold text-purple-400">
                            {checkedSteps.has(i) ? '✓' : i + 1}
                          </span>
                        </div>
                        <p
                          className="text-sm leading-relaxed transition-colors duration-200"
                          style={{ color: checkedSteps.has(i) ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)' }}
                        >
                          {item}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className="px-4 py-3 rounded-2xl text-xs text-white/35 leading-relaxed"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  Tap each step to check it off as you go. Start with setup, then move into the exercise.
                </div>
              </div>
            )}

            {/* Muscles tab */}
            {activeTab === 'muscles' && (
              <div className="space-y-5">
                {guide.targetMuscles.primary.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-3 px-1">Primary muscles</p>
                    <div className="flex flex-wrap gap-2">
                      {guide.targetMuscles.primary.map(m => (
                        <div
                          key={m}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                          style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}
                        >
                          <span className="text-lg">{getMuscleEmoji(m)}</span>
                          <span className="text-sm font-semibold text-purple-300">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guide.targetMuscles.secondary.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-3 px-1">Secondary muscles</p>
                    <div className="flex flex-wrap gap-2">
                      {guide.targetMuscles.secondary.map(m => (
                        <div
                          key={m}
                          className="flex items-center gap-2 px-3.5 py-2 rounded-2xl"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <span className="text-sm">{getMuscleEmoji(m)}</span>
                          <span className="text-sm text-white/55">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  className="px-4 py-4 rounded-2xl"
                  style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400/60 mb-1.5">What to feel</p>
                  <p className="text-white/55 text-sm leading-relaxed">
                    Focus on the primary muscles throughout each rep. Secondary muscles assist and stabilise - you'll feel them less but they protect your joints and help you lift safely.
                  </p>
                </div>
              </div>
            )}

            {/* Safety tab */}
            {activeTab === 'safety' && (
              <div className="space-y-4">
                {guide.mistakes.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-3 px-1">Avoid these mistakes</p>
                    <div className="space-y-2">
                      {guide.mistakes.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                        >
                          <span className="text-red-400 text-sm flex-shrink-0 mt-0.5 font-bold">✕</span>
                          <p className="text-sm text-white/70 leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {guide.tips.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-3 px-1">Pro tips</p>
                    <div className="space-y-2">
                      {guide.tips.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}
                        >
                          <span className="text-green-400 text-sm flex-shrink-0 mt-0.5 font-bold">✓</span>
                          <p className="text-sm text-white/70 leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 pb-10">
          <button
            onClick={reset}
            className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}
          >
            <HiCamera className="w-4 h-4" />
            Scan another machine
          </button>
        </div>
      </main>
    )
  }

  // ── Idle / Error (intro screen) ───────────────────────────────────────────────

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-black tracking-tight gradient-text">Machine Scanner</h1>
        <p className="text-white/40 text-sm mt-1">Take a photo of any gym machine for step-by-step instructions.</p>
      </motion.div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
        className="relative rounded-3xl overflow-hidden mb-5 p-6"
        style={{
          background: 'linear-gradient(140deg, rgba(168,85,247,0.2) 0%, rgba(34,211,238,0.1) 100%)',
          border: '1px solid rgba(168,85,247,0.28)',
          boxShadow: '0 0 60px rgba(168,85,247,0.1)',
        }}
      >
        <div className="absolute right-4 top-4 text-[80px] leading-none opacity-[0.08] pointer-events-none select-none">🏋️</div>
        <div className="relative z-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-purple-400/70 mb-3">
            Powered by Gemini AI
          </span>
          <h2 className="text-white font-black text-xl leading-tight mb-2">
            Identify any gym<br />
            <span className="gradient-text">machine instantly</span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-5">
            Take or upload a photo of any gym equipment and get a complete guide covering setup, exercise steps, targeted muscles, and safety tips.
          </p>
          <button
            onClick={() => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click() }}
            className="btn-primary w-full justify-center py-4 text-base"
          >
            <HiCamera className="w-5 h-5" />
            Take a Photo
          </button>
        </div>
      </motion.div>

      {/* Feature cards 2x2 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
        className="grid grid-cols-2 gap-3 mb-5"
      >
        {FEATURE_CARDS.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.06 }}
            className="px-4 py-3.5 rounded-2xl flex flex-col gap-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-2xl">{f.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm leading-snug">{f.label}</p>
              <p className="text-white/40 text-xs mt-0.5 leading-snug">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-5 rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-white/35 text-[11px] font-bold uppercase tracking-wider mb-4">How it works</p>
        <div className="flex gap-2">
          {HOW_STEPS.map(step => (
            <div key={step.title} className="flex-1 flex flex-col items-center text-center gap-2">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}
              >
                {step.icon}
              </div>
              <div>
                <p className="text-white font-semibold text-[11px] leading-snug">{step.title}</p>
                <p className="text-white/35 text-[10px] mt-0.5 leading-snug">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Error banner */}
      {state === 'error' && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="px-4 py-3.5 rounded-2xl mb-5"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <p className="text-red-400/80 text-sm leading-relaxed text-center">{error}</p>
        </motion.div>
      )}

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.28 }}
        className="mb-5"
      >
        <p className="text-[11px] font-bold text-white/25 uppercase tracking-wider mb-3 px-1">For best results</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '💡', tip: 'Good lighting' },
            { icon: '📐', tip: 'Full machine visible' },
            { icon: '🔍', tip: 'Clear and in focus' },
          ].map(({ icon, tip }) => (
            <div
              key={tip}
              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-xl">{icon}</span>
              <p className="text-white/40 text-xs">{tip}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Upload CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
      >
        <button
          onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click() }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all active:scale-[0.98] mb-10"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
        >
          <HiPhotograph className="w-4 h-4" />
          Upload from library
        </button>
      </motion.div>
    </main>
  )
}
