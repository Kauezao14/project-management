import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import {
  addDays, addWeeks, addMonths, startOfDay, startOfWeek, startOfMonth,
  parseISO, isAfter
} from 'date-fns'
import { rescheduleAll } from '../lib/scheduler'
import { saveState, loadState } from '../lib/persistence'
import { getViewportStart } from '../lib/ganttLayout'
import type { ClientConfig } from '../types/client'
import type { Pool } from '../types/pool'
import type { Task } from '../types/task'
import type { Project } from '../types/project'
import type { View } from '../types/app'

interface AppState {
  activeClient: string
  view: View
  viewportStart: string
  page: 'gantt' | 'projects'

  clients: ClientConfig[]
  pools: Pool[]
  tasks: Task[]
  projects: Project[]

  editingPoolId: string | null
  editingTaskId: string | null
  addingTaskToPoolId: string | null
  showClientSelector: boolean

  setClient: (id: string) => void
  setView: (v: View) => void
  setPage: (p: 'gantt' | 'projects') => void
  navigateViewport: (direction: -1 | 1) => void
  setViewportStart: (date: Date) => void
  setShowClientSelector: (v: boolean) => void

  addClient: (data: Omit<ClientConfig, 'id' | 'createdAt' | 'taskExtraFields'>) => string
  updateClient: (id: string, data: Partial<Omit<ClientConfig, 'id' | 'createdAt'>>) => void
  deleteClient: (id: string) => void

  addProject: (name: string, color: string) => string
  updateProject: (id: string, data: { name?: string; color?: string }) => void
  deleteProject: (id: string) => void

  addPool: (name: string) => void
  updatePool: (id: string, name: string) => void
  deletePool: (id: string) => void
  setEditingPool: (id: string | null) => void
  setAddingTaskToPool: (id: string | null) => void

