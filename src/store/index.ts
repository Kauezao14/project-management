import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import {
  addDays, addWeeks, addMonths, startOfDay, startOfWeek, startOfMonth,
  parseISO, isAfter
} from 'date-fns'
import { CLIENT_CONFIGS } from '../config/clients'
import { addWorkHours, snapToWorkStart, getEffectiveCalendar } from '../lib/workCalendar'
import { saveState, loadState } from '../lib/persistence'
import { getViewportStart } from '../lib/ganttLayout'
import type { ClientId } from '../types/client'
import type { Pool } from '../types/pool'
import type { Task } from '../types/task'
import type { View } from '../types/app'

interface AppState {
  // App-level
  activeClient: ClientId
  view: View
  viewportStart: string // ISO date string

  // Data
  pools: Pool[]
  tasks: Task[]

  // UI state
  selectedPoolId: string | null
  editingPoolId: string | null
  editingTaskId: string | null
  addingTaskToPoolId: string | null
  showClientSelector: boolean

  // App actions
  setClient: (id: ClientId) => void
  setView: (v: View) => void
  navigateViewport: (direction: -1 | 1) => void
  setViewportStart: (date: Date) => void
  setShowClientSelector: (v: boolean) => void

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

function _recalculatePool(tasks: Task[], poolId: string, clientId: ClientId) {
  const cal = CLIENT_CONFIGS[clientId].workCalendar
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
    cursor = snapToWorkStart(parseISO(t.scheduledEnd), cal) // próxima tarefa usa cal base
  }
}

function _propagateDelayFrom(tasks: Task[], poolId: string, fromIndex: number, clientId: ClientId) {
  const cal = CLIENT_CONFIGS[clientId].workCalendar
  const poolTasks = tasks
    .filter(t => t.poolId === poolId)
    .sort((a, b) => a.order - b.order)

  if (fromIndex >= poolTasks.length) return

  // Find the actual cursor from the delayed task's actualEnd or scheduledEnd
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
    activeClient: savedState?.activeClient ?? 'PSG',
    view: savedState?.view ?? 'weekly',
    viewportStart: initialViewportStart,
    pools: savedState?.pools ?? [],
    tasks: savedState?.tasks ?? [],
    selectedPoolId: null,
    editingPoolId: null,
    editingTaskId: null,
    addingTaskToPoolId: null,
    showClientSelector: !savedState,

    setClient: (id) => set(s => { s.activeClient = id; s.showClientSelector = false }),
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
      const cal = CLIENT_CONFIGS[pool.clientId].workCalendar
      const poolTasks = s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
      const maxOrder = poolTasks.reduce((m, t) => Math.max(m, t.order), -1)

      // Start after the last task
      let startDate: Date
      if (poolTasks.length > 0) {
        const lastTask = poolTasks[poolTasks.length - 1]
        startDate = snapToWorkStart(parseISO(lastTask.scheduledEnd), cal)
      } else {
        startDate = snapToWorkStart(new Date(), cal)
      }

      const scheduledStart = startDate.toISOString()
      const scheduledEnd = addWorkHours(startDate, data.durationHours, cal).toISOString()

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
      // Recalculate if duration changed
      if ('durationHours' in data) {
        _recalculatePool(s.tasks, task.poolId, task.clientId)
      }
    }),

    deleteTask: (id) => set(s => {
      const task = s.tasks.find(t => t.id === id)
      if (!task) return
      const { poolId, clientId } = task
      s.tasks = s.tasks.filter(t => t.id !== id)
      // Re-index remaining
      const poolTasks = s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
      poolTasks.forEach((t, i) => { t.order = i })
      _recalculatePool(s.tasks, poolId, clientId)
    }),

    moveTask: (taskId, toPoolId, toIndex) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (!task) return

      const sourcePoolId = task.poolId
      const sourceClientId = task.clientId
      const targetPool = s.pools.find(p => p.id === toPoolId)
      if (!targetPool) return

      // Remove from source
      const sourceTasks = s.tasks
        .filter(t => t.poolId === sourcePoolId && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
      sourceTasks.forEach((t, i) => { t.order = i })

      // Insert into target
      const targetTasks = s.tasks
        .filter(t => t.poolId === toPoolId && t.id !== taskId)
        .sort((a, b) => a.order - b.order)
      targetTasks.splice(toIndex, 0, task)
      targetTasks.forEach((t, i) => { t.order = i })

      task.poolId = toPoolId
      task.clientId = targetPool.clientId

      // Recalculate both pools
      _recalculatePool(s.tasks, sourcePoolId, sourceClientId)
      _recalculatePool(s.tasks, toPoolId, targetPool.clientId)
    }),

    setEditingTask: (id) => set(s => { s.editingTaskId = id }),

    markDelayed: (taskId, actualEnd) => set(s => {
      const task = s.tasks.find(t => t.id === taskId)
      if (!task) return
      const pool = s.pools.find(p => p.id === task.poolId)
      if (!pool) return

      task.status = 'delayed'
      if (!task.delayedSince) task.delayedSince = new Date().toISOString()
      if (actualEnd) task.actualEnd = actualEnd.toISOString()

      const poolTasks = s.tasks
        .filter(t => t.poolId === task.poolId)
        .sort((a, b) => a.order - b.order)
      const fromIndex = poolTasks.findIndex(t => t.id === taskId)
      _propagateDelayFrom(s.tasks, task.poolId, fromIndex, pool.clientId)
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
        if (!pool) continue
        const poolTasks = s.tasks.filter(t => t.poolId === poolId).sort((a, b) => a.order - b.order)
        const firstDelayed = poolTasks.findIndex(t => t.status === 'delayed')
        if (firstDelayed >= 0) {
          _propagateDelayFrom(s.tasks, poolId, firstDelayed, pool.clientId)
        }
      }
    }),
  }))
)

// Persist on every change
useStore.subscribe((state) => {
  saveState({
    activeClient: state.activeClient,
    view: state.view,
    viewportStart: state.viewportStart,
    pools: state.pools,
    tasks: state.tasks,
  })
})
