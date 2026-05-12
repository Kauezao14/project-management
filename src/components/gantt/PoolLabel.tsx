import { useState } from 'react'
import { Edit2, Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { LABEL_WIDTH } from '../../config/constants'
import type { Pool } from '../../types/pool'

interface Props {
  pool: Pool
  collapsed: boolean
  onToggleCollapse: () => void
}

export function PoolLabel({ pool, collapsed, onToggleCollapse }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(pool.name)
  const { updatePool, deletePool, setAddingTaskToPool, activeClient, clients } = useStore(useShallow(s => ({
    updatePool: s.updatePool,
    deletePool: s.deletePool,
    setAddingTaskToPool: s.setAddingTaskToPool,
    activeClient: s.activeClient,
    clients: s.clients,
  })))
  const client = clients.find(c => c.id === activeClient)

  const saveEdit = () => {
    if (name.trim()) updatePool(pool.id, name.trim())
    setEditing(false)
  }

  return (
    <div
      className="shrink-0 flex items-center gap-1 px-3 border-r border-gray-100 bg-gray-50 group"
      style={{ width: LABEL_WIDTH, height: 48 }}
    >
      <button onClick={onToggleCollapse} className="text-gray-400 hover:text-gray-600">
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

      {editing ? (
        <input
          className="flex-1 text-sm border border-blue-400 rounded px-1.5 py-0.5 outline-none"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm font-medium text-gray-700 truncate">{pool.name}</span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setAddingTaskToPool(pool.id)}
          className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
          title={`Adicionar ${client?.taskLabel ?? 'item'}`}
        >
          <Plus size={13} />
        </button>
        <button
          onClick={() => { setName(pool.name); setEditing(true) }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          title="Editar"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => {
            if (confirm(`Deletar ${client?.poolLabel.toLowerCase() ?? 'item'} "${pool.name}"?`)) deletePool(pool.id)
          }}
          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
          title="Deletar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}
