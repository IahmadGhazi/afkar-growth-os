import { useMemo, useState } from 'react'
import {
  LayoutDashboard, CheckSquare, Target, BarChart3, Users, Database, Bell,
  FileText, MessageSquare, Package, Megaphone, Users2, ShoppingBag, Store,
  Star, ShoppingCart, HeartPulse, Sunrise, FlaskConical, Settings as SettingsIcon,
  Rocket, ChevronDown, Store as StoreIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { canAccess } from '@/lib/selectors'

interface SidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  onOpenNotifications?: () => void
}

type Section = 'campaigns' | 'users' | null
interface Child { name: string; path: string; icon: typeof LayoutDashboard; section: Section }
interface Mother { name: string; icon: typeof LayoutDashboard; children: Child[] }

/** IA v2 — six mothers, job-grouped, water-tight. URLs unchanged. */
const NAV: (Child | Mother)[] = [
  { name: 'Command Center', path: '/', icon: LayoutDashboard, section: null },
  {
    name: 'Team', icon: Users, children: [
      { name: 'My Work', path: '/my-work', icon: CheckSquare, section: null },
      { name: 'Weekly Plan', path: '/weekly-plan', icon: Target, section: null },
      { name: 'Tasks', path: '/tasks', icon: CheckSquare, section: null },
      { name: 'Team Chat', path: '/chat', icon: MessageSquare, section: null },
      { name: 'Members', path: '/team', icon: Users2, section: null },
    ],
  },
  {
    name: 'Store', icon: StoreIcon, children: [
      { name: 'Products', path: '/store-products', icon: Store, section: null },
      { name: 'Cart Recovery', path: '/carts', icon: ShoppingCart, section: null },
      { name: 'Orders', path: '/orders', icon: ShoppingBag, section: null },
      { name: 'Customers', path: '/customers', icon: Users2, section: null },
      { name: 'Reviews', path: '/reviews', icon: Star, section: null },
    ],
  },
  {
    name: 'Growth', icon: Rocket, children: [
      { name: 'Product Research', path: '/products', icon: Package, section: null },
      { name: 'Campaigns', path: '/campaigns', icon: Megaphone, section: 'campaigns' },
      { name: 'KPIs', path: '/kpis', icon: BarChart3, section: null },
    ],
  },
  {
    name: 'Insights', icon: Sunrise, children: [
      { name: 'Morning Briefing', path: '/briefing', icon: Sunrise, section: null },
      { name: 'Retention', path: '/retention', icon: HeartPulse, section: null },
      { name: 'Client Report', path: '/report', icon: FileText, section: null },
    ],
  },
  {
    name: 'Settings', icon: SettingsIcon, children: [
      { name: 'Data & Sources', path: '/data', icon: Database, section: null },
      { name: 'Preferences', path: '/settings', icon: SettingsIcon, section: null },
      { name: 'UI/UX Lab', path: '/lab', icon: FlaskConical, section: 'users' },
    ],
  },
]

function isMother(x: Child | Mother): x is Mother {
  return (x as Mother).children !== undefined
}

export function Sidebar({ currentPath, onNavigate, onOpenNotifications }: SidebarProps) {
  const { state } = useApp()

  const visible = useMemo(() => {
    return NAV.map((entry) => {
      if (!isMother(entry)) return entry
      const children = entry.children.filter((c) => c.section == null || canAccess(state, c.section))
      return children.length ? { ...entry, children } : null
    }).filter(Boolean) as (Child | Mother)[]
  }, [state])

  // Route keeps the active mother expanded; your manual toggles override it.
  const routeMother = useMemo(() => {
    for (const entry of visible) {
      if (isMother(entry) && entry.children.some((c) => c.path === currentPath)) return entry.name
    }
    return null
  }, [visible, currentPath])

  const [toggled, setToggled] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const isOpen = (name: string) => {
    if (toggled.has(name)) return true
    if (collapsed.has(name)) return false
    return routeMother === name
  }

  const toggleMother = (name: string) => {
    const opening = !isOpen(name)
    setToggled((prev) => { const n = new Set(prev); if (opening) n.add(name); else n.delete(name); return n })
    setCollapsed((prev) => { const n = new Set(prev); if (opening) n.delete(name); else n.add(name); return n })
  }

  const currentUser = state.profiles.find((p) => p.id === state.currentUserId)
  const unread = (state.notifications ?? []).filter(
    (n) => (!currentUser || n.user_id === currentUser.id) && !n.is_read,
  ).length

  const itemCls = (active: boolean) =>
    cn(
      'relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-left',
      active
        ? 'bg-[var(--brand-soft)] text-[var(--brand)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]'
        : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
    )

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

      {/* Navigation — mothers & children */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {visible.map((entry) => {
          if (!isMother(entry)) {
            const active = currentPath === entry.path
            return (
              <button key={entry.path} onClick={() => onNavigate(entry.path)} className={itemCls(active)}>
                <entry.icon size={17} strokeWidth={active ? 2.2 : 1.9} />
                <span>{entry.name}</span>
              </button>
            )
          }
          const open = isOpen(entry.name)
          const containsActive = entry.children.some((c) => c.path === currentPath)
          return (
            <div key={entry.name}>
              <button
                onClick={() => toggleMother(entry.name)}
                className={cn(
                  'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                  containsActive
                    ? 'text-[var(--brand)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
                )}
                aria-expanded={open}
              >
                <entry.icon size={17} strokeWidth={containsActive ? 2.2 : 1.9} />
                <span className="flex-1 text-left">{entry.name}</span>
                <ChevronDown size={15} className={cn('transition-transform duration-200 opacity-60', open && 'rotate-180')} />
              </button>

              {open && (
                <div className="mt-0.5 mb-1 ml-[18px] pl-3 border-l border-[var(--hairline)] space-y-0.5">
                  {entry.children.map((c) => {
                    const active = currentPath === c.path
                    return (
                      <button key={c.path} onClick={() => onNavigate(c.path)} className={cn(itemCls(active), '!py-2 !text-[13px]')}>
                        {active && (
                          <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full" style={{ background: 'var(--brand)' }} />
                        )}
                        <c.icon size={14} strokeWidth={active ? 2.2 : 1.8} />
                        <span>{c.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-1 border-t border-[var(--hairline)]">
        <button
          onClick={onOpenNotifications}
          className={cn(
            'w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
            'text-[var(--text-secondary)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]',
          )}
        >
          <div className="relative">
            <Bell size={17} />
            {unread > 0 && (
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
