export type ClientId = 'PSG' | 'DOMINUS'

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select'
  required: boolean
  options?: { value: string; label: string }[]
}

export interface WorkCalendar {
  startHour: number
  endHour: number
  workDays: number[] // 0=Dom, 1=Seg...6=Sab
}

export interface ClientConfig {
  id: ClientId
  name: string
  poolLabel: string
  poolLabelPlural: string
  taskLabel: string
  taskLabelPlural: string
  taskExtraFields: FieldDef[]
  workCalendar: WorkCalendar
  color: string // primary brand color
}
