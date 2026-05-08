import { differenceInMinutes, getDaysInMonth, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import { HOUR_PX, DAY_PX, DAY_PX_MONTH } from '../config/constants'
import type { View } from '../types/app'

export interface TimelineColumn {
  key: string
  label: string
  widthPx: number
  date: Date
}

/** Pixels per work-hour for each view */
function pxPerHour(view: View): number {
  if (view === 'daily') return HOUR_PX          // 60 px/h
  if (view === 'weekly') return DAY_PX / 24      // 5 px/h
  return DAY_PX_MONTH / 24                       // ~1.67 px/h
}

/** Pixel offset of scheduledStart from viewportStart */
export function calcLeft(scheduledStart: string, viewportStart: Date, view: View): number {
  const start = new Date(scheduledStart)
  const diffMin = differenceInMinutes(start, viewportStart)
  return (diffMin / 60) * pxPerHour(view)
}

/** Pixel width for a task with given duration */
export function calcWidth(durationHours: number, view: View): number {
  return durationHours * pxPerHour(view)
}

/** Total width of the whole timeline area */
export function totalTimelinePx(view: View, viewportStart: Date): number {
  if (view === 'daily') return 24 * HOUR_PX
  if (view === 'weekly') return 7 * DAY_PX
  return getDaysInMonth(viewportStart) * DAY_PX_MONTH
}

/** Snap a date to the beginning of the current view period */
export function getViewportStart(view: View, date: Date): Date {
  if (view === 'daily') return startOfDay(date)
  if (view === 'weekly') return startOfWeek(date, { weekStartsOn: 1 })
  return startOfMonth(date)
}

export function generateTimelineColumns(view: View, viewportStart: Date): TimelineColumn[] {
  const cols: TimelineColumn[] = []

  if (view === 'daily') {
    for (let h = 0; h < 24; h++) {
      const d = new Date(viewportStart)
      d.setHours(h, 0, 0, 0)
      cols.push({ key: `h${h}`, label: `${String(h).padStart(2, '0')}h`, widthPx: HOUR_PX, date: d })
    }
  } else if (view === 'weekly') {
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    for (let i = 0; i < 7; i++) {
      const d = new Date(viewportStart)
      d.setDate(d.getDate() + i)
      cols.push({
        key: `d${i}`,
        label: `${DAYS[d.getDay()]} ${d.getDate()}`,
        widthPx: DAY_PX,
        date: d,
      })
    }
  } else {
    const daysInMonth = getDaysInMonth(viewportStart)
    for (let i = 0; i < daysInMonth; i++) {
      const d = new Date(viewportStart)
      d.setDate(d.getDate() + i)
      cols.push({
        key: `d${i}`,
        label: `${d.getDate()}`,
        widthPx: DAY_PX_MONTH,
        date: d,
      })
    }
  }

  return cols
}
