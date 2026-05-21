import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { nanoid } from 'nanoid'
import {
  addDays, addWeeks, addMonths, startOfDay, startOfWeek, startOfMonth,
  parseISO, isAfter,
} from 'date-fns'
import { rescheduleAll } from '../lib/scheduler'
import { getViewportStart } from '../lib/ganttLayout'
import {
  loadCompanyBySlug,
  upsertCompany,
  deleteCompany as dbDeleteCompany,
  upsertPool,
  deletePool as dbDeletePool,
  upsertProject,
  deleteProject as dbDeleteProject,
  upsertTasks,
  deleteTask as dbDeleteTask,
  subscribeToCompany,
  markLocalWrite,
} from '../lib/supabaseSync'
import type { CompanyData } from '../lib/supabaseSync'
import type { ClientConfig } from '../types/client'
import type { Pool } from '../types/pool'
import type { Task } from '../types/task'
import type { Project } from '../types/project'
import type { View } from '../types/app'

// Undo history — kept outside Zustand to avoid triggering selectors
type Snapshot = { tasks: Task[]; pools: Pool[]; projects: Project[] }
const undoStack: Snapshot[] = []
const MAX_UNDO = 20

function snapshot(s: { tasks: Task[]; pools: Pool[]; projects: Project[] }): void {
  undoStack.push({
    tasks: JSON.parse(JSON.stringify(s.tasks)),
    pools: JSON.parse(JSON.stringify(s.pools)),
    projects: JSON.parse(JSON.stringify(s.projects)),
  })
  if (undoStack.length > MAX_UNDO) undoStack.shift()
}

const savedView = (localStorage.getItem('gantt_view') as View | null) ?? 'weekly'
const savedViewportStart = localStorage.getItem('gantt_viewport')
  ?? getViewportStart(savedView, new Date()).toISOString()

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

  loaded: boolean
  loadError: string | null

  loadCompany: (slug: string) => Promise<void>
  reloadData: (data: CompanyData) => void

  setView: (v: View) => void
  setPage: (p: 'gantt' | 'projects') => void
  navigateViewport: (direction: -1 | 1) => void
  setViewportStart: (date: Date) => void
  setShowClientSelector: (v: boolean) => void

  addClient: (data: Omit<ClientConfig, 'id' | 'createdAt' | 'taskExtraFields'>) => string
  updateClient: (id: string, data: Partial<Omit<ClientConfig, 'id' | 'createdAt'>>) => void
  deleteClient: (id: string) => void
  setClient: (id: string) => void

  addProject: (name: string, color: string, startDate?: string) => string
  updateProject: (id: string, data: { name?: string; color?: string; startDate?: string }) => void
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
  migratePinScheduledStarts: () => void
  undo: () => void
}

