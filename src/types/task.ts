import type { ClientId } from './client'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'delayed'

export interface Task {
  id: string
  poolId: string
  clientId: ClientId
  title: string
  durationHours: number
  order: number
  status: TaskStatus
  scheduledStart: string // ISO
  scheduledEnd: string   // ISO
  notes?: string
  // PSG
  machineRef?: string
  maintenanceType?: 'assembly' | 'maintenance'
  // DOMINUS
  moldRef?: string
  quantity?: number
  // Scheduling modifiers
  overtime?: boolean       // estende o expediente além do horário normal
  overtimeHours?: number   // quantas horas extras (ex: 2)
  lunchWork?: boolean      // trabalha no intervalo de almoço
  // Project assignment
  projectId?: string
  // Delay tracking
  delayedSince?: string
  actualEnd?: string
}
