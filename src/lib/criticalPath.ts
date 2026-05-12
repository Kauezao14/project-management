import { parseISO } from 'date-fns'
import type { Task } from '../types/task'

export interface CpmNode {
  id: string
  duration: number   // horas
  predecessors: string[]
  successors: string[]
  es: number   // Early Start  (horas desde o início do projeto)
  ef: number   // Early Finish
  ls: number   // Late Start
  lf: number   // Late Finish
  float: number  // Folga total (0 = crítico)
}

export interface PoolPathInfo {
  poolId: string
  tasks: Task[]
  endMs: number
  floatH: number   // folga mínima das tarefas do pool, em horas
  isCritical: boolean
}

export interface ProjectPathInfo {
  projectId: string
  startMs: number
  endMs: number
  pools: PoolPathInfo[]
  criticalTaskIds: Set<string>
  nodes: Map<string, CpmNode>
}

/**
 * CPM completo: Forward Pass → Backward Pass → Folga
 * Considera predecessoras explícitas (task.predecessors) e
 * ordem sequencial dentro do mesmo pool (uma máquina, uma operação por vez).
 */
export function computeProjectPath(projectId: string, tasks: Task[]): ProjectPathInfo {
  const projectTasks = tasks.filter(t => t.projectId === projectId)
  const empty: ProjectPathInfo = {
    projectId, startMs: 0, endMs: 0,
    pools: [], criticalTaskIds: new Set(), nodes: new Map(),
  }
  if (projectTasks.length === 0) return empty

  const taskMap = new Map(projectTasks.map(t => [t.id, t]))

  // Ordem dentro do pool (apenas tarefas do projeto)
  const poolOrderMap = new Map<string, string[]>()
  for (const t of projectTasks) {
    if (!poolOrderMap.has(t.poolId)) poolOrderMap.set(t.poolId, [])
    poolOrderMap.get(t.poolId)!.push(t.id)
  }
  for (const [pid, ids] of poolOrderMap) {
    poolOrderMap.set(pid, ids.sort((a, b) => taskMap.get(a)!.order - taskMap.get(b)!.order))
  }

  // Monta os nós CPM com todas as dependências (pool + explícitas)
  const nodes = new Map<string, CpmNode>()
  for (const task of projectTasks) {
    const poolTasks = poolOrderMap.get(task.poolId) ?? []
    const poolIdx = poolTasks.indexOf(task.id)
    const poolPred = poolIdx > 0 ? poolTasks[poolIdx - 1] : null

    const allPreds = new Set<string>()
    if (poolPred) allPreds.add(poolPred)
    for (const id of task.predecessors ?? []) {
      if (taskMap.has(id)) allPreds.add(id)
    }

    nodes.set(task.id, {
      id: task.id,
      duration: task.durationHours,
      predecessors: [...allPreds],
      successors: [],
      es: 0, ef: 0, ls: 0, lf: 0, float: 0,
    })
  }

  // Preenche listas de sucessores
  for (const node of nodes.values()) {
    for (const predId of node.predecessors) {
      nodes.get(predId)?.successors.push(node.id)
    }
  }

  // Ordenação topológica (Kahn)
  const inDegree = new Map<string, number>()
  for (const [id, node] of nodes) inDegree.set(id, node.predecessors.length)
  const queue = [...nodes.keys()].filter(id => (inDegree.get(id) ?? 0) === 0)
  const topoOrder: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    topoOrder.push(id)
    for (const succId of nodes.get(id)!.successors) {
      const d = (inDegree.get(succId) ?? 1) - 1
      inDegree.set(succId, d)
      if (d === 0) queue.push(succId)
    }
  }

  // Forward Pass: ES e EF
  for (const id of topoOrder) {
    const node = nodes.get(id)!
    node.es = node.predecessors.length === 0
      ? 0
      : Math.max(...node.predecessors.map(p => nodes.get(p)!.ef))
    node.ef = node.es + node.duration
  }

  const projectFinish = Math.max(...[...nodes.values()].map(n => n.ef))

  // Backward Pass: LF e LS
  for (const id of [...topoOrder].reverse()) {
    const node = nodes.get(id)!
    node.lf = node.successors.length === 0
      ? projectFinish
      : Math.min(...node.successors.map(s => nodes.get(s)!.ls))
    node.ls = node.lf - node.duration
    node.float = Math.round((node.ls - node.es) * 1000) / 1000
  }

  // Tarefas críticas: folga = 0
  const criticalTaskIds = new Set<string>()
  for (const [id, node] of nodes) {
    if (node.float < 0.001) criticalTaskIds.add(id)
  }

  // Info por pool para exibição
  const pools: PoolPathInfo[] = []
  for (const [poolId, poolTaskIds] of poolOrderMap) {
    const poolTasks = poolTaskIds.map(id => taskMap.get(id)!).filter(Boolean)
    const poolNodes = poolTaskIds.map(id => nodes.get(id)!).filter(Boolean)
    const minFloat = poolNodes.length > 0 ? Math.min(...poolNodes.map(n => n.float)) : Infinity
    const isCritical = minFloat < 0.001
    const endMs = poolTasks.length > 0
      ? Math.max(...poolTasks.map(t => parseISO(t.scheduledEnd).getTime()))
      : 0

    pools.push({ poolId, tasks: poolTasks, endMs, floatH: minFloat, isCritical })
  }

  pools.sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1
    return b.endMs - a.endMs
  })

  const startMs = Math.min(...projectTasks.map(t => parseISO(t.scheduledStart).getTime()))
  const endMs = Math.max(...projectTasks.map(t => parseISO(t.scheduledEnd).getTime()))

  return { projectId, startMs, endMs, pools, criticalTaskIds, nodes }
}

export function computeAllCriticalTaskIds(tasks: Task[]): Set<string> {
  const projectIds = new Set(tasks.filter(t => t.projectId).map(t => t.projectId!))
  const result = new Set<string>()
  for (const pid of projectIds) {
    computeProjectPath(pid, tasks).criticalTaskIds.forEach(id => result.add(id))
  }
  return result
}
