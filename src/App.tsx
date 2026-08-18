import { useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CommandCenter } from './features/command-center/CommandCenter'
import { MyWork } from './features/my-work/MyWork'
import { Tasks } from './features/tasks/Tasks'
import { WeeklyPlan } from './features/objectives/WeeklyPlan'
import { Team } from './features/team/Team'
import { Clients } from './features/clients/Clients'
import { Kpis } from './features/kpis/Kpis'
import { Settings } from './features/settings/Settings'

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/my-work': 'My Work',
  '/weekly-plan': 'Weekly Plan',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/clients': 'Clients',
  '/kpis': 'KPIs',
  '/settings': 'Settings',
}

function App() {
  const [currentPath, setCurrentPath] = useState('/')

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <CommandCenter />
      case '/my-work':
        return <MyWork />
      case '/tasks':
        return <Tasks />
      case '/weekly-plan':
        return <WeeklyPlan />
      case '/team':
        return <Team />
      case '/clients':
        return <Clients />
      case '/kpis':
        return <Kpis />
      case '/settings':
        return <Settings />
      default:
        return <CommandCenter />
    }
  }

  return (
    <div className="flex h-screen bg-[var(--bg)]">
      <Sidebar currentPath={currentPath} onNavigate={setCurrentPath} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={pageTitles[currentPath] || 'Dashboard'} clientName="Afkar Modern" />
        <main className="flex-1 overflow-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

export default App
