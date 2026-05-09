import { i } from '@instantdb/react'

const _schema = i.schema({
  entities: {
    supportTickets: i.entity({
      userId: i.string().indexed(),
      category: i.string(),
      description: i.string(),
      draft: i.string(),
      hasScreenshot: i.boolean(),
      status: i.string(),
      createdAt: i.number().indexed(),
    }),
    mealEntries: i.entity({
      userId: i.string().indexed(),
      date: i.string().indexed(),    // "YYYY-MM-DD"
      meal: i.string(),              // "breakfast" | "lunch" | "dinner" | "snacks"
      description: i.string(),
      kcal: i.number(),
      protein: i.number(),
      carbs: i.number(),
      fat: i.number(),
      createdAt: i.number().indexed(),
    }),
    workoutPlans: i.entity({
      userId: i.string(),
      userName: i.string(),
      fitnessLevel: i.string(),
      goals: i.string(),
      equipment: i.string(),
      constraints: i.string(),
      plan: i.string(),
      createdAt: i.number(),
      parentPlanId: i.string().optional(),
      unavailableDays: i.string().optional(),
      dayOverrides: i.string().optional(),
      otherSports: i.string().optional(),
    }),
  },
})

export type AppSchema = typeof _schema
export default _schema
