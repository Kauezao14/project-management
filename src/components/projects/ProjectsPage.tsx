import { useState } from 'react'
import { format, parseISO, differenceInHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Plus, Star, Clock, CheckCircle, PlayCircle, AlertTriangle,
  Edit2, Trash2, X, Check, FolderOpen, CalendarDays,
} from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { computeProjectPath } from '../../lib/criticalPath'
import type { Project } from '../../types/project'
import type { Task } from '../../types/task'

const PROJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#ef4444',
]

const STATUS_META = {
  pending:     { icon: <Clock size={12} />,          label: 'Pendente',      color: '#6b7280' },
  in_progress: { icon: <PlayCircle size={12} />,     label: 'Em andamento',  color: '#f59e0b' },
  completed:   { icon: <CheckCircle size={12} />,    label: 'Concluído',     color: '#10b981' },
  delayed:     { icon: <AlertTriangle size={12} />,  label: 'Atrasado',      color: '#ef4444' },
}

function ProjectForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { name: string; color: string; startDate?: string }
  onSave: (name: string, color: string, startDate?: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [color, setColor] = useState(initial.color)
  const [startDate, setStartDate] = useState(initial.startDate ?? '')
  const [error, setError] = useState('')

  const handleSave = () => {
    if (!name.trim()) { setError('Nome obrigatório'); return }
    onSave(name.trim(), color, startDate || undefined)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <input
          autoFocus
          className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-400' : 'border-gray-200'}`}
          placeholder="Nome do projeto..."
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
        />
        <div className="flex gap-1.5">
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={15} />
          </button>
          <button
            onClick={handleSave}
            className="p-2 text-white rounded-lg"
            style={{ backgroundColor: color }}
          >
            <Check size={15} />
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-gray-500 shrink-0">Início do projeto</label>
        <input
          type="date"
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
        {startDate && (
          <button
            onClick={() => setStartDate('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {PROJECT_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: color === c ? '#1e3a5f' : 'transparent' }}
          >
            {color === c && <Check size={10} className="text-white" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.round(value * 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function TaskRow({ task, isCritical }: { task: Task; isCritical: boolean }) {
  const meta = STATUS_META[task.status]
  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs ${isCritical ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
      <span style={{ color: meta.color }} className="shrink-0">{meta.icon}</span>
      {isCritical && <Star size={10} className="text-yellow-500 shrink-0" fill="currentColor" />}
      <span className={`flex-1 truncate font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {task.title}
      </span>
      <span className="text-gray-400 shrink-0">{task.durationHours}h</span>
      <span className="text-gray-400 shrink-0">
        {format(parseISO(task.scheduledStart), "dd/MM HH:mm", { locale: ptBR })}
      </span>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const allTasks = useStore(s => s.tasks)
  const allPools = useStore(s => s.pools)
  const { updateProject, deleteProject } = useStore(useShallow(s => ({
    updateProject: s.updateProject,
    deleteProject: s.deleteProject,
  })))

  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const projectTasks = allTasks.filter(t => t.projectId === project.id)
  const pathInfo = computeProjectPath(project.id, allTasks)

  const total = projectTasks.length
  const done = projectTasks.filter(t => t.status === 'completed').length
  const progress = total > 0 ? done / total : 0

  const startDate = pathInfo.startMs ? new Date(pathInfo.startMs) : null
  const endDate = pathInfo.endMs ? new Date(pathInfo.endMs) : null
  const durationH = startDate && endDate ? differenceInHours(endDate, startDate) : 0

  const hasDelay = projectTasks.some(t => t.status === 'delayed')

  if (editing) {
    return (
      <div className="rounded-xl border border-gray-200 p-4">
        <ProjectForm
          initial={{ name: project.name, color: project.color, startDate: project.startDate }}
          onSave={(name, color, startDate) => { updateProject(project.id, { name, color, startDate }); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ borderLeft: `4px solid ${project.color}` }}
        onClick={() => setExpanded(v => !v)}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: project.color }}
        >
          {project.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 text-sm truncate">{project.name}</span>
            {hasDelay && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Atrasado</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <div className="flex-1 max-w-32">
              <ProgressBar value={progress} color={project.color} />
            </div>
            <span className="text-xs text-gray-400">{done}/{total} tarefas</span>
            {project.startDate && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <CalendarDays size={11} />
                {format(parseISO(project.startDate), "dd/MM/yy", { locale: ptBR })}
              </span>
            )}
            {startDate && endDate && (
              <span className="text-xs text-gray-400">
                → {format(endDate, "dd/MM HH:mm", { locale: ptBR })} · {durationH}h
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => { if (confirm(`Excluir projeto "${project.name}"?`)) deleteProject(project.id) }}
            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && total > 0 && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {pathInfo.pools.map(poolInfo => {
            const pool = allPools.find(p => p.id === poolInfo.poolId)
            const floatH = Math.round(poolInfo.floatH * 10) / 10

            return (
              <div key={poolInfo.poolId} className="px-4 py-2">
                {/* Pool header */}
                <div className="flex items-center gap-2 mb-1">
                  {poolInfo.isCritical ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                      <Star size={9} fill="currentColor" /> {pool?.name ?? poolInfo.poolId} · crítico
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500">
                      {pool?.name ?? poolInfo.poolId}
                      <span className="text-gray-400 font-normal ml-1">· folga: {floatH}h</span>
                    </span>
                  )}
                </div>

                {/* Tasks in this pool */}
                <div className="space-y-0.5">
                  {poolInfo.tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isCritical={pathInfo.criticalTaskIds.has(task.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {expanded && total === 0 && (
        <div className="px-4 py-4 text-xs text-gray-400 border-t border-gray-100">
          Nenhuma tarefa atribuída a este projeto.
        </div>
      )}
    </div>
  )
}

export function ProjectsPage() {
  const { activeClient, projects, addProject } = useStore(useShallow(s => ({
    activeClient: s.activeClient,
    projects: s.projects,
    addProject: s.addProject,
  })))

  const [creating, setCreating] = useState(false)

  const clientProjects = projects.filter(p => p.clientId === activeClient)

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Projetos</h2>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Plus size={13} /> Novo projeto
            </button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <div className="mb-4">
            <ProjectForm
              initial={{ name: '', color: PROJECT_COLORS[0] }}
              onSave={(name, color, startDate) => { addProject(name, color, startDate); setCreating(false) }}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        {/* Legend */}
        {clientProjects.length > 0 && (
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Star size={10} className="text-yellow-500" fill="currentColor" /> Tarefa no caminho crítico
            </span>
            <span className="text-gray-400">·</span>
            <span>Folga = tempo disponível antes de atrasar o projeto</span>
          </div>
        )}

        {/* Projects list */}
        <div className="space-y-4">
          {clientProjects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>

        {/* Empty state */}
        {clientProjects.length === 0 && !creating && (
          <div className="text-center py-16">
            <FolderOpen size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">Nenhum projeto cadastrado</p>
            <p className="text-xs text-gray-300 mt-1">
              Crie um projeto e vincule atividades a ele pelo formulário de tarefa.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="mt-4 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Criar primeiro projeto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
