import { useState } from 'react'
import { parseISO } from 'date-fns'
import { PoolLabel } from './PoolLabel'
import { TaskTrack } from './TaskTrack'
import { totalTimelinePx } from '../../lib/ganttLayout'
import { LABEL_WIDTH } from '../../config/constants'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import type { Pool } from '../../types/pool'

interface Props {
  pool: Pool
}

export function GanttRow({ pool }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const { view, viewportStart } = useStore(useShallow(s => ({ view: s.view, viewportStart: s.viewportStart })))
  const total = totalTimelinePx(view, parseISO(viewportStart))

  return (
    <div
      className="flex border-b border-gray-100 hover:bg-gray-50/30 transition-colors"
      style={{ minWidth: LABEL_WIDTH + total, height: 48 }}
    >
      {/* Sticky pool label */}
      <div className="sticky left-0 z-10 shrink-0 bg-white">
        <PoolLabel pool={pool} collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)} />
      </div>
      {collapsed ? (
        <div className="flex-1 bg-gray-50/50" />
      ) : (
        <TaskTrack poolId={pool.id} />
      )}
    </div>
  )
}
