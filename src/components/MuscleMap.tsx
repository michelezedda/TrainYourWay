// Canonical muscle IDs used by the AI and mapped to SVG regions.
// Front: chest, front_delts, biceps, forearms, abs, obliques,
//        hip_flexors, quads, adductors, calves_front
// Back:  rear_delts, traps, rhomboids, lats, triceps, forearms,
//        lower_back, glutes, hamstrings, calves

const MUSCLE_DISPLAY: Record<string, string> = {
  chest: 'Chest', front_delts: 'Front Delts', rear_delts: 'Rear Delts',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', hip_flexors: 'Hip Flexors',
  adductors: 'Inner Thigh', quads: 'Quads', calves_front: 'Tibialis',
  traps: 'Traps', rhomboids: 'Rhomboids', lats: 'Lats',
  lower_back: 'Lower Back', glutes: 'Glutes', hamstrings: 'Hamstrings',
  calves: 'Calves',
}

type MS = Set<string>

// ── Per-SVG gradient/filter helpers (prefixed to avoid DOM ID collisions) ─────

function F(muscleId: string, p: MS, s: MS, pfx: string): string {
  if (p.has(muscleId)) return `url(#pg-${pfx})`
  if (s.has(muscleId)) return `url(#sg-${pfx})`
  return 'transparent'
}

function G(muscleId: string, p: MS, s: MS, pfx: string): string | undefined {
  if (p.has(muscleId)) return `url(#gp-${pfx})`
  if (s.has(muscleId)) return `url(#gs-${pfx})`
  return undefined
}

// ── SVG defs (gradients + glow filters) ─────────────────────────────────────

