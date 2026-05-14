export type InjuryLocation = 'knee' | 'shoulder' | 'lower back' | 'wrist' | 'hip' | 'ankle' | 'neck' | 'other'
export type InjurySeverity = 'mild' | 'moderate' | 'sharp'

export interface InjuryState {
  active: boolean
  location: InjuryLocation
  severity: InjurySeverity
  worsensWithMovement: boolean
  startedAt: number
}

export interface InjuryAdvice {
  avoid: string[]
  focus: string[]
  message: string
  intensity: 'rest' | 'reduced' | 'normal'
}

const STORAGE_KEY = 'injury_state'

const ADVICE_MAP: Record<InjuryLocation, { avoid: string[]; focus: string[] }> = {
  knee: {
    avoid: ['Squats', 'Lunges', 'Leg Press', 'Running', 'Jump training', 'Deep knee flexion'],
    focus: ['Upper body', 'Core', 'Seated exercises', 'Swimming', 'Gentle stretching'],
  },
  shoulder: {
    avoid: ['Overhead press', 'Pull-ups', 'Bench press', 'Upright rows', 'Dips'],
    focus: ['Lower body', 'Core', 'Light resistance band work', 'Walking', 'Hip exercises'],
  },
  'lower back': {
    avoid: ['Deadlifts', 'Heavy squats', 'Bent-over rows', 'Sit-ups', 'High-impact cardio'],
    focus: ['Gentle core activation', 'Walking', 'Hip flexor stretches', 'Cat-cow mobility'],
  },
  wrist: {
    avoid: ['Push-ups', 'Plank variations', 'Barbell curls', 'Wrist-loaded movements'],
    focus: ['Lower body', 'Cardio', 'Core (no wrist load)', 'Shoulder-supported moves'],
  },
  hip: {
    avoid: ['Deep squats', 'Hip thrusts', 'Lunges', 'Running', 'High kicks'],
    focus: ['Upper body', 'Seated upper body', 'Gentle mobility', 'Core (lying down)'],
  },
  ankle: {
    avoid: ['Running', 'Jump rope', 'Box jumps', 'HIIT', 'Weight-bearing cardio'],
    focus: ['Seated upper body', 'Core', 'Swimming', 'Upper body resistance training'],
  },
  neck: {
    avoid: ['Overhead press', 'Heavy deadlifts', 'Upright rows', 'Crunches', 'Pull-ups'],
    focus: ['Light lower body', 'Walking', 'Gentle mobility', 'Breathing exercises'],
  },
  other: {
    avoid: ['High-impact movements', 'Heavy compound lifts', 'Movements that cause pain'],
    focus: ['Light mobility work', 'Gentle stretching', 'Low-impact cardio', 'Rest'],
  },
}

export function getInjuryAdvice(state: InjuryState): InjuryAdvice {
  const base = ADVICE_MAP[state.location]
  const isSharp = state.severity === 'sharp'
  const isMild = state.severity === 'mild'
  const worsens = state.worsensWithMovement

  let intensity: InjuryAdvice['intensity']
  let message: string

  if (isSharp || worsens) {
    intensity = 'rest'
    message = 'Your symptoms suggest you need full rest. Avoid all training until you recover.'
  } else if (isMild && !worsens) {
    intensity = 'reduced'
    message = 'Train smart: skip the affected area and keep intensity low. Listen to your body.'
  } else {
    intensity = 'reduced'
    message = 'Moderate your training. Avoid movements that stress the injured area.'
  }

  return { avoid: base.avoid, focus: base.focus, message, intensity }
}

export function getInjuryState(): InjuryState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as InjuryState
  } catch {
    return null
  }
}

export function saveInjuryState(state: InjuryState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearInjuryState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
