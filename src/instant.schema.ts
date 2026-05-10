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
    waterLogs: i.entity({
      userId: i.string().indexed(),
      date: i.string().indexed(),
      glasses: i.number(),
      createdAt: i.number(),
    }),
    workoutCompletions: i.entity({
      userId: i.string().indexed(),
      date: i.string().indexed(),
      createdAt: i.number(),
    }),
    gymRatings: i.entity({
      barcode: i.string().indexed(),
      userId: i.string().indexed(),
      rating: i.number(),
      createdAt: i.number(),
    }),
    communityFinds: i.entity({
      barcode: i.string().indexed(),
      productName: i.string(),
      brand: i.string(),
      grade: i.string(),
      gradeColor: i.string(),
      imageUrl: i.string(),
      sharedBy: i.string().indexed(),
      sharedAt: i.number(),
    }),
    leaderboardEntries: i.entity({
      userId: i.string().indexed(),
      nickname: i.string(),
      workoutStreak: i.number(),
      mealStreak: i.number(),
      updatedAt: i.number(),
    }),
    healthLogs: i.entity({
      userId:     i.string().indexed(),
      date:       i.string().indexed(),
      steps:      i.number(),
      sleepHours: i.number(),
      createdAt:  i.number(),
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
    userProfiles: i.entity({
      userId:    i.string().indexed(),
      name:      i.string(),
      country:   i.string().optional(),
      language:  i.string().optional(),
      createdAt: i.number(),
    }),
  },
})

export type AppSchema = typeof _schema
export default _schema
