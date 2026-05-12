import { useState, useEffect } from 'react'
import { FaYoutube } from 'react-icons/fa'
import { getExerciseInstructions, type ExerciseInstructions } from '@/lib/gemini'
import MuscleMap from './MuscleMap'

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center animate-fade-in"
      style={{ background: 'rgba(5, 5, 16, 0.80)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg mx-auto rounded-t-3xl rounded-b-none max-h-[90dvh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-3 mb-1" />
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 sticky top-0 glass-card rounded-t-3xl rounded-b-none">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-0.5">How to use</p>
            <h3 className="text-lg font-bold text-white">{name}</h3>
          </div>
          <button onClick={onClose} className="btn-ghost !px-3 !py-2 !text-sm" aria-label="Close">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-8 h-8 rounded-full animate-spin" style={{
                background: 'conic-gradient(from 0deg, #A855F7, #22D3EE, transparent)',
                padding: '2px',
              }}>
                <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
              </div>
              <p className="text-white/40 text-sm">Loading instructions…</p>
            </div>
          )}

          {!loading && error && (
            <p className="text-white/40 text-sm text-center py-6">
              Couldn't load instructions. Try the YouTube link below.
            </p>
          )}

          {!loading && instructions && (
            <>
              <MuscleMap
                primaryMuscles={instructions.primaryMuscles ?? []}
                secondaryMuscles={instructions.secondaryMuscles ?? []}
              />

              <div className="flex gap-3 p-4 rounded-2xl" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <span className="text-xl flex-shrink-0">🎯</span>
                <div>
                  <p className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1">Setup</p>
                  <p className="text-white/75 text-sm leading-relaxed">{instructions.setup}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Step by step</p>
                <div className="space-y-3">
                  {instructions.steps.map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                        style={{ background: 'linear-gradient(135deg, #A855F7, #22D3EE)', color: '#fff' }}
                      >
                        {s.step}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{s.title}</p>
                        <p className="text-white/60 text-sm leading-relaxed">{s.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.15)' }}>
                  <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Tips</p>
                  <ul className="space-y-1.5">
                    {instructions.tips.map((t, i) => (
                      <li key={i} className="text-white/65 text-sm flex gap-2">
                        <span className="text-cyan-400 flex-shrink-0">•</span>{t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Common mistakes</p>
                  <ul className="space-y-1.5">
                    {instructions.avoid.map((a, i) => (
                      <li key={i} className="text-white/65 text-sm flex gap-2">
                        <span className="text-red-400 flex-shrink-0">•</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          <a
            href={`https://www.youtube.com/results?search_query=${query}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost w-full !justify-center !text-sm"
          >
            <FaYoutube className="w-4 h-4 text-red-500" />
            Watch on YouTube
          </a>
        </div>
      </div>
    </div>
  )
}
