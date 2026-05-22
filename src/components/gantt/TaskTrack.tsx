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

const noopStrategy = () => null

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

  const { anchor, totalWidth } = useGanttTimeline()
  const { total: totalPeriods } = TIMELINE_PERIODS[view]

  const { setNodeRef } = useDroppable({ id: `pool-drop-${poolId}`, data: { poolId } })

  const columns = useMemo(
    () => generateMultiPeriodColumns(view, anchor, totalPeriods),
    [view, anchor, totalPeriods]
  )

  const taskLayouts = useMemo(() => {
    return tasks.map((task) => {
      const left = calcLeft(task.scheduledStart, anchor, view)
      const barEnd = task.actualEnd ?? task.scheduledEnd
      const width = Math.max(calcWidth(task.scheduledStart, barEnd, view), 4)
      const accentColor = (task.projectId && projectColors[task.projectId]) ?? '#94a3b8'
      return { task, left, width, accentColor }
    })
  }, [tasks, anchor, view, projectColors])

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
