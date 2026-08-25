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
import { Customers } from './features/customers/Customers'
import { Orders } from './features/orders/Orders'
import { CartRecovery } from './features/carts/CartRecovery'
import { Retention } from './features/retention/Retention'
import { Briefing } from './features/briefing/Briefing'
import { Lab } from './features/lab/Lab'
import { StoreProducts } from './features/store-products/StoreProducts'
import { Reviews } from './features/reviews/Reviews'
import { Kpis } from './features/kpis/Kpis'
import { Data } from './features/data/Data'
import { Settings } from './features/settings/Settings'
import { Report } from './features/report/Report'
import { NotificationsPanel } from './components/notifications/NotificationsPanel'
import { AppConfirm } from './components/shared/Confirm'

const pageTitles: Record<string, string> = {
  '/': 'Command Center',
  '/briefing': 'Morning Briefing',
  '/my-work': 'My Work',
  '/weekly-plan': 'Weekly Plan',
  '/tasks': 'Tasks',
  '/team': 'Team',
  '/chat': 'Team Chat',
  '/products': 'Product Research',
  '/store-products': 'Products',
  '/customers': 'Customers',
  '/orders': 'Orders',
  '/carts': 'Cart Recovery',
  '/retention': 'Retention',
  '/reviews': 'Reviews',
  '/campaigns': 'Campaigns',
  '/kpis': 'KPIs',
  '/data': 'Data & Sources',
  '/report': 'Client Report',
  '/settings': 'Settings',
  '/lab': 'UI/UX Lab',
}

function App() {
  const { state } = useApp()
  const auth = useAuth()

  // URL-driven navigation: real endpoints (/tasks, /chat, /campaigns...).
  // Refresh returns you to exactly where you were. Browser back/forward work.
  const [currentPath, setCurrentPath] = useState(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/'
    return pageTitles[path] ? path : '/'
  })
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Keep URL in sync when navigating via sidebar/buttons
  useEffect(() => {
    if (window.location.pathname !== currentPath) {
      window.history.pushState({}, '', currentPath)
    }
  }, [currentPath])

  // Browser back/forward buttons
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname.replace(/\/+$/, '') || '/'
      setCurrentPath(pageTitles[path] ? path : '/')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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
    window.history.pushState({}, '', path)
    setCurrentPath(path)
    setMobileNavOpen(false)
  }

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <CommandCenter onNavigate={navigate} />
      case '/briefing':
        return <Briefing onNavigate={navigate} />
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
      case '/store-products':
        return <StoreProducts />
      case '/customers':
        return <Customers />
      case '/orders':
        return <Orders />
      case '/carts':
        return <CartRecovery />
      case '/retention':
        return <Retention />
      case '/reviews':
        return <Reviews />
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
      case '/lab':
        return <Lab />
      default:
        return (
          <div className="p-10 text-center space-y-3">
            <div className="text-5xl font-black" style={{ color: '#d29a0c' }}>404</div>
            <div className="text-sm text-[var(--text-muted)]">This page does not exist.</div>
          </div>
        )
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
          onNavigate={navigate}
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
        onNavigate={navigate}
      />
      <Toaster />
      <AppConfirm />
    </div>
  )
}

export default App
