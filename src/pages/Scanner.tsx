import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import type { IScannerControls } from '@zxing/browser'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { fetchProduct, addToScanHistory, getScanHistory, type OFFProduct, type ScanHistoryEntry } from '@/lib/openFoodFacts'
import { scoreProduct, novaColor, type ScoredProduct } from '@/lib/healthScore'
import { getNutritionProfile } from '@/lib/nutrition'
import { sendChatMessage } from '@/lib/gemini'

type PageState = 'idle' | 'loading' | 'result' | 'not-found' | 'error'

// ── Grade badge ────────────────────────────────────────────────────────────────

function GradeBadge({ grade, color, bg, label }: { grade: string; color: string; bg: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 animate-fade-in"
        style={{ background: bg, border: `2px solid ${color}` }}
      >
        <span className="text-3xl font-black" style={{ color }}>{grade}</span>
      </div>
      <div>
        <p className="text-white font-bold text-lg leading-tight">{label}</p>
        <p className="text-white/40 text-xs">health score</p>
      </div>
    </div>
  )
}

// ── NOVA dots ─────────────────────────────────────────────────────────────────

function NovaDots({ group }: { group: number }) {
  const labels = ['', 'Unprocessed', 'Processed', 'Processed', 'Ultra-processed']
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30 text-xs">NOVA</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-colors"
            style={{ background: i <= group ? novaColor(group) : 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
      <span className="text-white/40 text-[10px]">{labels[group] ?? ''}</span>
    </div>
  )
}

// ── Verdict chips ─────────────────────────────────────────────────────────────

function VerdictChips({ verdicts }: { verdicts: ScoredProduct['verdicts'] }) {
  if (!verdicts.length) return null
  const styles = {
    positive: { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  color: '#86efac' },
    negative: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  color: '#fca5a5' },
    warning:  { bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)',  color: '#fde68a' },
  }
  return (
    <div className="flex flex-wrap gap-2">
      {verdicts.map((v, i) => {
        const s = styles[v.type]
        return (
          <span
            key={i}
            className="px-3 py-1 rounded-full text-xs font-medium border"
            style={{ background: s.bg, borderColor: s.border, color: s.color }}
          >
            {v.text}
          </span>
        )
      })}
    </div>
  )
}

// ── Macro row ─────────────────────────────────────────────────────────────────

function MacroRow({ product }: { product: OFFProduct }) {
  const n = product.nutriments ?? {}
  const items = [
    { label: 'Calories', value: n['energy-kcal_100g'] != null ? `${Math.round(n['energy-kcal_100g'])} kcal` : '--' },
    { label: 'Protein',  value: n.proteins_100g != null ? `${n.proteins_100g.toFixed(1)}g` : '--' },
    { label: 'Carbs',    value: n.carbohydrates_100g != null ? `${n.carbohydrates_100g.toFixed(1)}g` : '--' },
    { label: 'Fat',      value: n.fat_100g != null ? `${n.fat_100g.toFixed(1)}g` : '--' },
    { label: 'Sugars',   value: n.sugars_100g != null ? `${n.sugars_100g.toFixed(1)}g` : '--' },
    { label: 'Fiber',    value: n.fiber_100g != null ? `${n.fiber_100g.toFixed(1)}g` : '--' },
  ]
  return (
    <div>
      <p className="text-white/30 text-[9px] uppercase tracking-widest mb-3">Per 100g</p>
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ label, value }) => (
          <div key={label} className="text-center p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="text-white font-semibold text-sm">{value}</p>
            <p className="text-white/35 text-[10px] mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Alternative suggestion ────────────────────────────────────────────────────

function AlternativeCard({ product, scored }: { product: OFFProduct; scored: ScoredProduct }) {
  const [alt, setAlt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const profile = getNutritionProfile()
    const issues = scored.verdicts.filter(v => v.type !== 'positive').map(v => v.text).join(', ')
    const prompt = `The user scanned: "${product.product_name || 'Unknown'}" by "${product.brands || 'Unknown'}". ` +
      `Health grade: ${scored.grade}. Issues: ${issues || 'poor nutritional profile'}. ` +
      (profile ? `User goals: ${profile.goals.join(', ')}. Diet: ${profile.dietType}. ` : '') +
      `Suggest ONE specific better alternative product with a 1-sentence reason. ` +
      `Format: Product name - reason. Under 20 words total.`

    sendChatMessage([{ role: 'user', content: prompt }], '')
      .then(reply => setAlt(reply))
      .catch(() => setAlt(null))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <LoadingSpinner size="sm" />
        <span className="text-white/40 text-xs">Finding a better alternative...</span>
      </div>
    )
  }

  if (!alt) return null

  return (
    <div
      className="flex items-start gap-3 p-3.5 rounded-2xl border animate-fade-in"
      style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)' }}
    >
      <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="text-green-300 text-xs font-semibold mb-0.5">Better alternative</p>
        <p className="text-white/70 text-sm leading-relaxed">{alt}</p>
      </div>
    </div>
  )
}

