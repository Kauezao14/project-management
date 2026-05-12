import { createContext, useContext } from 'react'

interface GanttTimelineCtx {
  anchor: Date
  totalWidth: number
}

export const GanttTimelineContext = createContext<GanttTimelineCtx>({
  anchor: new Date(),
  totalWidth: 0,
})

export const useGanttTimeline = () => useContext(GanttTimelineContext)
