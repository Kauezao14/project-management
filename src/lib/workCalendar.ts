import { addMinutes, getHours, getMinutes, getDay, setHours, setMinutes, setSeconds, setMilliseconds, addDays, startOfDay } from 'date-fns'
import type { WorkCalendar } from '../types/client'
import type { Task } from '../types/task'

/** Calendário efetivo de uma tarefa, aplicando hora extra e almoço trabalhado */
export function getEffectiveCalendar(cal: WorkCalendar, task: Pick<Task, 'overtime' | 'overtimeHours' | 'lunchWork'>): WorkCalendar {
  return {
    ...cal,
    endHour: task.overtime && task.overtimeHours
      ? cal.endHour + task.overtimeHours
      : cal.endHour,
    lunchStart: task.lunchWork ? undefined : cal.lunchStart,
    lunchEnd:   task.lunchWork ? undefined : cal.lunchEnd,
  }
}

function atHour(d: Date, hour: number): Date {
  let r = setHours(d, hour)
  r = setMinutes(r, 0)
  r = setSeconds(r, 0)
  r = setMilliseconds(r, 0)
  return r
}

function nextWorkStart(date: Date, cal: WorkCalendar): Date {
  let d = new Date(date)

  // Avança até um dia útil
  while (!cal.workDays.includes(getDay(d))) {
    d = atHour(startOfDay(addDays(d, 1)), cal.startHour)
  }

  const h = getHours(d) + getMinutes(d) / 60

  // Antes do expediente → vai para o início
  if (h < cal.startHour) {
    return atHour(d, cal.startHour)
  }

  // Dentro do intervalo de almoço → vai para o fim do almoço
  if (cal.lunchStart !== undefined && cal.lunchEnd !== undefined) {
    if (h >= cal.lunchStart && h < cal.lunchEnd) {
      return atHour(d, cal.lunchEnd)
    }
  }

  // Após o fim do expediente → próximo dia útil
  if (h >= cal.endHour) {
    return nextWorkStart(atHour(startOfDay(addDays(d, 1)), cal.startHour), cal)
  }

  return d
}

/**
 * Dado um início e uma duração em horas de trabalho, retorna a data de término
 * respeitando o calendário (pula almoço, fim de expediente, fins de semana).
 */
export function addWorkHours(start: Date, durationHours: number, cal: WorkCalendar): Date {
  let remainingMin = Math.round(durationHours * 60) // trabalha em minutos para precisão
  let cursor = nextWorkStart(start, cal)

  while (remainingMin > 0) {
    const curH = getHours(cursor) + getMinutes(cursor) / 60

    // Minutos disponíveis até o próximo "bloqueio" (almoço ou fim do expediente)
    let nextBreakH: number = cal.endHour

    if (cal.lunchStart !== undefined && cal.lunchEnd !== undefined && curH < cal.lunchStart) {
      nextBreakH = cal.lunchStart // almoço vem antes do fim do expediente
    }

    const availableMin = Math.round((nextBreakH - curH) * 60)

    if (remainingMin <= availableMin) {
      cursor = addMinutes(cursor, remainingMin)
      remainingMin = 0
    } else {
      remainingMin -= availableMin
      // Pula o bloqueio (almoço ou EOD)
      if (nextBreakH === cal.lunchStart && cal.lunchEnd !== undefined) {
        cursor = atHour(cursor, cal.lunchEnd) // pula almoço
      } else {
        // Fim do expediente → próximo dia útil
        cursor = nextWorkStart(atHour(startOfDay(addDays(cursor, 1)), cal.startHour), cal)
      }
    }
  }

  return cursor
}

/** Retorna o primeiro momento de trabalho em ou após `date` */
export function snapToWorkStart(date: Date, cal: WorkCalendar): Date {
  return nextWorkStart(date, cal)
}
