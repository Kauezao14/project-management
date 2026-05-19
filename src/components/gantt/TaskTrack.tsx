import { useMemo } from 'react'
import { SortableContext } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { isToday } from 'date-fns'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { TaskBar } from './TaskBar'
import { calcLeft, calcWidth, generateMultiPeriodColumns, TIMELINE_PERIODS } from '../../lib/ganttLayout'
import { useGanttTimeline } from '../../contexts/GanttTimelineContext'

interface Props {
  poolId: string
}

// Disabled sorting strategy: bars are absolutely positioned by scheduledStart,
// so dnd-kit's translate-based visual reordering conflicts with calcLeft positions.
const noopStrategy = () => null

export function TaskTrack({ poolId }: Props) {
  const view = useStore(s => s.view)

  // Subscribe only to this pool's tasks — prevents cross-pool re-renders
  const tasks = useStore(
    useShallow(s =>
      s.tasks
        .filter(t => t.poolId === poolId)
        .sort((a, b) => a.order - b.order)
    )
  )

  const { anchor, totalWidth } = useGanttTimeline()
  const { total: totalPeriods } = TIMELINE_PERIODS[view]

  const { setNodeRef } = useDroppable({ id: `pool-drop-${poolId}`, data: { poolId } })

  // Columns only change when view or anchor changes — not on every drag event
  const columns = useMemo(
    () => generateMultiPeriodColumns(view, anchor, totalPeriods),
    [view, anchor, totalPeriods]
  )

  // Task layout (left + clamped width) only recomputes when tasks or anchor change
  const taskLayouts = useMemo(() => {
    return tasks.map((task, i) => {
      const left = calcLeft(task.scheduledStart, anchor, view)
      const natural = calcWidth(task.scheduledStart, task.scheduledEnd, view)
      const nextTask = tasks[i + 1]
      const available = nextTask
        ? calcLeft(nextTask.scheduledStart, anchor, view) - left
        : Infinity
      const width = Math.max(Math.min(natural, available), 4)
      return { task, left, width }
    })
  }, [tasks, anchor, view])

  const nowLeft = useMemo(
    () => calcLeft(new Date().toISOString(), anchor, view),
    [anchor, view]
  )
  const showNowMarker = nowLeft >= 0 && nowLeft <= totalWidth

  return (
    <div className="flex-1 relative" style={{ height: 48 }}>
      {/* Column background grid */}
      <div className="absolute inset-0 flex pointer-events-none">
        {columns.map(col => {
          const isCurrentDay = view !== 'daily' && isToday(col.date)
          return (
            <div
              key={col.key}
              className={`shrink-0 h-full border-r border-gray-100 ${isCurrentDay ? 'bg-blue-50/40' : ''}`}
              style={{ width: col.widthPx }}
            />
          )
        })}
      </div>

      {/* Tasks drop zone */}
      <div ref={setNodeRef} className="relative h-full" style={{ width: totalWidth }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={noopStrategy}>
          {taskLayouts.map(({ task, left, width }) => (
            <TaskBar key={task.id} task={task} left={left} width={width} />
          ))}
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
