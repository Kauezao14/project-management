import { parseISO } from 'date-fns'
import { addWorkHours, snapToWorkStart, getEffectiveCalendar } from './workCalendar'
import type { Task } from '../types/task'
import type { Pool } from '../types/pool'
import type { ClientConfig } from '../types/client'
import type { Project } from '../types/project'

function effectiveEnd(task: Task): Date {
  return parseISO(task.actualEnd ?? task.scheduledEnd)
}

/**
 * Reagenda todas as tarefas respeitando:
 *  1. Ordem dentro do pool (uma máquina não pode fazer duas coisas ao mesmo tempo)
 *  2. Predecessoras explícitas entre pools (task.predecessors)
 * Usa ordenação topológica iterativa para garantir que toda dependência
 * seja processada antes da tarefa que depende dela.
 */
export function rescheduleAll(tasks: Task[], pools: Pool[], clients: ClientConfig[], projects: Project[] = []): void {
  const now = new Date()
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const clientMap = new Map(clients.map(c => [c.id, c]))
  const projectMap = new Map(projects.map(p => [p.id, p]))

  // Ordem das tarefas dentro de cada pool
  const poolOrder = new Map<string, string[]>()
  for (const pool of pools) {
    const sorted = tasks
      .filter(t => t.poolId === pool.id)
      .sort((a, b) => a.order - b.order)
      .map(t => t.id)
    poolOrder.set(pool.id, sorted)
  }

  // Todas as dependências de uma tarefa (pool + explícitas)
  function getDeps(task: Task): string[] {
    const deps = new Set<string>()
    // Predecessora do pool (tarefa anterior na mesma fila)
    const poolTasks = poolOrder.get(task.poolId) ?? []
    const idx = poolTasks.indexOf(task.id)
    if (idx > 0) deps.add(poolTasks[idx - 1])
    // Predecessoras explícitas (apenas as que existem)
    for (const id of task.predecessors ?? []) {
      if (taskMap.has(id)) deps.add(id)
    }
    return [...deps]
  }

  const scheduled = new Set<string>()
  const remaining = new Set(tasks.map(t => t.id))

  // Processa em rodadas até que nenhuma tarefa reste ou haja dependência circular
  let maxRounds = tasks.length + 1
  while (remaining.size > 0 && maxRounds-- > 0) {
    let progress = false
    for (const id of [...remaining]) {
      const task = taskMap.get(id)!
      const deps = getDeps(task)
      if (!deps.every(d => scheduled.has(d))) continue

      const client = clientMap.get(task.clientId)
      if (!client) { scheduled.add(id); remaining.delete(id); continue }

      const cal = client.workCalendar
      const effectiveCal = getEffectiveCalendar(cal, task)

      // Início = máximo entre (floor do projeto ou agora) e (fim de cada dependência)
      const proj = task.projectId ? projectMap.get(task.projectId) : undefined
      const floorDate = proj?.startDate ? parseISO(proj.startDate) : now
      let start = snapToWorkStart(floorDate, cal)
      for (const depId of deps) {
        const dep = taskMap.get(depId)!
        const depEnd = snapToWorkStart(effectiveEnd(dep), cal)
        if (depEnd > start) start = depEnd
      }

      task.scheduledStart = start.toISOString()
      task.scheduledEnd = addWorkHours(start, task.durationHours, effectiveCal).toISOString()
      scheduled.add(id)
      remaining.delete(id)
      progress = true
    }
    if (!progress) break // dependência circular — interrompe sem travar
  }
}
