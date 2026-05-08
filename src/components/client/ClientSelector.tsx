import { useStore } from '../../store'
import { CLIENT_CONFIGS } from '../../config/clients'

export function ClientSelector() {
  const setClient = useStore(s => s.setClient)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Gestão de Projetos</h1>
        <p className="text-gray-400 mb-10">Selecione o cliente para começar</p>
        <div className="flex gap-6 justify-center">
          {Object.values(CLIENT_CONFIGS).map(client => (
            <button
              key={client.id}
              onClick={() => setClient(client.id)}
              className="group flex flex-col items-center gap-3 bg-gray-800 hover:bg-gray-700 border-2 border-gray-700 hover:border-blue-500 rounded-2xl p-8 w-48 transition-all duration-200"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: client.color }}
              >
                {client.name[0]}
              </div>
              <div>
                <div className="text-white font-semibold text-lg">{client.name}</div>
                <div className="text-gray-400 text-xs mt-1">{client.poolLabelPlural}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
