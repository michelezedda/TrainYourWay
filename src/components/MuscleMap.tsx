// Canonical muscle IDs used by the AI and mapped to SVG regions.
// Front view muscles: chest, front_delts, biceps, forearms, abs, obliques,
//   hip_flexors, quads, adductors, calves_front
// Back view muscles: rear_delts, traps, rhomboids, lats, triceps, forearms,
//   lower_back, glutes, hamstrings, calves

const BODY_F  = 'rgba(255,255,255,0.09)'
const BODY_S  = 'rgba(255,255,255,0.18)'
const BSW     = 0.75

const PRIMARY   = 'rgba(239,68,68,0.82)'
const SECONDARY = 'rgba(249,115,22,0.72)'
const INACTIVE  = 'transparent'

type MS = Set<string>

function c(id: string, p: MS, s: MS) {
  if (p.has(id)) return PRIMARY
  if (s.has(id)) return SECONDARY
  return INACTIVE
}

// ── Body silhouette (shared between front & back) ─────────────────────────────
function BodyBase() {
  return (
    <g fill={BODY_F} stroke={BODY_S} strokeWidth={BSW}>
      {/* Head */}
      <circle cx="60" cy="24" r="18" />
      {/* Neck */}
      <rect x="54" y="42" width="12" height="11" rx="4" />
      {/* Left shoulder */}
      <ellipse cx="26" cy="68" rx="14" ry="10" />
      {/* Right shoulder */}
      <ellipse cx="94" cy="68" rx="14" ry="10" />
      {/* Upper torso */}
      <rect x="35" y="54" width="50" height="50" rx="9" />
      {/* Waist */}
      <rect x="38" y="100" width="44" height="26" rx="7" />
      {/* Hips */}
      <rect x="34" y="122" width="52" height="30" rx="10" />
      {/* Left upper arm */}
      <rect x="10" y="60" width="22" height="70" rx="9" />
      {/* Right upper arm */}
      <rect x="88" y="60" width="22" height="70" rx="9" />
      {/* Left forearm */}
      <rect x="11" y="128" width="18" height="54" rx="7" />
      {/* Right forearm */}
      <rect x="91" y="128" width="18" height="54" rx="7" />
      {/* Left hand */}
      <ellipse cx="20" cy="188" rx="9" ry="6" />
      {/* Right hand */}
      <ellipse cx="100" cy="188" rx="9" ry="6" />
      {/* Left thigh */}
      <rect x="35" y="148" width="24" height="72" rx="10" />
      {/* Right thigh */}
      <rect x="61" y="148" width="24" height="72" rx="10" />
      {/* Left lower leg */}
      <rect x="37" y="217" width="20" height="64" rx="8" />
      {/* Right lower leg */}
      <rect x="63" y="217" width="20" height="64" rx="8" />
      {/* Left foot */}
      <ellipse cx="44" cy="285" rx="13" ry="7" />
      {/* Right foot */}
      <ellipse cx="76" cy="285" rx="13" ry="7" />
    </g>
  )
}

// ── Front-view muscle overlays ────────────────────────────────────────────────
function FrontMuscles({ p, s }: { p: MS; s: MS }) {
  return (
    <g strokeWidth={0} stroke="none">
      {/* Chest (pectorals) */}
      <ellipse cx="44" cy="82" rx="16" ry="13" fill={c('chest', p, s)} />
      <ellipse cx="76" cy="82" rx="16" ry="13" fill={c('chest', p, s)} />

      {/* Front deltoids */}
      <ellipse cx="24" cy="72" rx="11" ry="9" fill={c('front_delts', p, s)} />
      <ellipse cx="96" cy="72" rx="11" ry="9" fill={c('front_delts', p, s)} />

      {/* Biceps */}
      <ellipse cx="16" cy="106" rx="8" ry="19" fill={c('biceps', p, s)} />
      <ellipse cx="104" cy="106" rx="8" ry="19" fill={c('biceps', p, s)} />

      {/* Forearms */}
      <ellipse cx="14" cy="152" rx="7" ry="17" fill={c('forearms', p, s)} />
      <ellipse cx="106" cy="152" rx="7" ry="17" fill={c('forearms', p, s)} />

      {/* Abs – 6 blocks */}
      {(['abs'] as const).flatMap((id) =>
        [0, 1, 2].flatMap((row) =>
          [0, 1].map((col) => (
            <rect
              key={`abs-${row}-${col}`}
              x={50 + col * 11} y={106 + row * 14}
              width={9} height={11} rx={2}
              fill={c(id, p, s)}
            />
          ))
        )
      )}

      {/* Obliques */}
      <ellipse cx="36" cy="126" rx="9" ry="14"
        transform="rotate(-15 36 126)" fill={c('obliques', p, s)} />
      <ellipse cx="84" cy="126" rx="9" ry="14"
        transform="rotate(15 84 126)" fill={c('obliques', p, s)} />

      {/* Hip flexors */}
      <ellipse cx="47" cy="157" rx="9" ry="7" fill={c('hip_flexors', p, s)} />
      <ellipse cx="73" cy="157" rx="9" ry="7" fill={c('hip_flexors', p, s)} />

      {/* Quads */}
      <ellipse cx="44" cy="192" rx="13" ry="27" fill={c('quads', p, s)} />
      <ellipse cx="76" cy="192" rx="13" ry="27" fill={c('quads', p, s)} />

      {/* Adductors (inner thigh) */}
      <ellipse cx="53" cy="186" rx="7" ry="22" fill={c('adductors', p, s)} />
      <ellipse cx="67" cy="186" rx="7" ry="22" fill={c('adductors', p, s)} />

      {/* Tibialis anterior (calves_front) */}
      <ellipse cx="43" cy="245" rx="8" ry="16" fill={c('calves_front', p, s)} />
      <ellipse cx="77" cy="245" rx="8" ry="16" fill={c('calves_front', p, s)} />
    </g>
  )
}

