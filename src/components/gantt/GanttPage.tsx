import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { parseISO } from 'date-fns'
import { GanttHeader } from './GanttHeader'
import { GanttBody } from './GanttBody'
import { TaskForm } from '../task/TaskForm'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { GanttTimelineContext } from '../../contexts/GanttTimelineContext'
import {
  computeAnchorDate,
  totalMultiPeriodPx,
  TIMELINE_PERIODS,
  calcLeft,
  scrollLeftToDate,
  getViewportStart,
} from '../../lib/ganttLayout'

export function GanttPage() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const undo = useStore(s => s.undo)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  const { view, viewportStart, setViewportStart, editingTaskId, addingTaskToPoolId } = useStore(
    useShallow(s => ({
      view: s.view,
      viewportStart: s.viewportStart,
      setViewportStart: s.setViewportStart,
      editingTaskId: s.editingTaskId,
      addingTaskToPoolId: s.addingTaskToPoolId,
    }))
  )

  const vStart = parseISO(viewportStart)

  // Stable anchor — only updates when nav buttons change viewportStart, not when scroll does
  const [anchor, setAnchor] = useState<Date>(() => computeAnchorDate(view, vStart))

  // Tracks which viewportStart value was set by the scroll handler to break the feedback loop
  const scrolledToRef = useRef<string | null>(null)
  // Stable ref so handleScroll doesn't need viewportStart in its deps
  const viewportStartRef = useRef(viewportStart)
  viewportStartRef.current = viewportStart

  const { total: totalPeriods } = TIMELINE_PERIODS[view]
  const totalWidth = totalMultiPeriodPx(view, anchor, totalPeriods)

  // When viewportStart changes from nav buttons (not from scroll), reset anchor + jump scroll
  useEffect(() => {
    if (viewportStart === scrolledToRef.current) {
      // This change came from the scroll handler — don't move the anchor
      scrolledToRef.current = null
      return
    }
    scrolledToRef.current = null
    const newVStart = parseISO(viewportStart)
    const newAnchor = computeAnchorDate(view, newVStart)
    setAnchor(newAnchor)
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = calcLeft(newVStart.toISOString(), newAnchor, view)
      }
    })
  }, [viewportStart, view])

  // Scroll handler: update the topbar label as the user scrolls across periods
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const sl = scrollRef.current.scrollLeft
    const dateAtScroll = scrollLeftToDate(sl, anchor, view)
    const newPeriodStart = getViewportStart(view, dateAtScroll)
    const currentPeriodStart = parseISO(viewportStartRef.current)
    if (newPeriodStart.getTime() !== currentPeriodStart.getTime()) {
      scrolledToRef.current = newPeriodStart.toISOString()
      setViewportStart(newPeriodStart)
    }
  }, [anchor, view, setViewportStart])

  const ctx = useMemo(() => ({ anchor, totalWidth }), [anchor, totalWidth])

  return (
    <GanttTimelineContext.Provider value={ctx}>
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
          <GanttHeader />
          <GanttBody />
        </div>
        {(editingTaskId || addingTaskToPoolId) && <TaskForm />}
      </div>
    </GanttTimelineContext.Provider>
  )
}
