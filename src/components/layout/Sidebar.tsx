import {
  LayoutDashboard,
  CheckSquare,
  Target,
  BarChart3,
  Users,
  Database,
  Bell,
  FileText,
  MessageSquare,
  Package,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  onOpenNotifications?: () => void
}

const navigation = [
  { name: 'Command Center', path: '/', icon: LayoutDashboard },
  { name: 'My Work', path: '/my-work', icon: CheckSquare },
  { name: 'Weekly Plan', path: '/weekly-plan', icon: Target },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare },
  { name: 'Team', path: '/team', icon: Users },
  { name: 'Team Chat', path: '/chat', icon: MessageSquare },
  { name: 'Products', path: '/products', icon: Package },
  { name: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { name: 'KPIs', path: '/kpis', icon: BarChart3 },
  { name: 'Data & Sources', path: '/data', icon: Database },
]

export function Sidebar({ currentPath, onNavigate, onOpenNotifications }: SidebarProps) {
  const { state } = useApp()
  const currentUser = state.profiles.find((p) => p.id === state.currentUserId)
  const unread = (state.notifications ?? []).filter(
    (n) => (!currentUser || n.user_id === currentUser.id) && !n.is_read,
  ).length
  const hasNotifications = unread > 0
    return (
    <aside className="glass-strong w-full h-full lg:w-64 lg:h-auto lg:m-4 lg:mr-0 rounded-none lg:rounded-[28px] flex flex-col overflow-hidden">


      {/* Brand */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <img
          src="/logo.png"
          alt="AFKAR logo"
          className="h-10 w-auto rounded-xl object-contain drop-shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = currentPath === item.path
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-[var(--brand-soft)] text-[var(--brand)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
              )}
            >
              <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.9} />
              <span>{item.name}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-1 border-t border-[var(--hairline)]">
        <button
          onClick={() => onNavigate('/report')}
          className={cn(
            'w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
            currentPath === '/report'
              ? 'bg-[var(--brand-soft)] text-[var(--brand)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
          )}
        >
          <FileText size={17} />
          <span>Client Report</span>
        </button>
        <button
          onClick={onOpenNotifications}
          className={cn(
            'w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
            'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
          )}
        >
          <div className="relative">
            <Bell size={17} />
            {hasNotifications && (
              <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--critical)] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--glass-strong)]">
                {unread}
              </span>
            )}
          </div>
          <span className="font-medium">Notifications</span>
        </button>
        <div className="px-3.5 py-1.5">
          <span className="chip text-[10px]">Backend connected</span>
        </div>
      </div>
    </aside>
  )
}