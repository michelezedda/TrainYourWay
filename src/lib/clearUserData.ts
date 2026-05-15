/**
 * Wipes all local state tied to a user account.
 * Call on account deletion. Pass userId to also clear the per-user onboarding flag.
 */
export function clearAllLocalData(userId?: string): void {
  // Fixed keys
  const fixed = [
    'tyw_user_id',
    'tyw_avatar',
    'tyw_scan_history',
    'tyw_notif_seen',
    'tyw_lb_ts',
    'tyw_notif_ts',
    'uplift_nutrition_profile',
    'uplift_unit',
    'injury_state',
    'wellness_moods',
    'wellness_journal',
    'wellness_sessions',
  ]
  if (userId) fixed.push(`onb_${userId}`)
  fixed.forEach(k => localStorage.removeItem(k))

  // Pattern-keyed: uplift_weights_<planId>, onb_<anyUserId>
  const dynamic: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && (k.startsWith('uplift_weights_') || k.startsWith('onb_'))) {
      dynamic.push(k)
    }
  }
  dynamic.forEach(k => localStorage.removeItem(k))

  // Wipe any in-flight questionnaire / pending-plan state
  sessionStorage.clear()
}
