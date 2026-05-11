import { useRef, useState } from 'react'
import { analyzeMachineImage, type MachineGuide } from '@/lib/gemini'

type State = 'idle' | 'loading' | 'result' | 'error'

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   'Identified',
  medium: 'Likely match',
  low:    'Uncertain',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high:   '#34d399',
  medium: '#f59e0b',
  low:    'rgba(255,255,255,0.35)',
}

function Section({ emoji, title, items }: { emoji: string; title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-2 px-1">{emoji} {title}</p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}
          >
            <span
              className="text-xs font-bold tabular-nums flex-shrink-0 mt-0.5 w-4 text-center"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              {i + 1}
            </span>
            <p className="text-sm text-white/75 leading-snug">{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BulletSection({ emoji, title, items }: { emoji: string; title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/25 mb-2 px-1">{emoji} {title}</p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3"
            style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}
          >
            <span className="text-white/20 flex-shrink-0 mt-1.5 text-[6px]">●</span>
            <p className="text-sm text-white/75 leading-snug">{item}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MachineGuide() {
  const [state, setState] = useState<State>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [guide, setGuide] = useState<MachineGuide | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black gradient-text">Machine Guide</h1>
        <p className="text-white/40 text-sm mt-0.5">Photo any gym machine and get instant instructions.</p>
      </div>

      {/* Upload / camera area */}
      {state === 'idle' || state === 'error' ? (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.removeAttribute('capture')
                fileRef.current.click()
              }
            }}
            className="w-full rounded-3xl flex flex-col items-center justify-center gap-4 py-14 transition-all active:scale-[0.98]"
            style={{ background: 'rgba(168,85,247,0.06)', border: '2px dashed rgba(168,85,247,0.25)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}
            >
              🖼️
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/70">Upload a photo</p>
              <p className="text-xs text-white/35 mt-0.5">Tap to choose from your library</p>
            </div>
          </button>

          <button
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.setAttribute('capture', 'environment')
                fileRef.current.click()
              }
            }}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Take a photo
          </button>

          {state === 'error' && (
            <p className="text-sm text-red-400 text-center px-4">{error}</p>
          )}
        </div>
      ) : null}

      {/* Loading */}
      {state === 'loading' && (
        <div className="space-y-4">
          {preview && (
            <div className="rounded-2xl overflow-hidden" style={{ maxHeight: 240 }}>
              <img src={preview} alt="Machine" className="w-full h-60 object-cover" />
            </div>
          )}
          <div
            className="rounded-2xl px-6 py-10 flex flex-col items-center gap-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
            <p className="text-sm text-white/50">Analysing equipment...</p>
          </div>
        </div>
      )}

      {/* Result */}
      {state === 'result' && guide && (
        <div className="space-y-4 animate-fade-in">
          {/* Image preview */}
          {preview && (
            <div className="rounded-2xl overflow-hidden" style={{ maxHeight: 240 }}>
              <img src={preview} alt="Machine" className="w-full h-60 object-cover" />
            </div>
          )}

          {/* Machine identity card */}
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-white leading-tight">{guide.machineName}</p>
                <div className="flex flex-wrap gap-3 mt-2">
                  {guide.targetMuscles.primary.length > 0 && (
                    <div>
                      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Primary</p>
                      <div className="flex flex-wrap gap-1">
                        {guide.targetMuscles.primary.map(m => (
                          <span
                            key={m}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {guide.targetMuscles.secondary.length > 0 && (
                    <div>
                      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">Secondary</p>
                      <div className="flex flex-wrap gap-1">
                        {guide.targetMuscles.secondary.map(m => (
                          <span
                            key={m}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <span
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.06)', color: CONFIDENCE_COLOR[guide.confidence] ?? 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {CONFIDENCE_LABEL[guide.confidence] ?? guide.confidence}
              </span>
            </div>
          </div>

          {guide.setup.length > 0 && (
            <Section emoji="⚙️" title="Setup" items={guide.setup} />
          )}
          <Section emoji="▶️" title="How to perform" items={guide.steps} />
          <BulletSection emoji="⚠️" title="Common mistakes" items={guide.mistakes} />
          <BulletSection emoji="💡" title="Tips" items={guide.tips} />

          {/* Try another */}
          <button
            onClick={reset}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.6)' }}
          >
            Analyse another machine
          </button>
        </div>
      )}
    </main>
  )
}
