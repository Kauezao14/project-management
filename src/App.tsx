import { useEffect, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ClientSelector } from './components/client/ClientSelector'
import { useStore } from './store'
import { useShallow } from 'zustand/react/shallow'

function getSlug(): string | null {
  const match = window.location.hash.match(/^#\/c\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function LoadedApp({ slug }: { slug: string }) {
  const { loadCompany, loaded, loadError } = useStore(useShallow(s => ({
    loadCompany: s.loadCompany,
    loaded: s.loaded,
    loadError: s.loadError,
  })))

  useEffect(() => { loadCompany(slug) }, [slug])

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <p className="text-gray-500 text-sm">{loadError}</p>
          <a href="#/" className="text-blue-600 text-xs hover:underline">← Voltar para empresas</a>
        </div>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400">Carregando dados...</p>
        </div>
      </div>
    )
  }

  return <AppShell />
}

export default function App() {
  const [slug, setSlug] = useState(getSlug)

  useEffect(() => {
    const handler = () => setSlug(getSlug())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (!slug) return <ClientSelector />
  return <LoadedApp slug={slug} />
}
