import { supabase } from './supabase'
import type { ClientConfig } from '../types/client'
import type { Pool } from '../types/pool'
import type { Project } from '../types/project'
import type { Task } from '../types/task'

// ── Row → App type conversions ────────────────────────────────────────────────

function rowToClient(row: Record<string, unknown>): ClientConfig {
  const poolLabel = row.pool_label as string
  const taskLabel = row.task_label as string
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    color: row.color as string,
    poolLabel,
    poolLabelPlural: poolLabel + 's',
    taskLabel,
    taskLabelPlural: taskLabel + 's',
    taskExtraFields: (row.task_extra_fields as ClientConfig['taskExtraFields']) ?? [],
    workCalendar: row.work_calendar as ClientConfig['workCalendar'],
    createdAt: row.created_at as string,
  }
}

function rowToPool(row: Record<string, unknown>): Pool {
  return {
    id: row.id as string,
    clientId: row.company_id as string,
    name: row.name as string,
    order: row.order as number,
    createdAt: row.created_at as string,
  }
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    clientId: row.company_id as string,
    name: row.name as string,
    color: row.color as string,
    startDate: (row.start_date as string) ?? undefined,
    createdAt: row.created_at as string,
  }
}

function rowToTask(row: Record<string, unknown>): Task {
  const extra = (row.extra_data as Record<string, unknown>) ?? {}
  return {
    id: row.id as string,
    poolId: row.pool_id as string,
    clientId: row.company_id as string,
    title: row.title as string,
    durationHours: Number(row.duration_hours),
    order: row.order as number,
    status: row.status as Task['status'],
    scheduledStart: (row.scheduled_start as string) ?? new Date().toISOString(),
    scheduledEnd: (row.scheduled_end as string) ?? new Date().toISOString(),
    notes: (row.notes as string) ?? undefined,
    overtime: (row.overtime as boolean) ?? false,
    overtimeHours: (row.overtime_hours as number) ?? undefined,
    lunchWork: (row.lunch_work as boolean) ?? false,
    projectId: (row.project_id as string) ?? undefined,
    predecessors: (row.predecessors as string[]) ?? [],
    delayedSince: (row.delayed_since as string) ?? undefined,
    actualEnd: (row.actual_end as string) ?? undefined,
    ...extra,
  }
}

function taskToRow(task: Task): Record<string, unknown> {
  const {
    id, poolId, clientId, title, durationHours, order, status,
    scheduledStart, scheduledEnd, notes, overtime, overtimeHours, lunchWork,
    projectId, predecessors, delayedSince, actualEnd, pinnedStart,
    machineRef, maintenanceType, moldRef, quantity,
    ...rest
  } = task
  return {
    id,
    pool_id: poolId,
    company_id: clientId,
    title,
    duration_hours: durationHours,
    order,
    status,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    notes: notes ?? null,
    overtime: overtime ?? false,
    overtime_hours: overtimeHours ?? null,
    lunch_work: lunchWork ?? false,
    project_id: projectId ?? null,
    predecessors: predecessors ?? [],
    delayed_since: delayedSince ?? null,
    actual_end: actualEnd ?? null,
    extra_data: {
      ...(pinnedStart !== undefined ? { pinnedStart } : {}),
      ...(machineRef !== undefined ? { machineRef } : {}),
      ...(maintenanceType !== undefined ? { maintenanceType } : {}),
      ...(moldRef !== undefined ? { moldRef } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...rest,
    },
  }
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface CompanyData {
  company: ClientConfig
  pools: Pool[]
  projects: Project[]
  tasks: Task[]
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function loadCompanyBySlug(slug: string): Promise<CompanyData | null> {
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !company) return null

  const [{ data: pools }, { data: projects }, { data: tasks }] = await Promise.all([
    supabase.from('pools').select('*').eq('company_id', company.id).order('order'),
    supabase.from('projects').select('*').eq('company_id', company.id),
    supabase.from('tasks').select('*').eq('company_id', company.id),
  ])

  return {
    company: rowToClient(company as Record<string, unknown>),
    pools: (pools ?? []).map(r => rowToPool(r as Record<string, unknown>)),
    projects: (projects ?? []).map(r => rowToProject(r as Record<string, unknown>)),
    tasks: (tasks ?? []).map(r => rowToTask(r as Record<string, unknown>)),
  }
}

export async function fetchAllCompanies(): Promise<ClientConfig[]> {
  const { data } = await supabase.from('companies').select('*').order('name')
  return (data ?? []).map(r => rowToClient(r as Record<string, unknown>))
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function upsertCompany(client: ClientConfig): Promise<void> {
  await supabase.from('companies').upsert({
    id: client.id,
    slug: client.slug,
    name: client.name,
    color: client.color,
    pool_label: client.poolLabel,
    task_label: client.taskLabel,
    task_extra_fields: client.taskExtraFields,
    work_calendar: client.workCalendar,
  }, { onConflict: 'id' })
}

export async function deleteCompany(id: string): Promise<void> {
  await supabase.from('companies').delete().eq('id', id)
}

export async function upsertPool(pool: Pool): Promise<void> {
  await supabase.from('pools').upsert({
    id: pool.id,
    company_id: pool.clientId,
    name: pool.name,
    order: pool.order,
  }, { onConflict: 'id' })
}

export async function deletePool(id: string): Promise<void> {
  await supabase.from('pools').delete().eq('id', id)
}

export async function upsertProject(project: Project): Promise<void> {
  await supabase.from('projects').upsert({
    id: project.id,
    company_id: project.clientId,
    name: project.name,
    color: project.color,
    start_date: project.startDate ?? null,
  }, { onConflict: 'id' })
}

export async function deleteProject(id: string): Promise<void> {
  await supabase.from('projects').delete().eq('id', id)
}

export async function upsertTasks(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return
  await supabase.from('tasks').upsert(tasks.map(taskToRow), { onConflict: 'id' })
}

export async function deleteTask(id: string): Promise<void> {
  await supabase.from('tasks').delete().eq('id', id)
}

// ── Realtime ──────────────────────────────────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
let lastLocalWriteAt = 0

export function markLocalWrite(): void {
  lastLocalWriteAt = Date.now()
}

export function subscribeToCompany(companyId: string, onUpdate: () => void): void {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const debounced = () => {
    if (Date.now() - lastLocalWriteAt < 2000) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(onUpdate, 600)
  }

  realtimeChannel = supabase
    .channel(`company-${companyId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `company_id=eq.${companyId}` }, debounced)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `company_id=eq.${companyId}` }, debounced)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `company_id=eq.${companyId}` }, debounced)
    .subscribe()
}
