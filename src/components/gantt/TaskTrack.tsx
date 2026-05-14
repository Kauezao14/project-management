import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { isToday } from 'date-fns'
import { useStore } from '../../store'
import { TaskBar } from './TaskBar'
import { calcLeft, calcWidth, generateMultiPeriodColumns, TIMELINE_PERIODS } from '../../lib/ganttLayout'
import { useGanttTimeline } from '../../contexts/GanttTimelineContext'

interface Props {
  poolId: string
}

export function TaskTrack({ poolId }: Props) {
  const view = useStore(s => s.view)
  const allTasks = useStore(s => s.tasks)
  const { anchor, totalWidth } = useGanttTimeline()

  const tasks = allTasks
    .filter(t => t.poolId === poolId)
    .sort((a, b) => a.order - b.order)

  const { setNodeRef } = useDroppable({ id: `pool-drop-${poolId}`, data: { poolId } })

  const { total: totalPeriods } = TIMELINE_PERIODS[view]
  const columns = generateMultiPeriodColumns(view, anchor, totalPeriods)

  const now = new Date()
  const nowLeft = calcLeft(now.toISOString(), anchor, view)
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
        <SortableContext items={tasks.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          {tasks.map((task, i) => {
            const left = calcLeft(task.scheduledStart, anchor, view)
            const natural = calcWidth(task.scheduledStart, task.scheduledEnd, view)
            const nextTask = tasks[i + 1]
            const available = nextTask
              ? calcLeft(nextTask.scheduledStart, anchor, view) - left
              : Infinity
            const width = Math.max(Math.min(natural, available), 4)
            return (
              <TaskBar key={task.id} task={task} left={left} width={width} />
            )
          })}
        </SortableContext>

        {/* "Now" vertical marker */}
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
