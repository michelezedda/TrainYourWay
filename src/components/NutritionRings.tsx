import { getNutritionProfile, calculateTargets } from '@/lib/nutrition'

const SIZE   = 76
const STROKE = 7
const R      = (SIZE - STROKE) / 2
const CIRC   = 2 * Math.PI * R

interface RingProps {
  value: number
  unit: string
  label: string
  pct: number    // 0-1, how much of the ring to fill
  color: string
}

function Ring({ value, unit, label, pct, color }: RingProps) {
  const offset = CIRC * (1 - Math.min(1, pct))
  const fontSize = value >= 1000 ? '11px' : '13px'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE}
          />
          {/* Filled arc */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none gap-0.5">
          <span className="text-white font-bold tabular-nums" style={{ fontSize }}>
            {value}
          </span>
          <span className="text-white/35" style={{ fontSize: '9px' }}>{unit}</span>
        </div>
      </div>
      <span className="text-white/40 text-[10px] uppercase tracking-wider">{label}</span>
    </div>
  )
}

export default function NutritionRings() {
  const profile = getNutritionProfile()
  if (!profile) return null

  const t = calculateTargets(profile)

  // Each macro ring filled to the % of total kcal it contributes
  const proteinPct = (t.protein * 4) / t.kcal
  const carbsPct   = (t.carbs   * 4) / t.kcal
  const fatPct     = (t.fat     * 9) / t.kcal

  return (
    <div
      className="mb-6 px-5 py-4 rounded-2xl border border-white/8"
      style={{ background: 'rgba(255,255,255,0.025)' }}
    >
      <p className="text-white/30 text-[9px] uppercase tracking-widest mb-4">
        Daily Nutrition Targets
      </p>
      <div className="flex justify-around items-start">
        <Ring value={t.kcal}    unit="kcal" label="Calories" pct={1}          color="#A855F7" />
        <Ring value={t.protein} unit="g"    label="Protein"  pct={proteinPct} color="#22D3EE" />
        <Ring value={t.carbs}   unit="g"    label="Carbs"    pct={carbsPct}   color="#f59e0b" />
        <Ring value={t.fat}     unit="g"    label="Fat"      pct={fatPct}     color="#ec4899" />
      </div>
    </div>
  )
}
