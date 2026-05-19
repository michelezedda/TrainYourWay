import Groq from 'groq-sdk'
import type { ChatCompletionCreateParamsNonStreaming } from 'groq-sdk/resources/chat/completions'

let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({
      apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
      dangerouslyAllowBrowser: true,
    })
  }
  return _groq
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 429) throw new Error('Rate limit reached. Please wait a minute and try again.')
      if (status !== 500 && status !== 503) throw err
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 2 ** attempt * 1000))
      }
    }
  }
  throw new Error('The AI service is temporarily unavailable. Please try again in a moment.')
}

async function groqComplete(params: ChatCompletionCreateParamsNonStreaming): Promise<Groq.Chat.ChatCompletion> {
  return withRetry(() => getGroq().chat.completions.create(params))
}

export interface WorkoutFormData {
  planName: string
  name?: string
  age: string
  sex?: 'male' | 'female'
  bodyType?: 'ectomorph' | 'mesomorph' | 'endomorph'
  weight: string
  height: string
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
  equipment: string[]
  equipmentNotes: string
  injuries: string
  workoutDays: string[]
  sessionDuration: string
  otherSports?: string[]
  images: string[]
  dietType: string
  allergies: string[]
  customRestrictions?: string
  mealsPerDay: string
  unit?: 'metric' | 'imperial'
}

function formatSports(sports: string[] | undefined): string {
  if (!sports || sports.length === 0) return ''
  return sports.filter(s => s.trim()).join(', ')
}

function bodyTypeNote(bodyType: string | undefined): string {
  if (!bodyType) return ''
  const notes: Record<string, string> = {
    ectomorph: 'Ectomorph: naturally lean, fast metabolism, struggles to gain muscle. Prioritize progressive overload, sufficient volume, and calorie surplus if muscle gain is a goal.',
    mesomorph: 'Mesomorph: naturally athletic, responds well to training, gains muscle and loses fat efficiently. Can handle higher volume and intensity.',
    endomorph: 'Endomorph: heavier natural build, slower metabolism, gains fat easily. Emphasize compound movements, metabolic conditioning, and calorie control.',
  }
  return notes[bodyType] ?? ''
}

function bmiLabel(weight: string, height: string): string {
  const w = parseFloat(weight)
  const h = parseFloat(height) / 100
  if (!w || !h) return 'unknown'
  const bmi = w / (h * h)
  const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : 'Obese'
  return `${bmi.toFixed(1)} (${cat})`
}

function dietLine(data: WorkoutFormData): string {
  if (!data.dietType) return ''
  const parts: string[] = []
  if (data.allergies.length > 0) parts.push(`Avoiding: ${data.allergies.join(', ')}`)
  if (data.customRestrictions?.trim()) parts.push(`Also avoiding: ${data.customRestrictions.trim()}`)
  const extra = parts.length > 0 ? ` | ${parts.join(' | ')}` : ''
  return `- Diet: ${data.dietType}${extra} | ${data.mealsPerDay} meals/day`
}

function dispW(kg: string, unit: 'metric' | 'imperial'): string {
  if (unit !== 'imperial') return `${kg} kg`
  return `${Math.round(parseFloat(kg) * 2.2046)} lbs`
}

function dispH(cm: string, unit: 'metric' | 'imperial'): string {
  if (unit !== 'imperial') return `${cm} cm`
  const totalIn = parseFloat(cm) / 2.54
  const ft = Math.floor(totalIn / 12)
  const inches = Math.round(totalIn % 12)
  return `${ft}'${inches}"`
}

