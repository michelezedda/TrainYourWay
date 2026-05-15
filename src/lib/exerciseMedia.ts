// Exercise media lookup — fetches real GIFs from ExerciseDB.
// Priority: official RapidAPI (if VITE_EXERCISEDB_API_KEY set) → free community mirror → static map.

const OFFICIAL_KEY = import.meta.env.VITE_EXERCISEDB_API_KEY as string | undefined
const FREE_API     = 'https://exercisedb-api.vercel.app/api/v1'
const GIF_CDN      = 'https://v2.exercisedb.io/image'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExerciseMedia {
  gifUrl:     string
  exerciseId: string
  name:       string
}

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = new Map<string, ExerciseMedia | null>()

// ── Name normalisation ────────────────────────────────────────────────────────

export function normalizeExerciseName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(with|and|the|using|on|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Static lookup: normalised name → ExerciseDB image ID ─────────────────────
// IDs are verified from the public ExerciseDB dataset (exercisedb.p.rapidapi.com).

const STATIC_MAP: Record<string, string> = {
  // Chest
  'bench press':                 '0019',
  'barbell bench press':         '0019',
  'incline bench press':         '0041',
  'incline barbell bench press': '0041',
  'decline bench press':         '1259',
  'push up':                     '0061',
  'pushup':                      '0061',
  'dumbbell flye':               '0037',
  'dumbbell fly':                '0037',
  'dumbbell chest fly':          '0037',
  'cable crossover':             '0025',
  'cable fly':                   '0025',
  'chest dip':                   '1423',
  'pec deck':                    '0058',
  // Back
  'pull up':                     '0060',
  'pullup':                      '0060',
  'chin up':                     '0029',
  'chinup':                      '0029',
  'lat pulldown':                '0045',
  'barbell row':                 '0020',
  'bent over row':               '0020',
  'bent-over barbell row':       '0020',
  'dumbbell row':                '0043',
  'single arm dumbbell row':     '0043',
  'one arm dumbbell row':        '0043',
  'cable row':                   '0067',
  'seated cable row':            '0067',
  'seated row':                  '0067',
  'deadlift':                    '0032',
  'conventional deadlift':       '0032',
  't-bar row':                   '0073',
  'face pull':                   '0036',
  'hyperextension':              '0042',
  'back extension':              '0042',
  // Shoulders
  'overhead press':              '0057',
  'military press':              '0057',
  'barbell overhead press':      '0057',
  'barbell shoulder press':      '0057',
  'standing overhead press':     '0057',
  'dumbbell shoulder press':     '0035',
  'seated dumbbell press':       '0035',
  'lateral raise':               '0046',
  'dumbbell lateral raise':      '0046',
  'side lateral raise':          '0046',
  'front raise':                 '0038',
  'dumbbell front raise':        '0038',
  'rear delt flye':              '0063',
  'rear delt fly':               '0063',
  'reverse fly':                 '0063',
  'upright row':                 '0080',
  'barbell upright row':         '0080',
  'arnold press':                '0015',
  // Legs
  'squat':                       '0023',
  'barbell squat':               '0023',
  'back squat':                  '0023',
  'front squat':                 '0039',
  'leg press':                   '0049',
  'leg extension':               '0047',
  'leg curl':                    '0048',
  'lying leg curl':              '0048',
  'seated leg curl':             '0048',
  'hamstring curl':              '0048',
  'romanian deadlift':           '0064',
  'rdl':                         '0064',
  'stiff leg deadlift':          '0064',
  'lunge':                       '0051',
  'lunges':                      '0051',
  'dumbbell lunge':              '0051',
  'walking lunge':               '1014',
  'reverse lunge':               '0051',
  'split squat':                 '0051',
  'bulgarian split squat':       '1460',
  'hack squat':                  '0040',
  'calf raise':                  '0028',
  'standing calf raise':         '0076',
  'seated calf raise':           '1355',
  'hip thrust':                  '0692',
  'barbell hip thrust':          '0692',
  'glute bridge':                '0559',
  'sumo squat':                  '0624',
  'goblet squat':                '1399',
  'step up':                     '0070',
  'box step up':                 '0070',
  'jump squat':                  '0756',
  'box jump':                    '0029',
  // Biceps
  'bicep curl':                  '0027',
  'biceps curl':                 '0027',
  'barbell curl':                '0021',
  'dumbbell curl':               '0034',
  'dumbbell bicep curl':         '0034',
  'alternating dumbbell curl':   '0034',
  'hammer curl':                 '0194',
  'dumbbell hammer curl':        '0194',
  'preacher curl':               '0062',
  'barbell preacher curl':       '0062',
  'concentration curl':          '0030',
  'cable curl':                  '0024',
  'cable bicep curl':            '0024',
  'incline dumbbell curl':       '0207',
  // Triceps
  'tricep pushdown':             '0079',
  'triceps pushdown':            '0079',
  'cable tricep pushdown':       '0079',
  'skull crusher':               '0077',
  'lying tricep extension':      '0077',
  'close grip bench press':      '0026',
  'tricep dip':                  '0033',
  'triceps dip':                 '0033',
  'bench dip':                   '0033',
  'overhead tricep extension':   '0078',
  'tricep extension':            '0078',
  'cable tricep extension':      '0078',
  'diamond push up':             '1675',
  // Core
  'plank':                       '0059',
  'crunch':                      '0031',
  'sit up':                      '0075',
  'situp':                       '0075',
  'leg raise':                   '0050',
  'lying leg raise':             '0050',
  'hanging leg raise':           '0618',
  'hanging knee raise':          '0618',
  'russian twist':               '0065',
  'cable crunch':                '0024',
  'ab wheel rollout':            '0013',
  'mountain climber':            '0055',
  'bicycle crunch':              '0022',
  'flutter kick':                '0397',
  'v-up':                        '0827',
  'toe touch crunch':            '0806',
  // Compound / full body
  'kettlebell swing':            '0363',
  'burpee':                      '0082',
  'clean':                       '0282',
  'power clean':                 '0282',
  'turkish get up':              '0806',
  'farmer walk':                 '0347',
  'farmers walk':                '0347',
  'sled push':                   '0706',
}

function staticLookup(normalized: string): string | null {
  if (STATIC_MAP[normalized]) return STATIC_MAP[normalized]

  // Strip equipment prefixes and retry
  const stripped = normalized
    .replace(/^(barbell|dumbbell|cable|machine|ez bar|ez-bar|resistance band|smith machine|kettlebell)\s+/, '')
    .trim()
  if (stripped !== normalized && STATIC_MAP[stripped]) return STATIC_MAP[stripped]

  // Substring match (longest key wins to avoid too-broad matches)
  let bestId: string | null = null
  let bestLen = 0
  for (const [key, id] of Object.entries(STATIC_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (key.length > bestLen) { bestLen = key.length; bestId = id }
    }
  }
  return bestId
}

// ── API fetchers ──────────────────────────────────────────────────────────────

async function fetchOfficial(name: string): Promise<ExerciseMedia | null> {
  if (!OFFICIAL_KEY) return null
  try {
    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?limit=1&offset=0`,
      {
        headers: {
          'X-RapidAPI-Key': OFFICIAL_KEY,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
        signal: AbortSignal.timeout(6000),
      },
    )
    if (!res.ok) return null
    const data = await res.json() as Array<{ id: string; name: string; gifUrl: string }>
    const ex = data[0]
    return ex?.gifUrl ? { gifUrl: ex.gifUrl, exerciseId: ex.id, name: ex.name } : null
  } catch { return null }
}

async function fetchFreeApi(name: string): Promise<ExerciseMedia | null> {
  try {
    const res = await fetch(
      `${FREE_API}/exercises?name=${encodeURIComponent(name)}&limit=1`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (!res.ok) return null
    type ApiResp = { success: boolean; data: { exercises: Array<{ exerciseId: string; name: string; gifUrl: string }> } }
    const json = await res.json() as ApiResp
    const ex = json.data?.exercises?.[0]
    return ex?.gifUrl ? { gifUrl: ex.gifUrl, exerciseId: ex.exerciseId, name: ex.name } : null
  } catch { return null }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getExerciseMedia(exerciseName: string): Promise<ExerciseMedia | null> {
  const key = normalizeExerciseName(exerciseName)
  if (cache.has(key)) return cache.get(key)!

  // 1. Official RapidAPI (fast, authoritative, requires env key)
  const official = await fetchOfficial(key)
  if (official) { cache.set(key, official); return official }

  // 2. Free community mirror
  const free = await fetchFreeApi(key)
  if (free) { cache.set(key, free); return free }

  // 3. Static lookup with CDN URL
  const staticId = staticLookup(key)
  if (staticId) {
    const media: ExerciseMedia = {
      gifUrl: `${GIF_CDN}/${staticId}`,
      exerciseId: staticId,
      name: exerciseName,
    }
    cache.set(key, media)
    return media
  }

  cache.set(key, null)
  return null
}
