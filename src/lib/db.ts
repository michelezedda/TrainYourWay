import { init } from '@instantdb/react'
import schema from '@/instant.schema'

const appId = (import.meta.env.VITE_INSTANTDB_APP_ID as string) || 'missing-app-id'

export const db = init({ appId, schema })