function buildPrompt(data: WorkoutFormData): string {
  const u = data.unit ?? 'metric'
  const weightUnit = u === 'imperial' ? 'lbs' : 'kg'
  const weightExample = u === 'imperial' ? '18-26 lbs' : '8-12 kg'

  return `You are an expert personal trainer and fitness coach. Create a detailed, personalized weekly workout plan based on the profile below.

USER PROFILE:
- Age: ${data.age}${data.sex ? ` | Sex: ${data.sex}` : ''}
- Weight: ${dispW(data.weight, u)} | Height: ${dispH(data.height, u)} | BMI: ${bmiLabel(data.weight, data.height)}
- Fitness Level: ${data.fitnessLevel}
${data.bodyType ? `- Body Type: ${data.bodyType} -${bodyTypeNote(data.bodyType)}\n` : ''}- Goals: ${data.goals.join(', ')}
- Available Equipment: ${data.equipment.join(', ')}${data.equipmentNotes ? `, additional notes: ${data.equipmentNotes}` : ''}
- Injuries / Limitations: ${data.injuries || 'None'}
- Training: ${data.workoutDays.length} days/week on ${data.workoutDays.join(', ')}, ${data.sessionDuration} minutes/session
${formatSports(data.otherSports) ? `- Other sports/activities: ${formatSports(data.otherSports)} (schedule workouts to complement these, not compete with them on the same days)` : ''}
${dietLine(data)}
${data.images.length > 0 ? "\nThe images attached show the user's available workout space and equipment. Factor what you can see into the plan." : ''}

Create a complete ${data.workoutDays.length}-day weekly workout plan formatted in Markdown. Use this exact structure:

# ${data.planName}

## Overview
2-3 sentences summarizing the training approach and why it suits this person's profile.

## Weekly Schedule
SCHEDULE DIRECTIVE: The user trains ONLY on ${data.workoutDays.join(', ')}. Assign workouts to exactly these days. All other days MUST be Rest. Do not assign workouts to any unlisted day.
- **Monday:** [Workout Focus or Rest] - [Duration]
- **Tuesday:** [Workout Focus or Rest] - [Duration]
- **Wednesday:** [Workout Focus or Rest] - [Duration]
- **Thursday:** [Workout Focus or Rest] - [Duration]
- **Friday:** [Workout Focus or Rest] - [Duration]
- **Saturday:** [Workout Focus or Rest] - [Duration]
- **Sunday:** [Workout Focus or Rest] - [Duration]

## Day-by-Day Workouts

### Day 1: [Focus Area]

**Warm-Up** *(5 min)*
- [movement 1]
- [movement 2]
- [movement 3]

**Main Training**

**1. [Exercise Name]**
Sets: [X] x [Y reps or Z seconds] | Rest: [Ns] | Weight: [see rules]
*Form tip: one concise cue.*

[Continue numbering for all exercises]

**Cool-Down** *(3-5 min)*
- [1-2 stretches]

---

[Repeat this exact block format for every training day. Separate each day with ---]

## Progression Plan
How to increase difficulty over the next 4-8 weeks (3-4 bullet points).

## Nutrition Tips
${data.dietType
  ? `The user follows a ${data.dietType} diet (${data.mealsPerDay} meals/day${data.allergies.length > 0 ? `, avoiding ${data.allergies.join(', ')}` : ''}${data.customRestrictions?.trim() ? `; additional restrictions: ${data.customRestrictions.trim()}` : ''}). Provide 4-5 specific, practical tips that align with both their goals and this diet.`
  : '3-5 practical, specific nutrition tips aligned with the stated goals.'}

## Your Stats
**Body Metrics:** Weight ${dispW(data.weight, u)} | Height ${dispH(data.height, u)} | BMI ${bmiLabel(data.weight, data.height)}

> **Note:** BMI is a general reference point. It does not account for muscle mass, body composition, age, or athletic background.

---

Rules:
- NEVER use markdown tables anywhere in the response
- Every exercise must be doable with the listed equipment only
- Be specific: always include sets, reps (or time), and rest periods
- All weights in the plan must use ${weightUnit}
- Weight field rules: Bodyweight exercises use "Bodyweight"; bands use "Light/Medium/Heavy band"; weighted exercises use realistic ${weightUnit} range for a ${data.fitnessLevel} aged ${data.age}, e.g. "${weightExample}"`
}

