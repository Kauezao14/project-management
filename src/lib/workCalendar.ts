import { addHours, getHours, getDay, setHours, setMinutes, setSeconds, setMilliseconds, addDays, startOfDay } from 'date-fns'
import type { WorkCalendar } from '../types/client'

function nextWorkStart(date: Date, cal: WorkCalendar): Date {
  let d = new Date(date)
  // Advance to a work day
  while (!cal.workDays.includes(getDay(d))) {
    d = startOfDay(addDays(d, 1))
    d = setHours(d, cal.startHour)
    d = setMinutes(d, 0)
    d = setSeconds(d, 0)
    d = setMilliseconds(d, 0)
  }
  // If before start hour, move to start hour
  if (getHours(d) < cal.startHour) {
    d = setHours(d, cal.startHour)
    d = setMinutes(d, 0)
    d = setSeconds(d, 0)
    d = setMilliseconds(d, 0)
  }
  // If at or after end hour, move to next work day start
  if (getHours(d) >= cal.endHour) {
    d = startOfDay(addDays(d, 1))
    d = setHours(d, cal.startHour)
    d = setMinutes(d, 0)
    d = setSeconds(d, 0)
    d = setMilliseconds(d, 0)
    return nextWorkStart(d, cal)
  }
  return d
}

/**
 * Given a start date and duration in work hours, returns the end date
 * respecting the work calendar (skipping non-work hours and non-work days).
 */
export function addWorkHours(start: Date, durationHours: number, cal: WorkCalendar): Date {
  let remaining = durationHours
  let cursor = nextWorkStart(start, cal)

  while (remaining > 0) {
    const hoursUntilEOD = cal.endHour - getHours(cursor) - (new Date(cursor).getMinutes() / 60)
    if (remaining <= hoursUntilEOD) {
      cursor = addHours(cursor, remaining)
      remaining = 0
    } else {
      remaining -= hoursUntilEOD
      // Jump to next work day start
      cursor = startOfDay(addDays(cursor, 1))
      cursor = setHours(cursor, cal.startHour)
      cursor = setMinutes(cursor, 0)
      cursor = setSeconds(cursor, 0)
      cursor = setMilliseconds(cursor, 0)
      cursor = nextWorkStart(cursor, cal)
    }
  }

  return cursor
}

/**
 * Returns the first available work moment on or after `date`.
 */
export function snapToWorkStart(date: Date, cal: WorkCalendar): Date {
  return nextWorkStart(date, cal)
}