// ── Back-view muscle overlays ─────────────────────────────────────────────────
function BackMuscles({ p, s }: { p: MS; s: MS }) {
  return (
    <g strokeWidth={0} stroke="none">
      {/* Trapezius */}
      <path
        d="M60,50 L88,68 L78,82 L60,86 L42,82 L32,68 Z"
        fill={c('traps', p, s)}
      />

      {/* Rear deltoids */}
      <ellipse cx="24" cy="72" rx="11" ry="9" fill={c('rear_delts', p, s)} />
      <ellipse cx="96" cy="72" rx="11" ry="9" fill={c('rear_delts', p, s)} />

      {/* Rhomboids */}
      <ellipse cx="60" cy="90" rx="15" ry="11" fill={c('rhomboids', p, s)} />

      {/* Lats (fan shape from shoulder to lower back) */}
      <path d="M28,86 L12,132 L36,142 L50,100 Z" fill={c('lats', p, s)} />
      <path d="M92,86 L108,132 L84,142 L70,100 Z" fill={c('lats', p, s)} />

      {/* Triceps */}
      <ellipse cx="14" cy="105" rx="9" ry="22" fill={c('triceps', p, s)} />
      <ellipse cx="106" cy="105" rx="9" ry="22" fill={c('triceps', p, s)} />

      {/* Forearms (back) */}
      <ellipse cx="13" cy="152" rx="7" ry="17" fill={c('forearms', p, s)} />
      <ellipse cx="107" cy="152" rx="7" ry="17" fill={c('forearms', p, s)} />

      {/* Erector spinae / lower back */}
      <ellipse cx="52" cy="136" rx="8" ry="18" fill={c('lower_back', p, s)} />
      <ellipse cx="68" cy="136" rx="8" ry="18" fill={c('lower_back', p, s)} />

      {/* Glutes */}
      <ellipse cx="46" cy="164" rx="14" ry="14" fill={c('glutes', p, s)} />
      <ellipse cx="74" cy="164" rx="14" ry="14" fill={c('glutes', p, s)} />

      {/* Hamstrings */}
      <ellipse cx="44" cy="196" rx="13" ry="27" fill={c('hamstrings', p, s)} />
      <ellipse cx="76" cy="196" rx="13" ry="27" fill={c('hamstrings', p, s)} />

      {/* Calves (gastrocnemius) */}
      <ellipse cx="44" cy="246" rx="10" ry="18" fill={c('calves', p, s)} />
      <ellipse cx="76" cy="246" rx="10" ry="18" fill={c('calves', p, s)} />
    </g>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface MuscleMapProps {
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

export default function MuscleMap({ primaryMuscles, secondaryMuscles }: MuscleMapProps) {
  const p = new Set(primaryMuscles)
  const s = new Set(secondaryMuscles)

  const svgProps = {
    viewBox: '0 0 120 294',
    xmlns: 'http://www.w3.org/2000/svg',
    style: { width: '100%', maxWidth: '96px', height: 'auto' } as React.CSSProperties,
  }

  const hasAny = primaryMuscles.length > 0 || secondaryMuscles.length > 0
  if (!hasAny) return null

  return (
    <div className="mb-5">
      <p className="text-white/30 text-[9px] uppercase tracking-widest mb-3 text-center">
        Muscles worked
      </p>

      <div className="flex items-start justify-center gap-2">
        {/* Front */}
        <div className="flex flex-col items-center gap-1">
          <svg {...svgProps}>
            <BodyBase />
            <FrontMuscles p={p} s={s} />
          </svg>
          <span className="text-white/25 text-[9px] uppercase tracking-widest">Front</span>
        </div>

        {/* Back */}
        <div className="flex flex-col items-center gap-1">
          <svg {...svgProps}>
            <BodyBase />
            <BackMuscles p={p} s={s} />
          </svg>
          <span className="text-white/25 text-[9px] uppercase tracking-widest">Back</span>
        </div>

        {/* Legend */}
        <div className="flex flex-col justify-center gap-2.5 ml-2 pt-6">
          {primaryMuscles.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PRIMARY }} />
                <span className="text-white/50 text-[10px] font-medium">Primary</span>
              </div>
              <p className="text-white/30 text-[9px] leading-snug max-w-[80px]">
                {primaryMuscles.map(m => m.replace(/_/g, ' ')).join(', ')}
              </p>
            </div>
          )}
          {secondaryMuscles.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: SECONDARY }} />
                <span className="text-white/50 text-[10px] font-medium">Secondary</span>
              </div>
              <p className="text-white/30 text-[9px] leading-snug max-w-[80px]">
                {secondaryMuscles.map(m => m.replace(/_/g, ' ')).join(', ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
