import { storageGetAllKeys, storageMultiRemove } from './storage'

export async function clearAllLocalData(userId?: string): Promise<void> {
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

  const allKeys = await storageGetAllKeys()
  const dynamic = allKeys.filter(k => k.startsWith('uplift_weights_') || k.startsWith('onb_'))

  await storageMultiRemove([...fixed, ...dynamic])
}