function buildAnalysisPrompt(data: WorkoutFormData): string {
  const hasPhotos = data.images.length > 0
  const hasDiet = !!data.dietType
  const u = data.unit ?? 'metric'

  return `You are an expert personal trainer and nutritionist doing an initial assessment before creating a workout plan.

USER PROFILE:
- Age: ${data.age}${data.sex ? ` | Sex: ${data.sex}` : ''}
- Weight: ${dispW(data.weight, u)}, Height: ${dispH(data.height, u)}, BMI: ${bmiLabel(data.weight, data.height)}
- Fitness Level: ${data.fitnessLevel}
${data.bodyType ? `- Body Type: ${data.bodyType} -${bodyTypeNote(data.bodyType)}\n` : ''}- Goals: ${data.goals.join(', ')}
- Equipment: ${data.equipment.join(', ')}${data.equipmentNotes ? ` (${data.equipmentNotes})` : ''}
- Injuries or limitations: ${data.injuries || 'None'}
- Schedule: ${data.workoutDays.length} days/week (${data.workoutDays.join(', ')}), ${data.sessionDuration}-minute sessions
${formatSports(data.otherSports) ? `- Other sports/activities: ${formatSports(data.otherSports)}` : ''}
${hasDiet ? `- Diet: ${data.dietType} | ${data.mealsPerDay} meals/day${data.allergies.length > 0 ? ` | Avoiding: ${data.allergies.join(', ')}` : ''}${data.customRestrictions?.trim() ? ` | Also avoiding: ${data.customRestrictions.trim()}` : ''}` : ''}
${hasPhotos ? '\nWORKOUT SPACE PHOTOS: attached below. Study them carefully.' : ''}

Write a thorough initial assessment in Markdown with these exact sections:

## Profile Assessment
Honestly assess the user's fitness profile.

## Workout Space Analysis
${hasPhotos
  ? 'Based on the photos, describe exactly what you observe: floor surface, available space, every piece of equipment visible.'
  : `No photos were provided. Based solely on the stated equipment (${data.equipment.join(', ')}), describe the range of exercises available.`}

## Space Recommendations
Suggest 2-4 specific, low-cost additions that would meaningfully expand training options.

## Dietary Assessment
${hasDiet
  ? `Based on a ${data.dietType} approach, provide 3-4 specific nutrition priorities.`
  : 'Give 3-4 foundational nutrition principles that would support the stated goals.'}

## What to Expect
Set realistic expectations based on goals and starting level.

Rules:
- Never use long dashes. Use commas, colons, or new sentences instead.
- No markdown tables.
- Write in second person.
- Each section: 3-6 sentences or bullet points.
- Bullet points use - not *.`
}

type MessageContent = Groq.Chat.ChatCompletionContentPart

export async function generateAnalysis(data: WorkoutFormData): Promise<string> {
  const content: MessageContent[] = [{ type: 'text', text: buildAnalysisPrompt(data) }]
  for (const dataUrl of data.images) {
    content.push({ type: 'image_url', image_url: { url: dataUrl } })
  }
  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 2048,
  })
  return completion.choices[0]?.message?.content ?? ''
}

export async function generateWorkoutPlan(data: WorkoutFormData): Promise<string> {
  const content: MessageContent[] = [{ type: 'text', text: buildPrompt(data) }]
  for (const dataUrl of data.images) {
    content.push({ type: 'image_url', image_url: { url: dataUrl } })
  }
  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 8192,
  })
  return completion.choices[0]?.message?.content ?? ''
}

export interface ReevaluationData {
  originalPlanId: string
  originalPlan: string
  userName: string
  fitnessLevel: string
  goals: string[]
  equipment: string[]
  timeOnPlan: string
  adherence: string
  originalWeight: string
  originalHeight: string
  currentWeight: string
  currentHeight: string
  physicalFeel: string
  difficulty: string
  exercisesToRemove: string
  newInjuries: string
  newGoals: string[]
  workoutDays?: string[]
  unit?: 'metric' | 'imperial'
}