export const useStore = create<AppState>()(
  immer((set, get) => ({
    activeClient: '',
    view: savedView,
    viewportStart: savedViewportStart,
    page: 'gantt',
    clients: [],
    pools: [],
    tasks: [],
    projects: [],
    editingPoolId: null,
    editingTaskId: null,
    addingTaskToPoolId: null,
    showClientSelector: true,
    loaded: false,
    loadError: null,

    loadCompany: async (slug: string) => {
      set(s => { s.loaded = false; s.loadError = null; s.page = 'gantt' })
      const data = await loadCompanyBySlug(slug)
      if (!data) {
        set(s => { s.loadError = `Empresa "${slug}" não encontrada` })
        return
      }
      set(s => {
        s.clients = [data.company]
        s.activeClient = data.company.id
        s.pools = data.pools
        s.tasks = data.tasks
        s.projects = data.projects
        s.loaded = true
        s.showClientSelector = false
      })
      subscribeToCompany(data.company.id, async () => {
        const fresh = await loadCompanyBySlug(slug)
        if (fresh) get().reloadData(fresh)
      })
    },

    reloadData: (data: CompanyData) => set(s => {
      s.pools = data.pools
      s.tasks = data.tasks
      s.projects = data.projects
    }),

    setView: (v) => set(s => {
      s.view = v
      s.viewportStart = getViewportStart(v, parseISO(s.viewportStart)).toISOString()
      localStorage.setItem('gantt_view', v)
    }),
    setPage: (p) => set(s => { s.page = p }),
    navigateViewport: (dir) => set(s => {
      const base = parseISO(s.viewportStart)
      let next: Date
      if (s.view === 'daily') next = startOfDay(addDays(base, dir))
      else if (s.view === 'weekly') next = startOfWeek(addWeeks(base, dir), { weekStartsOn: 1 })
      else next = startOfMonth(addMonths(base, dir))
      s.viewportStart = next.toISOString()
      localStorage.setItem('gantt_viewport', s.viewportStart)
    }),
    setViewportStart: (date) => set(s => {
      s.viewportStart = getViewportStart(s.view, date).toISOString()
      localStorage.setItem('gantt_viewport', s.viewportStart)
    }),
    setShowClientSelector: () => { window.location.hash = '#/' },

    addClient: (data) => {
      const id = crypto.randomUUID()
      const client: ClientConfig = {
        ...data,
        id,
        taskExtraFields: [],
        createdAt: new Date().toISOString(),
      }
      set(s => { s.clients = [client]; s.activeClient = id })
      markLocalWrite()
      upsertCompany(client).catch(console.error)
      return id
    },
    updateClient: (id, data) => {
      set(s => {
        const c = s.clients.find(c => c.id === id)
        if (c) Object.assign(c, data)
      })
      const client = get().clients.find(c => c.id === id)
      if (client) { markLocalWrite(); upsertCompany(client).catch(console.error) }
    },
    deleteClient: (id) => {
      set(s => {
        s.clients = s.clients.filter(c => c.id !== id)
        s.pools = s.pools.filter(p => p.clientId !== id)
        s.tasks = s.tasks.filter(t => t.clientId !== id)
        s.projects = s.projects.filter(p => p.clientId !== id)
        s.loaded = false
      })
      markLocalWrite()
      dbDeleteCompany(id).catch(console.error)
      window.location.hash = '#/'
    },
    setClient: (id) => set(s => { s.activeClient = id }),

    addProject: (name, color, startDate) => {
      const id = nanoid()
      set(s => {
        s.projects.push({ id, clientId: s.activeClient, name, color, startDate, createdAt: new Date().toISOString() })
      })
      const project = get().projects.find(p => p.id === id)!
      markLocalWrite(); upsertProject(project).catch(console.error)
      return id
    },
    updateProject: (id, data) => {
      set(s => {
        const p = s.projects.find(p => p.id === id)
        if (p) Object.assign(p, data)
      })
      const project = get().projects.find(p => p.id === id)
      if (project) { markLocalWrite(); upsertProject(project).catch(console.error) }
    },
    deleteProject: (id) => {
      const affectedTaskIds = get().tasks.filter(t => t.projectId === id).map(t => t.id)
      set(s => {
        s.projects = s.projects.filter(p => p.id !== id)
        s.tasks.forEach(t => { if (t.projectId === id) delete t.projectId })
      })
      markLocalWrite()
      dbDeleteProject(id).catch(console.error)
      if (affectedTaskIds.length > 0) {
        upsertTasks(get().tasks.filter(t => affectedTaskIds.includes(t.id))).catch(console.error)
      }
    },

    addPool: (name) => {
      const id = nanoid()
      set(s => {
        const maxOrder = s.pools.filter(p => p.clientId === s.activeClient).reduce((m, p) => Math.max(m, p.order), -1)
        s.pools.push({ id, clientId: s.activeClient, name, order: maxOrder + 1, createdAt: new Date().toISOString() })
      })
      const pool = get().pools.find(p => p.id === id)!
      markLocalWrite(); upsertPool(pool).catch(console.error)
    },
    updatePool: (id, name) => {
      set(s => { const p = s.pools.find(p => p.id === id); if (p) p.name = name })
      const pool = get().pools.find(p => p.id === id)
      if (pool) { markLocalWrite(); upsertPool(pool).catch(console.error) }
    },
    deletePool: (id) => {
      set(s => {
        s.pools = s.pools.filter(p => p.id !== id)
        s.tasks = s.tasks.filter(t => t.poolId !== id)
      })
      markLocalWrite(); dbDeletePool(id).catch(console.error)
    },
    setEditingPool: (id) => set(s => { s.editingPoolId = id }),
    setAddingTaskToPool: (id) => set(s => { s.addingTaskToPoolId = id }),

    addTask: (poolId, data) => {
      snapshot(get())
      set(s => {
        const pool = s.pools.find(p => p.id === poolId)
        if (!pool) return
        const maxOrder = s.tasks.filter(t => t.poolId === poolId).reduce((m, t) => Math.max(m, t.order), -1)
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
        rescheduleAll(s.tasks, s.pools, s.clients, s.projects)
      })
      markLocalWrite()
      upsertTasks(get().tasks.filter(t => t.poolId === poolId)).catch(console.error)
    },

    updateTask: (id, data) => {
      snapshot(get())
      const poolId = get().tasks.find(t => t.id === id)?.poolId
      const scheduleFields = new Set(['durationHours', 'overtime', 'overtimeHours', 'lunchWork', 'predecessors', 'projectId', 'pinnedStart'])
      const needsReschedule = Object.keys(data).some(k => scheduleFields.has(k))
      set(s => {
        const task = s.tasks.find(t => t.id === id)
        if (!task) return
        Object.assign(task, data)
        if (needsReschedule) rescheduleAll(s.tasks, s.pools, s.clients, s.projects)
      })
      markLocalWrite()
      if (needsReschedule && poolId) {
        upsertTasks(get().tasks.filter(t => t.poolId === poolId)).catch(console.error)
      } else {
        const task = get().tasks.find(t => t.id === id)
        if (task) upsertTasks([task]).catch(console.error)
      }
    },

    deleteTask: (id) => {
      snapshot(get())
      const poolId = get().tasks.find(t => t.id === id)?.poolId
      set(s => {
        s.tasks = s.tasks.filter(t => t.id !== id)
        s.tasks.forEach(t => {
          if (t.predecessors?.includes(id)) t.predecessors = t.predecessors.filter(p => p !== id)
        })
        const pools = new Set(s.tasks.map(t => t.poolId))
        for (const pid of pools) {
          s.tasks.filter(t => t.poolId === pid).sort((a, b) => a.order - b.order).forEach((t, i) => { t.order = i })
        }
        rescheduleAll(s.tasks, s.pools, s.clients, s.projects)
      })
      markLocalWrite()
      dbDeleteTask(id).catch(console.error)
      if (poolId) upsertTasks(get().tasks.filter(t => t.poolId === poolId)).catch(console.error)
    },

    moveTask: (taskId, toPoolId, toIndex) => {
      snapshot(get())
      const fromPoolId = get().tasks.find(t => t.id === taskId)?.poolId
      set(s => {
        const task = s.tasks.find(t => t.id === taskId)
        if (!task) return
        const targetPool = s.pools.find(p => p.id === toPoolId)
        if (!targetPool) return

        if (task.poolId === toPoolId) {
          // Same-pool: remove task, then insert at target index
          const sorted = s.tasks.filter(t => t.poolId === toPoolId).sort((a, b) => a.order - b.order)
          const fromIdx = sorted.findIndex(t => t.id === taskId)
          sorted.splice(fromIdx, 1)
          sorted.splice(Math.min(toIndex, sorted.length), 0, task)
          sorted.forEach((t, i) => { t.order = i })
        } else {
          // Cross-pool: renumber source, insert into target
          s.tasks.filter(t => t.poolId === task.poolId && t.id !== taskId)
            .sort((a, b) => a.order - b.order).forEach((t, i) => { t.order = i })
          const targetTasks = s.tasks.filter(t => t.poolId === toPoolId && t.id !== taskId)
            .sort((a, b) => a.order - b.order)
          targetTasks.splice(Math.min(toIndex, targetTasks.length), 0, task)
          targetTasks.forEach((t, i) => { t.order = i })
          task.poolId = toPoolId
          task.clientId = targetPool.clientId
        }

        rescheduleAll(s.tasks, s.pools, s.clients, s.projects)
      })
      markLocalWrite()
      const tasks = get().tasks
      const poolIds = new Set([fromPoolId, toPoolId].filter(Boolean) as string[])
      upsertTasks(tasks.filter(t => poolIds.has(t.poolId))).catch(console.error)
    },

    setEditingTask: (id) => set(s => { s.editingTaskId = id }),

    markDelayed: (taskId, actualEnd) => {
      snapshot(get())
      set(s => {
        const task = s.tasks.find(t => t.id === taskId)
        if (!task) return
        task.status = 'delayed'
        if (!task.delayedSince) task.delayedSince = new Date().toISOString()
        if (actualEnd) task.actualEnd = actualEnd.toISOString()
      })
      markLocalWrite()
      const task = get().tasks.find(t => t.id === taskId)
      if (task) upsertTasks([task]).catch(console.error)
    },

    markCompleted: (taskId) => {
      snapshot(get())
      set(s => {
        const task = s.tasks.find(t => t.id === taskId)
        if (task) { task.status = 'completed'; task.actualEnd = task.actualEnd ?? new Date().toISOString() }
      })
      markLocalWrite()
      const task = get().tasks.find(t => t.id === taskId)
      if (task) upsertTasks([task]).catch(console.error)
    },

    markInProgress: (taskId) => {
      snapshot(get())
      set(s => { const task = s.tasks.find(t => t.id === taskId); if (task) task.status = 'in_progress' })
      markLocalWrite()
      const task = get().tasks.find(t => t.id === taskId)
      if (task) upsertTasks([task]).catch(console.error)
    },

    checkAndPropagateDelays: () => {
      const now = new Date()
      const changedIds: string[] = []
      set(s => {
        for (const task of s.tasks) {
          if (task.status === 'in_progress' && isAfter(now, parseISO(task.scheduledEnd))) {
            if (!task.delayedSince) { task.status = 'delayed'; task.delayedSince = now.toISOString(); changedIds.push(task.id) }
          }
        }
        if (changedIds.length > 0) rescheduleAll(s.tasks, s.pools, s.clients, s.projects)
      })
      if (changedIds.length > 0) {
        markLocalWrite()
        upsertTasks(get().tasks.filter(t => changedIds.includes(t.id))).catch(console.error)
      }
    },

    undo: () => {
      const prev = undoStack.pop()
      if (!prev) return
      set(s => {
        s.tasks = prev.tasks
        s.pools = prev.pools
        s.projects = prev.projects
      })
      markLocalWrite()
      upsertTasks(get().tasks).catch(console.error)
    },

    migratePinScheduledStarts: () => {
      const FLAG = 'gantt_pin_migration_v1'
      if (localStorage.getItem(FLAG)) return
      const toPin = get().tasks.filter(t => !t.pinnedStart && t.status !== 'completed')
      if (toPin.length > 0) {
        const ids = new Set(toPin.map(t => t.id))
        set(s => { s.tasks.forEach(t => { if (ids.has(t.id)) t.pinnedStart = t.scheduledStart }) })
        markLocalWrite()
        upsertTasks(get().tasks.filter(t => ids.has(t.id))).catch(console.error)
      }
      localStorage.setItem(FLAG, '1')
    },
  }))
)
