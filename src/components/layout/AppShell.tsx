import { useStore } from '../../store'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { GanttPage } from '../gantt/GanttPage'
import { ProjectsPage } from '../projects/ProjectsPage'

export function AppShell() {
  const page = useStore(s => s.page)

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        {page === 'gantt' && <TopBar />}
        {page === 'gantt' ? <GanttPage /> : <ProjectsPage />}
      </div>
    </div>
  )
}