export async function reevaluateWorkoutPlan(data: ReevaluationData): Promise<string> {
  const goals = (() => { try { return (JSON.parse(data.goals as unknown as string) as string[]).join(', ') } catch { return Array.isArray(data.goals) ? data.goals.join(', ') : data.goals } })()
  const equipment = (() => { try { return (JSON.parse(data.equipment as unknown as string) as string[]).join(', ') } catch { return Array.isArray(data.equipment) ? data.equipment.join(', ') : data.equipment } })()

  const progressionNote =
    data.difficulty === 'Too easy'
      ? 'Apply significant progression: increase weights 10-15%, add sets, reduce rest periods'
      : data.difficulty === 'Too hard'
      ? 'Slight regression: consolidate current weights, focus on form before adding load'
      : 'Moderate progression: increase weights 5-10%, add 1 rep per set on key lifts'

  const consistencyNote =
    data.adherence === 'Every session' || data.adherence === 'Most sessions'
      ? 'User has been consistent, apply full progression'
      : 'User has been inconsistent, consolidate and reinforce before progressing'

  const u = data.unit ?? 'metric'
  const weightUnit = u === 'imperial' ? 'lbs' : 'kg'
  const weightExample = u === 'imperial' ? '18-26 lbs' : '8-12 kg'

  const prompt = `You are an expert personal trainer conducting a formal progress review and writing a FULLY EVOLVED workout plan.

PROGRESS REPORT:
- Time on current plan: ${data.timeOnPlan}
- Adherence: ${data.adherence}
- Physical feel: ${data.physicalFeel}
- Perceived difficulty: ${data.difficulty}
- Exercises to remove/replace: ${data.exercisesToRemove || 'None'}
- New injuries or limitations: ${data.newInjuries || 'None'}
${data.newGoals.length > 0 ? `- New focus areas: ${data.newGoals.join(', ')}` : ''}

UPDATED BODY STATS:
- Weight: ${dispW(data.currentWeight, u)} | Height: ${dispH(data.currentHeight, u)} | BMI: ${bmiLabel(data.currentWeight, data.currentHeight)}

ORIGINAL FITNESS PROFILE:
- Level: ${data.fitnessLevel} | Goals: ${goals} | Equipment: ${equipment}
${data.workoutDays?.length ? `- New schedule: ${data.workoutDays.length} days/week, training on: ${data.workoutDays.join(', ')}` : ''}

THE PLAN THEY HAVE BEEN FOLLOWING:
${data.originalPlan}

---

TRAINER DIRECTIVES:
1. ${progressionNote}
2. ${consistencyNote}
3. Replace EVERY exercise listed in "Exercises to remove/replace" with a different alternative.
4. Respect all new injuries.
${data.newGoals.length > 0 ? `5. Shift emphasis toward: ${data.newGoals.join(', ')}` : ''}
6. Swap at minimum 3 exercises across the plan with fresh alternatives.
7. Change EVERY set/rep/weight figure compared to the original.
8. Update rest periods where appropriate.
9. Rewrite the Overview section to describe this evolved phase.
10. Update the Progression Plan for the next 4-8 weeks.
${data.workoutDays?.length ? `11. Build the plan around exactly these training days: ${data.workoutDays.join(', ')}.` : ''}

THIS MUST BE A COMPLETE, FULLY WRITTEN PLAN.

Title: # ${data.userName}: Next Phase

CRITICAL FORMAT:
- Day sections MUST use: ### Day N: [Focus Area]
- Swapped exercises MUST include *(new)* inside the bold name line only: **N. Exercise Name *(new)***
- Exercise meta line MUST start with "Sets:": Sets: X x Y reps | Rest: Ns | Weight: [range or Bodyweight]
- NEVER use markdown tables

Rules:
- Include Weight: field on every exercise (${weightUnit} range or Bodyweight)
- All weights must use ${weightUnit}
- Use "${weightExample}" as the weight format example
- Write the full plan, do not truncate or skip any day`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8192,
  })

  const result = completion.choices[0]?.message?.content ?? ''
  if (!result || result.trim().length < 200) {
    throw new Error('The evolved plan could not be generated. Please try again.')
  }
  return result
}

