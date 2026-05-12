import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, PlayCircle, AlertTriangle, Clock, Trash2, Edit2, Moon, Coffee } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import type { Task } from '../../types/task'

// Paleta de 12 cores distintas para identificar tarefas individualmente
const TASK_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
  '#84cc16', // lime
  '#ef4444', // red (reservado mas disponível se necessário)
]

// Cor determinística baseada no ID da tarefa — sempre a mesma cor para o mesmo ID
function taskColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  // Evita o vermelho (índice 11) para não confundir com "Atrasado"
  return TASK_PALETTE[hash % (TASK_PALETTE.length - 1)]
}

const STATUS_META = {
  pending:     { label: 'Pendente',      opacity: 1,    borderColor: null },
  in_progress: { label: 'Em andamento',  opacity: 1,    borderColor: '#fbbf24' },
  completed:   { label: 'Concluído',     opacity: 0.55, borderColor: '#34d399' },
  delayed:     { label: 'Atrasado',      opacity: 1,    borderColor: '#ef4444' },
}

interface Props {
  task: Task
  left: number
  width: number
}

export function TaskBar({ task, left, width }: Props) {
  const [hovered, setHovered] = useState(false)
  const { setEditingTask, deleteTask, markCompleted, markInProgress, markDelayed } = useStore(useShallow(s => ({
    setEditingTask: s.setEditingTask,
    deleteTask: s.deleteTask,
    markCompleted: s.markCompleted,
    markInProgress: s.markInProgress,
    markDelayed: s.markDelayed,
  })))

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const barColor = taskColor(task.id)
  const meta = STATUS_META[task.status]
  const minWidth = width >= 80

  const style = {
    position: 'absolute' as const,
    left,
    width: Math.max(width, 60),
    top: 6,
    height: 36,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : hovered ? 10 : 1,
    opacity: isDragging ? 0.7 : meta.opacity,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="task-bar cursor-grab active:cursor-grabbing select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...attributes}
      {...listeners}
    >
      {/* Borda de status à esquerda */}
      <div
        className="w-full h-full rounded-md flex items-center px-2 gap-1.5 overflow-hidden relative"
        style={{
          backgroundColor: barColor,
          // Borda esquerda grossa indica o status
          boxShadow: meta.borderColor
            ? `inset 3px 0 0 0 ${meta.borderColor}, 0 1px 3px rgba(0,0,0,0.25)`
            : '0 1px 3px rgba(0,0,0,0.2)',
          outline: `1px solid rgba(0,0,0,0.15)`,
        }}
      >
        {/* Ícone de status */}
        {task.status === 'delayed'     && <AlertTriangle size={11} className="shrink-0 text-white" />}
        {task.status === 'completed'   && <CheckCircle   size={11} className="shrink-0 text-white" />}
        {task.status === 'in_progress' && <PlayCircle    size={11} className="shrink-0 text-white" />}

        {/* Título */}
        {minWidth && (
          <span className="text-xs text-white font-semibold truncate leading-none drop-shadow-sm">
            {task.title}
          </span>
        )}

        {/* Badges de regime */}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          {task.lunchWork && (
            <span title="Trabalha no almoço" className="text-white/90">
              <Coffee size={10} />
            </span>
          )}
          {task.overtime && (
            <span title="Hora extra" className="text-white/90">
              <Moon size={10} />
            </span>
          )}
          {task.status === 'delayed' && minWidth && (
            <span className="text-xs font-bold text-white/90 bg-red-600/70 px-1 rounded ml-1">
              Atrasado
            </span>
          )}
        </div>

        {/* Risco diagonal para concluído */}
        {task.status === 'completed' && (
          <div
            className="absolute inset-0 rounded-md pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 2px, transparent 2px, transparent 8px)',
            }}
          />
        )}
      </div>

      {/* Tooltip ao passar o mouse */}
      {hovered && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 bg-gray-900 text-white rounded-lg shadow-xl p-3 min-w-52 pointer-events-none"
          style={{ maxWidth: 280 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: barColor }} />
            <span className="font-semibold text-sm">{task.title}</span>
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: meta.borderColor ?? '#6b7280',
                  color: 'white',
                }}
              >
                {meta.label}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-0.5">
              <Clock size={10} />
              {task.durationHours}h — início: {format(parseISO(task.scheduledStart), "dd/MM HH:mm", { locale: ptBR })}
            </div>
            {task.notes && <div className="text-gray-400 pt-1 border-t border-gray-700">{task.notes}</div>}
          </div>

          {/* Botões de ação */}
          <div
            className="flex gap-1.5 mt-2 pt-2 border-t border-gray-700 pointer-events-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {task.status !== 'in_progress' && task.status !== 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); markInProgress(task.id) }}
                className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded"
              >
                <PlayCircle size={10} /> Iniciar
              </button>
            )}
            {task.status !== 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); markCompleted(task.id) }}
                className="flex items-center gap-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded"
              >
                <CheckCircle size={10} /> Concluir
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={(e) => { e.stopPropagation(); markDelayed(task.id) }}
                className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
              >
                <AlertTriangle size={10} /> Atraso
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTask(task.id) }}
              className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded ml-auto"
            >
              <Edit2 size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
              className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-red-600 text-white px-2 py-1 rounded"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
