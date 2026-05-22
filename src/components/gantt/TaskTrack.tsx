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

/** Returns which direction each task would shift if the drag were completed */
function computeDirections(
  tasks: Task[],
  draggingId: string,
  draggingTask: Task,
  _isSourcePool: boolean,
  isTargetPool: boolean,
  overIndex: number,
): Map<string, 'forward' | 'backward'> {
  const currentIdx = new Map(tasks.map((t, i) => [t.id, i]))
  let hypo = tasks.filter(t => t.id !== draggingId)
  if (isTargetPool && overIndex >= 0) {
    const at = Math.min(overIndex, hypo.length)
    hypo = [...hypo.slice(0, at), draggingTask, ...hypo.slice(at)]
  }
  const newIdx = new Map(hypo.map((t, i) => [t.id, i]))

  const result = new Map<string, 'forward' | 'backward'>()
  for (const t of tasks) {
    if (t.id === draggingId) continue
    const oi = currentIdx.get(t.id) ?? 0
    const ni = newIdx.get(t.id) ?? oi
    if (ni > oi) result.set(t.id, 'forward')
    else if (ni < oi) result.set(t.id, 'backward')
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

  // Compute base layouts — ensure no two bars in the same pool visually overlap.
  // When a bar's minimum display width (4px) exceeds its actual time width, the
  // next bar starts where the previous one visually ends, not at its raw pixel pos.
  const taskLayouts = useMemo(() => {
    let minLeft = -Infinity
    return tasks.map((task) => {
      const barEnd = task.actualEnd ?? task.scheduledEnd
      const rawLeft = calcLeft(task.scheduledStart, timelineAnchor, view)
      const width = Math.max(calcWidth(task.scheduledStart, barEnd, view), 4)
      const left = Math.max(rawLeft, minLeft)
      minLeft = left + width
      const accentColor = (task.projectId && projectColors[task.projectId]) ?? '#94a3b8'
      return { task, left, width, accentColor }
    })
  }, [tasks, timelineAnchor, view, projectColors])

  // Direction arrows while dragging — which tasks shift forward or backward
  const directionMap = useMemo<Map<string, 'forward' | 'backward'> | null>(() => {
    if (!draggingId) return null

    const isSourcePool = tasks.some(t => t.id === draggingId)
    const isTargetPool = overPoolId === poolId
    if (!isSourcePool && !isTargetPool) return null

    const draggingTask = useStore.getState().tasks.find(t => t.id === draggingId)
    if (!draggingTask) return null

    return computeDirections(tasks, draggingId, draggingTask, isSourcePool, isTargetPool, overIndex)
  }, [draggingId, overPoolId, overIndex, tasks, poolId])

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
            const isDraggingThis = task.id === draggingId
            const dragDirection = isDragActive && !isDraggingThis
              ? (directionMap?.get(task.id) ?? null)
              : null

            return (
              <TaskBar
                key={task.id}
                task={task}
                left={left}
                width={width}
                dragDirection={dragDirection}
                style={isDraggingThis ? { opacity: 0.25 } : undefined}
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
