import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import {
  addDays, addWeeks, addMonths, startOfDay, startOfWeek, startOfMonth,
  parseISO, isAfter
} from 'date-fns'
import { addWorkHours, snapToWorkStart, getEffectiveCalendar } from '../lib/workCalendar'
import { saveState, loadState } from '../lib/persistence'
import { getViewportStart } from '../lib/ganttLayout'
import type { ClientConfig, WorkCalendar } from '../types/client'
import type { Pool } from '../types/pool'
import type { Task } from '../types/task'
import type { Project } from '../types/project'
import type { View } from '../types/app'

interface AppState {
  // App-level
  activeClient: string
  view: View
  viewportStart: string
  page: 'gantt' | 'projects'

  // Data
  clients: ClientConfig[]
  pools: Pool[]
  tasks: Task[]
  projects: Project[]

  // UI state
  editingPoolId: string | null
  editingTaskId: string | null
  addingTaskToPoolId: string | null
  showClientSelector: boolean

  // App actions
  setClient: (id: string) => void
  setView: (v: View) => void
  setPage: (p: 'gantt' | 'projects') => void
  navigateViewport: (direction: -1 | 1) => void
  setViewportStart: (date: Date) => void
  setShowClientSelector: (v: boolean) => void

  // Client actions
  addClient: (data: Omit<ClientConfig, 'id' | 'createdAt' | 'taskExtraFields'>) => string
  updateClient: (id: string, data: Partial<Omit<ClientConfig, 'id' | 'createdAt'>>) => void
  deleteClient: (id: string) => void

  // Project actions
  addProject: (name: string, color: string) => string
  updateProject: (id: string, data: { name?: string; color?: string }) => void
  deleteProject: (id: string) => void

  // Pool actions
  addPool: (name: string) => void
  updatePool: (id: string, name: string) => void
  deletePool: (id: string) => void
  setEditingPool: (id: string | null) => void
  setAddingTaskToPool: (id: string | null) => void

