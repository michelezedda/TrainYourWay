// Static coaching library - zero LLM calls, zero tokens.
// All tips are pre-written and selected via deterministic rules.

// ── Exercise form tips ────────────────────────────────────────────────────────

type ExerciseCategory = 'push' | 'pull' | 'legs' | 'core' | 'hinge' | 'carry' | 'cardio' | 'general'

const PUSH_TIPS = [
  'Brace your core before every rep - it protects your spine and improves force transfer.',
  'Control the descent. Lowering in 2-3 seconds builds more muscle than dropping fast.',
  'Keep your elbows at 45-75 degrees on press movements to protect the shoulder joint.',
  'Squeeze hard at the top of each rep. Full contraction is where gains happen.',
  'Exhale on the push, inhale on the way down - rhythm keeps tension steady.',
]

const PULL_TIPS = [
  'Initiate the pull from your shoulder blades, not your arms - the lats do the work.',
  'Drive your elbows down and back, not just back. Full range, full result.',
  'Pause at the bottom of each rep to eliminate momentum and keep the muscle loaded.',
  'Think "bend the bar" on rows to keep elbows close and maximize back engagement.',
  'Dead hang briefly at the top of pull-ups to stretch the lat and build full range.',
]

const LEGS_TIPS = [
  "Push the floor away, don't think about lifting the bar - it cues the right muscles.",
  'Break at the hips before the knees on squats. Sit back, not just down.',
  'Keep your knees tracking over your toes throughout the entire movement.',
  'Pause at the bottom of squats to eliminate the bounce and build real strength.',
  'Drive through the full foot - heel, arch, and ball - not just the toes.',
]

const HINGE_TIPS = [
  'Hinge at the hips, not the waist. The bar stays close to the body the whole way.',
  'Lock your lats before you pull - imagine protecting your armpits from something.',
  'Neutral spine, braced core, proud chest. Set this before the weight leaves the floor.',
  "Push the floor away on deadlifts. It's a push, not just a pull.",
  'Reset your brace between each rep. Every single one deserves a clean setup.',
]

const CORE_TIPS = [
  'Quality over quantity. Slow, controlled reps beat fast, sloppy ones every time.',
  'Focus on exhaling fully at the top of each crunch - it deepens the contraction.',
  'A proper plank is full-body tension: quads, glutes, core, all engaged simultaneously.',
  'If you feel your lower back on ab work, reset. The core, not spine, should be working.',
  'The abs are anti-movement muscles. Resist rotation and flexion as much as create it.',
]

const CARRY_TIPS = [
  'Walk tall. Shoulders packed, core locked, eyes forward - carries are full-body drills.',
  'Control your breath on carries. Short, sharp exhales keep the core tight.',
  "Don't lean away from the weight. Stay neutral and let the core do its job.",
]

const CARDIO_TIPS = [
  "Stay in a zone where you could hold a short conversation - that's the fat-burn zone.",
  'Consistent pace beats sprinting and stopping. Sustainable effort compounds over time.',
  'Breathe through your nose when possible. It builds endurance capacity over weeks.',
  'Your arms drive your legs. Relax your hands, bend your elbows, pump smoothly.',
]

const GENERAL_TIPS = [
  'Rest 60-90 seconds between sets. Shorter for endurance, longer for strength.',
  'Controlled tempo is your friend. Slow is smooth, smooth is strong.',
  'Log your weights today - progress requires knowing where you started.',
  'Focus on the muscle, not just the movement. Mind-muscle connection is real.',
  'The rep you least want to do is the one that moves the needle.',
  'Hydrate between sets - even mild dehydration cuts performance noticeably.',
  'Perfect the pattern before adding load. Technique is your foundation.',
]

const CATEGORY_TIPS: Record<ExerciseCategory, string[]> = {
  push:    PUSH_TIPS,
  pull:    PULL_TIPS,
  legs:    LEGS_TIPS,
  hinge:   HINGE_TIPS,
  core:    CORE_TIPS,
  carry:   CARRY_TIPS,
  cardio:  CARDIO_TIPS,
  general: GENERAL_TIPS,
}

// Keyword-to-category mapping (order matters: more specific first)
const EXERCISE_PATTERNS: [RegExp, ExerciseCategory][] = [
  [/deadlift|romanian|rdl|good morning|hip thrust|glute bridge/i, 'hinge'],
  [/squat|lunge|leg press|step.?up|split squat|hack squat|leg extension|leg curl|calf/i, 'legs'],
  [/bench|press|push.?up|dip|fly|flye|overhead|shoulder press|tricep|lateral raise|front raise/i, 'push'],
  [/row|pull.?up|chin.?up|pulldown|lat|bicep|curl|face pull|rear delt|shrug/i, 'pull'],
  [/plank|crunch|sit.?up|ab |abs|core|oblique|hollow|russian twist|leg raise/i, 'core'],
  [/carry|farmer|suitcase|waiter/i, 'carry'],
  [/run|jog|sprint|cycle|bike|cardio|jump|burpee|box jump|mountain climber|rope/i, 'cardio'],
]

function categorizeExercise(name: string): ExerciseCategory {
  for (const [pattern, category] of EXERCISE_PATTERNS) {
    if (pattern.test(name)) return category
  }
  return 'general'
}

