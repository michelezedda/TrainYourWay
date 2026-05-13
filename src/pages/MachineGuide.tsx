import { useRef, useState } from 'react'
import { HiCamera } from 'react-icons/hi'
import { analyzeMachineImage, type MachineGuide } from '@/lib/gemini'

type State = 'idle' | 'loading' | 'result' | 'error'

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Identified', medium: 'Likely match', low: 'Uncertain',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#34d399', medium: '#f59e0b', low: 'rgba(255,255,255,0.35)',
}

function Section({ emoji, title, items }: { emoji: string; title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2.5 px-1">{emoji} {title}</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
            <span className="text-xs font-bold tabular-nums flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.14)', color: '#c084fc' }}>
              {i + 1}
            </span>
            <p className="text-sm text-white/75 leading-relaxed">{item}</p>
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
      <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2.5 px-1">{emoji} {title}</p>
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: 'rgba(255,255,255,0.25)' }} />
            <p className="text-sm text-white/75 leading-relaxed">{item}</p>
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
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
      <div className="mb-5">
        <h1 className="text-2xl font-black gradient-text">Machine Guide</h1>
        <p className="text-white/40 text-sm mt-0.5">Photo any gym machine for instant instructions.</p>
      </div>

      {/* Idle / error */}
      {(state === 'idle' || state === 'error') && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {/* Upload from library */}
          <button
            onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click() }}
            className="w-full rounded-3xl flex flex-col items-center justify-center gap-4 py-14 transition-all active:scale-[0.98]"
            style={{ background: 'rgba(168,85,247,0.06)', border: '2px dashed rgba(168,85,247,0.25)' }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}>
              ðŸ–¼ï¸
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/70">Upload a photo</p>
              <p className="text-xs text-white/35 mt-0.5">Choose from your library</p>
            </div>
          </button>

          {/* Camera */}
          <button
            onClick={() => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click() }}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.65)' }}
          >
            <HiCamera className="w-5 h-5" />
            Take a photo
          </button>

          {state === 'error' && <p className="text-sm text-red-400 text-center px-4">{error}</p>}
        </div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className="space-y-4">
          {preview && (
            <div className="rounded-3xl overflow-hidden">
              <img src={preview} alt="Machine" className="w-full h-56 object-cover" />
            </div>
          )}
          <div className="glass-card p-8 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
            <p className="text-sm text-white/50">Analysing equipment...</p>
          </div>
        </div>
      )}

      {/* Result */}
      {state === 'result' && guide && (
        <div className="space-y-4 animate-fade-in">
          {preview && (
            <div className="rounded-3xl overflow-hidden">
              <img src={preview} alt="Machine" className="w-full h-52 object-cover" />
            </div>
          )}

          {/* Machine identity */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-lg font-bold text-white leading-tight">{guide.machineName}</p>
              <span
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.06)', color: CONFIDENCE_COLOR[guide.confidence] ?? 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {CONFIDENCE_LABEL[guide.confidence] ?? guide.confidence}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {guide.targetMuscles.primary.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Primary</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guide.targetMuscles.primary.map(m => (
                      <span key={m} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                        style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {guide.targetMuscles.secondary.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Secondary</p>
                  <div className="flex flex-wrap gap-1.5">
                    {guide.targetMuscles.secondary.map(m => (
                      <span key={m} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {guide.setup.length > 0 && <Section emoji="âš™ï¸" title="Setup" items={guide.setup} />}
          <Section emoji="â–¶ï¸" title="How to perform" items={guide.steps} />
          <BulletSection emoji="âš ï¸" title="Common mistakes" items={guide.mistakes} />
          <BulletSection emoji="ðŸ’¡" title="Tips" items={guide.tips} />

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
