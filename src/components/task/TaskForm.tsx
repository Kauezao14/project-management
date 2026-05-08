import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { CLIENT_CONFIGS } from '../../config/clients'
import type { Task } from '../../types/task'

type FormData = {
  title: string
  durationHours: string
  notes: string
  status: Task['status']
  // dynamic
  [key: string]: string
}

export function TaskForm() {
  const { editingTaskId, addingTaskToPoolId, tasks, activeClient, addTask, updateTask, setEditingTask, setAddingTaskToPool } = useStore(useShallow(s => ({
    editingTaskId: s.editingTaskId,
    addingTaskToPoolId: s.addingTaskToPoolId,
    tasks: s.tasks,
    activeClient: s.activeClient,
    addTask: s.addTask,
    updateTask: s.updateTask,
    setEditingTask: s.setEditingTask,
    setAddingTaskToPool: s.setAddingTaskToPool,
  })))

  const isEditing = !!editingTaskId
  const task = editingTaskId ? tasks.find(t => t.id === editingTaskId) : null
  const poolId = isEditing ? task?.poolId : addingTaskToPoolId
  const taskClientId = isEditing ? (task?.clientId ?? activeClient) : activeClient
  const client = CLIENT_CONFIGS[taskClientId]

  const [form, setForm] = useState<FormData>({
    title: task?.title ?? '',
    durationHours: task?.durationHours?.toString() ?? '',
    notes: task?.notes ?? '',
    status: task?.status ?? 'pending',
    // extra fields
    ...client.taskExtraFields.reduce((acc, f) => ({
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
    const dur = parseFloat(form.durationHours)
    if (!form.durationHours || isNaN(dur) || dur <= 0) errs.durationHours = 'Duração deve ser > 0'
    client.taskExtraFields.forEach(f => {
      if (f.required && !form[f.key]?.trim()) errs[f.key] = `${f.label} obrigatório`
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const extraData = client.taskExtraFields.reduce((acc, f) => {
      const val = form[f.key]
      if (!val) return acc
      return { ...acc, [f.key]: f.type === 'number' ? parseFloat(val) : val }
    }, {} as Record<string, unknown>)

    if (isEditing && task) {
      updateTask(task.id, {
        title: form.title.trim(),
        durationHours: parseFloat(form.durationHours),
        notes: form.notes.trim() || undefined,
        status: form.status,
        ...extraData,
      })
    } else if (poolId) {
      addTask(poolId, {
        title: form.title.trim(),
        durationHours: parseFloat(form.durationHours),
        notes: form.notes.trim() || undefined,
        status: 'pending',
        ...extraData,
      } as Parameters<typeof addTask>[1])
    }
    onClose()
  }

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  return (
    <Modal
      title={isEditing ? `Editar ${client.taskLabel}` : `Nova ${client.taskLabel}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Título"
          value={form.title}
          onChange={e => setField('title', e.target.value)}
          error={errors.title}
          required
          autoFocus
          placeholder={`Nome da ${client.taskLabel.toLowerCase()}`}
        />

        <Input
          label="Duração (horas)"
          type="number"
          min="0.25"
          step="0.25"
          value={form.durationHours}
          onChange={e => setField('durationHours', e.target.value)}
          error={errors.durationHours}
          required
          placeholder="Ex: 8"
        />

        {/* Dynamic extra fields */}
        {client.taskExtraFields.map(field => (
          field.type === 'select' ? (
            <Select
              key={field.key}
              label={field.label}
              options={field.options ?? []}
              value={form[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              error={errors[field.key]}
              required={field.required}
            />
          ) : (
            <Input
              key={field.key}
              label={field.label}
              type={field.type}
              value={form[field.key] ?? ''}
              onChange={e => setField(field.key, e.target.value)}
              error={errors[field.key]}
              required={field.required}
              min={field.type === 'number' ? '1' : undefined}
            />
          )
        ))}

        {isEditing && (
          <Select
            label="Status"
            options={[
              { value: 'pending', label: 'Pendente' },
              { value: 'in_progress', label: 'Em andamento' },
              { value: 'completed', label: 'Concluído' },
              { value: 'delayed', label: 'Atrasado' },
            ]}
            value={form.status}
            onChange={e => setField('status', e.target.value)}
          />
        )}

        <Textarea
          label="Observações"
          value={form.notes}
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
