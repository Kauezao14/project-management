import { useMemo } from 'react'
import { SortableContext } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { isToday } from 'date-fns'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { TaskBar } from './TaskBar'
import { calcLeft, calcWidth, generateMultiPeriodColumns, TIMELINE_PERIODS } from '../../lib/ganttLayout'
import { useGanttTimeline } from '../../contexts/GanttTimelineContext'
import { useDragPreview } from '../../contexts/DragPreviewContext'
import type { Task } from '../../types/task'

interface Props {
  poolId: string
}

const noopStrategy = () => null

/** Compute sequential preview positions for tasks in hypothetical order */
function computePreview(
  orderedTasks: Task[],
  queueStart: Date,
  timelineAnchor: Date,
  view: Parameters<typeof calcLeft>[2],
): Map<string, { left: number; width: number; origLeft: number }> {
  const result = new Map<string, { left: number; width: number; origLeft: number }>()
  let cursor = queueStart.getTime()
  for (const t of orderedTasks) {
    const dur = new Date(t.scheduledEnd).getTime() - new Date(t.scheduledStart).getTime()
    const left = calcLeft(new Date(cursor).toISOString(), timelineAnchor, view)
    const origLeft = calcLeft(t.scheduledStart, timelineAnchor, view)
    const end = cursor + dur
    const width = Math.max(calcWidth(new Date(cursor).toISOString(), new Date(end).toISOString(), view), 4)
    result.set(t.id, { left, width, origLeft })
    cursor = end
  }
  return result
}

export function TaskTrack({ poolId }: Props) {
  const view = useStore(s => s.view)

  const tasks = useStore(
    useShallow(s =>
      s.tasks
        .filter(t => t.poolId === poolId)
        .sort((a, b) => a.order - b.order)
    )
  )

  const projectColors = useStore(
    useShallow(s => Object.fromEntries(s.projects.map(p => [p.id, p.color])))
  )

  const { anchor: timelineAnchor, totalWidth } = useGanttTimeline()
  const { total: totalPeriods } = TIMELINE_PERIODS[view]
  const { draggingId, overPoolId, overIndex } = useDragPreview()

  const { setNodeRef } = useDroppable({ id: `pool-drop-${poolId}`, data: { poolId } })

  const columns = useMemo(
    () => generateMultiPeriodColumns(view, timelineAnchor, totalPeriods),
    [view, timelineAnchor, totalPeriods]
  )

  // Compute base layouts
  const taskLayouts = useMemo(() => {
    return tasks.map((task) => {
      const barEnd = task.actualEnd ?? task.scheduledEnd
      const left = calcLeft(task.scheduledStart, timelineAnchor, view)
      const width = Math.max(calcWidth(task.scheduledStart, barEnd, view), 4)
      const accentColor = (task.projectId && projectColors[task.projectId]) ?? '#94a3b8'
      return { task, left, width, accentColor }
    })
  }, [tasks, timelineAnchor, view, projectColors])

  // Preview layout while dragging — recomputed only when drag state changes
  const previewMap = useMemo<Map<string, { left: number; width: number; origLeft: number }> | null>(() => {
    if (!draggingId) return null

    const isSourcePool = tasks.some(t => t.id === draggingId)
    const isTargetPool = overPoolId === poolId
    if (!isSourcePool && !isTargetPool) return null

    const allTasks = useStore.getState().tasks
    const draggingTask = allTasks.find(t => t.id === draggingId)
    if (!draggingTask) return null

    // Build hypothetical order for this pool
    let hypo: Task[] = tasks.filter(t => t.id !== draggingId)
    if (isTargetPool && overIndex >= 0) {
      const at = Math.min(overIndex, hypo.length)
      hypo = [...hypo.slice(0, at), draggingTask, ...hypo.slice(at)]
    }

    // Queue starts at the first task's current scheduledStart
    const queueStart = tasks[0] ? new Date(tasks[0].scheduledStart) : new Date()
    return computePreview(hypo, queueStart, timelineAnchor, view)
  }, [draggingId, overPoolId, overIndex, tasks, timelineAnchor, view, poolId])

  const nowLeft = useMemo(
    () => calcLeft(new Date().toISOString(), timelineAnchor, view),
    [timelineAnchor, view]
  )
  const showNowMarker = nowLeft >= 0 && nowLeft <= totalWidth

  const isDragActive = !!draggingId

  return (
    <div className="flex-1 relative" style={{ height: 48 }}>
      {/* Column background grid */}
      <div className="absolute inset-0 flex pointer-events-none">
        {columns.map(col => {
          const isCurrentDay = view !== 'daily' && isToday(col.date)
          const isWeekend = view !== 'daily' && (col.date.getDay() === 0 || col.date.getDay() === 6)
          return (
            <div
              key={col.key}
              className={`shrink-0 h-full border-r border-gray-100 ${
                isCurrentDay ? 'bg-blue-50/40' : isWeekend ? 'bg-gray-50/60' : ''
              }`}
              style={{ width: col.widthPx }}
            />
          )
        })}
      </div>

      {/* Tasks drop zone */}
      <div ref={setNodeRef} className="relative h-full" style={{ width: totalWidth }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={noopStrategy}>
          {taskLayouts.map(({ task, left, width }) => {
            const preview = previewMap?.get(task.id)
            const isDraggingThis = task.id === draggingId

            // During drag: use preview position for non-dragged tasks
            const displayLeft = preview && !isDraggingThis ? preview.left : left
            const displayWidth = preview && !isDraggingThis ? preview.width : width

            // Direction badge: compare preview position to original
            let dragDirection: 'forward' | 'backward' | null = null
            if (preview && !isDraggingThis && isDragActive) {
              const delta = preview.left - preview.origLeft
              if (delta > 3) dragDirection = 'forward'
              else if (delta < -3) dragDirection = 'backward'
            }

            return (
              <TaskBar
                key={task.id}
                task={task}
                left={displayLeft}
                width={displayWidth}
                dragDirection={dragDirection}
                style={isDraggingThis ? { opacity: 0.25 } : isDragActive && preview ? { opacity: 0.85, transition: 'left 120ms ease' } : undefined}
              />
            )
          })}
        </SortableContext>

        {showNowMarker && (
          <div
            className="absolute top-0 bottom-0 w-px bg-red-400 pointer-events-none z-20"
            style={{ left: nowLeft }}
          />
        )}
      </div>
    </div>
  )
}
