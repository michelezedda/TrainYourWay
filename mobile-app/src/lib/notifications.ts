import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export type PermissionStatus = 'granted' | 'denied' | 'undetermined'

export async function getNotificationPermission(): Promise<PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync()
  return status as PermissionStatus
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync()
  return status as PermissionStatus
}

export async function scheduleWorkoutReminder(hour = 9, minute = 0): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to train',
      body: "Your workout is waiting. Let's go.",
    },
    trigger: { hour, minute, repeats: true } as Notifications.NotificationTriggerInput,
  })
}

export async function scheduleMealReminder(hour = 12, minute = 30): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Log your meals',
      body: 'Keep your nutrition on track - log what you have eaten today.',
    },
    trigger: { hour, minute, repeats: true } as Notifications.NotificationTriggerInput,
  })
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
