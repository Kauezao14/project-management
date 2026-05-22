import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, PlayCircle, AlertTriangle, Clock, Trash2, Edit2, Moon, Coffee, Star } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { useCriticalPath } from '../../contexts/CriticalPathContext'
import type { Task } from '../../types/task'

const STATUS_META = {
  pending:     { label: 'Pendente',      opacity: 1,    statusColor: '#6b7280' },
  in_progress: { label: 'Em andamento',  opacity: 1,    statusColor: '#f59e0b' },
  completed:   { label: 'Concluído',     opacity: 0.55, statusColor: '#10b981' },
  delayed:     { label: 'Atrasado',      opacity: 1,    statusColor: '#ef4444' },
}

interface Props {
  task: Task
  left: number
  width: number
  dragDirection?: 'forward' | 'backward' | null
  style?: React.CSSProperties
}

export function TaskBar({ task, left, width, dragDirection, style: extraStyle }: Props) {
  const [open, setOpen] = useState(false)
  const barRef = useRef<HTMLDivElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({})

  const { setEditingTask, deleteTask, markCompleted, markInProgress, markDelayed } = useStore(useShallow(s => ({
    setEditingTask: s.setEditingTask,
    deleteTask: s.deleteTask,
    markCompleted: s.markCompleted,
    markInProgress: s.markInProgress,
    markDelayed: s.markDelayed,
  })))

  const project = useStore(s => task.projectId ? s.projects.find(p => p.id === task.projectId) ?? null : null)
  const criticalTaskIds = useCriticalPath()
  const isCritical = criticalTaskIds.has(task.id)

  // Accent = project color; fallback neutral for unassigned tasks
  const accentColor = project?.color ?? '#94a3b8'

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  // Stable ref — recreating this on every render confuses dnd-kit's node tracking
  const combinedRef = useCallback((el: HTMLDivElement | null) => {
    setNodeRef(el)
    barRef.current = el
  }, [setNodeRef])

  // Close popup when clicking outside both the bar and the popup
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Node
      if (
        (!popupRef.current || !popupRef.current.contains(target)) &&
        (!barRef.current || !barRef.current.contains(target))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  const handleBarClick = () => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const style: React.CSSProperties = {
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 292),
      zIndex: 9999,
      minWidth: 220,
      maxWidth: 280,
    }
    // Show above if enough space, otherwise below
    if (rect.top > 260) {
      style.bottom = window.innerHeight - rect.top + 8
    } else {
      style.top = rect.bottom + 8
    }
    setPopupStyle(style)
    setOpen(v => !v)
  }

  const meta = STATUS_META[task.status]
  const minWidth = width >= 60

  const barStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    width,
    top: 6,
    height: 36,
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 2 : open ? 10 : 1,
    opacity: isDragging ? 0.35 : meta.opacity,
    ...extraStyle,
  }

  return (
    <>
      <div
        ref={combinedRef}
        style={barStyle}
        className="task-bar cursor-grab active:cursor-grabbing select-none"
        onClick={handleBarClick}
        {...attributes}
        {...listeners}
      >
        <div
          className="w-full h-full rounded-md flex items-center px-2 gap-1.5 overflow-hidden relative"
          style={{
            backgroundColor: `${accentColor}18`,
            boxShadow: `inset 4px 0 0 0 ${accentColor}`,
            border: `1px solid ${accentColor}55`,
            outline: open ? `2px solid ${accentColor}` : 'none',
            outlineOffset: '1px',
          }}
        >
          {task.status === 'delayed'     && <AlertTriangle size={11} className="shrink-0" style={{ color: '#ef4444' }} />}
          {task.status === 'completed'   && <CheckCircle   size={11} className="shrink-0" style={{ color: '#10b981' }} />}
          {task.status === 'in_progress' && <PlayCircle    size={11} className="shrink-0" style={{ color: '#f59e0b' }} />}
          {dragDirection === 'forward'  && <span className="shrink-0 text-xs font-bold" style={{ color: '#f59e0b' }}>→</span>}
          {dragDirection === 'backward' && <span className="shrink-0 text-xs font-bold" style={{ color: '#3b82f6' }}>←</span>}

          {minWidth && (
            <span className="text-xs font-semibold truncate leading-none" style={{ color: '#1e293b' }}>
              {task.title}
            </span>
          )}

          <div className="ml-auto flex items-center gap-0.5 shrink-0">
            {isCritical && (
              <span title="Caminho crítico" style={{ color: '#eab308' }}>
                <Star size={10} fill="currentColor" />
              </span>
            )}
            {task.lunchWork && (
              <span title="Trabalha no almoço" style={{ color: accentColor }}>
                <Coffee size={10} />
              </span>
            )}
            {task.overtime && (
              <span title={`Hora extra (+${task.overtimeHours ?? '?'}h)`} style={{ color: accentColor }}>
                <Moon size={10} />
              </span>
            )}
            {task.status === 'delayed' && minWidth && (
              <span className="text-xs font-bold px-1 rounded ml-1" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}>
                Atrasado
              </span>
            )}
          </div>

          {task.status === 'completed' && (
            <div
              className="absolute inset-0 rounded-md pointer-events-none"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 8px)',
              }}
            />
          )}
        </div>
      </div>

      {open && createPortal(
        <div
          ref={popupRef}
          className="bg-gray-900 text-white rounded-lg shadow-2xl p-3 pointer-events-auto"
          style={popupStyle}
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: accentColor }} />
            <span className="font-semibold text-sm flex-1 truncate">{task.title}</span>
            {isCritical && <Star size={12} className="text-yellow-400 shrink-0" fill="currentColor" />}
          </div>

          {/* Details */}
          <div className="text-xs text-gray-300 space-y-1">
            {project && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                <span className="text-gray-400">{project.name}</span>
                {isCritical && <span className="text-yellow-400 font-medium">· caminho crítico</span>}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: meta.statusColor,
                  color: 'white',
                }}
              >
                {meta.label}
              </span>
            </div>
            <div className="flex items-center gap-1 pt-0.5">
              <Clock size={10} />
              {task.durationHours}h &nbsp;·&nbsp;
              {format(parseISO(task.scheduledStart), "dd/MM HH:mm", { locale: ptBR })}
              {' → '}
              {format(parseISO(task.actualEnd ?? task.scheduledEnd), "dd/MM HH:mm", { locale: ptBR })}
            </div>
            {task.notes && (
              <div className="text-gray-400 pt-1 border-t border-gray-700">{task.notes}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 mt-2 pt-2 border-t border-gray-700">
            {task.status !== 'in_progress' && task.status !== 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); markInProgress(task.id); setOpen(false) }}
                className="flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded"
              >
                <PlayCircle size={10} /> Iniciar
              </button>
            )}
            {task.status !== 'completed' && (
              <button
                onClick={(e) => { e.stopPropagation(); markCompleted(task.id); setOpen(false) }}
                className="flex items-center gap-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded"
              >
                <CheckCircle size={10} /> Concluir
              </button>
            )}
            {task.status === 'in_progress' && (
              <button
                onClick={(e) => { e.stopPropagation(); markDelayed(task.id); setOpen(false) }}
                className="flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded"
              >
                <AlertTriangle size={10} /> Atraso
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setEditingTask(task.id); setOpen(false) }}
              className="flex items-center gap-1 text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded ml-auto"
            >
              <Edit2 size={10} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteTask(task.id); setOpen(false) }}
              className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-red-600 text-white px-2 py-1 rounded"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
