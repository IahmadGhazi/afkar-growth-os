import { Plus, Store, Settings } from 'lucide-react'
import { useApp } from '../../lib/store'
import { currentClient, currentUser, roleLabel } from '../../lib/selectors'

interface TopBarProps {
  title: string
  onQuickAdd?: () => void
  onNavigate?: (path: string) => void
}

export function TopBar({ title, onQuickAdd, onNavigate }: TopBarProps) {
  const { state } = useApp()
  const client = currentClient(state)
  const user = currentUser(state)

  return (
    <header className="glass-strong mx-4 mt-4 mb-2 rounded-2xl h-16 flex items-center justify-between px-5 shrink-0">
      <div className="flex items-center gap-4 min-w-0">
        <h1 className="text-lg font-bold text-[var(--text-primary)] truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Client chip (single client) */}
        {client && (
          <div className="chip">
            <Store size={13} className="text-[var(--brand)]" />
            <span className="text-[var(--text-primary)] font-semibold">{client.name}</span>
          </div>
        )}

        {/* Quick Add */}
        <button onClick={onQuickAdd} className="btn btn-primary">
          <Plus size={16} strokeWidth={2.4} />
          <span className="hidden sm:inline">Quick Add</span>
          <span className="hidden lg:inline text-xs font-semibold opacity-80">⌘K</span>
        </button>

        {/* Settings */}
        <button
          onClick={() => onNavigate?.('/settings')}
          title="Settings"
          aria-label="Settings"
          className="icon-btn w-9 h-9 rounded-xl"
        >
          <Settings size={18} />
        </button>

        {/* User */}
        <button
          onClick={() => onNavigate?.('/settings')}
          className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-[rgba(22,26,34,0.05)] transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6177ff] to-[#4459e8] flex items-center justify-center shadow-[0_4px_12px_rgba(77,99,242,0.3)]">
            {user?.full_name ? (
              <span className="text-sm font-bold text-white">{user.full_name.charAt(0)}</span>
            ) : (
              <span className="text-sm font-bold text-white">?</span>
            )}
          </div>
          <div className="text-left hidden md:block">
            <div className="text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {user?.full_name ?? 'Guest'}
            </div>
            <div className="text-xs text-[var(--text-muted)] leading-tight">
              {user ? roleLabel(user.role) : 'Local mode'}
            </div>
          </div>
        </button>
      </div>
    </header>
  )
}