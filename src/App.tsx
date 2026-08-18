import { useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { QuickAdd } from './components/quick-add/QuickAdd'
import { CommandCenter } from './features/command-center/CommandCenter'
import { MyWork } from './features/my-work/MyWork'
import { Tasks } from './features/tasks/Tasks'
import { WeeklyPlan } from './features/objectives/WeeklyPlan'
import { Team } from './features/team/Team'
import { Kpis } from './features/kpis/Kpis'
import { Data } from './features/data/Data'
import { Settings } from './features/settings/Settings'
import { Report } from './features/report/Report'
import { Chat } from './features/chat/Chat'
import { NotificationsPanel } from './components/notifications/NotificationsPanel'

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/my-work': 'My Work',
  '/weekly-plan': 'Weekly Plan',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/chat': 'Team Chat',
  '/kpis': 'KPIs',
  '/data': 'Data & Sources',
  '/report': 'Client Report',
  '/settings': 'Settings',
}

function App() {
  const [currentPath, setCurrentPath] = useState('/')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickAddOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <CommandCenter onNavigate={setCurrentPath} />
      case '/my-work':
        return <MyWork />
      case '/tasks':
        return <Tasks />
      case '/weekly-plan':
        return <WeeklyPlan />
      case '/team':
        return <Team />
      case '/chat':
        return <Chat />
      case '/kpis':
        return <Kpis />
      case '/data':
        return <Data />
      case '/report':
        return <Report />
      case '/settings':
        return <Settings />
      default:
        return <CommandCenter />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      <div className="print:hidden">
        <Sidebar
          currentPath={currentPath}
          onNavigate={setCurrentPath}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <TopBar
            title={pageTitles[currentPath] || 'Dashboard'}
            onQuickAdd={() => setQuickAddOpen(true)}
            onNavigate={setCurrentPath}
          />
        </div>
        <main key={currentPath} className="flex-1 overflow-y-auto px-5 pb-8 page-enter print:overflow-visible print:p-0 print:animate-none">
          <div className="max-w-[1440px] mx-auto">{renderPage()}</div>
        </main>
      </div>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigate={setCurrentPath}
      />
    </div>
  )
}

export default App