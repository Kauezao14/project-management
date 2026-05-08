import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../../store'
import { useShallow } from 'zustand/react/shallow'
import { CLIENT_CONFIGS } from '../../config/clients'

export function TopBar() {
  const { view, viewportStart, activeClient, setView, navigateViewport, addPool } = useStore(useShallow(s => ({
    view: s.view,
    viewportStart: s.viewportStart,
    activeClient: s.activeClient,
    setView: s.setView,
    navigateViewport: s.navigateViewport,
    addPool: s.addPool,
  })))

  const client = CLIENT_CONFIGS[activeClient]
  const date = parseISO(viewportStart)

  const dateLabel = view === 'daily'
    ? format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : view === 'weekly'
    ? `Semana de ${format(date, "d 'de' MMM", { locale: ptBR })}`
    : format(date, "MMMM 'de' yyyy", { locale: ptBR })

  const views: { key: typeof view; label: string }[] = [
    { key: 'daily', label: 'Dia' },
    { key: 'weekly', label: 'Semana' },
    { key: 'monthly', label: 'Mês' },
  ]

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center gap-4 px-4 shrink-0">
      {/* View toggle */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === v.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigateViewport(-1)}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-gray-700 font-medium capitalize min-w-48 text-center">
          {dateLabel}
        </span>
        <button
          onClick={() => navigateViewport(1)}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Today button */}
      <button
        onClick={() => useStore.getState().setViewportStart(new Date())}
        className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors border border-gray-200"
      >
        Hoje
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Add pool */}
      <button
        onClick={() => {
          const name = prompt(`Nome do ${client.poolLabel}:`)
          if (name?.trim()) addPool(name.trim())
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
        style={{ backgroundColor: client.color }}
      >
        <Plus size={14} />
        {client.poolLabel}
      </button>
    </header>
  )
}
