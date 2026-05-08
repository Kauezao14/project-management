import { useRef } from 'react'
import { GanttHeader } from './GanttHeader'
import { GanttBody } from './GanttBody'
import { TaskForm } from '../task/TaskForm'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'

export function GanttPage() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { editingTaskId, addingTaskToPoolId } = useStore(useShallow(s => ({
    editingTaskId: s.editingTaskId,
    addingTaskToPoolId: s.addingTaskToPoolId,
  })))

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <GanttHeader />
        <GanttBody />
      </div>

      {(editingTaskId || addingTaskToPoolId) && <TaskForm />}
    </div>
  )
}
