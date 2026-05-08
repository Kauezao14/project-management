import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, PlayCircle, AlertTriangle, Clock, Trash2, Edit2 } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import type { Task } from '../../types/task'

const STATUS_COLORS = {
  pending: { bar: '#3b82f6', text: 'white', bg: '#dbeafe', label: 'Pendente' },
  in_progress: { bar: '#f59e0b', text: 'white', bg: '#fef3c7', label: 'Em andamento' },
  completed: { bar: '#10b981', text: 'white', bg: '#d1fae5', label: 'Concluído' },
  delayed: { bar: '#ef4444', text: 'white', bg: '#fee2e2', label: 'Atrasado' },
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

  const style = {
    position: 'absolute' as const,
    left,
    width: Math.max(width, 60),
    top: 8,
    height: 32,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : hovered ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  }

  const colors = STATUS_COLORS[task.status]
  const minWidth = width >= 100

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="task-bar rounded-md cursor-grab active:cursor-grabbing select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...attributes}
      {...listeners}
    >
      {/* Bar body */}
      <div
        className="w-full h-full rounded-md flex items-center px-2 gap-1 overflow-hidden"
        style={{ backgroundColor: colors.bar }}
      >
        {task.status === 'delayed' && <AlertTriangle size={11} className="shrink-0 text-white/90" />}
        {task.status === 'completed' && <CheckCircle size={11} className="shrink-0 text-white/90" />}
        {task.status === 'in_progress' && <PlayCircle size={11} className="shrink-0 text-white/90" />}
        {minWidth && (
          <span className="text-xs text-white font-medium truncate leading-none">{task.title}</span>
        )}
        {task.status === 'delayed' && minWidth && (
          <span className="text-xs text-white/80 font-semibold ml-auto shrink-0">Atrasado</span>
        )}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 bg-gray-900 text-white rounded-lg shadow-xl p-3 min-w-52 pointer-events-none"
          style={{ maxWidth: 280 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="font-semibold text-sm mb-1">{task.title}</div>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: colors.bar }}
              />
              {colors.label}
            </div>
            <div className="flex items-center gap-1">
              <Clock size={10} />
              {task.durationHours}h — início: {format(parseISO(task.scheduledStart), "dd/MM HH:mm", { locale: ptBR })}
            </div>
            {task.notes && <div className="text-gray-400 pt-1">{task.notes}</div>}
          </div>
          {/* Action buttons */}
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
