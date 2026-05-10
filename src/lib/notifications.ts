const SEEN_KEY = 'tyw_notif_seen'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSeenToday(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as { date: string; ids: string[] }
    return parsed.date === todayStr() ? new Set(parsed.ids) : new Set()
  } catch { return new Set() }
}

function markSeen(id: string) {
  const seen = getSeenToday()
  seen.add(id)
  localStorage.setItem(SEEN_KEY, JSON.stringify({ date: todayStr(), ids: [...seen] }))
}

export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function fireNotification(id: string, title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (getSeenToday().has(id)) return
  markSeen(id)
  new Notification(title, { body, icon: '/logo.png' })
}
