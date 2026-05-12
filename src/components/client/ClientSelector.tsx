import { useState, useEffect } from 'react'
import { Plus, Building2, Edit2, Trash2, X, Check, ExternalLink, Loader } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { fetchAllCompanies, upsertCompany, deleteCompany } from '../../lib/supabaseSync'
import type { ClientConfig } from '../../types/client'

const COLOR_PALETTE = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#ef4444',
]

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function toTimeStr(h: number): string {
  const hours = Math.floor(h)
  const mins = Math.round((h - hours) * 60)
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function fromTimeStr(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + (m || 0) / 60
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type FormState = {
  name: string
  slug: string
  poolLabel: string
  taskLabel: string
  color: string
  startTime: string
  endTime: string
  hasLunch: boolean
  lunchStartTime: string
  lunchEndTime: string
  workDays: number[]
}

const DEFAULT_FORM: FormState = {
  name: '', slug: '', poolLabel: '', taskLabel: '',
  color: COLOR_PALETTE[0],
  startTime: '07:00', endTime: '17:00',
  hasLunch: true, lunchStartTime: '12:00', lunchEndTime: '13:00',
  workDays: [1, 2, 3, 4, 5],
}

function TimeInput({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="time"
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-400' : 'border-gray-200'}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

function CompanyForm({ initial, onSave, onCancel, title, saving }: {
  initial: FormState
  onSave: (f: FormState) => Promise<void>
  onCancel: () => void
  title: string
  saving: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [slugManual, setSlugManual] = useState(!!initial.slug)

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(prev => {
      const next = { ...prev, [k]: v }
      if (k === 'name' && !slugManual) next.slug = nameToSlug(v as string)
      return next
    })
  }

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
    if (!form.slug.trim()) e.slug = 'Obrigatório'
    if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = 'Apenas letras minúsculas, números e hífens'
    if (!form.poolLabel.trim()) e.poolLabel = 'Obrigatório'
    if (!form.taskLabel.trim()) e.taskLabel = 'Obrigatório'
    if (!form.startTime) e.startTime = 'Obrigatório'
    if (!form.endTime) e.endTime = 'Obrigatório'
    if (form.startTime && form.endTime && fromTimeStr(form.endTime) <= fromTimeStr(form.startTime))
      e.endTime = 'Deve ser após o início'
    if (form.workDays.length === 0) e.workDays = 'Selecione ao menos 1 dia'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => { if (validate()) onSave(form) }

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome da empresa</label>
          <input
            autoFocus
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder="Ex: PSG, Dominus, Acme..."
          />
          {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
        </div>

        {/* Slug / URL */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">URL de acesso</label>
          <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 border-gray-200">
            <span className="px-3 py-2 bg-gray-50 text-gray-400 text-xs border-r border-gray-200 whitespace-nowrap select-none">
              /#/c/
            </span>
            <input
              className="flex-1 px-3 py-2 text-sm focus:outline-none"
              value={form.slug}
              onChange={e => { setSlugManual(true); setField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
              placeholder="minha-empresa"
            />
          </div>
          {errors.slug
            ? <p className="text-xs text-red-500 mt-0.5">{errors.slug}</p>
            : <p className="text-xs text-gray-400 mt-0.5">Link que você vai compartilhar com o cliente</p>
          }
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome da fila</label>
            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.poolLabel ? 'border-red-400' : 'border-gray-200'}`}
              value={form.poolLabel}
              onChange={e => setField('poolLabel', e.target.value)}
              placeholder="Ex: Máquina, Técnico"
            />
            {errors.poolLabel && <p className="text-xs text-red-500 mt-0.5">{errors.poolLabel}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome da tarefa</label>
            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.taskLabel ? 'border-red-400' : 'border-gray-200'}`}
              value={form.taskLabel}
              onChange={e => setField('taskLabel', e.target.value)}
              placeholder="Ex: Atividade, Peça"
            />
            {errors.taskLabel && <p className="text-xs text-red-500 mt-0.5">{errors.taskLabel}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setField('color', c)}
                className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: form.color === c ? '#1e3a5f' : 'transparent' }}>
                {form.color === c && <Check size={12} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Dias de trabalho</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, idx) => (
              <button key={idx} type="button" onClick={() => toggleDay(idx)}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${form.workDays.includes(idx) ? 'text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                style={form.workDays.includes(idx) ? { backgroundColor: form.color } : {}}>
                {label}
              </button>
            ))}
          </div>
          {errors.workDays && <p className="text-xs text-red-500 mt-0.5">{errors.workDays}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TimeInput label="Início do expediente" value={form.startTime} onChange={v => setField('startTime', v)} error={errors.startTime} />
          <TimeInput label="Fim do expediente" value={form.endTime} onChange={v => setField('endTime', v)} error={errors.endTime} />
        </div>

        <div className="border border-gray-100 rounded-xl p-3 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.hasLunch} onChange={e => setField('hasLunch', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-gray-700">Tem intervalo de almoço</span>
          </label>
          {form.hasLunch && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <TimeInput label="Início do almoço" value={form.lunchStartTime} onChange={v => setField('lunchStartTime', v)} />
              <TimeInput label="Fim do almoço" value={form.lunchEndTime} onChange={v => setField('lunchEndTime', v)} />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex-1 text-white rounded-lg py-2 text-sm font-medium transition-colors hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ backgroundColor: form.color }}>
          {saving && <Loader size={14} className="animate-spin" />}
          Salvar
        </button>
      </div>
    </div>
  )
}

function formToClient(form: FormState, id: string): ClientConfig {
  const poolLabel = form.poolLabel.trim()
  const taskLabel = form.taskLabel.trim()
  return {
    id,
    slug: form.slug.trim(),
    name: form.name.trim(),
    color: form.color,
    poolLabel,
    poolLabelPlural: poolLabel + 's',
    taskLabel,
    taskLabelPlural: taskLabel + 's',
    taskExtraFields: [],
    workCalendar: {
      startHour: fromTimeStr(form.startTime),
      endHour: fromTimeStr(form.endTime),
      workDays: form.workDays,
      lunchStart: form.hasLunch && form.lunchStartTime ? fromTimeStr(form.lunchStartTime) : undefined,
      lunchEnd: form.hasLunch && form.lunchEndTime ? fromTimeStr(form.lunchEndTime) : undefined,
    },
    createdAt: new Date().toISOString(),
  }
}

function clientToForm(c: ClientConfig): FormState {
  const cal = c.workCalendar
  return {
    name: c.name, slug: c.slug,
    poolLabel: c.poolLabel, taskLabel: c.taskLabel,
    color: c.color,
    startTime: toTimeStr(cal.startHour),
    endTime: toTimeStr(cal.endHour),
    hasLunch: cal.lunchStart !== undefined,
    lunchStartTime: cal.lunchStart !== undefined ? toTimeStr(cal.lunchStart) : '12:00',
    lunchEndTime: cal.lunchEnd !== undefined ? toTimeStr(cal.lunchEnd) : '13:00',
    workDays: cal.workDays,
  }
}

export function ClientSelector() {
  const { addClient } = useStore(useShallow(s => ({ addClient: s.addClient })))

  const [companies, setCompanies] = useState<ClientConfig[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingCompany, setEditingCompany] = useState<ClientConfig | null>(null)
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    setLoadingList(true)
    fetchAllCompanies().then(data => { setCompanies(data); setLoadingList(false) })
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!loadingList && companies.length === 0) setMode('create')
  }, [loadingList, companies.length])

  const handleCreate = async (form: FormState) => {
    setSaving(true)
    const id = crypto.randomUUID()
    const client = formToClient(form, id)
    addClient(client)
    await upsertCompany(client)
    setSaving(false)
    window.location.hash = `#/c/${form.slug}`
  }

  const handleEdit = async (form: FormState) => {
    if (!editingCompany) return
    setSaving(true)
    const client = formToClient(form, editingCompany.id)
    await upsertCompany(client)
    setSaving(false)
    refresh()
    setMode('list')
    setEditingCompany(null)
  }

  const handleDelete = async (company: ClientConfig) => {
    if (!confirm(`Excluir "${company.name}" e todos os seus dados?`)) return
    await deleteCompany(company.id)
    refresh()
  }

  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center p-4">
      {mode === 'create' && (
        <CompanyForm
          title="Nova empresa"
          initial={DEFAULT_FORM}
          onSave={handleCreate}
          onCancel={() => companies.length > 0 ? setMode('list') : undefined}
          saving={saving}
        />
      )}

      {mode === 'edit' && editingCompany && (
        <CompanyForm
          title="Editar empresa"
          initial={clientToForm(editingCompany)}
          onSave={handleEdit}
          onCancel={() => { setMode('list'); setEditingCompany(null) }}
          saving={saving}
        />
      )}

      {mode === 'list' && (
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800">Empresas</h2>
            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Plus size={13} /> Nova empresa
            </button>
          </div>

          {loadingList ? (
            <div className="flex items-center justify-center py-10">
              <Loader size={20} className="animate-spin text-gray-400" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8">
              <Building2 size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma empresa cadastrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {companies.map(company => (
                <div key={company.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 hover:border-gray-200 hover:bg-gray-50 transition-all group"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                    style={{ backgroundColor: company.color }}
                  >
                    {company.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{company.name}</div>
                    <div className="text-xs text-gray-400">
                      {company.poolLabelPlural} · {company.taskLabelPlural} · {toTimeStr(company.workCalendar.startHour)}–{toTimeStr(company.workCalendar.endHour)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a
                      href={`#/c/${company.slug}`}
                      className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <ExternalLink size={11} /> Abrir
                    </a>
                    <button
                      onClick={() => { setEditingCompany(company); setMode('edit') }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(company)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
