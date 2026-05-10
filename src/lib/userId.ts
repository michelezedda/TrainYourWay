import { v4 as uuidv4 } from 'uuid'

const KEY = 'tyw_user_id'

let _authUserId: string | null = null

export function setAuthUserId(id: string | null) {
  _authUserId = id
}

export function getUserId(): string {
  if (_authUserId) return _authUserId
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = uuidv4()
    localStorage.setItem(KEY, id)
  }
  return id
}
