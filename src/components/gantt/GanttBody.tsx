import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { GanttRow } from './GanttRow'
import { CriticalPathContext } from '../../contexts/CriticalPathContext'
import { DragPreviewContext, type DragPreviewState } from '../../contexts/DragPreviewContext'
import { computeAllCriticalTaskIds } from '../../lib/criticalPath'

const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  if (within.length > 0) return within
  return closestCenter(args)
}

const EMPTY_PREVIEW: DragPreviewState = { draggingId: null, overPoolId: null, overIndex: -1 }

export function GanttBody() {
  const pools = useStore(
    useShallow(s =>
      s.pools
        .filter(p => p.clientId === s.activeClient)
        .sort((a, b) => a.order - b.order)
    )
  )
  const client = useStore(
    useShallow(s => s.clients.find(c => c.id === s.activeClient))
  )
  const allTasks = useStore(s => s.tasks)
  const moveTask = useStore(s => s.moveTask)
  const checkAndPropagateDelays = useStore(s => s.checkAndPropagateDelays)
  const migratePinScheduledStarts = useStore(s => s.migratePinScheduledStarts)
  const fixCorruptedCompletedTasks = useStore(s => s.fixCorruptedCompletedTasks)

  const criticalTaskIds = useMemo(
    () => computeAllCriticalTaskIds(allTasks),
    [allTasks]
  )

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<DragPreviewState>(EMPTY_PREVIEW)

  useEffect(() => {
    fixCorruptedCompletedTasks()
    migratePinScheduledStarts()
    checkAndPropagateDelays()
  }, []) // run once on mount

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const id = String(active.id)
    setDraggingId(id)
    const tasks = useStore.getState().tasks
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const sorted = tasks.filter(t => t.poolId === task.poolId).sort((a, b) => a.order - b.order)
    setDragPreview({ draggingId: id, overPoolId: task.poolId, overIndex: sorted.findIndex(t => t.id === id) })
  }, [])

  const handleDragOver = useCallback(({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const tasks = useStore.getState().tasks

    let overPoolId: string
    let overIndex: number

    if (overId.startsWith('pool-drop-')) {
      overPoolId = overId.replace('pool-drop-', '')
      overIndex = tasks.filter(t => t.poolId === overPoolId).length
    } else {
      const overTask = tasks.find(t => t.id === overId)
      if (!overTask) return
      overPoolId = overTask.poolId
      const sorted = tasks.filter(t => t.poolId === overPoolId).sort((a, b) => a.order - b.order)
      overIndex = sorted.findIndex(t => t.id === overId)
    }

    setDragPreview(prev =>
      prev.draggingId === activeId && prev.overPoolId === overPoolId && prev.overIndex === overIndex
        ? prev
        : { draggingId: activeId, overPoolId, overIndex }
    )
  }, [])

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setDraggingId(null)
    setDragPreview(EMPTY_PREVIEW)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    const tasks = useStore.getState().tasks

    let targetPoolId: string
    let targetIndex: number

    if (overId.startsWith('pool-drop-')) {
      targetPoolId = overId.replace('pool-drop-', '')
      const poolTasks = tasks.filter(t => t.poolId === targetPoolId).sort((a, b) => a.order - b.order)
      targetIndex = poolTasks.length
    } else {
      const overTask = tasks.find(t => t.id === overId)
      if (!overTask) return
      targetPoolId = overTask.poolId
      const sorted = tasks.filter(t => t.poolId === overTask.poolId).sort((a, b) => a.order - b.order)
      targetIndex = sorted.findIndex(t => t.id === overId)
    }

    moveTask(activeId, targetPoolId, targetIndex)
  }, [moveTask])

  if (pools.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300 }}>
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium text-gray-500">
            Nenhum {client?.poolLabel.toLowerCase() ?? 'item'} cadastrado
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Clique em "+ {client?.poolLabel ?? 'Item'}" no topo para começar
          </p>
        </div>
      </div>
    )
  }

  const draggingTask = draggingId ? useStore.getState().tasks.find(t => t.id === draggingId) : null

  return (
    <CriticalPathContext.Provider value={criticalTaskIds}>
      <DragPreviewContext.Provider value={dragPreview}>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {pools.map(pool => (
            <GanttRow key={pool.id} pool={pool} />
          ))}
          <DragOverlay dropAnimation={null}>
            {draggingTask ? (
              <div className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-md shadow-xl opacity-90 pointer-events-none whitespace-nowrap">
                {draggingTask.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </DragPreviewContext.Provider>
    </CriticalPathContext.Provider>
  )
}
