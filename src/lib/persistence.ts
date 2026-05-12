import { STORAGE_KEY } from '../config/constants'
import type { ClientConfig } from '../types/client'
import type { Pool } from '../types/pool'
import type { Task } from '../types/task'
import type { View } from '../types/app'

export interface PersistedState {
  activeClient: string
  clients: ClientConfig[]
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
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    // Migrate old data that had hardcoded PSG/DOMINUS but no clients array
    if (!parsed.clients || parsed.clients.length === 0) {
      return { ...parsed, clients: [], activeClient: '', pools: [], tasks: [] }
    }
    return parsed
  } catch {
    return null
  }
}