function SvgDefs({ pfx }: { pfx: string }) {
  return (
    <defs>
      {/* Body base gradient */}
      <radialGradient id={`bg-${pfx}`} cx="50%" cy="30%" r="70%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
      </radialGradient>

      {/* Primary muscle gradient - rose to violet */}
      <radialGradient id={`pg-${pfx}`} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stopColor="#f43f5e" stopOpacity="1" />
        <stop offset="100%" stopColor="#9333ea" stopOpacity="0.55" />
      </radialGradient>

      {/* Secondary muscle gradient - amber to orange */}
      <radialGradient id={`sg-${pfx}`} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#f97316" stopOpacity="0.5" />
      </radialGradient>

      {/* Primary glow filter */}
      <filter id={`gp-${pfx}`} x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Secondary glow filter */}
      <filter id={`gs-${pfx}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

// ── Body silhouette ───────────────────────────────────────────────────────────
// Uses a bezier-curve torso path for organic proportions.
// viewBox: 0 0 120 298

function BodyBase({ pfx }: { pfx: string }) {
  const fill = `url(#bg-${pfx})`
  const stroke = 'rgba(255,255,255,0.14)'
  const sw = 0.6

  return (
    <g fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round">
      {/* Head */}
      <circle cx="60" cy="21" r="18.5" />
      {/* Neck */}
      <rect x="53" y="39" width="14" height="13" rx="5" />
      {/* Left shoulder cap */}
      <ellipse cx="17" cy="68" rx="16" ry="11" />
      {/* Right shoulder cap */}
      <ellipse cx="103" cy="68" rx="16" ry="11" />
      {/* Torso - organic bezier path: chest wide, waist narrow, hips flare */}
      <path d="
        M 36,54
        C 24,60 24,72 26,84
        L 26,102
        C 26,120 30,132 34,144
        L 34,158
        C 30,166 26,172 24,185
        L 24,196
        Q 42,202 60,202
        Q 78,202 96,196
        L 96,185
        C 94,172 90,166 86,158
        L 86,144
        C 90,132 94,120 94,102
        L 94,84
        C 96,72 96,60 84,54
        Z
      " />
      {/* Left upper arm */}
      <rect x="6" y="62" width="20" height="74" rx="9" />
      {/* Right upper arm */}
      <rect x="94" y="62" width="20" height="74" rx="9" />
      {/* Left forearm */}
      <rect x="8" y="133" width="17" height="58" rx="7" />
      {/* Right forearm */}
      <rect x="95" y="133" width="17" height="58" rx="7" />
      {/* Left hand */}
      <ellipse cx="17" cy="197" rx="9" ry="6" />
      {/* Right hand */}
      <ellipse cx="103" cy="197" rx="9" ry="6" />
      {/* Left thigh */}
      <rect x="28" y="198" width="28" height="76" rx="12" />
      {/* Right thigh */}
      <rect x="64" y="198" width="28" height="76" rx="12" />
      {/* Left lower leg */}
      <rect x="30" y="270" width="24" height="62" rx="9" />
      {/* Right lower leg */}
      <rect x="66" y="270" width="24" height="62" rx="9" />
      {/* Left foot */}
      <ellipse cx="39" cy="296" rx="15" ry="6" />
      {/* Right foot */}
      <ellipse cx="77" cy="296" rx="15" ry="6" />
    </g>
  )
}

// ── Front muscle overlays ─────────────────────────────────────────────────────

function FrontMuscles({ p, s, pfx }: { p: MS; s: MS; pfx: string }) {
  const f = (id: string) => F(id, p, s, pfx)
  const g = (id: string) => G(id, p, s, pfx)
  return (
    <g strokeWidth={0} stroke="none">
      {/* Chest - two pec ellipses */}
      <ellipse cx="43" cy="80" rx="18" ry="15" fill={f('chest')} filter={g('chest')} />
      <ellipse cx="77" cy="80" rx="18" ry="15" fill={f('chest')} filter={g('chest')} />

      {/* Front deltoids */}
      <ellipse cx="17" cy="68" rx="12" ry="10" fill={f('front_delts')} filter={g('front_delts')} />
      <ellipse cx="103" cy="68" rx="12" ry="10" fill={f('front_delts')} filter={g('front_delts')} />

      {/* Biceps */}
      <ellipse cx="11" cy="99" rx="8" ry="21" fill={f('biceps')} filter={g('biceps')} />
      <ellipse cx="109" cy="99" rx="8" ry="21" fill={f('biceps')} filter={g('biceps')} />

      {/* Forearms */}
      <ellipse cx="12" cy="154" rx="7" ry="17" fill={f('forearms')} filter={g('forearms')} />
      <ellipse cx="108" cy="154" rx="7" ry="17" fill={f('forearms')} filter={g('forearms')} />

      {/* Abs - 6 blocks (2 cols x 3 rows) centered around x=60 */}
      {([0, 1, 2] as const).flatMap(row =>
        ([0, 1] as const).map(col => (
          <rect key={`abs-${row}-${col}`}
            x={49 + col * 12} y={106 + row * 15}
            width={10} height={12} rx={2.5}
            fill={f('abs')} filter={g('abs')} />
        ))
      )}

      {/* Obliques */}
      <ellipse cx="33" cy="128" rx="9" ry="16"
        transform="rotate(-15,33,128)" fill={f('obliques')} filter={g('obliques')} />
      <ellipse cx="87" cy="128" rx="9" ry="16"
        transform="rotate(15,87,128)" fill={f('obliques')} filter={g('obliques')} />

      {/* Hip flexors */}
      <ellipse cx="46" cy="166" rx="11" ry="8" fill={f('hip_flexors')} filter={g('hip_flexors')} />
      <ellipse cx="74" cy="166" rx="11" ry="8" fill={f('hip_flexors')} filter={g('hip_flexors')} />

      {/* Quads */}
      <ellipse cx="42" cy="232" rx="14" ry="31" fill={f('quads')} filter={g('quads')} />
      <ellipse cx="78" cy="232" rx="14" ry="31" fill={f('quads')} filter={g('quads')} />

      {/* Adductors (inner thigh) */}
      <ellipse cx="53" cy="226" rx="8" ry="26" fill={f('adductors')} filter={g('adductors')} />
      <ellipse cx="67" cy="226" rx="8" ry="26" fill={f('adductors')} filter={g('adductors')} />

      {/* Tibialis anterior */}
      <ellipse cx="40" cy="276" rx="8" ry="17" fill={f('calves_front')} filter={g('calves_front')} />
      <ellipse cx="78" cy="276" rx="8" ry="17" fill={f('calves_front')} filter={g('calves_front')} />
    </g>
  )
}

// ── Back muscle overlays ──────────────────────────────────────────────────────

function BackMuscles({ p, s, pfx }: { p: MS; s: MS; pfx: string }) {
  const f = (id: string) => F(id, p, s, pfx)
  const g = (id: string) => G(id, p, s, pfx)
  return (
    <g strokeWidth={0} stroke="none">
      {/* Trapezius - diamond/hexagon shape */}
      <path d="M 60,52 L 94,70 L 80,90 L 60,94 L 40,90 L 26,70 Z"
        fill={f('traps')} filter={g('traps')} />

      {/* Rear deltoids */}
      <ellipse cx="17" cy="68" rx="12" ry="10" fill={f('rear_delts')} filter={g('rear_delts')} />
      <ellipse cx="103" cy="68" rx="12" ry="10" fill={f('rear_delts')} filter={g('rear_delts')} />

      {/* Rhomboids - between shoulder blades */}
      <ellipse cx="60" cy="93" rx="18" ry="12" fill={f('rhomboids')} filter={g('rhomboids')} />

      {/* Lats - fan shape */}
      <path d="M 26,82 L 8,136 L 33,148 L 48,106 Z" fill={f('lats')} filter={g('lats')} />
      <path d="M 94,82 L 112,136 L 87,148 L 72,106 Z" fill={f('lats')} filter={g('lats')} />

      {/* Triceps */}
      <ellipse cx="9" cy="98" rx="9" ry="23" fill={f('triceps')} filter={g('triceps')} />
      <ellipse cx="111" cy="98" rx="9" ry="23" fill={f('triceps')} filter={g('triceps')} />

      {/* Forearms */}
      <ellipse cx="12" cy="154" rx="7" ry="17" fill={f('forearms')} filter={g('forearms')} />
      <ellipse cx="108" cy="154" rx="7" ry="17" fill={f('forearms')} filter={g('forearms')} />

      {/* Erector spinae / lower back */}
      <ellipse cx="50" cy="142" rx="9" ry="20" fill={f('lower_back')} filter={g('lower_back')} />
      <ellipse cx="70" cy="142" rx="9" ry="20" fill={f('lower_back')} filter={g('lower_back')} />

      {/* Glutes */}
      <ellipse cx="43" cy="172" rx="17" ry="17" fill={f('glutes')} filter={g('glutes')} />
      <ellipse cx="77" cy="172" rx="17" ry="17" fill={f('glutes')} filter={g('glutes')} />

      {/* Hamstrings */}
      <ellipse cx="42" cy="232" rx="14" ry="31" fill={f('hamstrings')} filter={g('hamstrings')} />
      <ellipse cx="78" cy="232" rx="14" ry="31" fill={f('hamstrings')} filter={g('hamstrings')} />

      {/* Calves (gastrocnemius) */}
      <ellipse cx="41" cy="278" rx="11" ry="21" fill={f('calves')} filter={g('calves')} />
      <ellipse cx="79" cy="278" rx="11" ry="21" fill={f('calves')} filter={g('calves')} />
    </g>
  )
}

// ── Public component ──────────────────────────────────────────────────────────

interface MuscleMapProps {
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

const SVG_STYLE: React.CSSProperties = {
  width: '100%',
  maxWidth: 130,
  height: 'auto',
  display: 'block',
}

export default function MuscleMap({ primaryMuscles, secondaryMuscles }: MuscleMapProps) {
  if (!primaryMuscles.length && !secondaryMuscles.length) return null

  const p = new Set(primaryMuscles)
  const s = new Set(secondaryMuscles)

  const totalMuscles = primaryMuscles.length + secondaryMuscles.length

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Muscles Worked
        </p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'rgba(168,85,247,0.12)', color: 'rgba(168,85,247,0.8)', border: '1px solid rgba(168,85,247,0.2)' }}>
          {totalMuscles} muscle{totalMuscles !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Front + Back side by side */}
      <div className="flex items-end justify-center gap-6 mb-5">
        {/* Front view */}
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 120 298" xmlns="http://www.w3.org/2000/svg" style={SVG_STYLE}>
            <SvgDefs pfx="front" />
            <BodyBase pfx="front" />
            <FrontMuscles p={p} s={s} pfx="front" />
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'rgba(255,255,255,0.2)' }}>Front</span>
        </div>

        {/* Divider */}
        <div className="w-px self-stretch" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Back view */}
        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 120 298" xmlns="http://www.w3.org/2000/svg" style={SVG_STYLE}>
            <SvgDefs pfx="back" />
            <BodyBase pfx="back" />
            <BackMuscles p={p} s={s} pfx="back" />
          </svg>
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: 'rgba(255,255,255,0.2)' }}>Back</span>
        </div>
      </div>

      {/* Muscle chips legend */}
      <div className="space-y-3">
        {primaryMuscles.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(244,63,94,0.7)' }}>
              Primary
            </p>
            <div className="flex flex-wrap gap-1.5">
              {primaryMuscles.map(id => (
                <span key={id}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(244,63,94,0.12)',
                    border: '1px solid rgba(244,63,94,0.28)',
                    color: '#f87171',
                  }}>
                  {MUSCLE_DISPLAY[id] ?? id.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
        {secondaryMuscles.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(251,191,36,0.65)' }}>
              Secondary
            </p>
            <div className="flex flex-wrap gap-1.5">
              {secondaryMuscles.map(id => (
                <span key={id}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.25)',
                    color: '#fcd34d',
                  }}>
                  {MUSCLE_DISPLAY[id] ?? id.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