export async function generateReevaluationAnalysis(data: ReevaluationData): Promise<string> {
  const goals = (() => { try { return (JSON.parse(data.goals as unknown as string) as string[]).join(', ') } catch { return Array.isArray(data.goals) ? data.goals.join(', ') : data.goals } })()
  const u = data.unit ?? 'metric'

  const weightDiff = (() => {
    const prev = parseFloat(data.originalWeight)
    const curr = parseFloat(data.currentWeight)
    if (!prev || !curr || isNaN(prev) || isNaN(curr)) return ''
    const diffKg = curr - prev
    if (Math.abs(diffKg) < 0.1) return ' (no change)'
    if (u === 'imperial') {
      const diffLbs = Math.abs(diffKg) * 2.2046
      return ` (${diffKg > 0 ? '+' : '-'}${diffLbs.toFixed(1)} lbs since last plan)`
    }
    return ` (${diffKg > 0 ? '+' : ''}${diffKg.toFixed(1)} kg since last plan)`
  })()

  const prompt = `You are an expert personal trainer conducting a formal progress review.

PHYSICAL PROGRESS:
- Previous: Weight ${dispW(data.originalWeight, u)}, Height ${dispH(data.originalHeight, u)}, BMI ${bmiLabel(data.originalWeight, data.originalHeight)}
- Current: Weight ${dispW(data.currentWeight, u)}, Height ${dispH(data.currentHeight, u)}, BMI ${bmiLabel(data.currentWeight, data.currentHeight)}${weightDiff ? `\n- Weight change: ${weightDiff}` : ''}

TRAINING REVIEW:
- Time on plan: ${data.timeOnPlan}
- Adherence: ${data.adherence}
- Physical feel: ${data.physicalFeel}
- Perceived difficulty: ${data.difficulty}
- Original goals: ${goals}
${data.newGoals.length > 0 ? `- New focus areas: ${data.newGoals.join(', ')}` : ''}

Write a focused progress assessment in Markdown with these exact sections:

## Your Progress
Compare current stats to previous stats.

## Training Assessment
Based on adherence, physical feel, and difficulty, evaluate how the last phase went.

## What Changes in This Phase
Briefly explain what the evolved plan will adjust and why.

Rules:
- Never use long dashes.
- No markdown tables.
- Write in second person.
- Each section: 3-5 sentences.
- Bullet points use - not *.`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1536,
  })
  return completion.choices[0]?.message?.content ?? ''
}

export interface FoodMacros {
  description: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export async function estimateFoodMacros(
  description: string,
  imageDataUrl?: string,
): Promise<FoodMacros> {
  const isPhotoMode = !!imageDataUrl

  const textPrompt = isPhotoMode
    ? `Analyze this photo of a meal and estimate its total nutritional content.

Reply with ONLY valid JSON, no markdown, no extra text:
{
  "description": "concise description of what you see, comma-separated",
  "kcal": 350,
  "protein": 25,
  "carbs": 40,
  "fat": 8
}

Rules:
- Identify every food item visible and sum all values.
- Round every number to the nearest integer.
- Use realistic average portion-size estimates.
- Never use long dashes in the description.`
    : `Estimate the nutritional content for: "${description}"

Reply with ONLY valid JSON, no markdown, no extra text:
{
  "description": "cleaned-up, concise description",
  "kcal": 350,
  "protein": 25,
  "carbs": 40,
  "fat": 8
}

Rules:
- If multiple items are listed, sum all values.
- Round every number to the nearest integer.
- Use realistic, average portion-size estimates.
- Never use long dashes.`

  const content: MessageContent[] = [{ type: 'text', text: textPrompt }]
  if (imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: imageDataUrl } })
  }

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 200,
    temperature: 0.1,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as FoodMacros
  return {
    ...parsed,
    kcal: Math.round(parsed.kcal),
    protein: Math.round(parsed.protein),
    carbs: Math.round(parsed.carbs),
    fat: Math.round(parsed.fat),
  }
}

