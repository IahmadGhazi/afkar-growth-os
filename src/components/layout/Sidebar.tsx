import { useState } from 'react'
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Target, 
  BarChart3, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
}

const navigation = [
  { name: 'Command Center', path: '/', icon: LayoutDashboard },
  { name: 'My Work', path: '/my-work', icon: CheckSquare },
  { name: 'Weekly Plan', path: '/weekly-plan', icon: Target },
  { name: 'Tasks', path: '/tasks', icon: CheckSquare },
  { name: 'Team', path: '/team', icon: Users },
  { name: 'Clients', path: '/clients', icon: Users },
  { name: 'KPIs', path: '/kpis', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside 
      className={cn(
        "h-screen bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[var(--border)]">
        {!collapsed && (
          <span className="text-lg font-semibold text-[var(--text-primary)]">
            AFKAR
          </span>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-[var(--border)]"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="p-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)]">
            <Search size={14} />
            <span>Search...</span>
            <span className="ml-auto text-xs bg-[var(--border)] px-1.5 py-0.5 rounded">⌘K</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navigation.map((item) => {
          const isActive = currentPath === item.path
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive 
                  ? "bg-[var(--brand-soft)] text-[var(--brand)]" 
                  : "text-[var(--text-secondary)] hover:bg-[var(--border)]"
              )}
            >
              <item.icon size={18} />
              {!collapsed && <span>{item.name}</span>}
            </button>
          )
        })}
      </nav>

      {/* Notifications */}
      <div className="p-3 border-t border-[var(--border)]">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--border)]">
          <Bell size={18} />
          {!collapsed && <span>Notifications</span>}
        </button>
      </div>
    </aside>
  )
}
