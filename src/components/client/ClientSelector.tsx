import { useState } from 'react'
import { Plus, Building2, Edit2, Trash2, X, Check } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import type { ClientConfig } from '../../types/client'

const COLOR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#ef4444',
]

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Converts decimal hour (7.75) to "HH:MM" ("07:45")
function toTimeStr(h: number): string {
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// Converts "HH:MM" to decimal hour (7.75)
function fromTimeStr(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

type FormState = {
  name: string
  poolLabel: string
  taskLabel: string
  color: string
  startTime: string   // "HH:MM"
  endTime: string     // "HH:MM"
  hasLunch: boolean
  lunchStartTime: string  // "HH:MM"
  lunchEndTime: string    // "HH:MM"
  workDays: number[]
}

const DEFAULT_FORM: FormState = {
  name: '',
  poolLabel: '',
  taskLabel: '',
  color: COLOR_PALETTE[0],
  startTime: '07:00',
  endTime: '17:00',
  hasLunch: true,
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  workDays: [1, 2, 3, 4, 5],
}

function TimeInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="time"
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-400' : 'border-gray-200'
        }`}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

function CompanyForm({
  initial,
  onSave,
  onCancel,
  title,
}: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  title: string
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const toggleDay = (d: number) => {
    setForm(prev => ({
      ...prev,
      workDays: prev.workDays.includes(d)
        ? prev.workDays.filter(x => x !== d)
        : [...prev.workDays, d].sort(),
    }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Obrigatório'
    if (!form.poolLabel.trim()) e.poolLabel = 'Obrigatório'
    if (!form.taskLabel.trim()) e.taskLabel = 'Obrigatório'
    if (!form.startTime) e.startTime = 'Obrigatório'
    if (!form.endTime) e.endTime = 'Obrigatório'
    if (form.startTime && form.endTime && fromTimeStr(form.endTime) <= fromTimeStr(form.startTime)) {
      e.endTime = 'Deve ser após o início'
    }
    if (form.workDays.length === 0) e.workDays = 'Selecione ao menos 1 dia'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (validate()) onSave(form)
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome da empresa</label>
          <input
            autoFocus
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex: Dominus, PSG, Acme..."
          />
          {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
        </div>

        {/* Labels */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome da fila</label>
            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.poolLabel ? 'border-red-400' : 'border-gray-200'}`}
              value={form.poolLabel}
              onChange={e => set('poolLabel', e.target.value)}
              placeholder="Ex: Máquina, Técnico"
            />
            {errors.poolLabel && <p className="text-xs text-red-500 mt-0.5">{errors.poolLabel}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome da tarefa</label>
            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.taskLabel ? 'border-red-400' : 'border-gray-200'}`}
              value={form.taskLabel}
              onChange={e => set('taskLabel', e.target.value)}
              placeholder="Ex: Atividade, Peça"
            />
            {errors.taskLabel && <p className="text-xs text-red-500 mt-0.5">{errors.taskLabel}</p>}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: form.color === c ? '#1e3a5f' : 'transparent' }}
              >
                {form.color === c && <Check size={12} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        {/* Work days */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dias de trabalho</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                  form.workDays.includes(idx) ? 'text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                style={form.workDays.includes(idx) ? { backgroundColor: form.color } : {}}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.workDays && <p className="text-xs text-red-500 mt-0.5">{errors.workDays}</p>}
        </div>

        {/* Work hours */}
        <div className="grid grid-cols-2 gap-3">
          <TimeInput
            label="Início do expediente"
            value={form.startTime}
            onChange={v => set('startTime', v)}
            error={errors.startTime}
          />
          <TimeInput
            label="Fim do expediente"
            value={form.endTime}
            onChange={v => set('endTime', v)}
            error={errors.endTime}
          />
        </div>

        {/* Lunch break */}
        <div className="border border-gray-100 rounded-xl p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.hasLunch}
              onChange={e => set('hasLunch', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium text-gray-700">Tem intervalo de almoço</span>
          </label>
          {form.hasLunch && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <TimeInput
                label="Início do almoço"
                value={form.lunchStartTime}
                onChange={v => set('lunchStartTime', v)}
              />
              <TimeInput
                label="Fim do almoço"
                value={form.lunchEndTime}
                onChange={v => set('lunchEndTime', v)}
              />
            </div>
          )}
        </div>

      </div>

      <div className="flex gap-2 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 text-white rounded-lg py-2 text-sm font-medium transition-colors hover:opacity-90"
          style={{ backgroundColor: form.color }}
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

function formToConfig(form: FormState): Omit<ClientConfig, 'id' | 'createdAt' | 'taskExtraFields'> {
  const poolLabel = form.poolLabel.trim()
  const taskLabel = form.taskLabel.trim()
  return {
    name: form.name.trim(),
    poolLabel,
    poolLabelPlural: poolLabel + 's',
    taskLabel,
    taskLabelPlural: taskLabel + 's',
    color: form.color,
    workCalendar: {
      startHour: fromTimeStr(form.startTime),
      endHour: fromTimeStr(form.endTime),
      workDays: form.workDays,
      lunchStart: form.hasLunch && form.lunchStartTime ? fromTimeStr(form.lunchStartTime) : undefined,
      lunchEnd:   form.hasLunch && form.lunchEndTime   ? fromTimeStr(form.lunchEndTime)   : undefined,
    },
  }
}

function configToForm(c: ClientConfig): FormState {
  const cal = c.workCalendar
  return {
    name: c.name,
    poolLabel: c.poolLabel,
    taskLabel: c.taskLabel,
    color: c.color,
    startTime: toTimeStr(cal.startHour),
    endTime: toTimeStr(cal.endHour),
    hasLunch: cal.lunchStart !== undefined,
    lunchStartTime: cal.lunchStart !== undefined ? toTimeStr(cal.lunchStart) : '12:00',
    lunchEndTime:   cal.lunchEnd   !== undefined ? toTimeStr(cal.lunchEnd)   : '13:00',
    workDays: cal.workDays,
  }
}

export function ClientSelector() {
  const { clients, activeClient, setClient, addClient, updateClient, deleteClient, setShowClientSelector } = useStore(useShallow(s => ({
    clients: s.clients,
    activeClient: s.activeClient,
    setClient: s.setClient,
    addClient: s.addClient,
    updateClient: s.updateClient,
    deleteClient: s.deleteClient,
    setShowClientSelector: s.setShowClientSelector,
  })))

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>(clients.length === 0 ? 'create' : 'list')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleCreate = (form: FormState) => {
    const id = addClient(formToConfig(form))
    setClient(id)
  }

  const handleEdit = (form: FormState) => {
    if (!editingId) return
    updateClient(editingId, formToConfig(form))
    setEditingId(null)
    setMode('list')
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta empresa e todos os seus dados?')) return
    deleteClient(id)
    if (clients.length <= 1) setMode('create')
  }

  const handleSelect = (id: string) => {
    setClient(id)
    setShowClientSelector(false)
  }

  const canClose = clients.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/90 p-4">
      {mode === 'create' && (
        <CompanyForm
          title="Nova empresa"
          initial={DEFAULT_FORM}
          onSave={handleCreate}
          onCancel={() => canClose ? setMode('list') : undefined}
        />
      )}

      {mode === 'edit' && editingId && (
        <CompanyForm
          title="Editar empresa"
          initial={configToForm(clients.find(c => c.id === editingId)!)}
          onSave={handleEdit}
          onCancel={() => setMode('list')}
        />
      )}

      {mode === 'list' && (
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">Empresas</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('create')}
                className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <Plus size={13} /> Nova empresa
              </button>
              {canClose && (
                <button onClick={() => setShowClientSelector(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {clients.map(client => (
              <div
                key={client.id}
                className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                  activeClient === client.id ? 'border-current' : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                }`}
                style={activeClient === client.id ? { borderColor: client.color, backgroundColor: `${client.color}10` } : {}}
                onClick={() => handleSelect(client.id)}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                  style={{ backgroundColor: client.color }}
                >
                  {client.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{client.name}</div>
                  <div className="text-xs text-gray-400">
                    {client.poolLabelPlural} · {client.taskLabelPlural} · {toTimeStr(client.workCalendar.startHour)}–{toTimeStr(client.workCalendar.endHour)}
                  </div>
                </div>
                {activeClient === client.id && (
                  <Check size={16} style={{ color: client.color }} />
                )}
                <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => { setEditingId(client.id); setMode('edit') }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {clients.length === 0 && (
            <div className="text-center py-8">
              <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma empresa cadastrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
