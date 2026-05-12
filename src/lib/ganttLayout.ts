import { differenceInMinutes, getDaysInMonth, startOfDay, startOfWeek, startOfMonth, addDays, addWeeks, addMonths } from 'date-fns'
import { HOUR_PX, DAY_PX, DAY_PX_MONTH } from '../config/constants'
import type { View } from '../types/app'

export interface TimelineColumn {
  key: string
  label: string
  widthPx: number
  date: Date
}

/** Pixels per real hour for each view */
export function pxPerHour(view: View): number {
  if (view === 'daily') return HOUR_PX          // 60 px/h
  if (view === 'weekly') return DAY_PX / 24      // 5 px/h
  return DAY_PX_MONTH / 24                       // ~1.67 px/h
}

/** How many periods to pre-render before and total, per view */
export const TIMELINE_PERIODS = {
  daily:   { before: 3, total: 14 },
  weekly:  { before: 3, total: 12 },
  monthly: { before: 2, total: 12 },
} as const

/** Advance one period forward */
export function nextPeriodStart(view: View, date: Date): Date {
  if (view === 'daily') return startOfDay(addDays(date, 1))
  if (view === 'weekly') return startOfWeek(addWeeks(date, 1), { weekStartsOn: 1 })
  return startOfMonth(addMonths(date, 1))
}

/** Compute the leftmost rendered date (anchor) from the current viewportStart */
export function computeAnchorDate(view: View, viewportStart: Date): Date {
  const { before } = TIMELINE_PERIODS[view]
  if (view === 'daily') return startOfDay(addDays(viewportStart, -before))
  if (view === 'weekly') return startOfWeek(addWeeks(viewportStart, -before), { weekStartsOn: 1 })
  return startOfMonth(addMonths(viewportStart, -before))
}

/** Convert a scrollLeft pixel offset back to a calendar date */
export function scrollLeftToDate(scrollLeft: number, anchorDate: Date, view: View): Date {
  const msFromAnchor = (scrollLeft / pxPerHour(view)) * 3_600_000
  return new Date(anchorDate.getTime() + msFromAnchor)
}

/** Pixel offset of a date from a reference (anchorDate) */
export function calcLeft(scheduledStart: string, anchorDate: Date, view: View): number {
  const start = new Date(scheduledStart)
  const diffMin = differenceInMinutes(start, anchorDate)
  return (diffMin / 60) * pxPerHour(view)
}

/** Pixel width for a task based on its real wall-clock span (start → end) */
export function calcWidth(scheduledStart: string, scheduledEnd: string, view: View): number {
  const diffMin = differenceInMinutes(new Date(scheduledEnd), new Date(scheduledStart))
  return Math.max((diffMin / 60) * pxPerHour(view), 0)
}

/** Total width of a single period */
export function totalTimelinePx(view: View, periodStart: Date): number {
  if (view === 'daily') return 24 * HOUR_PX
  if (view === 'weekly') return 7 * DAY_PX
  return getDaysInMonth(periodStart) * DAY_PX_MONTH
}

/** Total width across multiple periods starting from anchorDate */
export function totalMultiPeriodPx(view: View, anchorDate: Date, numPeriods: number): number {
  let total = 0
  let cur = anchorDate
  for (let i = 0; i < numPeriods; i++) {
    total += totalTimelinePx(view, cur)
    cur = nextPeriodStart(view, cur)
  }
  return total
}

/** Snap a date to the beginning of the current view period */
export function getViewportStart(view: View, date: Date): Date {
  if (view === 'daily') return startOfDay(date)
  if (view === 'weekly') return startOfWeek(date, { weekStartsOn: 1 })
  return startOfMonth(date)
}

/** Columns for a single period */
export function generateTimelineColumns(view: View, periodStart: Date): TimelineColumn[] {
  const cols: TimelineColumn[] = []
  if (view === 'daily') {
    for (let h = 0; h < 24; h++) {
      const d = new Date(periodStart)
      d.setHours(h, 0, 0, 0)
      cols.push({ key: `h${h}`, label: `${String(h).padStart(2, '0')}h`, widthPx: HOUR_PX, date: d })
    }
  } else if (view === 'weekly') {
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    for (let i = 0; i < 7; i++) {
      const d = new Date(periodStart)
      d.setDate(d.getDate() + i)
      cols.push({ key: `d${i}`, label: `${DAYS[d.getDay()]} ${d.getDate()}`, widthPx: DAY_PX, date: d })
    }
  } else {
    const daysInMonth = getDaysInMonth(periodStart)
    for (let i = 0; i < daysInMonth; i++) {
      const d = new Date(periodStart)
      d.setDate(d.getDate() + i)
      cols.push({ key: `d${i}`, label: `${d.getDate()}`, widthPx: DAY_PX_MONTH, date: d })
    }
  }
  return cols
}

/** Columns spanning multiple periods — keys are unique across periods */
export function generateMultiPeriodColumns(view: View, anchorDate: Date, numPeriods: number): TimelineColumn[] {
  const all: TimelineColumn[] = []
  let cur = anchorDate
  for (let p = 0; p < numPeriods; p++) {
    const cols = generateTimelineColumns(view, cur)
    all.push(...cols.map(c => ({ ...c, key: `p${p}-${c.key}` })))
    cur = nextPeriodStart(view, cur)
  }
  return all
}
