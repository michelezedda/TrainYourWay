import { init } from '@instantdb/react-native'
import schema from '@/instant.schema'

const appId = process.env.EXPO_PUBLIC_INSTANTDB_APP_ID ?? 'missing-app-id'

export const db = init({ appId, schema })
