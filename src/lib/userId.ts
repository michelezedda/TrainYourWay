import { v4 as uuidv4 } from 'uuid'

const KEY = 'tyw_user_id'

export function getUserId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = uuidv4()
    localStorage.setItem(KEY, id)
  }
  return id
}
