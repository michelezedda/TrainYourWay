import { useEffect, useRef, useState, useCallback } from 'react'
import { HiShare, HiPlus, HiCamera, HiInformationCircle, HiStar, HiChevronLeft } from 'react-icons/hi'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import type { IScannerControls } from '@zxing/browser'
import LoadingSpinner from '@/components/LoadingSpinner'
import { fetchProduct, addToScanHistory, getScanHistory, type OFFProduct, type ScanHistoryEntry } from '@/lib/openFoodFacts'
import { scoreProduct, novaColor, type ScoredProduct } from '@/lib/healthScore'
import { getNutritionProfile } from '@/lib/nutrition'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/userId'
import { generateProductStory, shareOrDownload } from '@/lib/storyCanvas'

type PageState = 'intro' | 'idle' | 'loading' | 'result' | 'not-found' | 'error'
type ResultTab = 'health' | 'nutrition' | 'details'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Grade constants ───────────────────────────────────────────────────────────

const GRADE_EXPLANATION: Record<string, string> = {
  A: 'Excellent nutritional quality. A great choice.',
  B: 'Good quality with minor concerns.',
  C: 'Average quality - fine in moderation.',
  D: 'Poor quality. Limit how often you eat this.',
  E: 'Very low quality. Consider an alternative.',
}

const GRADE_SHORT: Record<string, string> = {
  A: 'Excellent', B: 'Good', C: 'Moderate', D: 'Poor', E: 'Avoid',
}

const NS_COLORS: Record<string, string> = {
  A: '#1e8a3c', B: '#83b830', C: '#f5c92e', D: '#e87d1e', E: '#e53a29',
}
const GRADE_SEQUENCE = ['A', 'B', 'C', 'D', 'E']

// ── NOVA explanation ──────────────────────────────────────────────────────────

const NOVA_EXPLANATION: Record<number, string> = {
  1: 'Unprocessed or minimally processed - fruits, vegetables, meats. Best choice.',
  2: 'Processed culinary ingredients - oils, flour, sugar. Used in cooking, not eaten alone.',
  3: 'Processed foods - canned goods, cured meats, fresh bread. OK in moderation.',
  4: 'Ultra-processed - industrial formulas with many additives. Limit these.',
}

// ── Intro screen data ─────────────────────────────────────────────────────────

const FEATURE_CARDS = [
  { icon: '🏆', label: 'Nutritional Score A-E', desc: 'Science-backed grade for every product' },
  { icon: '📊', label: 'Macro Breakdown', desc: 'Calories, protein, carbs, fat per 100g' },
  { icon: '🚨', label: 'Allergen Check', desc: 'Flags your personal restrictions' },
  { icon: '🎯', label: 'Goal Match', desc: 'See if it fits your nutrition goals' },
]

const HOW_STEPS = [
  { icon: '📷', title: 'Point at barcode', desc: 'Any product from a supermarket' },
  { icon: '🔍', title: 'Instant lookup', desc: '3M+ products in our database' },
  { icon: '✅', title: 'Get your score', desc: 'Personalized to your goals' },
]

const EXAMPLE_VERDICTS = [
  { text: 'High protein', type: 'positive' },
  { text: 'Low in sugar', type: 'positive' },
  { text: 'Good fiber source', type: 'positive' },
  { text: 'High saturated fat', type: 'warning' },
  { text: 'Ultra-processed', type: 'negative' },
  { text: 'Contains allergen', type: 'warning' },
]

const VERDICT_CHIP_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  positive: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', color: '#86efac' },
  warning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', color: '#fde68a' },
  negative: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', color: '#fca5a5' },
}

// ── Intro screen ──────────────────────────────────────────────────────────────

