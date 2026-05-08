import type { ClientId } from './client'

export interface Pool {
  id: string
  clientId: ClientId
  name: string
  order: number
  createdAt: string
}
