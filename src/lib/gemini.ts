import Groq from 'groq-sdk'

const groq = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY as string,
  dangerouslyAllowBrowser: true,
})

export interface SportActivity {
  sport: string
  days: string[]  // full day names e.g. ['Monday', 'Wednesday']
}

export interface WorkoutFormData {
  planName: string  // auto-generated descriptive name
  age: string
  weight: string   // kg
  height: string   // cm
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced'
  goals: string[]
  equipment: string[]
  equipmentNotes: string
  injuries: string
  daysPerWeek: string
  sessionDuration: string
  unavailableDays?: string[]
  otherSports?: SportActivity[]
  images: string[]
  dietType: string
  allergies: string[]
  customRestrictions?: string
  mealsPerDay: string
}

function formatSports(sports: SportActivity[] | undefined): string {
  if (!sports || sports.length === 0) return ''
  return sports
    .filter(s => s.sport.trim())
    .map(s => s.days.length > 0 ? `${s.sport} (${s.days.join(', ')})` : s.sport)
    .join(', ')
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

function buildPrompt(data: WorkoutFormData): string {
  return `You are an expert personal trainer and fitness coach. Create a detailed, personalized weekly workout plan based on the profile below.

USER PROFILE:
- Age: ${data.age}
- Weight: ${data.weight} kg | Height: ${data.height} cm | BMI: ${bmiLabel(data.weight, data.height)}
- Fitness Level: ${data.fitnessLevel}
- Goals: ${data.goals.join(', ')}
- Available Equipment: ${data.equipment.join(', ')}${data.equipmentNotes ? `, additional notes: ${data.equipmentNotes}` : ''}
- Injuries / Limitations: ${data.injuries || 'None'}
- Training: ${data.daysPerWeek} days/week, ${data.sessionDuration} minutes/session
${data.unavailableDays?.length ? `- Cannot train on: ${data.unavailableDays.join(', ')}` : ''}
${formatSports(data.otherSports) ? `- Other sports/activities: ${formatSports(data.otherSports)} (schedule workouts to complement these, not compete with them on the same days)` : ''}
${dietLine(data)}
${data.images.length > 0 ? '\nThe images attached show the user\'s available workout space and equipment. Factor what you can see into the plan.' : ''}

Create a complete ${data.daysPerWeek}-day weekly workout plan formatted in Markdown. Use this exact structure:

# ${data.planName}

## Overview
2-3 sentences summarizing the training approach and why it suits this person's profile.

## Weekly Schedule
${data.unavailableDays?.length ? `IMPORTANT: The user CANNOT train on ${data.unavailableDays.join(', ')}. Mark those days as Rest in the schedule.` : ''}
- **Monday:** [Workout Focus or Rest] · [Duration]
- **Tuesday:** [Workout Focus or Rest] · [Duration]
- **Wednesday:** [Workout Focus or Rest] · [Duration]
- **Thursday:** [Workout Focus or Rest] · [Duration]
- **Friday:** [Workout Focus or Rest] · [Duration]
- **Saturday:** [Workout Focus or Rest] · [Duration]
- **Sunday:** [Workout Focus or Rest] · [Duration]

## Day-by-Day Workouts

### Day 1: [Focus Area]

**🔥 Warm-Up** *(5 min)*
- [movement 1]
- [movement 2]
- [movement 3]

**💪 Main Training**

**1. [Exercise Name]**
Sets: [X] × [Y reps or Z seconds] | Rest: [Ns] | Weight: [see rules]
*Form tip: one concise cue.*

**2. [Exercise Name]**
Sets: [X] × [Y reps or Z seconds] | Rest: [Ns] | Weight: [see rules]
*Form tip: one concise cue.*

[Continue numbering for all exercises in this session]

**🧘 Cool-Down** *(3-5 min)*
- [1-2 stretches]

---

[Repeat this exact block format for every training day. Separate each day with ---]

## Progression Plan
How to increase difficulty over the next 4-8 weeks (3-4 bullet points).

## Nutrition Tips
${data.dietType
  ? `The user follows a ${data.dietType} diet (${data.mealsPerDay} meals/day${data.allergies.length > 0 ? `, avoiding ${data.allergies.join(', ')}` : ''}${data.customRestrictions?.trim() ? `; additional restrictions: ${data.customRestrictions.trim()}` : ''}). Provide 4-5 specific, practical tips that align with both their goals and this diet. Include specific foods, meal timing, and at least one tip on pre/post-workout nutrition compatible with their diet type. Respect all listed restrictions strictly.`
  : '3-5 practical, specific nutrition tips aligned with the stated goals. Include meal timing and food examples.'}

## Your Stats
Include this section verbatim, substituting the actual values:

**Body Metrics:** Weight ${data.weight} kg | Height ${data.height} cm | BMI ${bmiLabel(data.weight, data.height)}

> **Note:** BMI is a general reference point. It does not account for muscle mass, body composition, age, or athletic background. Use it as context, not a verdict. Always listen to your body and consult a healthcare professional before starting any new exercise programme.

---

Rules:
- NEVER use markdown tables anywhere in the response. Use the bullet/block formats shown above.
- Every exercise must be doable with the listed equipment only
- Adapt intensity precisely to the ${data.fitnessLevel} level
- Be specific: always include sets, reps (or time), and rest periods
- Keep descriptions concise and actionable
- Weight field rules (required on every exercise):
  · Bodyweight exercises → "Bodyweight"
  · Resistance band exercises → "Light band" / "Medium band" / "Heavy band"
  · Dumbbell / barbell / kettlebell → give a realistic kg range for a ${data.fitnessLevel} aged ${data.age}, e.g. "8-12 kg", based on the muscle group and movement difficulty
  · If unsure, err on the lighter side and add "(adjust to feel)" after the range`
}

function buildAnalysisPrompt(data: WorkoutFormData): string {
  const hasPhotos = data.images.length > 0
  const hasDiet = !!data.dietType

  return `You are an expert personal trainer and nutritionist doing an initial assessment before creating a workout plan.

USER PROFILE:
- Age: ${data.age}
- Weight: ${data.weight} kg, Height: ${data.height} cm, BMI: ${bmiLabel(data.weight, data.height)}
- Fitness Level: ${data.fitnessLevel}
- Goals: ${data.goals.join(', ')}
- Equipment: ${data.equipment.join(', ')}${data.equipmentNotes ? ` (${data.equipmentNotes})` : ''}
- Injuries or limitations: ${data.injuries || 'None'}
- Schedule: ${data.daysPerWeek} days/week, ${data.sessionDuration}-minute sessions
${data.unavailableDays?.length ? `- Cannot train on: ${data.unavailableDays.join(', ')}` : ''}
${formatSports(data.otherSports) ? `- Other sports/activities: ${formatSports(data.otherSports)}` : ''}
${hasDiet ? `- Diet: ${data.dietType} | ${data.mealsPerDay} meals/day${data.allergies.length > 0 ? ` | Avoiding: ${data.allergies.join(', ')}` : ''}${data.customRestrictions?.trim() ? ` | Also avoiding: ${data.customRestrictions.trim()}` : ''}` : ''}
${hasPhotos ? '\nWORKOUT SPACE PHOTOS: attached below. Study them carefully.' : ''}

Write a thorough initial assessment in Markdown with these exact sections:

## Profile Assessment
Honestly assess the user's fitness profile. Relate the BMI (${bmiLabel(data.weight, data.height)}) to their stated goals and note any advantages or challenges in their starting point. Briefly note that BMI is one indicator among many and does not capture muscle mass or fitness level. Be direct but encouraging.

## Workout Space Analysis
${hasPhotos
  ? `Based on the photos, describe exactly what you observe: floor surface, available space, every piece of equipment or furniture visible. Note what exercises each item already enables. Be specific and name every object you can identify.`
  : `No photos were provided. Based solely on the stated equipment (${data.equipment.join(', ')}), describe the range of exercises available and any notable gaps.`}

## Space Recommendations
${hasPhotos
  ? `Suggest 2-4 specific, low-cost additions that would meaningfully expand training options in this space. For each item, explain exactly which exercises it unlocks.`
  : `Suggest 2-3 practical additions to the current equipment that would fill the most important gaps for these goals.`}

## Dietary Assessment
${hasDiet
  ? `Based on a ${data.dietType} approach (${data.mealsPerDay} meals/day${data.allergies.length > 0 ? `, avoiding ${data.allergies.join(', ')}` : ''}${data.customRestrictions?.trim() ? `; additional restrictions: ${data.customRestrictions.trim()}` : ''}), provide 3-4 specific nutrition priorities that will directly support the user's goals. Call out any potential nutrient gaps common with this diet type and how to address them with specific food choices that respect all restrictions. Include one practical tip on pre and post-workout nutrition.`
  : `No dietary preferences were provided. Give 3-4 foundational nutrition principles that would support the stated goals, focusing on protein intake, meal timing, and hydration.`}

## What to Expect
Set realistic expectations based on the goals and starting level. What will likely happen in week 1 vs week 4? What visible or measurable progress is realistic? Be honest, not overly optimistic.

Rules:
- Never use long dashes. Use commas, colons, or new sentences instead.
- No markdown tables.
- Write in second person (address the user directly using "you").
- Each section: 3-6 sentences or bullet points, no more.
- Bullet points use - not *.`
}

type MessageContent = Groq.Chat.ChatCompletionContentPart

export async function generateAnalysis(data: WorkoutFormData): Promise<string> {
  const content: MessageContent[] = [{ type: 'text', text: buildAnalysisPrompt(data) }]
  for (const dataUrl of data.images) {
    content.push({ type: 'image_url', image_url: { url: dataUrl } })
  }
  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 2048,
  })
  return completion.choices[0]?.message?.content ?? ''
}

export async function generateWorkoutPlan(data: WorkoutFormData): Promise<string> {
  const content: MessageContent[] = [{ type: 'text', text: buildPrompt(data) }]

  for (const dataUrl of data.images) {
    content.push({
      type: 'image_url',
      image_url: { url: dataUrl },
    })
  }

  const completion = await groq.chat.completions.create({
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
  goals: string[]     // JSON string e.g. '["Weight Loss"]'
  equipment: string[] // JSON string e.g. '["Dumbbells"]'
  timeOnPlan: string
  adherence: string
  originalWeight: string   // kg - from the plan being evolved
  originalHeight: string   // cm - from the plan being evolved
  currentWeight: string    // kg
  currentHeight: string    // cm
  physicalFeel: string
  difficulty: string       // "Too easy" | "Just right" | "Too hard"
  exercisesToRemove: string
  newInjuries: string
  newGoals: string[]
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

  const prompt = `You are an expert personal trainer conducting a progress review.

PROGRESS REPORT:
- Time on current plan: ${data.timeOnPlan}
- Adherence: ${data.adherence}
- Physical feel: ${data.physicalFeel}
- Perceived difficulty: ${data.difficulty}
- Exercises to remove/replace: ${data.exercisesToRemove || 'None'}
- New injuries or limitations: ${data.newInjuries || 'None'}
${data.newGoals.length > 0 ? `- New focus areas: ${data.newGoals.join(', ')}` : ''}

UPDATED BODY STATS:
- Weight: ${data.currentWeight} kg | Height: ${data.currentHeight} cm | BMI: ${bmiLabel(data.currentWeight, data.currentHeight)}

ORIGINAL FITNESS PROFILE:
- Level: ${data.fitnessLevel} | Goals: ${goals} | Equipment: ${equipment}

THE PLAN THEY HAVE BEEN FOLLOWING:
${data.originalPlan}

---

Trainer notes:
- ${progressionNote}
- ${consistencyNote}
- Replace every exercise listed in "Exercises to remove/replace" with a suitable alternative targeting the same muscle group
- Respect any new injuries. Avoid or modify affected movements.
${data.newGoals.length > 0 ? `- Shift emphasis toward: ${data.newGoals.join(', ')}` : ''}

Create the evolved plan using the EXACT same Markdown structure as the original.
Title: # ${data.userName}: Next Phase

After the Nutrition Tips section, add a "Your Stats" section:

## Your Stats
**Body Metrics:** Weight ${data.currentWeight} kg | Height ${data.currentHeight} cm | BMI ${bmiLabel(data.currentWeight, data.currentHeight)}

> **Note:** BMI is a general reference point. It does not account for muscle mass, body composition, age, or athletic background. Use it as context, not a verdict. Always listen to your body and consult a healthcare professional before starting any new exercise programme.

Rules:
- NEVER use markdown tables
- Include Weight: field on every exercise (kg range, Bodyweight, or band level)
- Mark swapped exercises with *(new)* after the name
- Mark increased weights/reps/sets with *(up)* after the value
- Every change must be explicit. No vague "adjust as needed".`

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 8192,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function generateReevaluationAnalysis(data: ReevaluationData): Promise<string> {
  const goals = (() => { try { return (JSON.parse(data.goals as unknown as string) as string[]).join(', ') } catch { return Array.isArray(data.goals) ? data.goals.join(', ') : data.goals } })()

  const weightDiff = (() => {
    const prev = parseFloat(data.originalWeight)
    const curr = parseFloat(data.currentWeight)
    if (!prev || !curr || isNaN(prev) || isNaN(curr)) return ''
    const diff = curr - prev
    if (Math.abs(diff) < 0.1) return ' (no change)'
    return ` (${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg since last plan)`
  })()

  const prompt = `You are an expert personal trainer conducting a formal progress review.

PHYSICAL PROGRESS:
- Previous: Weight ${data.originalWeight} kg, Height ${data.originalHeight} cm, BMI ${bmiLabel(data.originalWeight, data.originalHeight)}
- Current: Weight ${data.currentWeight} kg, Height ${data.currentHeight} cm, BMI ${bmiLabel(data.currentWeight, data.currentHeight)}${weightDiff ? `\n- Weight change: ${weightDiff}` : ''}

TRAINING REVIEW:
- Time on plan: ${data.timeOnPlan}
- Adherence: ${data.adherence}
- Physical feel: ${data.physicalFeel}
- Perceived difficulty: ${data.difficulty}
- Original goals: ${goals}
${data.newGoals.length > 0 ? `- New focus areas: ${data.newGoals.join(', ')}` : ''}
${data.exercisesToRemove ? `- Requested changes: ${data.exercisesToRemove}` : ''}
${data.newInjuries ? `- New limitations: ${data.newInjuries}` : ''}

Write a focused progress assessment in Markdown with these exact sections:

## Your Progress
Compare current stats to previous stats. Note the weight change and what it means given the goals (${goals}). If BMI changed, mention it. Be honest, specific, and encouraging.

## Training Assessment
Based on adherence (${data.adherence}), how they felt (${data.physicalFeel}), and difficulty (${data.difficulty}), evaluate how the last phase went. What does this tell us about fitness adaptation?

## What Changes in This Phase
Briefly explain what the evolved plan will adjust and why, given the data above. Be concrete.

Rules:
- Never use long dashes. Use commas, colons, or new sentences instead.
- No markdown tables.
- Write in second person, addressing the user directly using "you".
- Each section: 3-5 sentences. Be concise and specific.
- Bullet points use - not *.`

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1536,
  })
  return completion.choices[0]?.message?.content ?? ''
}

export interface FoodMacros {
  description: string
  kcal: number
  protein: number  // grams
  carbs: number    // grams
  fat: number      // grams
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
- Identify every food item visible in the image and sum all values.
- Round every number to the nearest integer.
- Use realistic average portion-size estimates based on what is visible.
- Never use long dashes in the description. Use commas instead.`
    : `Estimate the nutritional content for the following food or meal: "${description}"

Reply with ONLY valid JSON, no markdown, no extra text:
{
  "description": "cleaned-up, concise description of what was entered",
  "kcal": 350,
  "protein": 25,
  "carbs": 40,
  "fat": 8
}

Rules:
- If multiple items are listed, sum all values.
- Round every number to the nearest integer.
- Use realistic, average portion-size estimates.
- Never use long dashes in the description. Use commas instead.`

  const content: MessageContent[] = [{ type: 'text', text: textPrompt }]
  if (imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: imageDataUrl } })
  }

  const completion = await groq.chat.completions.create({
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
    kcal:    Math.round(parsed.kcal),
    protein: Math.round(parsed.protein),
    carbs:   Math.round(parsed.carbs),
    fat:     Math.round(parsed.fat),
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
  "primaryMuscles": ["muscle_id_1", "muscle_id_2"],
  "secondaryMuscles": ["muscle_id_3"]
}

For primaryMuscles and secondaryMuscles, use ONLY these canonical IDs (choose the ones that apply):
chest, front_delts, rear_delts, biceps, triceps, forearms,
abs, obliques, hip_flexors, adductors, quads, calves_front,
traps, rhomboids, lats, lower_back, glutes, hamstrings, calves`

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 512,
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

export async function sendChatMessage(
  messages: ChatMessage[],
  userContext: string,
): Promise<string> {
  const contextBlock = userContext
    ? `Here is what you know about this user:\n\n${userContext}`
    : 'No profile data is available yet for this user.'

  const systemPrompt = `You are Kai, Uplift's AI fitness and nutrition coach. You are professional, warm, and empathetic. You understand that fitness journeys are personal and sometimes hard, and you genuinely celebrate every step of progress.

STRICT SCOPE: You only discuss topics in these categories:
- Exercise: workout programming, exercise form, technique, sets, reps, progressions
- Nutrition: macros, meal timing, food choices, calorie targets, hydration, diet strategies
- Recovery: sleep, rest days, mobility, stretching, injury prevention and management
- Mindset: motivation, habit building, consistency, goal setting as it relates to fitness
- The Uplift app: how to use the Diet page, workout plan history, the Evolve feature, understanding their nutrition targets

OFF-TOPIC HANDLING: If the user asks about anything outside this scope (news, coding, relationships, pop culture, general knowledge, etc.), respond warmly but clearly: acknowledge their message with one short sentence, then explain that your expertise is strictly fitness and the Uplift app, and offer to help with something relevant. Never answer off-topic questions even partially, not even as a passing comment. Do not apologise excessively, just redirect naturally.

Example off-topic redirect: "That's outside my area of expertise. I'm here specifically for fitness, nutrition, and your Uplift journey. Is there anything about your training or diet I can help with?"

TONE GUIDELINES:
- Encouraging but never fake or over-the-top ("great question!" on every message is annoying, use it sparingly)
- Direct and specific: give actionable advice with numbers, not generic tips
- Empathetic: acknowledge when something sounds hard (sore muscles, missed sessions, plateaus) before offering advice
- Professional but conversational, like a knowledgeable friend who is also a certified trainer
- You are the face of Uplift. Every response reflects the brand: focused, honest, and genuinely helpful

FORMATTING:
- Use markdown (bullet points, bold) when it improves clarity
- Never use em dashes or en dashes. Use commas or colons instead
- Keep responses concise. If the answer needs detail, structure it clearly

${contextBlock}`

  const completion = await groq.chat.completions.create({
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
  const prompt = `You are given a photo of a workout plan (handwritten, printed, or on a screen). Extract every piece of information and reformat it using this EXACT Uplift Markdown structure.

# [Derive a short descriptive title from the plan content]

## Overview
One or two sentences describing what this plan is designed for, based solely on what you can read.

## Weekly Schedule
- **Monday:** [Workout focus or Rest] · [Duration if visible]
- **Tuesday:** [Workout focus or Rest] · [Duration if visible]
- **Wednesday:** [Workout focus or Rest] · [Duration if visible]
- **Thursday:** [Workout focus or Rest] · [Duration if visible]
- **Friday:** [Workout focus or Rest] · [Duration if visible]
- **Saturday:** [Workout focus or Rest] · [Duration if visible]
- **Sunday:** [Workout focus or Rest] · [Duration if visible]

## Day-by-Day Workouts

### Day 1: [Focus Area]

**Warm-Up** *(if present in the image)*
- [movement 1]
- [movement 2]

**Main Training**

**1. [Exercise Name]**
Sets: [X] × [Y reps or Z seconds] | Rest: [Ns] | Weight: [as written, or Bodyweight if no weight shown]
*Form tip: [only if a cue is visible in the image, otherwise omit this line]*

**2. [Exercise Name]**
Sets: [X] × [Y reps or Z seconds] | Rest: [Ns] | Weight: [as written, or Bodyweight]

[Continue numbering for all exercises in this session]

**Cool-Down** *(if present)*
- [stretch]

---

[Repeat the ### Day N: block for every training day. Separate each day with ---]

## Progression Plan
[Only include if progression notes are visible in the image. Otherwise omit this section entirely.]

Rules:
- Extract ONLY what is visible in the image. Never invent exercises, sets, or reps.
- If something is illegible write [unclear] in place of the value.
- Map visible training days to the correct days of the week. If the plan uses Day 1/2/3 without naming days, distribute them across the week sensibly and mark remaining days as Rest.
- Weight field: use what is written. If no weight is shown, write Bodyweight. If it is a band, write Light band / Medium band / Heavy band.
- Never use long dashes. Use commas or colons instead.
- Never use markdown tables.`

  const content: MessageContent[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ]

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content }],
    max_tokens: 4096,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function analyzeImportedPlan(plan: string, profileContext: string): Promise<string> {
  const prompt = `You are an expert personal trainer reviewing a workout plan that a user has imported.

${profileContext ? `USER PROFILE:\n${profileContext}\n` : ''}

IMPORTED PLAN:
${plan}

Write a concise analysis in Markdown with these exact sections:

## Plan Assessment
What type of plan is this and what is it designed for? Is it well-structured?

## Suitability for Your Goals
How well does this plan align with the user's stated goals and fitness level? Be direct.

## What Works Well
2-3 specific strengths of this plan.

## What Could Be Better
2-3 specific weaknesses or gaps, especially relative to the user's profile.

## Verdict
One clear recommendation: keep as-is, use with modifications, or generate a personalized plan instead.

Rules:
- Never use long dashes. Use commas or colons instead.
- No markdown tables.
- Write in second person.
- Each section: 2-4 sentences or bullet points.`

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1536,
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

  const prompt = `You are Kai, Uplift's AI support assistant. A user has submitted a support request. Your job is to:
1. Understand their issue
2. Write a clear, concise support ticket summary in Markdown

ISSUE CATEGORY: ${category}

USER'S DESCRIPTION:
"${description}"
${hasImage ? '\nThe user has attached a screenshot (shown below). Describe what you see in it if relevant to the issue.' : ''}

Write the support ticket in this exact format:

## Summary
One sentence describing the core issue.

## What the User Reported
Restate their issue clearly in 2-3 sentences, correcting any unclear language. Mention the screenshot if one was provided.

## Likely Cause
Your best guess at what might be causing this (1-2 sentences). If unsure, say so.

## Suggested Next Steps
2-3 bullet points for the support team to investigate or try.

Rules:
- Professional but conversational tone
- Never use long dashes. Use commas or colons instead.
- Keep it concise: this is a quick-scan ticket, not an essay
- If the description is vague, note that more detail may be needed`

  content.push({ type: 'text', text: prompt })
  if (imageDataUrl) {
    content.push({ type: 'image_url', image_url: { url: imageDataUrl } })
  }

  const completion = await groq.chat.completions.create({
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

EXISTING PLAN (for context on style, equipment, and intensity):
${planSnippet}

Task: Create a workout session for ${day} that fits seamlessly into this plan.

Requirements:
- Match the exercise format exactly: **Exercise Name** then Sets: X x Y reps | Rest: Zs | Weight: ...
- Include a warm-up (3-5 min) and a cool-down (3-5 min)
- Match the intensity, exercise types, and equipment of the existing plan
- Choose muscle groups that complement what is trained on nearby days (avoid overlap)
- Keep it the same session length as other days in the plan

Output ONLY the workout content. Start directly with **Warm-Up**. Do not include any day heading, preamble, or closing remarks.
No markdown tables. No long dashes. Bullet points use - not *.`

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
  })

  return completion.choices[0]?.message?.content ?? ''
}

export async function improveImportedPlan(plan: string, profileContext: string): Promise<string> {
  const prompt = `You are an expert personal trainer improving an existing workout plan to better suit a specific user.

${profileContext ? `USER PROFILE:\n${profileContext}\n` : ''}

EXISTING PLAN TO IMPROVE:
${plan}

Rewrite and improve this plan to better fit the user's profile. Keep the overall structure and intent of the original plan but fix weaknesses, fill gaps, and tailor it precisely to the user's goals, fitness level, and available equipment.

Output the improved plan in Markdown using this structure:

# Improved Workout Plan

## What Changed
3-4 bullet points explaining the key improvements made and why.

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
3-4 bullet points on how to progress over 4-6 weeks.

Rules:
- NEVER use markdown tables
- Every exercise must include sets, reps, rest, and weight
- Never use long dashes. Use commas or colons instead.
- Keep changes minimal but impactful, respect the spirit of the original`

  const completion = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 6144,
  })

  return completion.choices[0]?.message?.content ?? ''
}
