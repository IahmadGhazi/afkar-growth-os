import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { QuickAdd } from './components/quick-add/QuickAdd'
import { BootScreen } from './components/shared/BootScreen'
import { Toaster } from './lib/toast'
import { useApp } from './lib/store'
import { useAuth } from './lib/auth'
import { Login } from './features/auth/Login'
import { ResetPassword } from './features/auth/ResetPassword'
import { CommandCenter } from './features/command-center/CommandCenter'
import { MyWork } from './features/my-work/MyWork'
import { Tasks } from './features/tasks/Tasks'
import { WeeklyPlan } from './features/objectives/WeeklyPlan'
import { Team } from './features/team/Team'
import { Chat } from './features/chat/Chat'
import { Products } from './features/products/Products'
import { Campaigns } from './features/campaigns/Campaigns'
import { Kpis } from './features/kpis/Kpis'
import { Data } from './features/data/Data'
import { Settings } from './features/settings/Settings'
import { Report } from './features/report/Report'
import { NotificationsPanel } from './components/notifications/NotificationsPanel'

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/my-work': 'My Work',
  '/weekly-plan': 'Weekly Plan',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/chat': 'Team Chat',
  '/products': 'Product Research',
  '/campaigns': 'Campaigns',
  '/kpis': 'KPIs',
  '/data': 'Data & Sources',
  '/report': 'Client Report',
  '/settings': 'Settings',
}

function App() {
  const { state } = useApp()
  const auth = useAuth()
  // Role-based landing: admins open on the Command Center, everyone else
  // opens on their own My Work - the view that matters to them first.
  const [currentPath, setCurrentPath] = useState<string>(() => {
    try {
      const st = JSON.parse(localStorage.getItem('afkar-last-path') ?? 'null') as { path: string; role: string } | null
      return st?.path ?? '/'
    } catch {
      return '/'
    }
  })
  const [landingResolved, setLandingResolved] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (auth.status !== 'signed-in' || !state.ready || landingResolved) return
    const me = state.profiles.find((p) => p.id === state.currentUserId)
    const adminish = me?.role === 'super_admin' || me?.role === 'account_manager'
    const last = (() => {
      try {
        return JSON.parse(localStorage.getItem('afkar-last-path') ?? 'null') as { role: string } | null
      } catch {
        return null
      }
    })()
    // First visit of this role in this browser -> land them right.
    if (!last || last.role !== (me?.role ?? '')) {
      const target = adminish ? '/' : '/my-work'
      setCurrentPath(target)
      localStorage.setItem('afkar-last-path', JSON.stringify({ path: target, role: me?.role ?? '' }))
    }
    setLandingResolved(true)
  }, [auth.status, state.ready, landingResolved])

  useEffect(() => {
    try {
      const me = state.profiles.find((p) => p.id === state.currentUserId)
      localStorage.setItem('afkar-last-path', JSON.stringify({ path: currentPath, role: me?.role ?? '' }))
    } catch {
      // ignore
    }
  }, [currentPath])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickAddOpen((open) => !open)
      }
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close mobile nav + scroll to top on navigation
  const navigate = (path: string) => {
    setCurrentPath(path)
    setMobileNavOpen(false)
  }

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
      case '/products':
        return <Products />
      case '/campaigns':
        return <Campaigns />
      case '/kpis':
        return <Kpis />
      case '/data':
        return <Data />
      case '/report':
        return <Report />
      case '/settings':
        return <Settings />
      default:
        return <CommandCenter onNavigate={setCurrentPath} />
    }
  }

  // Gates render standalone full-screen pages (outside the flex shell).
  if (auth.status === 'loading' || (auth.status === 'signed-in' && !state.ready)) {
    return (
      <>
        <BootScreen />
        <Toaster />
      </>
    )
  }
  if (auth.status === 'signed-out') {
    return (
      <>
        <Login />
        <Toaster />
      </>
    )
  }
  if (auth.status === 'signed-in' && auth.recovery) {
    return (
      <>
        <ResetPassword />
        <Toaster />
      </>
    )
  }

  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          currentPath={currentPath}
          onNavigate={setCurrentPath}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileNavOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMobileNavOpen(false)
        }}
      >
        <div
          className={`h-full w-[268px] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative h-full">
            <button
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="absolute top-5 right-4 z-10 icon-btn w-9 h-9 rounded-xl"
            >
              <X size={18} />
            </button>
            <Sidebar
              currentPath={currentPath}
              onNavigate={navigate}
              onOpenNotifications={() => {
                setNotificationsOpen(true)
                setMobileNavOpen(false)
              }}
            />
          </div>
        </div>
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 lg:h-screen">
        <div className="print:hidden">
          <TopBar
            title={pageTitles[currentPath] || 'Dashboard'}
            onQuickAdd={() => setQuickAddOpen(true)}
            onNavigate={navigate}
            onMenuClick={() => setMobileNavOpen(true)}
          />
        </div>
        <main
          key={currentPath}
          className="flex-1 overflow-y-auto px-4 pb-8 sm:px-5 lg:px-5 lg:pb-8 page-enter print:overflow-visible print:p-0 print:animate-none"
        >
          <div className="max-w-[1440px] mx-auto">{renderPage()}</div>
        </main>
      </div>

      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      <NotificationsPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onNavigate={setCurrentPath}
      />
      <Toaster />
    </div>
  )
}

export default App
