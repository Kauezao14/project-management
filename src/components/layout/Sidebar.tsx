import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Settings, LayoutList, FolderOpen } from 'lucide-react'

export function Sidebar() {
  const { activeClient, clients, page, setClient, setPage, addPool, setShowClientSelector } = useStore(useShallow(s => ({
    activeClient: s.activeClient,
    clients: s.clients,
    page: s.page,
    setClient: s.setClient,
    setPage: s.setPage,
    addPool: s.addPool,
    setShowClientSelector: s.setShowClientSelector,
  })))

  const allPools = useStore(s => s.pools)
  const client = clients.find(c => c.id === activeClient)
  const clientPools = allPools.filter(p => p.clientId === activeClient).sort((a, b) => a.order - b.order)

  if (!client) return null

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-full shrink-0">
      {/* Page navigation */}
      <div className="px-3 pt-3 pb-2 flex gap-1">
        <button
          onClick={() => setPage('gantt')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-colors ${
            page === 'gantt' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <LayoutList size={13} /> Gantt
        </button>
        <button
          onClick={() => setPage('projects')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-colors ${
            page === 'projects' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <FolderOpen size={13} /> Projetos
        </button>
      </div>

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Empresa Ativa</div>
        <button
          onClick={() => setShowClientSelector(true)}
          className="flex items-center gap-2 w-full hover:bg-gray-800 rounded-lg px-2 py-2 transition-colors"
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: client.color }}
          >
            {client.name[0].toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">{client.name}</div>
            <div className="text-xs text-gray-400">{client.poolLabelPlural}</div>
          </div>
          <Settings size={12} className="ml-auto text-gray-600" />
        </button>
      </div>

      {/* Pools list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider">{client.poolLabelPlural}</span>
          <button
            onClick={() => {
              const name = prompt(`Nome do ${client.poolLabel}:`)
              if (name?.trim()) addPool(name.trim())
            }}
            className="text-gray-400 hover:text-white transition-colors"
            title={`Adicionar ${client.poolLabel}`}
          >
            <Plus size={14} />
          </button>
        </div>
        {clientPools.length === 0 ? (
          <p className="text-xs text-gray-600 mt-4">Nenhum {client.poolLabel.toLowerCase()} cadastrado</p>
        ) : (
          <ul className="space-y-1">
            {clientPools.map(pool => (
              <li key={pool.id} className="text-xs text-gray-300 px-2 py-1.5 rounded-md bg-gray-800/50">
                {pool.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Client switcher */}
      {clients.length > 1 && (
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="text-xs text-gray-600 mb-2">Trocar empresa</div>
          <div className="flex flex-col gap-1">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => setClient(c.id)}
                className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors text-left ${
                  c.id === activeClient
                    ? 'text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                style={c.id === activeClient ? { backgroundColor: c.color } : {}}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