  addTask: (poolId: string, data: Omit<Task, 'id' | 'poolId' | 'clientId' | 'order' | 'scheduledStart' | 'scheduledEnd'>) => void
  updateTask: (id: string, data: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (taskId: string, toPoolId: string, toIndex: number) => void
  setEditingTask: (id: string | null) => void
  markDelayed: (taskId: string, actualEnd?: Date) => void
  markCompleted: (taskId: string) => void
  markInProgress: (taskId: string) => void
  checkAndPropagateDelays: () => void
}

const savedState = loadState()

const initialViewportStart = savedState
  ? savedState.viewportStart
  : getViewportStart('weekly', new Date()).toISOString()

export const useStore = create<AppState>()(
  immer((set) => ({
    activeClient: savedState?.activeClient ?? '',
    view: savedState?.view ?? 'weekly',
    viewportStart: initialViewportStart,
    page: 'gantt',
    clients: savedState?.clients ?? [],
    pools: savedState?.pools ?? [],
    tasks: savedState?.tasks ?? [],
    projects: savedState?.projects ?? [],
    editingPoolId: null,
    editingTaskId: null,
    addingTaskToPoolId: null,
    showClientSelector: !savedState || (savedState.clients?.length ?? 0) === 0,

    setClient: (id) => set(s => { s.activeClient = id; s.showClientSelector = false }),
    setPage: (p) => set(s => { s.page = p }),
    setView: (v) => set(s => {
      s.view = v
      s.viewportStart = getViewportStart(v, parseISO(s.viewportStart)).toISOString()
    }),
    navigateViewport: (dir) => set(s => {
      const base = parseISO(s.viewportStart)
      let next: Date
      if (s.view === 'daily') next = startOfDay(addDays(base, dir))
      else if (s.view === 'weekly') next = startOfWeek(addWeeks(base, dir), { weekStartsOn: 1 })
      else next = startOfMonth(addMonths(base, dir))
      s.viewportStart = next.toISOString()
    }),
    setViewportStart: (date) => set(s => {
      s.viewportStart = getViewportStart(s.view, date).toISOString()
    }),
    setShowClientSelector: (v) => set(s => { s.showClientSelector = v }),

    addClient: (data) => {
      const id = nanoid()
      set(s => {
        s.clients.push({ ...data, id, taskExtraFields: [], createdAt: new Date().toISOString() })
      })
      return id
    },
    updateClient: (id, data) => set(s => {
      const c = s.clients.find(c => c.id === id)
      if (c) Object.assign(c, data)
    }),
    deleteClient: (id) => set(s => {
      s.clients = s.clients.filter(c => c.id !== id)
      s.pools = s.pools.filter(p => p.clientId !== id)
      s.tasks = s.tasks.filter(t => t.clientId !== id)
      s.projects = s.projects.filter(p => p.clientId !== id)
      if (s.activeClient === id) {
        s.activeClient = s.clients[0]?.id ?? ''
        s.showClientSelector = s.clients.length === 0
      }
    }),

    addProject: (name, color) => {
      const id = nanoid()
      set(s => {
        s.projects.push({ id, clientId: s.activeClient, name, color, createdAt: new Date().toISOString() })
      })
      return id
    },
    updateProject: (id, data) => set(s => {
      const p = s.projects.find(p => p.id === id)
      if (p) Object.assign(p, data)
    }),
    deleteProject: (id) => set(s => {
      s.projects = s.projects.filter(p => p.id !== id)
      s.tasks.forEach(t => { if (t.projectId === id) delete t.projectId })
    }),

    addPool: (name) => set(s => {
      const maxOrder = s.pools.filter(p => p.clientId === s.activeClient).reduce((m, p) => Math.max(m, p.order), -1)
      s.pools.push({
        id: nanoid(), clientId: s.activeClient, name,
        order: maxOrder + 1, createdAt: new Date().toISOString(),
      })
    }),
    updatePool: (id, name) => set(s => {
      const p = s.pools.find(p => p.id === id)
      if (p) p.name = name
    }),
    deletePool: (id) => set(s => {
      s.pools = s.pools.filter(p => p.id !== id)
      s.tasks = s.tasks.filter(t => t.poolId !== id)
    }),
    setEditingPool: (id) => set(s => { s.editingPoolId = id }),
    setAddingTaskToPool: (id) => set(s => { s.addingTaskToPoolId = id }),

    addTask: (poolId, data) => set(s => {
      const pool = s.pools.find(p => p.id === poolId)
      if (!pool) return
      const poolTasks = s.tasks.filter(t => t.poolId === poolId)
      const maxOrder = poolTasks.reduce((m, t) => Math.max(m, t.order), -1)

      // Placeholder dates — rescheduleAll will fix them
      s.tasks.push({
        ...data,
        id: nanoid(),
        poolId,
        clientId: pool.clientId,
        order: maxOrder + 1,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date().toISOString(),
        status: data.status ?? 'pending',
      })
      rescheduleAll(s.tasks, s.pools, s.clients)
    }),

    updateTask: (id, data) => set(s => {
      const task = s.tasks.find(t => t.id === id)
      if (!task) return
      Object.assign(task, data)
      rescheduleAll(s.tasks, s.pools, s.clients)
    }),

    deleteTask: (id) => set(s => {
      s.tasks = s.tasks.filter(t => t.id !== id)
      // Remove referências a esta tarefa nas predecessoras
      s.tasks.forEach(t => {
        if (t.predecessors?.includes(id)) {
          t.predecessors = t.predecessors.filter(p => p !== id)
        }
      })
      // Re-indexa orders por pool
      const pools = new Set(s.tasks.map(t => t.poolId))
      for (const poolId of pools) {
        s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
          .forEach((t, i) => { t.order = i })
      }
      rescheduleAll(s.tasks, s.pools, s.clients)
    }),

    moveTask: (taskId, toPoolId, toIndex) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (!task) return
      const targetPool = s.pools.find(p => p.id === toPoolId)
      if (!targetPool) return

      const sourceTasks = s.tasks
        .filter(t => t.poolId === task.poolId && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
      sourceTasks.forEach((t, i) => { t.order = i })

      const targetTasks = s.tasks
        .filter(t => t.poolId === toPoolId && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
      targetTasks.splice(toIndex, 0, task)
      targetTasks.forEach((t, i) => { t.order = i })

      task.poolId = toPoolId
      task.clientId = targetPool.clientId

      rescheduleAll(s.tasks, s.pools, s.clients)
    }),

    setEditingTask: (id) => set(s => { s.editingTaskId = id }),

    markDelayed: (taskId, actualEnd) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (!task) return
      task.status = 'delayed'
      if (!task.delayedSince) task.delayedSince = new Date().toISOString()
      if (actualEnd) task.actualEnd = actualEnd.toISOString()
      rescheduleAll(s.tasks, s.pools, s.clients)
    }),

    markCompleted: (taskId) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (task) {
        task.status = 'completed'
        task.actualEnd = task.actualEnd ?? new Date().toISOString()
      }
      rescheduleAll(s.tasks, s.pools, s.clients)
    }),

    markInProgress: (taskId) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (task) task.status = 'in_progress'
    }),

    checkAndPropagateDelays: () => set(s => {
      const now = new Date()
      let changed = false
      for (const task of s.tasks) {
        if (task.status === 'in_progress' && isAfter(now, parseISO(task.scheduledEnd))) {
          if (!task.delayedSince) {
            task.status = 'delayed'
            task.delayedSince = now.toISOString()
            changed = true
          }
        }
      }
      if (changed) rescheduleAll(s.tasks, s.pools, s.clients)
    }),
  }))
)

useStore.subscribe((state) => {
  saveState({
    activeClient: state.activeClient,
    clients: state.clients,
    view: state.view,
    viewportStart: state.viewportStart,
    pools: state.pools,
    tasks: state.tasks,
    projects: state.projects,
  })
})