export interface ExerciseStep {
  step: number
  title: string
  description: string
}

export interface ExerciseInstructions {
  setup: string
  steps: ExerciseStep[]
  tips: string[]
  avoid: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced'
  difficultyReason?: string
}

export async function getExerciseInstructions(exerciseName: string): Promise<ExerciseInstructions> {
  const prompt = `Give concise visual instructions for the exercise: "${exerciseName}".

Reply with ONLY valid JSON in this exact shape. No markdown, no extra text:
{
  "setup": "one sentence on starting position and equipment needed",
  "steps": [
    { "step": 1, "title": "short title", "description": "one clear sentence" },
    { "step": 2, "title": "short title", "description": "one clear sentence" },
    { "step": 3, "title": "short title", "description": "one clear sentence" }
  ],
  "tips": ["tip 1", "tip 2", "tip 3"],
  "avoid": ["mistake 1", "mistake 2"],
  "primaryMuscles": ["muscle_id_1"],
  "secondaryMuscles": ["muscle_id_2"],
  "difficulty": "Beginner",
  "difficultyReason": "one sentence"
}

For muscles use ONLY: chest, front_delts, rear_delts, biceps, triceps, forearms, abs, obliques, hip_flexors, adductors, quads, calves_front, traps, rhomboids, lats, lower_back, glutes, hamstrings, calves`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 640,
    temperature: 0.3,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw) as ExerciseInstructions
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChatMessage(messages: ChatMessage[], userContext: string): Promise<string> {
  const contextBlock = userContext
    ? `Here is what you know about this user:\n\n${userContext}`
    : 'No profile data is available yet for this user.'

  const systemPrompt = `You are Kai, UPLYFT's fitness and nutrition coach. You are direct, professional, and specific. No emojis, no filler phrases.

STRICT SCOPE: Only discuss exercise, nutrition, recovery, mindset, and the UPLYFT app. OFF-TOPIC: say once "That's outside my scope. Ask me about fitness, nutrition, or your UPLYFT plan."

TONE: Direct and specific. Give numbers, not generalities. No em dashes, no en dashes.

FORMATTING: Keep responses under 2 short sentences unless structure helps. No emojis.

${contextBlock}`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 1024,
    temperature: 0.7,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function extractPlanFromImage(imageDataUrl: string): Promise<string> {
  const prompt = `You are given a photo of a workout plan. Extract every piece of information and reformat it using the UPLYFT Markdown structure.

# [Derive a short descriptive title]

## Overview
One or two sentences.

## Weekly Schedule
- **Monday:** [focus or Rest] - [Duration if visible]
[continue for all 7 days]

## Day-by-Day Workouts

### Day 1: [Focus Area]

**Warm-Up** *(if present)*
- [movement]

**Main Training**

**1. [Exercise Name]**
Sets: [X] x [Y reps] | Rest: [Ns] | Weight: [as written, or Bodyweight]

[Continue for all exercises and days. Separate days with ---]

Rules:
- Extract ONLY what is visible. Never invent exercises.
- If illegible write [unclear].
- Never use long dashes.
- Never use markdown tables.`

  const content: MessageContent[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ]

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 4096,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export interface MachineAnalysis {
  machineName: string
  confidence: 'high' | 'medium' | 'low'
  targetMuscles: { primary: string[]; secondary: string[] }
  setup: string[]
  steps: string[]
  mistakes: string[]
  tips: string[]
}

export async function analyzeMachineImage(imageDataUrl: string): Promise<MachineAnalysis> {
  const prompt = `Analyze this image of gym equipment.

Respond ONLY with valid JSON using exactly this structure:
{
  "machineName": "Full name of the machine",
  "confidence": "high",
  "targetMuscles": {
    "primary": ["Muscle 1"],
    "secondary": ["Muscle 2"]
  },
  "setup": ["Adjustment step 1"],
  "steps": ["Starting position", "Movement step 2", "Return step 3"],
  "mistakes": ["Common mistake 1"],
  "tips": ["Safety tip 1"]
}

Rules:
- If unknown, set machineName to "Unknown equipment" and confidence to "low".
- steps: 3 to 6 clear numbered steps.
- mistakes: 2 to 4 common errors.
- tips: 2 to 3 coaching cues.
- No em dashes, no markdown formatting inside strings.`

  const content: MessageContent[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ]

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 1024,
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw) as MachineAnalysis
}

export async function analyzeImportedPlan(plan: string, profileContext: string): Promise<string> {
  const prompt = `You are an expert personal trainer reviewing an imported workout plan.

${profileContext ? `USER PROFILE:\n${profileContext}\n` : ''}

IMPORTED PLAN:
${plan}

Write a concise analysis in Markdown with these exact sections:

## Plan Assessment
What type of plan is this and what is it designed for?

## Suitability for Your Goals
How well does this plan align with the user's stated goals?

## What Works Well
2-3 specific strengths.

## What Could Be Better
2-3 specific weaknesses.

## Verdict
One clear recommendation.

Rules: No long dashes. No markdown tables. Second person. 2-4 sentences per section.`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1536,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function improveImportedPlan(plan: string, profileContext: string): Promise<string> {
  const prompt = `You are an expert personal trainer improving an existing workout plan.

${profileContext ? `USER PROFILE:\n${profileContext}\n` : ''}

EXISTING PLAN TO IMPROVE:
${plan}

Rewrite and improve this plan to better fit the user's profile.

Output the improved plan in Markdown:

# Improved Workout Plan

## What Changed
3-4 bullet points explaining key improvements.

## Weekly Schedule
- **Monday:** [focus or rest]
[continue for all days]

## Day-by-Day Workouts

### Day 1: [Focus]

**Warm-Up** (5 min)
- [movement]

**Main Training**

**1. [Exercise]**
Sets: X x Y reps | Rest: Zs | Weight: [range or Bodyweight]

[Continue for all exercises and days]

## Progression Plan
3-4 bullet points.

Rules:
- NEVER use markdown tables
- Every exercise must include sets, reps, rest, and weight
- Never use long dashes`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 6144,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function draftSupportTicket(
  category: string,
  description: string,
  imageDataUrl?: string,
): Promise<string> {
  const hasImage = !!imageDataUrl
  const content: MessageContent[] = []

  const prompt = `You are Kai, UPLYFT's AI support assistant. A user has submitted a support request.

ISSUE CATEGORY: ${category}

USER'S DESCRIPTION:
"${description}"
${hasImage ? '\nThe user has attached a screenshot (shown below).' : ''}

Write the support ticket:

## Summary
One sentence describing the core issue.

## What the User Reported
Restate their issue in 2-3 sentences.

## Likely Cause
Your best guess at what might be causing this (1-2 sentences).

## Suggested Next Steps
2-3 bullet points for the support team.

Rules: Professional tone. No long dashes. Keep it concise.`

  content.push({ type: 'text', text: prompt })
  if (imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: imageDataUrl } })
  }

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 768,
    temperature: 0.4,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function generateDayWorkout(plan: string, day: string): Promise<string> {
  const planSnippet = plan.slice(0, 3000)

  const prompt = `You are adding a single new workout session to an existing weekly training plan.

EXISTING PLAN (for context):
${planSnippet}

Task: Create a workout session for ${day} that fits seamlessly into this plan.

Requirements:
- Match the exercise format exactly: **Exercise Name** then Sets: X x Y reps | Rest: Zs | Weight: ...
- Include a warm-up (3-5 min) and a cool-down (3-5 min)
- Match the intensity, exercise types, and equipment of the existing plan
- Choose muscle groups that complement nearby days

Output ONLY the workout content starting with **Warm-Up**. No preamble. No markdown tables. No long dashes.`

  const completion = await groqComplete({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
  })

  return completion.choices[0]?.message?.content ?? ''
}
