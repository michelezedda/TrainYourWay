export interface HabitAlert {
  type: 'workout_streak' | 'meal_log' | 'water' | 'wellness'
  message: string
  emoji: string
}

export function analyzeWeeklyHabits(data: {
  workoutDates: string[]
  mealDates: string[]
  waterGlassesToday: number
  wellnessSessions: number
  today: string
}): HabitAlert[] {
  const alerts: HabitAlert[] = []
  const weekAgo = new Date(data.today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekCutoff = weekAgo.toISOString().slice(0, 10)

  const weekWorkouts = data.workoutDates.filter(d => d >= weekCutoff).length
  const weekMeals = data.mealDates.filter(d => d >= weekCutoff).length

  if (weekWorkouts === 0) {
    alerts.push({ type: 'workout_streak', message: 'No workouts logged this week. Get moving!', emoji: '💪' })
  } else if (weekWorkouts >= 4) {
    alerts.push({ type: 'workout_streak', message: `${weekWorkouts} workouts this week. Great consistency!`, emoji: '🔥' })
  }

  if (weekMeals < 5) {
    alerts.push({ type: 'meal_log', message: 'Log your meals consistently for better nutrition tracking.', emoji: '🥗' })
  }

  if (data.waterGlassesToday < 4) {
    alerts.push({ type: 'water', message: 'Stay hydrated. Aim for at least 8 glasses today.', emoji: '💧' })
  }

  if (data.wellnessSessions === 0) {
    alerts.push({ type: 'wellness', message: 'Try a mindfulness session today to support recovery.', emoji: '🧘' })
  }

  return alerts
}
