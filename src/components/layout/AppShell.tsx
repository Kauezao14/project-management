import { useStore } from '../../store'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ClientSelector } from '../client/ClientSelector'
import { GanttPage } from '../gantt/GanttPage'

export function AppShell() {
  const showClientSelector = useStore(s => s.showClientSelector)

  return (
    <>
      {showClientSelector && <ClientSelector />}
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar />
          <GanttPage />
        </div>
      </div>
    </>
  )
}
