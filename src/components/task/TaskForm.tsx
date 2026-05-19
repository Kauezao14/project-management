import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Moon, Coffee, GitMerge, CalendarClock, X as XIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import type { Task } from '../../types/task'

type FormData = {
  title: string
  durationHours: string
  notes: string
  status: Task['status']
  overtime: boolean
  overtimeHours: string
  lunchWork: boolean
  projectId: string
  predecessors: string[]
  pinnedStart: string  // '' = sem pin; formato datetime-local "YYYY-MM-DDTHH:mm"
  [key: string]: string | boolean | string[]
}

function Toggle({
  checked,
  onChange,
  icon,
  label,
  description,
  color,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  icon: React.ReactNode
  label: string
  description: string
  color: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 border-2 text-left transition-all ${
        checked
          ? 'border-current bg-opacity-10'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      style={checked ? { borderColor: color, backgroundColor: `${color}18`, color } : { color: '#6b7280' }}
    >
      <div
        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
        style={{ backgroundColor: checked ? `${color}25` : '#f3f4f6' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: checked ? color : '#374151' }}>
          {label}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
      <div
        className="shrink-0 w-9 h-5 rounded-full relative transition-colors"
        style={{ backgroundColor: checked ? color : '#d1d5db' }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
    </button>
  )
}

export function TaskForm() {
  const {
    editingTaskId, addingTaskToPoolId, tasks, pools, activeClient, clients, projects,
    addTask, updateTask, setEditingTask, setAddingTaskToPool,
  } = useStore(useShallow(s => ({
    editingTaskId: s.editingTaskId,
    addingTaskToPoolId: s.addingTaskToPoolId,
    tasks: s.tasks,
    pools: s.pools,
    activeClient: s.activeClient,
    clients: s.clients,
    projects: s.projects,
    addTask: s.addTask,
    updateTask: s.updateTask,
    setEditingTask: s.setEditingTask,
    setAddingTaskToPool: s.setAddingTaskToPool,
  })))

  const isEditing = !!editingTaskId
  const task = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null
  const poolId = isEditing ? task?.poolId : addingTaskToPoolId
  const taskClientId = isEditing ? (task?.clientId ?? activeClient) : activeClient
  const client = clients.find(c => c.id === taskClientId)!
  const cal = client?.workCalendar
  const clientProjects = projects.filter(p => p.clientId === taskClientId)

  const [form, setForm] = useState<FormData>({
    title: task?.title ?? '',
    durationHours: task?.durationHours?.toString() ?? '',
    notes: task?.notes ?? '',
    status: task?.status ?? 'pending',
    overtime: task?.overtime ?? false,
    overtimeHours: task?.overtimeHours?.toString() ?? '2',
    lunchWork: task?.lunchWork ?? false,
    projectId: task?.projectId ?? '',
    predecessors: task?.predecessors ?? [],
    pinnedStart: task?.pinnedStart ? format(parseISO(task.pinnedStart), "yyyy-MM-dd'T'HH:mm") : '',
    ...(client?.taskExtraFields ?? []).reduce((acc, f) => ({
      ...acc,
      [f.key]: String((task as unknown as Record<string, unknown>)?.[f.key] ?? ''),
    }), {}),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onClose = () => {
    setEditingTask(null)
    setAddingTaskToPool(null)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'Título obrigatório'
    const dur = parseFloat(form.durationHours as string)
    if (!form.durationHours || isNaN(dur) || dur <= 0) errs.durationHours = 'Duração deve ser > 0'
    ;(client?.taskExtraFields ?? []).forEach(f => {
      if (f.required && !(form[f.key] as string)?.trim()) errs[f.key] = `${f.label} obrigatório`
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const extraData = (client?.taskExtraFields ?? []).reduce((acc, f) => {
      const val = form[f.key] as string
      if (!val) return acc
      return { ...acc, [f.key]: f.type === 'number' ? parseFloat(val) : val }
    }, {} as Record<string, unknown>)

    const pinnedStartRaw = (form.pinnedStart as string).trim()
    const base = {
      title: (form.title as string).trim(),
      durationHours: parseFloat(form.durationHours as string),
      notes: (form.notes as string).trim() || undefined,
      overtime: form.overtime as boolean,
      overtimeHours: form.overtime ? parseFloat(form.overtimeHours as string) || 2 : undefined,
      lunchWork: form.lunchWork as boolean,
      projectId: (form.projectId as string) || undefined,
      predecessors: (form.predecessors as string[]).length > 0 ? (form.predecessors as string[]) : undefined,
      pinnedStart: pinnedStartRaw ? new Date(pinnedStartRaw).toISOString() : undefined,
      ...extraData,
    }

    if (isEditing && task) {
      updateTask(task.id, { ...base, status: form.status as Task['status'] })
    } else if (poolId) {
      addTask(poolId, { ...base, status: 'pending' } as Parameters<typeof addTask>[1])
    }
    onClose()
  }

  const setField = (key: string, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (typeof value === 'string' && errors[key]) {
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }
  }

  const togglePredecessor = (id: string) => {
    const preds = form.predecessors as string[]
    setField('predecessors', preds.includes(id) ? preds.filter(p => p !== id) : [...preds, id])
  }

  // Tasks available as predecessors: same project, not the current task, grouped by pool
  const selectedProjectId = form.projectId as string
  const taskId = task?.id ?? ''
  const candidateTasks = useMemo(
    () => selectedProjectId
      ? tasks.filter(t => t.projectId === selectedProjectId && t.id !== taskId)
      : [],
    [selectedProjectId, tasks, taskId]
  )

  // Group candidates by pool
  const candidateByPool = useMemo(
    () => candidateTasks.reduce<{ poolId: string; poolName: string; tasks: Task[] }[]>((acc, t) => {
      const existing = acc.find(g => g.poolId === t.poolId)
      const poolName = pools.find(p => p.id === t.poolId)?.name ?? t.poolId
      if (existing) {
        existing.tasks.push(t)
      } else {
        acc.push({ poolId: t.poolId, poolName, tasks: [t] })
      }
      return acc
    }, []),
    [candidateTasks, pools]
  )

  return (
    <Modal
      title={isEditing ? `Editar ${client?.taskLabel ?? 'tarefa'}` : `Nova ${client?.taskLabel ?? 'tarefa'}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Título"
          value={form.title as string}
          onChange={e => setField('title', e.target.value)}
          error={errors.title}
          required
          autoFocus
          placeholder={`Nome da ${client?.taskLabel.toLowerCase() ?? 'tarefa'}`}
        />

        <Input
          label="Duração (horas)"
          type="number"
          min="0.25"
          step="0.25"
          value={form.durationHours as string}
          onChange={e => setField('durationHours', e.target.value)}
          error={errors.durationHours}
          required
          placeholder="Ex: 8"
        />

        {/* Pinned start (optional manual scheduling) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1.5">
            <CalendarClock size={12} />
            Início manual <span className="font-normal text-gray-400">(opcional)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.pinnedStart as string}
              onChange={e => setField('pinnedStart', e.target.value)}
            />
            {form.pinnedStart && (
              <button
                type="button"
                onClick={() => setField('pinnedStart', '')}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                title="Remover início fixo"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            A tarefa não começa antes desta data. Se uma predecessora terminar depois, prevalece.
          </p>
        </div>

        {/* Client extra fields */}
        {(client?.taskExtraFields ?? []).map(field => (
          field.type === 'select' ? (
            <Select
              key={field.key}
              label={field.label}
              options={field.options ?? []}
              value={form[field.key] as string ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              error={errors[field.key]}
              required={field.required}
            />
          ) : (
            <Input
              key={field.key}
              label={field.label}
              type={field.type}
              value={form[field.key] as string ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              error={errors[field.key]}
              required={field.required}
              min={field.type === 'number' ? '1' : undefined}
            />
          )
        ))}

        {/* Work schedule */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">Regime de trabalho</div>
          <div className="space-y-2">
            <Toggle
              checked={form.overtime as boolean}
              onChange={v => setField('overtime', v)}
              icon={<Moon size={15} />}
              label="Hora extra"
              description={
                form.overtime
                  ? `Expediente estendido até ${cal ? cal.endHour + (parseFloat(form.overtimeHours as string) || 2) : '?'}h`
                  : 'Atividade será encerrada no fim do expediente'
              }
              color="#f59e0b"
            />
            {form.overtime && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                <span className="text-xs text-amber-700 font-medium whitespace-nowrap">Horas extras:</span>
                <input
                  type="number"
                  min="0.5"
                  max="8"
                  step="0.5"
                  className="w-20 border border-amber-200 bg-white rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={form.overtimeHours as string}
                  onChange={e => setField('overtimeHours', e.target.value)}
                />
                <span className="text-xs text-amber-600">h além do expediente</span>
              </div>
            )}
            {cal?.lunchStart !== undefined && cal?.lunchEnd !== undefined && (
              <Toggle
                checked={form.lunchWork as boolean}
                onChange={v => setField('lunchWork', v)}
                icon={<Coffee size={15} />}
                label="Trabalha no almoço"
                description={`Aproveita o intervalo das ${cal?.lunchStart}h às ${cal?.lunchEnd}h`}
                color="#10b981"
              />
            )}
          </div>
        </div>

        {isEditing && (
          <Select
            label="Status"
            options={[
              { value: 'pending', label: 'Pendente' },
              { value: 'in_progress', label: 'Em andamento' },
              { value: 'completed', label: 'Concluído' },
              { value: 'delayed', label: 'Atrasado' },
            ]}
            value={form.status as string}
            onChange={e => setField('status', e.target.value)}
          />
        )}

        {/* Project selector */}
        {clientProjects.length > 0 && (
          <Select
            label="Projeto"
            options={[
              { value: '', label: '— Sem projeto —' },
              ...clientProjects.map(p => ({ value: p.id, label: p.name })),
            ]}
            value={form.projectId as string}
            onChange={e => {
              setField('projectId', e.target.value)
              setField('predecessors', [])
            }}
          />
        )}

        {/* Predecessor selector — only when a project is selected and there are candidates */}
        {selectedProjectId && candidateByPool.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
              <GitMerge size={12} />
              Predecessoras (deve terminar antes desta)
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
              {candidateByPool.map(group => (
                <div key={group.poolId} className="px-3 py-2">
                  <div className="text-xs font-semibold text-gray-400 mb-1.5">{group.poolName}</div>
                  <div className="space-y-1">
                    {group.tasks.map(t => {
                      const checked = (form.predecessors as string[]).includes(t.id)
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center gap-2 cursor-pointer rounded px-2 py-1 text-xs transition-colors ${
                            checked ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePredecessor(t.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex-1 truncate font-medium">{t.title}</span>
                          <span className="text-gray-400 shrink-0">{t.durationHours}h</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Textarea
          label="Observações"
          value={form.notes as string}
          onChange={e => setField('notes', e.target.value)}
          placeholder="Detalhes adicionais..."
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm">{isEditing ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
