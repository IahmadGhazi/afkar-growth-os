import { User, ChevronDown } from 'lucide-react'

interface TopBarProps {
  title: string
  clientName?: string
}

export function TopBar({ title, clientName }: TopBarProps) {
  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Client Switcher */}
        {clientName && (
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-secondary)]">
            <span className="text-sm font-medium">{clientName}</span>
            <ChevronDown size={14} />
          </button>
        )}

        {/* User Menu */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)]">
          <div className="w-8 h-8 rounded-full bg-[var(--brand-soft)] flex items-center justify-center">
            <User size={16} className="text-[var(--brand)]" />
          </div>
          <span className="text-sm font-medium">Admin</span>
        </button>
      </div>
    </header>
  )
}
