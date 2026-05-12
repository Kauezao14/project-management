import { useStore } from '../../store'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ClientSelector } from '../client/ClientSelector'
import { GanttPage } from '../gantt/GanttPage'
import { ProjectsPage } from '../projects/ProjectsPage'

export function AppShell() {
  const showClientSelector = useStore(s => s.showClientSelector)
  const page = useStore(s => s.page)

  return (
    <>
      {showClientSelector && <ClientSelector />}
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          {page === 'gantt' && <TopBar />}
          {page === 'gantt' ? <GanttPage /> : <ProjectsPage />}
        </div>
      </div>
    </>
  )
}
