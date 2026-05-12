import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useStore } from '../../store'
import { GanttRow } from './GanttRow'
import { CriticalPathContext } from '../../contexts/CriticalPathContext'
import { computeAllCriticalTaskIds } from '../../lib/criticalPath'

export function GanttBody() {
  const activeClient = useStore(s => s.activeClient)
  const allPools = useStore(s => s.pools)
  const allClients = useStore(s => s.clients)
  const allTasks = useStore(s => s.tasks)
  const moveTask = useStore(s => s.moveTask)
  const checkAndPropagateDelays = useStore(s => s.checkAndPropagateDelays)

  const pools = allPools
    .filter(p => p.clientId === activeClient)
    .sort((a, b) => a.order - b.order)

  const criticalTaskIds = useMemo(
    () => computeAllCriticalTaskIds(allTasks),
    [allTasks]
  )

  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    checkAndPropagateDelays()
  }, []) // run once on mount

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    setDraggingId(String(active.id))
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)
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
      targetIndex = overTask.order
    }

    moveTask(activeId, targetPoolId, targetIndex)
  }

  const client = allClients.find(c => c.id === activeClient)

  if (pools.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300 }}>
        <div className="text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-sm font-medium text-gray-500">Nenhum {client?.poolLabel.toLowerCase() ?? 'item'} cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">Clique em "+ {client?.poolLabel ?? 'Item'}" no topo para começar</p>
        </div>
      </div>
    )
  }

  const draggingTask = draggingId ? useStore.getState().tasks.find(t => t.id === draggingId) : null

  return (
    <CriticalPathContext.Provider value={criticalTaskIds}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {pools.map(pool => (
          <GanttRow key={pool.id} pool={pool} />
        ))}
        <DragOverlay>
          {draggingTask ? (
            <div className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded-md shadow-xl opacity-90 pointer-events-none">
              {draggingTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </CriticalPathContext.Provider>
  )
}
