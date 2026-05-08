import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { parseISO, isToday } from 'date-fns'
import { useStore } from '../../store'
import { TaskBar } from './TaskBar'
import { calcLeft, calcWidth, totalTimelinePx, generateTimelineColumns } from '../../lib/ganttLayout'

interface Props {
  poolId: string
}

export function TaskTrack({ poolId }: Props) {
  // Select raw values — no computed arrays inside the selector
  const view = useStore(s => s.view)
  const viewportStart = useStore(s => s.viewportStart)
  const allTasks = useStore(s => s.tasks)

  // Filter and sort outside the selector
  const tasks = allTasks
    .filter(t => t.poolId === poolId)
    .sort((a, b) => a.order - b.order)

  const { setNodeRef } = useDroppable({ id: `pool-drop-${poolId}`, data: { poolId } })
  const vStart = parseISO(viewportStart)
  const total = totalTimelinePx(view, vStart)
  const columns = generateTimelineColumns(view, vStart)

  const now = new Date()
  const nowLeft = calcLeft(now.toISOString(), vStart, view)
  const showNowMarker = nowLeft >= 0 && nowLeft <= total

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
      <div ref={setNodeRef} className="relative h-full" style={{ width: total }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          {tasks.map(task => (
            <TaskBar
              key={task.id}
              task={task}
              left={calcLeft(task.scheduledStart, vStart, view)}
              width={calcWidth(task.durationHours, view)}
            />
          ))}
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
