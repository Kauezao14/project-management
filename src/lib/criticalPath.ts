import { parseISO } from 'date-fns'
import type { Task } from '../types/task'

export interface PoolPathInfo {
  poolId: string
  tasks: Task[]
  endMs: number
  floatMs: number
  isCritical: boolean
}

export interface ProjectPathInfo {
  projectId: string
  startMs: number
  endMs: number
  pools: PoolPathInfo[]
  criticalTaskIds: Set<string>
}

function effectiveEnd(task: Task): number {
  return parseISO(task.actualEnd ?? task.scheduledEnd).getTime()
}

export function computeProjectPath(projectId: string, tasks: Task[]): ProjectPathInfo {
  const projectTasks = tasks.filter(t => t.projectId === projectId)

  if (projectTasks.length === 0) {
    return { projectId, startMs: 0, endMs: 0, pools: [], criticalTaskIds: new Set() }
  }

  const startMs = Math.min(...projectTasks.map(t => parseISO(t.scheduledStart).getTime()))
  const endMs = Math.max(...projectTasks.map(t => effectiveEnd(t)))

  // Group by pool
  const byPool = new Map<string, Task[]>()
  for (const t of projectTasks) {
    if (!byPool.has(t.poolId)) byPool.set(t.poolId, [])
    byPool.get(t.poolId)!.push(t)
  }

  const criticalTaskIds = new Set<string>()
  const pools: PoolPathInfo[] = []

  for (const [poolId, poolTasks] of byPool) {
    const sorted = [...poolTasks].sort((a, b) => a.order - b.order)
    const poolEndMs = Math.max(...sorted.map(t => effectiveEnd(t)))
    const floatMs = endMs - poolEndMs
    const isCritical = floatMs === 0

    if (isCritical) sorted.forEach(t => criticalTaskIds.add(t.id))

    pools.push({ poolId, tasks: sorted, endMs: poolEndMs, floatMs, isCritical })
  }

  // Sort pools: critical first, then by end time desc
  pools.sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1
    return b.endMs - a.endMs
  })

  return { projectId, startMs, endMs, pools, criticalTaskIds }
}

export function computeAllCriticalTaskIds(tasks: Task[]): Set<string> {
  const projectIds = new Set(tasks.filter(t => t.projectId).map(t => t.projectId!))
  const result = new Set<string>()
  for (const pid of projectIds) {
    const info = computeProjectPath(pid, tasks)
    info.criticalTaskIds.forEach(id => result.add(id))
  }
  return result
}
