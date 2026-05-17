import { useRef, useState } from 'react'
import { HiCamera } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { analyzeMachineImage, type MachineGuide } from '@/lib/gemini'

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

export default function MachineGuide() {
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [guide, setGuide] = useState<MachineGuide | null>(null)
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

  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight gradient-text">Machine Scanner</h1>
        <p className="text-white/40 text-sm mt-1">Take a photo of any gym machine for step-by-step instructions.</p>
      </div>

      {/* Idle / error */}
      {(state === 'idle' || state === 'error') && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          <button
            onClick={() => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click() }}
            className="w-full rounded-3xl flex flex-col items-center justify-center gap-4 py-12 transition-all active:scale-[0.98]"
            style={{ background: 'rgba(168,85,247,0.07)', border: '2px dashed rgba(168,85,247,0.3)' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)' }}>
              <HiCamera className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-white/80">Take a photo</p>
              <p className="text-sm text-white/35 mt-0.5">Point at any gym machine</p>
            </div>
          </button>

          <button
            onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click() }}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
          >
            🖼️ Upload from library
          </button>

          {state === 'error' && (
            <div className="px-4 py-3 rounded-2xl text-sm text-red-400 text-center"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div className="pt-2">
            <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-3 px-1">For best results</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { emoji: '💡', tip: 'Good lighting' },
                { emoji: '📐', tip: 'Full machine visible' },
                { emoji: '🔍', tip: 'Clear and in focus' },
              ].map(({ emoji, tip }) => (
                <div key={tip} className="flex flex-col items-center gap-1.5 py-3 rounded-2xl text-center"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-xl">{emoji}</span>
                  <p className="text-white/40 text-xs">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className="space-y-4">
          {preview && (
            <div className="rounded-3xl overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={preview} alt="Machine" className="w-full h-56 object-cover" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: 'rgba(0,0,0,0.6)' }}>
                <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
                <p className="text-white font-semibold">Identifying equipment...</p>
                <p className="text-white/40 text-xs">Reading machine type and settings</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {state === 'result' && guide && (
        <div className="space-y-4 animate-fade-in">

          {/* Preview with overlaid machine name */}
          {preview && (
            <div className="rounded-3xl overflow-hidden relative" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <img src={preview} alt="Machine" className="w-full h-48 object-cover" />
              <div className="absolute inset-x-0 bottom-0 px-4 py-4"
                style={{ background: 'linear-gradient(transparent, rgba(5,5,16,0.95))' }}>
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
          <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
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

                  <div className="px-4 py-3 rounded-2xl text-xs text-white/35 leading-relaxed"
                    style={{ background: 'rgba(255,255,255,0.03)' }}>
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

                  <div className="px-4 py-4 rounded-2xl"
                    style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)' }}>
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

          <button
            onClick={reset}
            className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
          >
            Analyse another machine
          </button>
        </div>
      )}
    </main>
  )
}
