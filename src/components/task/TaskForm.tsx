import { useState } from 'react'
import { Moon, Coffee } from 'lucide-react'
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
  [key: string]: string | boolean
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
      {/* Switch visual */}
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
  const { editingTaskId, addingTaskToPoolId, tasks, activeClient, clients, projects, addTask, updateTask, setEditingTask, setAddingTaskToPool } = useStore(useShallow(s => ({
    editingTaskId: s.editingTaskId,
    addingTaskToPoolId: s.addingTaskToPoolId,
    tasks: s.tasks,
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

    const base = {
      title: (form.title as string).trim(),
      durationHours: parseFloat(form.durationHours as string),
      notes: (form.notes as string).trim() || undefined,
      overtime: form.overtime as boolean,
      overtimeHours: form.overtime ? parseFloat(form.overtimeHours as string) || 2 : undefined,
      lunchWork: form.lunchWork as boolean,
      projectId: (form.projectId as string) || undefined,
      ...extraData,
    }

    if (isEditing && task) {
      updateTask(task.id, { ...base, status: form.status as Task['status'] })
    } else if (poolId) {
      addTask(poolId, { ...base, status: 'pending' } as Parameters<typeof addTask>[1])
    }
    onClose()
  }

  const setField = (key: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (typeof value === 'string' && errors[key]) {
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
    }
  }

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

        {/* Campos extras do cliente */}
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

        {/* Modificadores de agenda */}
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

        {clientProjects.length > 0 && (
          <Select
            label="Projeto"
            options={[
              { value: '', label: '— Sem projeto —' },
              ...clientProjects.map(p => ({ value: p.id, label: p.name })),
            ]}
            value={form.projectId as string}
            onChange={e => setField('projectId', e.target.value)}
          />
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
