import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { CLIENT_CONFIGS } from '../../config/clients'

export function PoolForm() {
  const { editingPoolId, pools, activeClient, updatePool, addPool, setEditingPool } = useStore(useShallow(s => ({
    editingPoolId: s.editingPoolId,
    pools: s.pools,
    activeClient: s.activeClient,
    updatePool: s.updatePool,
    addPool: s.addPool,
    setEditingPool: s.setEditingPool,
  })))

  const isEditing = !!editingPoolId
  const pool = editingPoolId ? pools.find(p => p.id === editingPoolId) : null
  const client = CLIENT_CONFIGS[activeClient]

  const [name, setName] = useState(pool?.name ?? '')
  const [error, setError] = useState('')

  const onClose = () => setEditingPool(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Nome obrigatório'); return }
    if (isEditing && pool) {
      updatePool(pool.id, name.trim())
    } else {
      addPool(name.trim())
    }
    onClose()
  }

  return (
    <Modal title={isEditing ? `Editar ${client.poolLabel}` : `Novo ${client.poolLabel}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label={`Nome do ${client.poolLabel}`}
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          error={error}
          required
          autoFocus
          placeholder={client.poolLabel === 'Técnico' ? 'Ex: João Silva' : 'Ex: Injetora #3'}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="submit" size="sm">{isEditing ? 'Salvar' : 'Criar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