// ── History chips ─────────────────────────────────────────────────────────────

function HistoryChips({ history, onSelect }: { history: ScanHistoryEntry[]; onSelect: (barcode: string) => void }) {
  if (!history.length) return null
  return (
    <div>
      <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Recent scans</p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {history.map(h => (
          <button
            key={h.barcode}
            onClick={() => onSelect(h.barcode)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-colors hover:bg-white/8"
            style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: h.gradeColor, color: '#fff' }}
            >
              {h.grade}
            </span>
            <span className="text-white/60 text-xs truncate max-w-[100px]">{h.name || h.barcode}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Aim overlay ───────────────────────────────────────────────────────────────

function AimOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-56 h-28">
        {/* Corner brackets */}
        {[
          'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
          'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
          'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
          'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: 'rgba(168,85,247,0.8)' }} />
        ))}
        {/* Scan line */}
        <div
          className="absolute left-2 right-2 h-0.5 top-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #A855F7, transparent)' }}
        />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Scanner() {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const controlsRef   = useRef<IScannerControls | null>(null)
  const scanning      = useRef(false)

  const [state,   setState]   = useState<PageState>('idle')
  const [product, setProduct] = useState<OFFProduct | null>(null)
  const [scored,  setScored]  = useState<ScoredProduct | null>(null)
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => getScanHistory())
  const [errMsg,  setErrMsg]  = useState('')

  const profile = getNutritionProfile()

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    scanning.current = false
  }, [])

  const startCamera = useCallback(() => {
    if (scanning.current || !videoRef.current) return
    scanning.current = true
    const reader = new BrowserMultiFormatReader()

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoRef.current,
      (result, err) => {
        if (result && scanning.current) {
          scanning.current = false
          void handleBarcode(result.getText())
        }
        if (err && !(err instanceof NotFoundException)) {
          if (err.name === 'NotAllowedError') {
            setErrMsg('Camera permission denied. Please allow camera access and reload.')
            setState('error')
          }
        }
      },
    ).then(controls => {
      controlsRef.current = controls
    }).catch(err => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission') || msg.includes('allowed')) {
        setErrMsg('Camera permission denied. Please allow camera access and reload.')
      } else {
        setErrMsg('Could not start camera. Make sure no other app is using it.')
      }
      setState('error')
      scanning.current = false
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state === 'idle') startCamera()
    return () => { if (state !== 'idle') stopCamera() }
  }, [state, startCamera, stopCamera])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const handleBarcode = async (barcode: string) => {
    stopCamera()
    setState('loading')
    try {
      const data = await fetchProduct(barcode)
      if (!data) { setState('not-found'); return }

      const score = scoreProduct(data, profile)
      setProduct(data)
      setScored(score)
      setState('result')

      const entry: ScanHistoryEntry = {
        barcode,
        name:       data.product_name || '',
        brand:      data.brands || '',
        grade:      score.grade,
        gradeColor: score.gradeColor,
        scannedAt:  Date.now(),
      }
      addToScanHistory(entry)
      setHistory(getScanHistory())
    } catch {
      setErrMsg('Failed to fetch product data. Check your connection.')
      setState('error')
    }
  }

  const reset = () => {
    setProduct(null)
    setScored(null)
    setErrMsg('')
    setState('idle')
  }

  // ── Render states ─────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="text-center">
          <div className="mb-6"><LoadingSpinner size="lg" /></div>
          <p className="text-white font-semibold">Looking up product...</p>
          <p className="text-white/40 text-sm mt-1">Checking Open Food Facts database</p>
        </div>
      </main>
    )
  }

  if (state === 'error') {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center animate-fade-in">
        <GlassCard>
          <div className="text-4xl mb-4">📷</div>
          <h2 className="text-white font-bold text-lg mb-2">Camera unavailable</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">{errMsg}</p>
          <button onClick={reset} className="btn-primary !text-sm">Try again</button>
        </GlassCard>
      </main>
    )
  }

  if (state === 'not-found') {
    return (
      <main className="max-w-lg mx-auto px-4 py-12 text-center animate-fade-in">
        <GlassCard>
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-white font-bold text-lg mb-2">Product not found</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">
            This barcode isn't in the Open Food Facts database yet.
          </p>
          <button onClick={reset} className="btn-primary !text-sm">Scan another</button>
        </GlassCard>
      </main>
    )
  }

  if (state === 'result' && product && scored) {
    const n = product.nutriments ?? {}
    return (
      <main className="max-w-lg mx-auto px-4 py-8 animate-fade-in">
        {/* Product header */}
        <div className="flex gap-4 mb-5">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.product_name}
              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 border border-white/10"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <span className="text-3xl">🛒</span>
            </div>
          )}
          <div className="min-w-0">
            {product.brands && (
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-0.5 truncate">
                {product.brands.split(',')[0].trim()}
              </p>
            )}
            <h2 className="text-white font-bold text-lg leading-snug">
              {product.product_name || 'Unknown product'}
            </h2>
          </div>
        </div>

        {/* Grade + NOVA */}
        <GlassCard className="mb-4" padding={false}>
          <div className="p-4">
            <GradeBadge
              grade={scored.grade}
              color={scored.gradeColor}
              bg={scored.gradeBg}
              label={scored.gradeLabel}
            />
            {product.nova_group && (
              <div className="mt-3 pt-3 border-t border-white/8">
                <NovaDots group={product.nova_group} />
              </div>
            )}
          </div>
        </GlassCard>

        {/* Verdict chips */}
        {scored.verdicts.length > 0 && (
          <div className="mb-4">
            <VerdictChips verdicts={scored.verdicts} />
          </div>
        )}

        {/* Macros */}
        {n['energy-kcal_100g'] != null && (
          <GlassCard className="mb-4">
            <MacroRow product={product} />
          </GlassCard>
        )}

        {/* Better alternative */}
        {scored.needsAlternative && (
          <div className="mb-4">
            <AlternativeCard product={product} scored={scored} />
          </div>
        )}

        {/* Ingredients */}
        {product.ingredients_text && (
          <GlassCard className="mb-4">
            <p className="text-white/30 text-[9px] uppercase tracking-widest mb-2">Ingredients</p>
            <p className="text-white/50 text-xs leading-relaxed line-clamp-4">
              {product.ingredients_text}
            </p>
          </GlassCard>
        )}

        <button
          onClick={reset}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Scan another
        </button>
      </main>
    )
  }

  // ── Idle / scanning state ─────────────────────────────────────────────────

  return (
    <main className="max-w-lg mx-auto px-4 py-6 animate-fade-in">
      <div className="mb-5">
        <h1 className="text-2xl font-black gradient-text mb-1">Food Scanner</h1>
        <p className="text-white/40 text-sm">Point at a barcode to get a personalized health score</p>
      </div>

      {/* Camera viewfinder */}
      <div
        className="relative w-full rounded-3xl overflow-hidden mb-5"
        style={{
          aspectRatio: '4/3',
          background: '#000',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          autoPlay
          playsInline
          muted
        />
        <AimOverlay />
        <div
          className="absolute bottom-0 left-0 right-0 px-4 py-3 text-center text-xs text-white/50"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}
        >
          Align barcode with the guide
        </div>
      </div>

      {/* Profile notice */}
      {!profile && (
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-2xl mb-5 border"
          style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.2)' }}
        >
          <svg className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-purple-300/80 text-xs leading-relaxed">
            Complete your nutrition profile to get personalized scores based on your goals and allergies.
          </p>
        </div>
      )}

      {/* Recent scans */}
      <HistoryChips history={history} onSelect={(barcode) => void handleBarcode(barcode)} />
    </main>
  )
}
