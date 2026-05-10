import { useEffect, useRef, useState, useCallback } from 'react'
import { id } from '@instantdb/react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import type { IScannerControls } from '@zxing/browser'
import GlassCard from '@/components/GlassCard'
import LoadingSpinner from '@/components/LoadingSpinner'
import { fetchProduct, addToScanHistory, getScanHistory, type OFFProduct, type ScanHistoryEntry } from '@/lib/openFoodFacts'
import { scoreProduct, novaColor, type ScoredProduct } from '@/lib/healthScore'
import { getNutritionProfile } from '@/lib/nutrition'
import { sendChatMessage } from '@/lib/gemini'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { generateProductStory, shareOrDownload } from '@/lib/storyCanvas'

type PageState = 'idle' | 'loading' | 'result' | 'not-found' | 'error'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Nutri-Score badge (European style) ────────────────────────────────────────

const NS_COLORS: Record<string, string> = {
  A: '#1e8a3c',
  B: '#83b830',
  C: '#f5c92e',
  D: '#e87d1e',
  E: '#e53a29',
}
const GRADE_SEQUENCE = ['A', 'B', 'C', 'D', 'E']

function NutriScoreBadge({ grade, gradeLabel }: { grade: string; gradeLabel: string }) {
  return (
    <div
      className="rounded-2xl px-3 pt-2.5 pb-3 animate-fade-in"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}
    >
      <p
        className="text-center font-black tracking-[0.2em] mb-2.5 text-[10px] uppercase"
        style={{ color: 'rgba(255,255,255,0.35)' }}
      >
        Nutri-Score
      </p>
      <div className="flex items-end gap-1.5">
        {GRADE_SEQUENCE.map(g => {
          const isActive = g === grade
          const color = NS_COLORS[g] ?? '#888'
          return (
            <div
              key={g}
              className="flex items-center justify-center flex-1 transition-all duration-300"
              style={{
                background: isActive ? color : color + '50',
                height: isActive ? 56 : 38,
                borderRadius: isActive ? 12 : 8,
              }}
            >
              <span
                className="font-black leading-none transition-all duration-300"
                style={{
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                  fontSize: isActive ? 28 : 18,
                }}
              >
                {g}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <p className="text-white font-bold text-sm">{gradeLabel}</p>
        <p className="text-white/35 text-xs">health score</p>
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
    const prompt =
      `You are a strict nutrition coach. ` +
      `Product scanned: "${product.product_name || 'Unknown'}" by "${product.brands || 'Unknown'}". ` +
      `Grade: ${scored.grade}. Issues: ${issues || 'poor nutritional profile'}. ` +
      (profile ? `User goals: ${profile.goals.join(', ')}. Diet: ${profile.dietType}. ` : '') +
      `Name ONE better alternative with a short reason. ` +
      `Reply format: "Product name - reason." Under 15 words. No emojis, no filler, no marketing language.`

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

// ── Can I eat this? ───────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'Yes':         { bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  text: '#86efac', dot: '#22c55e' },
  'Sometimes':   { bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)',  text: '#fde68a', dot: '#eab308' },
  'Avoid often': { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#fca5a5', dot: '#ef4444' },
}

function CanIEatThis({ product, scored }: { product: OFFProduct; scored: ScoredProduct }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [verdict, setVerdict] = useState('')
  const [reason, setReason]   = useState('')

  const ask = async () => {
    if (status === 'loading') return
    setStatus('loading')
    try {
      const profile = getNutritionProfile()
      const negatives = scored.verdicts.filter(v => v.type !== 'positive').map(v => v.text)
      const prompt =
        `You are a strict, direct nutrition coach. Reply in this EXACT format, nothing else:\n` +
        `[Verdict]: [reason]\n` +
        `[Verdict] must be one of exactly: Yes / Sometimes / Avoid often\n` +
        `[reason] is under 8 words. No emojis, no filler, no punctuation at end.\n` +
        `Be supportive for healthy products, strict for ultra-processed or poor ones.\n\n` +
        `Product: ${product.product_name || 'Unknown'}\n` +
        `Grade: ${scored.grade} (${scored.gradeLabel})\n` +
        `Issues: ${negatives.join(', ') || 'none'}\n` +
        (profile ? `Goals: ${profile.goals.join(', ')}. Diet: ${profile.dietType}.` : '')

      const reply = await sendChatMessage([{ role: 'user', content: prompt }], '')
      const colonIdx = reply.indexOf(':')
      if (colonIdx === -1) throw new Error('bad format')
      const v = reply.slice(0, colonIdx).trim()
      const r = reply.slice(colonIdx + 1).trim()
      setVerdict(v)
      setReason(r)
      setStatus('done')
    } catch {
      setStatus('idle')
    }
  }

  if (status === 'done') {
    const s = VERDICT_STYLES[verdict] ?? VERDICT_STYLES['Sometimes']
    return (
      <div
        className="rounded-2xl p-4 border animate-fade-in"
        style={{ background: s.bg, borderColor: s.border }}
      >
        <div className="flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
          <div className="flex-1">
            <p className="font-black text-base leading-tight" style={{ color: s.text }}>{verdict}</p>
            <p className="text-white/70 text-sm mt-0.5">{reason}</p>
          </div>
          <button
            onClick={() => { setStatus('idle'); setVerdict(''); setReason('') }}
            className="text-white/25 text-[10px] hover:text-white/50 transition-colors mt-0.5 flex-shrink-0"
          >
            Ask again
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => void ask()}
      disabled={status === 'loading'}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-medium transition-all border"
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderColor: 'rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.6)',
        opacity: status === 'loading' ? 0.7 : 1,
      }}
    >
      {status === 'loading' ? (
        <>
          <LoadingSpinner size="sm" />
          <span>Asking coach...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Can I eat this?</span>
        </>
      )}
    </button>
  )
}

// ── Gym rating widget ─────────────────────────────────────────────────────────

function GymRatingWidget({ barcode, userId }: { barcode: string; userId: string }) {
  const { data } = db.useQuery({ gymRatings: { $: { where: { barcode } } } })
  const ratings = (data?.gymRatings ?? []) as Array<{ id: string; userId: string; rating: number }>
  const myRating = ratings.find(r => r.userId === userId)
  const avg = ratings.length > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : null

  const handleRate = async (stars: number) => {
    if (myRating) {
      await db.transact(db.tx.gymRatings[myRating.id].update({ rating: stars }))
    } else {
      await db.transact(db.tx.gymRatings[id()].update({ barcode, userId, rating: stars, createdAt: Date.now() }))
    }
  }

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider">Gym Score</p>
        {avg !== null && (
          <span className="text-white/40 text-xs">
            {avg.toFixed(1)} avg · {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => {
          const filled = myRating ? star <= myRating.rating : false
          return (
            <button
              key={star}
              onClick={() => void handleRate(star)}
              className="flex-1 py-1.5 transition-transform hover:scale-110 active:scale-95"
              aria-label={`Rate ${star} stars`}
            >
              <svg className="w-7 h-7 mx-auto" viewBox="0 0 24 24">
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={filled ? '#facc15' : 'none'}
                  stroke={filled ? '#facc15' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )
        })}
      </div>
      {!myRating && (
        <p className="text-white/25 text-[10px] text-center mt-2">Rate this product for the community</p>
      )}
    </GlassCard>
  )
}

// ── Share story button ────────────────────────────────────────────────────────

function ShareButton({ product, scored, userId }: { product: OFFProduct; scored: ScoredProduct; userId: string }) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'shared'>('idle')

  const handleShare = async () => {
    if (status !== 'idle') return
    setStatus('generating')
    try {
      const file = await generateProductStory(product, scored)
      await shareOrDownload(file, `${product.product_name || 'Product'} - Grade ${scored.grade}`)
      setStatus('shared')
      await db.transact(
        db.tx.workoutCompletions[id()].update({ userId, date: todayStr(), createdAt: Date.now() })
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStatus('idle')
      } else {
        setStatus('idle')
      }
    }
  }

  return (
    <button
      onClick={() => void handleShare()}
      disabled={status === 'generating'}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-medium transition-all border"
      style={{
        background: status === 'shared' ? 'rgba(34,197,94,0.1)' : 'rgba(168,85,247,0.1)',
        borderColor: status === 'shared' ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)',
        color: status === 'shared' ? '#86efac' : '#d8b4fe',
        opacity: status === 'generating' ? 0.7 : 1,
      }}
    >
      {status === 'generating' ? (
        <>
          <LoadingSpinner size="sm" />
          <span>Generating story...</span>
        </>
      ) : status === 'shared' ? (
        <span>Shared! Workout logged.</span>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span>Share Story</span>
        </>
      )}
    </button>
  )
}

// ── Add to finds button ───────────────────────────────────────────────────────

function AddToFindsButton({
  product, scored, barcode, userId,
}: { product: OFFProduct; scored: ScoredProduct; barcode: string; userId: string }) {
  const { data } = db.useQuery({ communityFinds: { $: { where: { barcode, sharedBy: userId } } } })
  const alreadyShared = ((data?.communityFinds ?? []) as unknown[]).length > 0

  const handleAdd = async () => {
    await db.transact(
      db.tx.communityFinds[id()].update({
        barcode,
        productName: product.product_name || '',
        brand: product.brands?.split(',')[0]?.trim() || '',
        grade: scored.grade,
        gradeColor: scored.gradeColor,
        imageUrl: product.image_url || '',
        sharedBy: userId,
        sharedAt: Date.now(),
      })
    )
  }

  if (alreadyShared) {
    return (
      <p className="text-center text-xs text-white/30 py-1">Added to Healthy Finds</p>
    )
  }

  return (
    <button
      onClick={() => void handleAdd()}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-medium transition-all border"
      style={{
        background: 'rgba(34,197,94,0.08)',
        borderColor: 'rgba(34,197,94,0.2)',
        color: '#86efac',
      }}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Add to Healthy Finds
    </button>
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
        {[
          'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg',
          'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg',
          'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg',
          'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: 'rgba(168,85,247,0.8)' }} />
        ))}
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
  const videoRef    = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const scanning    = useRef(false)

  const [state,   setState]   = useState<PageState>('idle')
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState<OFFProduct | null>(null)
  const [scored,  setScored]  = useState<ScoredProduct | null>(null)
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => getScanHistory())
  const [errMsg,  setErrMsg]  = useState('')

  const profile = getNutritionProfile()
  const userId  = getUserId()

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

  const handleBarcode = async (code: string) => {
    setBarcode(code)
    stopCamera()
    setState('loading')
    try {
      const data = await fetchProduct(code)
      if (!data) { setState('not-found'); return }

      const score = scoreProduct(data, profile)
      setProduct(data)
      setScored(score)
      setState('result')

      const entry: ScanHistoryEntry = {
        barcode: code,
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
    setBarcode('')
    setErrMsg('')
    setState('idle')
  }

  // ── Render states ──────────────────────────────────────────────────────────

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
            <NutriScoreBadge grade={scored.grade} gradeLabel={scored.gradeLabel} />
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

        {/* Can I eat this? */}
        <div className="mb-4">
          <CanIEatThis product={product} scored={scored} />
        </div>

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

        {/* Gym rating */}
        <div className="mb-3">
          <GymRatingWidget barcode={barcode} userId={userId} />
        </div>

        {/* Share story */}
        <div className="mb-3">
          <ShareButton product={product} scored={scored} userId={userId} />
        </div>

        {/* Add to healthy finds (A/B only) */}
        {(scored.grade === 'A' || scored.grade === 'B') && (
          <div className="mb-4">
            <AddToFindsButton product={product} scored={scored} barcode={barcode} userId={userId} />
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

  // ── Idle / scanning state ──────────────────────────────────────────────────

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
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
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
      <HistoryChips history={history} onSelect={(code) => void handleBarcode(code)} />
    </main>
  )
}
