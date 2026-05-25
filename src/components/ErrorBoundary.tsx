import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full space-y-4">
          <h1 className="text-lg font-bold text-red-600">Erro na aplicação</h1>
          <p className="text-sm text-gray-600">{error.message}</p>
          <pre className="text-xs bg-gray-100 rounded-lg p-3 overflow-auto max-h-48 text-gray-700 whitespace-pre-wrap">
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