  // Task actions
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

function _recalculatePool(tasks: Task[], poolId: string, cal: WorkCalendar) {
  const poolTasks = tasks
    .filter(t => t.poolId === poolId)
    .sort((a, b) => a.order - b.order)

  if (poolTasks.length === 0) return

  const now = new Date()
  let cursor = snapToWorkStart(now, cal)

  for (const task of poolTasks) {
    const t = tasks.find(t => t.id === task.id)!
    const effectiveCal = getEffectiveCalendar(cal, t)
    t.scheduledStart = cursor.toISOString()
    t.scheduledEnd = addWorkHours(cursor, t.durationHours, effectiveCal).toISOString()
    cursor = snapToWorkStart(parseISO(t.scheduledEnd), cal)
  }
}

function _propagateDelayFrom(tasks: Task[], poolId: string, fromIndex: number, cal: WorkCalendar) {
  const poolTasks = tasks
    .filter(t => t.poolId === poolId)
    .sort((a, b) => a.order - b.order)

  if (fromIndex >= poolTasks.length) return

  const delayedTask = poolTasks[fromIndex]
  const delayedInStore = tasks.find(t => t.id === delayedTask.id)!
  let cursor = parseISO(delayedInStore.actualEnd ?? delayedInStore.scheduledEnd)
  cursor = snapToWorkStart(cursor, cal)

  for (let i = fromIndex + 1; i < poolTasks.length; i++) {
    const t = tasks.find(t => t.id === poolTasks[i].id)!
    if (t.status === 'completed') {
      cursor = parseISO(t.scheduledEnd)
      continue
    }
    t.scheduledStart = cursor.toISOString()
    t.scheduledEnd = addWorkHours(cursor, t.durationHours, cal).toISOString()
    t.status = 'delayed'
    if (!t.delayedSince) t.delayedSince = new Date().toISOString()
    cursor = parseISO(t.scheduledEnd)
    cursor = snapToWorkStart(cursor, cal)
  }
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
        s.clients.push({
          ...data,
          id,
          taskExtraFields: [],
          createdAt: new Date().toISOString(),
        })
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
        id: nanoid(),
        clientId: s.activeClient,
        name,
        order: maxOrder + 1,
        createdAt: new Date().toISOString(),
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
      const client = s.clients.find(c => c.id === pool.clientId)
      if (!client) return
      const cal = client.workCalendar
      const poolTasks = s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
      const maxOrder = poolTasks.reduce((m, t) => Math.max(m, t.order), -1)

      let startDate: Date
      if (poolTasks.length > 0) {
        const lastTask = poolTasks[poolTasks.length - 1]
        startDate = snapToWorkStart(parseISO(lastTask.scheduledEnd), cal)
      } else {
        startDate = snapToWorkStart(new Date(), cal)
      }

      const scheduledStart = startDate.toISOString()
      const effectiveCal = getEffectiveCalendar(cal, data as Pick<typeof data, 'overtime' | 'lunchWork'>)
      const scheduledEnd = addWorkHours(startDate, data.durationHours, effectiveCal).toISOString()

      s.tasks.push({
        ...data,
        id: nanoid(),
        poolId,
        clientId: pool.clientId,
        order: maxOrder + 1,
        scheduledStart,
        scheduledEnd,
        status: data.status ?? 'pending',
      })
    }),

    updateTask: (id, data) => set(s => {
      const task = s.tasks.find(t => t.id === id)
      if (!task) return
      Object.assign(task, data)
      if ('durationHours' in data || 'overtime' in data || 'lunchWork' in data) {
        const pool = s.pools.find(p => p.id === task.poolId)
        const client = pool ? s.clients.find(c => c.id === pool.clientId) : null
        if (client) _recalculatePool(s.tasks, task.poolId, client.workCalendar)
      }
    }),

    deleteTask: (id) => set(s => {
      const task = s.tasks.find(t => t.id === id)
      if (!task) return
      const { poolId, clientId } = task
      s.tasks = s.tasks.filter(t => t.id !== id)
      const poolTasks = s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
      poolTasks.forEach((t, i) => { t.order = i })
      const client = s.clients.find(c => c.id === clientId)
      if (client) _recalculatePool(s.tasks, poolId, client.workCalendar)
    }),

    moveTask: (taskId, toPoolId, toIndex) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (!task) return

      const sourcePoolId = task.poolId
      const sourceClientId = task.clientId
      const targetPool = s.pools.find(p => p.id === toPoolId)
      if (!targetPool) return

      const sourceTasks = s.tasks
        .filter(t => t.poolId === sourcePoolId && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
      sourceTasks.forEach((t, i) => { t.order = i })

      const targetTasks = s.tasks
        .filter(t => t.poolId === toPoolId && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
      targetTasks.splice(toIndex, 0, task)
      targetTasks.forEach((t, i) => { t.order = i })

      task.poolId = toPoolId
      task.clientId = targetPool.clientId

      const sourceClient = s.clients.find(c => c.id === sourceClientId)
      const targetClient = s.clients.find(c => c.id === targetPool.clientId)
      if (sourceClient) _recalculatePool(s.tasks, sourcePoolId, sourceClient.workCalendar)
      if (targetClient) _recalculatePool(s.tasks, toPoolId, targetClient.workCalendar)
    }),

    setEditingTask: (id) => set(s => { s.editingTaskId = id }),

    markDelayed: (taskId, actualEnd) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (!task) return
      const pool = s.pools.find(p => p.id === task.poolId)
      const client = pool ? s.clients.find(c => c.id === pool.clientId) : null
      if (!client) return

      task.status = 'delayed'
      if (!task.delayedSince) task.delayedSince = new Date().toISOString()
      if (actualEnd) task.actualEnd = actualEnd.toISOString()

      const poolTasks = s.tasks
        .filter(t => t.poolId === task.poolId)
        .sort((a, b) => a.order - b.order)
      const fromIndex = poolTasks.findIndex(t => t.id === taskId)
      _propagateDelayFrom(s.tasks, task.poolId, fromIndex, client.workCalendar)
    }),

    markCompleted: (taskId) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (task) {
        task.status = 'completed'
        task.actualEnd = task.actualEnd ?? new Date().toISOString()
      }
    }),

    markInProgress: (taskId) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (task) task.status = 'in_progress'
    }),

    checkAndPropagateDelays: () => set(s => {
      const now = new Date()
      const poolsToRecalc = new Set<string>()

      for (const task of s.tasks) {
        if (task.status === 'in_progress' && isAfter(now, parseISO(task.scheduledEnd))) {
          if (!task.delayedSince) {
            task.status = 'delayed'
            task.delayedSince = now.toISOString()
            poolsToRecalc.add(task.poolId)
          }
        }
      }

      for (const poolId of poolsToRecalc) {
        const pool = s.pools.find(p => p.id === poolId)
        const client = pool ? s.clients.find(c => c.id === pool.clientId) : null
        if (!client) continue
        const poolTasks = s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
        const firstDelayed = poolTasks.findIndex(t => t.status === 'delayed')
        if (firstDelayed >= 0) {
          _propagateDelayFrom(s.tasks, poolId, firstDelayed, client.workCalendar)
        }
      }
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