function IntroScreen({
  history,
  profile,
  onStart,
  onSelectHistory,
}: {
  history: ScanHistoryEntry[]
  profile: ReturnType<typeof getNutritionProfile>
  onStart: () => void
  onSelectHistory: (barcode: string) => void
}) {
  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6">
        <h1 className="text-3xl font-black tracking-tight gradient-text">Food Scanner</h1>
        <p className="text-white/40 text-sm mt-1">Scan any barcode for an instant health breakdown.</p>
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
        {/* Background glyph */}
        <div className="absolute right-4 top-4 text-[80px] leading-none opacity-[0.08] pointer-events-none select-none">📦</div>

        <div className="relative z-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-purple-400/70 mb-3">
            Powered by Open Food Facts
          </span>
          <h2 className="text-white font-black text-xl leading-tight mb-2">
            Know exactly what's<br />
            <span className="gradient-text">inside your food</span>
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-5">
            Scan a barcode in seconds and get a personalized health report covering nutrition, additives, allergens, and whether it fits your goals.
          </p>

          {/* Personalized notice */}
          {profile && (
            <div className="flex items-center gap-2 mb-5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-green-300/80">
                Personalized for {profile.goals[0] ?? 'your goals'} {profile.dietType ? `· ${profile.dietType}` : ''}
              </span>
            </div>
          )}

          <button
            onClick={onStart}
            className="btn-primary w-full justify-center py-4 text-base"
          >
            <HiCamera className="w-5 h-5" />
            Start Scanning
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

      {/* NutriScore explained */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
        className="mb-5 rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-white/6">
          <p className="text-white font-bold text-sm">What is Nutritional Score?</p>
          <p className="text-white/40 text-xs mt-0.5">A to E grading system based on nutritional quality</p>
        </div>
        <div className="px-4 py-4 space-y-2">
          {GRADE_SEQUENCE.map((g, i) => (
            <motion.div
              key={g}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.06 }}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: NS_COLORS[g], boxShadow: `0 0 10px ${NS_COLORS[g]}55` }}>
                <span className="text-white font-black text-base">{g}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-semibold text-xs">{GRADE_SHORT[g]}</span>
                  <span className="text-white/35 text-[11px] leading-snug">{GRADE_EXPLANATION[g]}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Example insights preview */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.28 }}
        className="mb-5"
      >
        <p className="text-white/35 text-[11px] font-bold uppercase tracking-wider mb-3">Example insights you'll see</p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_VERDICTS.map((v, i) => {
            const s = VERDICT_CHIP_STYLES[v.type]
            return (
              <motion.span
                key={v.text}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="px-3 py-1.5 rounded-full text-xs font-medium border"
                style={{ background: s.bg, borderColor: s.border, color: s.color }}
              >
                {v.text}
              </motion.span>
            )
          })}
        </div>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.32 }}
        className="mb-5 rounded-2xl p-4"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-white/35 text-[11px] font-bold uppercase tracking-wider mb-4">How it works</p>
        <div className="flex gap-2">
          {HOW_STEPS.map((step, i) => (
            <div key={step.title} className="flex-1 flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.2)' }}>
                {step.icon}
              </div>
              <div>
                <p className="text-white font-semibold text-[11px] leading-snug">{step.title}</p>
                <p className="text-white/35 text-[10px] mt-0.5 leading-snug">{step.desc}</p>
              </div>
              {i < HOW_STEPS.length - 1 && (
                <div className="absolute" style={{ display: 'none' }} />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Profile notice */}
      {!profile && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="flex items-start gap-2.5 px-4 py-3.5 rounded-2xl mb-5"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
        >
          <HiInformationCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="text-purple-300/80 text-xs leading-relaxed">
            Complete your nutrition profile to unlock personalized scores based on your goals and allergies.
          </p>
        </motion.div>
      )}

      {/* Recent scans */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="mb-5"
        >
          <p className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-3 px-1">Recent scans</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
            {history.map(h => (
              <button
                key={h.barcode}
                onClick={() => onSelectHistory(h.barcode)}
                className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-left transition-all active:scale-[0.97] hover:border-white/18"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }}
              >
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0 text-white"
                  style={{ background: h.gradeColor }}>
                  {h.grade}
                </span>
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-medium truncate max-w-[120px]">{h.name || 'Unknown'}</p>
                  <p className="text-white/30 text-[10px] truncate max-w-[120px]">{h.brand || h.barcode}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
      >
        <button onClick={onStart} className="btn-primary w-full justify-center py-4 text-base mb-10">
          <HiCamera className="w-5 h-5" />
          {history.length > 0 ? 'Scan Another Product' : 'Scan Your First Product'}
        </button>
      </motion.div>

    </main>
  )
}

// ── Camera / Idle screen ──────────────────────────────────────────────────────

function CameraScreen({
  videoRef,
  history,
  profile,
  onBack,
  onSelectHistory,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  history: ScanHistoryEntry[]
  profile: ReturnType<typeof getNutritionProfile>
  onBack: () => void
  onSelectHistory: (barcode: string) => void
}) {
  return (
    <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">

      {/* Header with back */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <HiChevronLeft className="w-5 h-5 text-white/60" />
        </button>
        <div>
          <h1 className="text-xl font-black tracking-tight gradient-text">Scanning</h1>
          <p className="text-white/35 text-xs">Align barcode with the guide</p>
        </div>
      </div>

      {/* Camera viewfinder */}
      <div className="relative w-full rounded-3xl overflow-hidden mb-5"
        style={{ aspectRatio: '4/3', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}>
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />

        {/* Aim overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-60 h-32">
            {/* Animated scan line */}
            <motion.div
              className="absolute left-3 right-3 h-0.5 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #A855F7, #22D3EE, transparent)' }}
              animate={{ top: ['20%', '80%', '20%'] }}
              transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
            />
            {/* Corner brackets */}
            {[
              'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
              'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
              'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
              'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-7 h-7 ${cls}`}
                style={{ borderColor: 'rgba(168,85,247,0.9)' }} />
            ))}
          </div>
        </div>

        {/* Bottom gradient + hint */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-4"
          style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.72))' }}>
          <p className="text-center text-xs text-white/60 font-medium">Point camera at any product barcode</p>
        </div>
      </div>

      {/* Tips */}
      <div className="flex gap-3 mb-5">
        {[
          { icon: '💡', text: 'Good lighting helps' },
          { icon: '📐', text: 'Keep it flat, not angled' },
          { icon: '🔍', text: '15-30 cm away works best' },
        ].map(tip => (
          <div key={tip.text} className="flex-1 flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-base">{tip.icon}</span>
            <span className="text-white/40 text-[10px] leading-snug">{tip.text}</span>
          </div>
        ))}
      </div>

      {/* Profile notice */}
      {!profile && (
        <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-2xl mb-5"
          style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <HiInformationCircle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="text-purple-300/80 text-xs leading-relaxed">
            Complete your nutrition profile to unlock personalized scores based on your goals and allergies.
          </p>
        </div>
      )}

      {/* Recent scans */}
      {history.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-white/35 uppercase tracking-wider mb-3 px-1">Recent scans</p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
            {history.map(h => (
              <button key={h.barcode} onClick={() => onSelectHistory(h.barcode)}
                className="flex-shrink-0 flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-left transition-all active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                  style={{ background: h.gradeColor }}>{h.grade}</span>
                <div className="min-w-0">
                  <p className="text-white/70 text-xs font-medium truncate max-w-[110px]">{h.name || 'Unknown'}</p>
                  <p className="text-white/30 text-[10px] truncate max-w-[110px]">{h.brand || h.barcode}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

// ── Visual macro bars ─────────────────────────────────────────────────────────

type MacroDir = 'more-is-better' | 'less-is-better' | 'neutral'

function macroBarColor(pct: number, dir: MacroDir): string {
  if (dir === 'more-is-better') {
    if (pct >= 0.6) return '#22c55e'
    if (pct >= 0.25) return '#eab308'
    return 'rgba(255,255,255,0.25)'
  }
  if (dir === 'less-is-better') {
    if (pct >= 0.75) return '#ef4444'
    if (pct >= 0.4) return '#f97316'
    return '#22c55e'
  }
  return '#A855F7'
}

function VisualMacroBars({ product }: { product: OFFProduct }) {
  const n = product.nutriments ?? {}
  const items: { label: string; value: number | null; unit: 'kcal' | 'g' | 'mg'; max: number; dir: MacroDir; context: string }[] = [
    { label: 'Calories', value: n['energy-kcal_100g'] ?? null, unit: 'kcal', max: 500, dir: 'neutral', context: 'Energy content' },
    { label: 'Protein', value: n.proteins_100g ?? null, unit: 'g', max: 30, dir: 'more-is-better', context: 'Builds and repairs muscle' },
    { label: 'Carbs', value: n.carbohydrates_100g ?? null, unit: 'g', max: 60, dir: 'neutral', context: 'Main fuel for your body' },
    { label: 'Sugars', value: n.sugars_100g ?? null, unit: 'g', max: 25, dir: 'less-is-better', context: 'Limit for better health' },
    { label: 'Fat', value: n.fat_100g ?? null, unit: 'g', max: 20, dir: 'neutral', context: 'Essential for hormones and cells' },
    { label: 'Sat. Fat', value: n['saturated-fat_100g'] ?? null, unit: 'g', max: 10, dir: 'less-is-better', context: 'Keep low for heart health' },
    { label: 'Fiber', value: n.fiber_100g ?? null, unit: 'g', max: 8, dir: 'more-is-better', context: 'Supports digestion' },
    { label: 'Sodium', value: n.sodium_100g != null ? n.sodium_100g * 1000 : null, unit: 'mg', max: 600, dir: 'less-is-better', context: 'Watch your salt intake' },
  ]
  const visible = items.filter(i => i.value !== null)
  if (!visible.length) return <p className="text-white/35 text-sm text-center py-10">No nutrition data available.</p>

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/35">Per 100g</p>
      {visible.map(item => {
        const val = item.value as number
        const pct = Math.min(val / item.max, 1)
        const color = macroBarColor(pct, item.dir)
        const valStr = item.unit === 'kcal' ? `${Math.round(val)} kcal` : item.unit === 'mg' ? `${Math.round(val)} mg` : `${val.toFixed(1)} g`
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between mb-1.5 gap-2">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-sm font-semibold text-white flex-shrink-0">{item.label}</span>
                <span className="text-xs text-white/30 truncate">{item.context}</span>
              </div>
              <span className="text-sm font-bold flex-shrink-0" style={{ color }}>{valStr}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ background: color }} />
            </div>
          </div>
        )
      })}
      <div className="pt-1 flex flex-wrap gap-3 text-[10px] text-white/25">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />More is better</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />Less is better</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#A855F7' }} />Context-dependent</span>
      </div>
    </div>
  )
}

// ── Nutri-Score badge ─────────────────────────────────────────────────────────

function NutriScoreBadge({ grade, gradeLabel }: { grade: string; gradeLabel: string }) {
  return (
    <div className="rounded-2xl px-3 pt-2.5 pb-3"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)' }}>
      <p className="text-center font-black tracking-[0.2em] mb-2.5 text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Nutri-Score
      </p>
      <div className="flex items-end gap-1.5">
        {GRADE_SEQUENCE.map(g => {
          const isActive = g === grade
          const color = NS_COLORS[g] ?? '#888'
          return (
            <div key={g} className="flex items-center justify-center flex-1 transition-all duration-300"
              style={{ background: isActive ? color : color + '50', height: isActive ? 56 : 38, borderRadius: isActive ? 12 : 8 }}>
              <span className="font-black leading-none transition-all duration-300"
                style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.35)', fontSize: isActive ? 28 : 18 }}>
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

// ── NOVA display ──────────────────────────────────────────────────────────────

function NovaDots({ group }: { group: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30 text-xs">NOVA</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full transition-colors"
            style={{ background: i <= group ? novaColor(group) : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
      <span className="text-white/40 text-[10px]">{['', 'Unprocessed', 'Processed', 'Processed', 'Ultra-processed'][group] ?? ''}</span>
    </div>
  )
}

function NovaCard({ group }: { group: number }) {
  const color = novaColor(group)
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex gap-1 flex-shrink-0 mt-1">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ background: i <= group ? color : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold mb-0.5" style={{ color }}>NOVA group {group}</p>
        <p className="text-xs text-white/50 leading-relaxed">{NOVA_EXPLANATION[group] ?? ''}</p>
      </div>
    </div>
  )
}

// ── Verdict chips ─────────────────────────────────────────────────────────────

function VerdictChips({ verdicts }: { verdicts: ScoredProduct['verdicts'] }) {
  if (!verdicts.length) return null
  const styles = {
    positive: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', color: '#86efac' },
    negative: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: '#fca5a5' },
    warning: { bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)', color: '#fde68a' },
  }
  return (
    <div className="flex flex-wrap gap-2">
      {verdicts.map((v, i) => {
        const s = styles[v.type]
        return (
          <span key={i} className="px-3 py-1 rounded-full text-xs font-medium border"
            style={{ background: s.bg, borderColor: s.border, color: s.color }}>
            {v.text}
          </span>
        )
      })}
    </div>
  )
}

// ── Goal match (rule-based, zero API calls) ───────────────────────────────────

const GRADE_VERDICT: Record<string, { label: string; reason: string; style: { bg: string; border: string; text: string; dot: string } }> = {
  A: { label: 'Yes', reason: 'Excellent nutritional quality. Great fit for most goals.', style: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#86efac', dot: '#22c55e' } },
  B: { label: 'Yes', reason: 'Good quality. Fits well into a balanced diet.', style: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', text: '#86efac', dot: '#22c55e' } },
  C: { label: 'Sometimes', reason: 'Average quality. Fine occasionally, not as a staple.', style: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#fde68a', dot: '#eab308' } },
  D: { label: 'Avoid often', reason: 'Poor nutritional profile. Limit intake where possible.', style: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5', dot: '#ef4444' } },
  E: { label: 'Avoid often', reason: 'Very poor quality. Look for a grade A or B alternative.', style: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5', dot: '#ef4444' } },
}

function GoalMatch({ scored }: { scored: ScoredProduct }) {
  const verdict = GRADE_VERDICT[scored.grade] ?? GRADE_VERDICT['C']
  const s = verdict.style
  return (
    <div className="rounded-2xl p-4 border animate-fade-in" style={{ background: s.bg, borderColor: s.border }}>
      <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
        <div className="flex-1">
          <p className="font-black text-base leading-tight" style={{ color: s.text }}>{verdict.label}</p>
          <p className="text-white/70 text-sm mt-0.5">{verdict.reason}</p>
        </div>
      </div>
    </div>
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
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">Community rating</p>
        {avg !== null && (
          <span className="text-white/40 text-xs">{avg.toFixed(1)} avg · {ratings.length} {ratings.length === 1 ? 'rating' : 'ratings'}</span>
        )}
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} onClick={() => void handleRate(star)}
            className="flex-1 py-2 transition-transform active:scale-95" aria-label={`Rate ${star} stars`}>
            <HiStar className="w-7 h-7 mx-auto"
              style={{ color: myRating && star <= myRating.rating ? '#facc15' : 'rgba(255,255,255,0.2)' }} />
          </button>
        ))}
      </div>
      {!myRating && <p className="text-white/25 text-[10px] text-center mt-2">Rate this product for the community</p>}
    </div>
  )
}

// ── Share button ──────────────────────────────────────────────────────────────

function ShareButton({ product, scored, userId }: { product: OFFProduct; scored: ScoredProduct; userId: string }) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'shared'>('idle')

  const handleShare = async () => {
    if (status !== 'idle') return
    setStatus('generating')
    try {
      const file = await generateProductStory(product, scored)
      await shareOrDownload(file, `${product.product_name || 'Product'} - Grade ${scored.grade}`)
      setStatus('shared')
      await db.transact(db.tx.workoutCompletions[id()].update({ userId, date: todayStr(), createdAt: Date.now() }))
    } catch {
      setStatus('idle')
    }
  }

  return (
    <button onClick={() => void handleShare()} disabled={status === 'generating'}
      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
      style={{
        background: status === 'shared' ? 'rgba(34,197,94,0.1)' : 'rgba(168,85,247,0.1)',
        border: `1px solid ${status === 'shared' ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)'}`,
        color: status === 'shared' ? '#86efac' : '#d8b4fe',
        opacity: status === 'generating' ? 0.7 : 1,
      }}>
      {status === 'generating' ? (
        <><LoadingSpinner size="sm" /><span>Generating story...</span></>
      ) : status === 'shared' ? (
        <span>Shared!</span>
      ) : (
        <><HiShare className="w-4 h-4" /><span>Share Story</span></>
      )}
    </button>
  )
}

// ── Add to finds button ───────────────────────────────────────────────────────

function AddToFindsButton({ product, scored, barcode, userId }: { product: OFFProduct; scored: ScoredProduct; barcode: string; userId: string }) {
  const { data } = db.useQuery({ communityFinds: { $: { where: { barcode, sharedBy: userId } } } })
  const alreadyShared = ((data?.communityFinds ?? []) as unknown[]).length > 0

  const handleAdd = async () => {
    await db.transact(db.tx.communityFinds[id()].update({
      barcode, productName: product.product_name || '', brand: product.brands?.split(',')[0]?.trim() || '',
      grade: scored.grade, gradeColor: scored.gradeColor, imageUrl: product.image_url || '',
      sharedBy: userId, sharedAt: Date.now(),
    }))
  }

  if (alreadyShared) return <p className="text-center text-xs text-white/30 py-2">Added to Healthy Finds</p>

  return (
    <button onClick={() => void handleAdd()}
      className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
      style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}>
      <HiPlus className="w-4 h-4" />
      Add to Healthy Finds
    </button>
  )
}

// ── Result tabs ───────────────────────────────────────────────────────────────

const RESULT_TABS: { id: ResultTab; label: string }[] = [
  { id: 'health', label: 'Health' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'details', label: 'Details' },
]

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FoodScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const scanning = useRef(false)

  const [state, setState] = useState<PageState>('intro')
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState<OFFProduct | null>(null)
  const [scored, setScored] = useState<ScoredProduct | null>(null)
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => getScanHistory())
  const [errMsg, setErrMsg] = useState('')
  const [resultTab, setResultTab] = useState<ResultTab>('health')

  const profile = getNutritionProfile()
  const userId = getUserId()

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
      setErrMsg(msg.includes('Permission') || msg.includes('allowed')
        ? 'Camera permission denied. Please allow camera access and reload.'
        : 'Could not start camera. Make sure no other app is using it.')
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
      setResultTab('health')
      setState('result')

      const entry: ScanHistoryEntry = {
        barcode: code, name: data.product_name || '', brand: data.brands || '',
        grade: score.grade, gradeColor: score.gradeColor, scannedAt: Date.now(),
      }
      addToScanHistory(entry)
      setHistory(getScanHistory())
    } catch {
      setErrMsg('Failed to fetch product data. Check your connection.')
      setState('error')
    }
  }

  const reset = () => {
    setProduct(null); setScored(null)
    setBarcode(''); setErrMsg('')
    setResultTab('health')
    setState('idle')
  }

  const backToIntro = () => {
    setState('intro')
    stopCamera()
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 animate-fade-in">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full animate-spin-slow"
              style={{ background: 'conic-gradient(from 0deg, #A855F7 0%, #22D3EE 45%, transparent 65%, #A855F7 100%)', padding: '2.5px' }}>
              <div className="w-full h-full rounded-full" style={{ background: '#050510' }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🛒</div>
          </div>
          <p className="text-white font-semibold">Looking up product...</p>
          <p className="text-white/40 text-sm mt-1">Checking Open Food Facts database</p>
        </div>
      </main>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (state === 'error') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav text-center animate-fade-in">
        <div className="glass-card p-8">
          <div className="text-4xl mb-4">📷</div>
          <h2 className="text-white font-bold text-lg mb-2">Camera unavailable</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">{errMsg}</p>
          <button onClick={backToIntro}
            className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}>
            Go back
          </button>
        </div>
      </main>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (state === 'not-found') {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">
        <div className="glass-card p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-white font-bold text-lg mb-2">Product not found</h2>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">
            This barcode isn't in the Open Food Facts database yet.
          </p>
          <div className="space-y-3">
            <button onClick={reset}
              className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}>
              <span className="flex items-center justify-center gap-2"><HiCamera className="w-4 h-4" /> Try another product</span>
            </button>
            <button onClick={backToIntro}
              className="w-full py-3 rounded-2xl text-sm text-white/40 transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Back
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Result ─────────────────────────────────────────────────────────────────

  if (state === 'result' && product && scored) {
    return (
      <main className="w-full md:max-w-2xl md:mx-auto px-4 pt-6 pb-nav animate-fade-in">

        {/* Product header */}
        <div className="flex gap-4 mb-5">
          {product.image_url ? (
            <img src={product.image_url} alt={product.product_name}
              className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-3xl">🛒</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {product.brands && (
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-0.5 truncate">
                {product.brands.split(',')[0].trim()}
              </p>
            )}
            <h2 className="text-white font-bold text-xl leading-snug">
              {product.product_name || 'Unknown product'}
            </h2>
          </div>
        </div>

        {/* Grade hero */}
        <div className="rounded-3xl p-5 mb-4 relative overflow-hidden"
          style={{ background: scored.gradeBg, border: `1.5px solid ${scored.gradeColor}55` }}>
          <div className="absolute inset-0 flex items-center justify-end opacity-[0.07] pointer-events-none select-none">
            <span className="text-[160px] font-black leading-none pr-4" style={{ color: scored.gradeColor }}>{scored.grade}</span>
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: scored.gradeColor, opacity: 0.75 }}>Nutri-Score</p>
            <div className="flex items-end gap-3 mb-2">
              <span className="text-6xl font-black leading-none" style={{ color: scored.gradeColor }}>{scored.grade}</span>
              <div>
                <p className="text-white font-bold text-xl leading-tight">{scored.gradeLabel}</p>
                <p className="text-white/50 text-sm">{GRADE_EXPLANATION[scored.grade]}</p>
              </div>
            </div>
            {product.nova_group && (
              <div className="pt-2.5 mt-2.5" style={{ borderTop: `1px solid ${scored.gradeColor}33` }}>
                <NovaDots group={product.nova_group} />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {RESULT_TABS.map(tab => (
            <button key={tab.id} onClick={() => setResultTab(tab.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
              style={resultTab === tab.id ? { background: 'rgba(168,85,247,0.2)', color: '#c084fc' } : { color: 'rgba(255,255,255,0.38)' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={resultTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="space-y-4">

            {resultTab === 'health' && (
              <>
                <NutriScoreBadge grade={scored.grade} gradeLabel={scored.gradeLabel} />
                {product.nova_group && <NovaCard group={product.nova_group} />}
                {scored.verdicts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2.5 px-1">Key highlights</p>
                    <VerdictChips verdicts={scored.verdicts} />
                  </div>
                )}
                <GoalMatch scored={scored} />
              </>
            )}

            {resultTab === 'nutrition' && (
              <div className="glass-card p-4"><VisualMacroBars product={product} /></div>
            )}

            {resultTab === 'details' && (
              <>
                {scored.allergenWarnings.length > 0 && (
                  <div className="px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-red-400/70 mb-2">Allergen alert</p>
                    <div className="flex flex-wrap gap-2">
                      {scored.allergenWarnings.map((w, i) => (
                        <span key={i} className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {product.ingredients_text && (
                  <div className="glass-card p-4 pb-10">
                    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2.5">Ingredients</p>
                    <p className="text-white/55 text-xs leading-relaxed">{product.ingredients_text}</p>
                  </div>
                )}
                <div className="glass-card p-4">
                  <GymRatingWidget barcode={barcode} userId={userId} />
                </div>
                <ShareButton product={product} scored={scored} userId={userId} />
                {(scored.grade === 'A' || scored.grade === 'B') && (
                  <AddToFindsButton product={product} scored={scored} barcode={barcode} userId={userId} />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 pb-10">
          <button onClick={reset}
            className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg,#A855F7,#22D3EE)', color: '#fff' }}>
            <HiCamera className="w-4 h-4" />
            Scan another
          </button>
        </div>
      </main>
    )
  }

  // ── Intro ──────────────────────────────────────────────────────────────────

  if (state === 'intro') {
    return (
      <IntroScreen
        history={history}
        profile={profile}
        onStart={() => setState('idle')}
        onSelectHistory={(code) => void handleBarcode(code)}
      />
    )
  }

  // ── Idle / scanning ────────────────────────────────────────────────────────

  return (
    <CameraScreen
      videoRef={videoRef}
      history={history}
      profile={profile}
      onBack={backToIntro}
      onSelectHistory={(code) => void handleBarcode(code)}
    />
  )
}
