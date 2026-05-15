import { useMemo, useState } from 'react'
import {
  analyzeWeekNutrition,
  analyzeWeekScans,
  getHabitAlerts,
  type HabitAlert,
} from '@/lib/habits'
import { requestNotificationPermission, getNotificationPermission, fireNotification } from '@/lib/notifications'
import type { ScanHistoryEntry } from '@/lib/openFoodFacts'
import { useLocale } from '@/context/LocaleContext'

interface Props {
  mealEntries: Array<{ date: string; kcal?: number; protein?: number; carbs?: number; fat?: number }>
  targets: { kcal: number; protein: number; carbs: number; fat: number }
  scanHistory: ScanHistoryEntry[]
  todayProtein: number
  today: string
}

const ALERT_STYLE: Record<HabitAlert['severity'], { bg: string; color: string; icon: string }> = {
  warn:    { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', icon: '!' },
  info:    { bg: 'rgba(96,165,250,0.1)',  color: '#93c5fd', icon: '→' },
  success: { bg: 'rgba(34,197,94,0.1)',   color: '#86efac', icon: '✓' },
}

function MacroBar({
  label, avg, target, color,
}: { label: string; avg: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(avg / target, 1) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-white/35 text-[11px] w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
      <span className="text-[11px] w-20 text-right shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {avg}<span style={{ color: 'rgba(255,255,255,0.2)' }}>/{target}</span>
      </span>
    </div>
  )
}

export default function WeeklyInsights({ mealEntries, targets, scanHistory, todayProtein, today }: Props) {
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(getNotificationPermission)
  const { weekStart } = useLocale()

  const nutrition = useMemo(
    () => analyzeWeekNutrition(mealEntries, targets, today, weekStart),
    [mealEntries, targets, today, weekStart],
  )
  const scans = useMemo(
    () => analyzeWeekScans(scanHistory, today),
    [scanHistory, today],
  )
  const alerts = useMemo(
    () => getHabitAlerts(nutrition, scans, todayProtein, targets),
    [nutrition, scans, todayProtein, targets],
  )

  // Fire browser notifications once per day per alert
  if (notifPerm === 'granted') {
    alerts.forEach(a => {
      if (a.id === 'protein-close')  fireNotification(a.id, 'Almost there',       a.message)
      if (a.id === 'poor-scans')     fireNotification(a.id, 'Watch your choices', a.message)
      if (a.id === 'protein-streak') fireNotification(a.id, 'Crushing it',        a.message)
      if (a.id === 'low-protein')    fireNotification(a.id, 'Protein check',      a.message)
    })
  }

  const scanScore = scans.total > 0 ? Math.round((scans.healthy / scans.total) * 100) : null
  const scanHealthy = scanScore !== null && scanScore >= 70

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/80">This week</span>
        {nutrition.daysLogged > 0 && (
          <span
            className="text-[11px] rounded-full px-2.5 py-0.5"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
          >
            {nutrition.daysLogged} day{nutrition.daysLogged !== 1 ? 's' : ''} logged
          </span>
        )}
      </div>

      {/* Nutrition bars */}
      {nutrition.daysLogged === 0 ? (
        <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Log meals in Diet to see weekly insights.
        </p>
      ) : (
        <div className="space-y-2.5">
          <MacroBar label="Protein"  avg={nutrition.avgProtein} target={targets.protein} color="#a855f7" />
          <MacroBar label="Calories" avg={nutrition.avgKcal}    target={targets.kcal}    color="#22d3ee" />
          <MacroBar label="Carbs"    avg={nutrition.avgCarbs}   target={targets.carbs}   color="#fb923c" />
          <MacroBar label="Fat"      avg={nutrition.avgFat}     target={targets.fat}     color="#f472b6" />
        </div>
      )}

      {/* Scanner score */}
      {scans.total > 0 && (
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Scanner choices</span>
          <span
            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              background: scanHealthy ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color:      scanHealthy ? '#86efac'               : '#f87171',
            }}
          >
            {scans.healthy}/{scans.total} healthy
          </span>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          className="space-y-1.5 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {alerts.map(alert => {
            const s = ALERT_STYLE[alert.severity]
            return (
              <div
                key={alert.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: s.bg }}
              >
                <span className="text-[11px] font-bold w-3 shrink-0" style={{ color: s.color }}>{s.icon}</span>
                <span className="text-[12px]" style={{ color: s.color }}>{alert.message}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Notification opt-in */}
      {notifPerm === 'default' && (
        <button
          onClick={async () => {
            const perm = await requestNotificationPermission()
            setNotifPerm(perm)
          }}
          className="w-full py-2 rounded-xl text-[12px] transition-colors"
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.38)',
          }}
        >
          Enable goal alerts
        </button>
      )}
    </div>
  )
}
