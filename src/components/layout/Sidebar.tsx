import {
  LayoutDashboard,
  CheckSquare,
  Target,
  BarChart3,
  Users,
  Database,
  Bell,
  FileText,
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
    <aside className="glass-strong w-64 shrink-0 m-4 mr-0 rounded-[28px] flex flex-col overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6177ff] to-[#4459e8] flex items-center justify-center shadow-[0_6px_16px_rgba(77,99,242,0.35)]">
          <span className="text-white font-extrabold text-base">A</span>
        </div>
        <div className="leading-tight">
          <div className="font-extrabold tracking-[0.04em] text-[var(--text-primary)]">
            AFKAR
          </div>
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
            Growth OS
          </div>
        </div>
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
                  : 'text-[var(--text-secondary)] hover:bg-[rgba(22,26,34,0.05)] hover:text-[var(--text-primary)]',
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
              : 'text-[var(--text-secondary)] hover:bg-[rgba(22,26,34,0.05)] hover:text-[var(--text-primary)]',
          )}
        >
          <FileText size={17} />
          <span>Client Report</span>
        </button>
        <button
          onClick={onOpenNotifications}
          className={cn(
            'w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
            'text-[var(--text-secondary)] hover:bg-[rgba(22,26,34,0.05)] hover:text-[var(--text-primary)]',
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
          <span className="chip text-[10px]">Local mode</span>
        </div>
      </div>
    </aside>
  )
}