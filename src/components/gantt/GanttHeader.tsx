import { useMemo } from 'react'
import { isToday } from 'date-fns'
import { useStore } from '../../store'
import { generateMultiPeriodColumns, TIMELINE_PERIODS } from '../../lib/ganttLayout'
import { useGanttTimeline } from '../../contexts/GanttTimelineContext'
import { LABEL_WIDTH } from '../../config/constants'

export function GanttHeader() {
  const view = useStore(s => s.view)
  const { anchor, totalWidth } = useGanttTimeline()
  const { total: totalPeriods } = TIMELINE_PERIODS[view]
  const columns = useMemo(
    () => generateMultiPeriodColumns(view, anchor, totalPeriods),
    [view, anchor, totalPeriods]
  )

  return (
    <div
      className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20"
      style={{ height: 36, minWidth: LABEL_WIDTH + totalWidth }}
    >
      {/* Sticky label column */}
      <div
        className="shrink-0 border-r border-gray-200 bg-gray-50 sticky left-0 z-30"
        style={{ width: LABEL_WIDTH }}
      />
      {/* Timeline columns */}
      <div className="flex" style={{ width: totalWidth }}>
        {columns.map(col => {
          const isCurrentDay = view !== 'daily' && isToday(col.date)
          return (
            <div
              key={col.key}
              className={`shrink-0 flex items-center justify-center text-xs font-medium border-r border-gray-100 ${
                isCurrentDay ? 'bg-blue-100 text-blue-600' : 'text-gray-500'
              }`}
              style={{ width: col.widthPx }}
            >
              {col.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
