import { STORAGE_KEY } from '../config/constants'
import type { ClientId } from '../types/client'
import type { Pool } from '../types/pool'
import type { Task } from '../types/task'
import type { View } from '../types/app'

export interface PersistedState {
  activeClient: ClientId
  pools: Pool[]
  tasks: Task[]
  view: View
  viewportStart: string
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PersistedState) : null
  } catch {
    return null
  }
}