// Deterministic index based on exercise name so same exercise always shows same tip.
function stableIndex(str: string, max: number): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  return Math.abs(hash) % max
}

export function getExerciseTip(exerciseName: string): string {
  const category = categorizeExercise(exerciseName)
  const tips = CATEGORY_TIPS[category]
  return tips[stableIndex(exerciseName, tips.length)]
}

// ── Workout session tips (based on day label from schedule) ───────────────────

const SESSION_TIPS: Record<string, string> = {
  push:     'Today is a pushing session. Focus on controlled eccentrics and a strong lockout.',
  pull:     'Pulling day. Initiate every rep from your shoulder blades, not your hands.',
  legs:     'Leg day. Drive through the full foot and brace before every single rep.',
  chest:    'Chest session. Keep your shoulder blades retracted throughout every set.',
  back:     'Back day. Elbows drive back and down - the arms just hold the bar.',
  shoulder: 'Shoulder session. Control the descent on all pressing movements.',
  arms:     'Arm day. Slow eccentrics add more size than fast, sloppy reps.',
  glutes:   "Glute focus today. Squeeze hard at the top and don't rush the eccentric.",
  core:     'Core work today. Quality beats quantity - slow, intentional reps only.',
  upper:    'Upper body session. Alternate between push and pull patterns for balance.',
  lower:    'Lower body session. Warm up the hips and glutes before your first heavy set.',
  full:     "Full body session today. Prioritize compound movements first while you're fresh.",
  hiit:     'HIIT session. Give max effort in each work interval - the rest is earned.',
  cardio:   'Cardio day. Consistent pace beats starting hard and fading. Find your rhythm.',
  active:   'Active recovery today. Light movement, not intensity - let your body rebuild.',
  mobility: 'Mobility session. Breathe into each stretch and hold for full benefit.',
  rest:     'Rest day - your body grows when you recover, not when you train.',
}

export function getSessionTip(dayLabel: string): string {
  const lower = (dayLabel ?? '').toLowerCase()
  for (const [key, tip] of Object.entries(SESSION_TIPS)) {
    if (lower.includes(key)) return tip
  }
  return GENERAL_TIPS[stableIndex(dayLabel, GENERAL_TIPS.length)]
}

// ── Workout moment messages ───────────────────────────────────────────────────

const START_MESSAGES = [
  'Warm up properly. The first two sets belong to your joints.',
  'Put the phone down between sets - mental recovery matters as much as physical.',
  'Focus on quality today. Every rep should have a reason.',
  "You don't have to feel motivated to start. Start anyway. It shows up.",
  "Log every set. You can't improve what you don't track.",
]

const MID_MESSAGES = [
  "You're halfway through. The second half is where the real work gets done.",
  "Don't cut reps when it gets hard. That last rep is the one that counts.",
  'Stay hydrated. Even small dehydration tanks performance by up to 10%.',
  'Reset between exercises. Shake out, breathe, then lock in for the next set.',
  "The burn is just lactic acid. Your muscles aren't failing - push through it.",
]

const COMPLETE_MESSAGES = [
  'Done. Consistency like this is what separates people who talk about it from those who do it.',
  'Solid session. Recovery starts now: protein, water, sleep.',
  'Work done. Log your weights so next week you can beat today.',
  "That's one more session than most people did today.",
  'Finished. The discipline you built in that session carries everywhere.',
]

const RECOVERY_MESSAGES = [
  "Rest day. This is when the adaptations happen - don't skip it.",
  'Active recovery beats total rest. A 20-minute walk today accelerates tomorrow.',
  "Today's rest is part of the program, not a break from it.",
  "Sleep tonight. It's your most powerful recovery tool.",
  'Use today to prep for tomorrow: food, sleep, and mindset.',
]

function todayBasedIndex(arr: string[]): string {
  const day = new Date().getDay()
  return arr[day % arr.length]
}

export function getWorkoutStartMessage(): string   { return todayBasedIndex(START_MESSAGES) }
export function getMidWorkoutMessage(): string      { return todayBasedIndex(MID_MESSAGES) }
export function getWorkoutCompleteMessage(): string { return todayBasedIndex(COMPLETE_MESSAGES) }
export function getRestDayMessage(): string         { return todayBasedIndex(RECOVERY_MESSAGES) }

// ── Daily coaching insight (for Dashboard) ────────────────────────────────────

const DAILY_INSIGHTS = [
  { label: 'Recovery',            tip: 'Muscle grows during rest, not training. Protect your sleep window.' },
  { label: 'Nutrition',           tip: 'Hit protein first. Everything else fills in around it.' },
  { label: 'Consistency',         tip: 'An average session you complete beats a perfect session you skip.' },
  { label: 'Progressive Overload', tip: 'Add reps before adding weight. Volume before intensity.' },
  { label: 'Focus',               tip: 'One extra rep per set per week compounds into massive progress over months.' },
  { label: 'Hydration',           tip: 'Drink water before you feel thirsty. Thirst is already a performance cost.' },
  { label: 'Warm-Up',             tip: 'Two light sets before your working sets prevents 90% of avoidable injuries.' },
]

export function getDailyInsight(): { label: string; tip: string } {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  return DAILY_INSIGHTS[dayOfYear % DAILY_INSIGHTS.length]
}
