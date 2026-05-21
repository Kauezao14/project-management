import { useMemo } from 'react'
import { SortableContext } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { isToday } from 'date-fns'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { TaskBar } from './TaskBar'
import { calcLeft, generateMultiPeriodColumns, getWorkSegments, TIMELINE_PERIODS } from '../../lib/ganttLayout'
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

  // Work calendar for this pool — needed to compute work segments
  const workCalendar = useStore(
    useShallow(s => {
      const clientId = s.pools.find(p => p.id === poolId)?.clientId
      return s.clients.find(c => c.id === clientId)?.workCalendar ?? null
    })
  )

  // Project colors for extra segment rendering
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
      const effectiveEndHour = workCalendar
        ? (task.overtime ? workCalendar.endHour + (task.overtimeHours ?? 0) : workCalendar.endHour)
        : 24
      const segments = workCalendar
        ? getWorkSegments(
            task.scheduledStart, task.scheduledEnd,
            workCalendar, !task.lunchWork, effectiveEndHour,
            anchor, view,
          )
        : [{ left: calcLeft(task.scheduledStart, anchor, view), width: 4 }]

      const accentColor = (task.projectId && projectColors[task.projectId]) ?? '#94a3b8'
      return { task, left: segments[0].left, width: segments[0].width, extraSegments: segments.slice(1), accentColor }
    })
  }, [tasks, anchor, view, workCalendar, projectColors])

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
          {taskLayouts.map(({ task, left, width, extraSegments, accentColor }) => (
            <div key={task.id}>
              <TaskBar task={task} left={left} width={width} />
              {extraSegments.map((seg, i) => (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: seg.left,
                    width: seg.width,
                    top: 6,
                    height: 36,
                    borderRadius: 6,
                    backgroundColor: `${accentColor}18`,
                    boxShadow: `inset 4px 0 0 0 ${accentColor}`,
                    border: `1px solid ${accentColor}55`,
                  }}
                />
              ))}
            </div>
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
