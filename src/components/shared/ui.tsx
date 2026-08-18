import type { ReactNode } from 'react'
import type { TaskPriority } from '../../types/database'
import { cn } from '../../lib/utils'

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        'badge',
        priority === 'critical' && 'bg-[var(--critical-soft)] text-[var(--critical)]',
        priority === 'high' && 'bg-[var(--warning-soft)] text-[var(--warning)]',
        priority === 'medium' && 'bg-[var(--brand-soft)] text-[var(--brand)]',
        priority === 'low' && 'bg-[rgba(22,26,34,0.06)] text-[var(--text-muted)]',
      )}
    >
      {priority}
    </span>
  )
}

export function StatusDot({ color }: { color: string }) {
  return <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] bg-[rgba(255,255,255,0.35)] text-center">
      <div className="text-sm font-medium text-[var(--text-secondary)]">{title}</div>
      {hint && <div className="text-sm text-[var(--text-muted)] mt-1">{hint}</div>}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-[0.08em] mb-4">
      {children}
    </h2>
  )
}

export function Card({
  children,
  className,
  hover = false,
}: {
  children: ReactNode
  className?: string
  hover?: boolean
}) {
  return <div className={cn('glass-card p-5', hover && 'hover-lift', className)}>{children}</div>
}

export function PrimaryButton({
  children,
  onClick,
  className,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} onClick={onClick} className={cn('btn btn-primary', className)}>
      {children}
    </button>
  )
}

export function PositiveButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button onClick={onClick} className={cn('btn btn-positive', className)}>
      {children}
    </button>
  )
}

export function OutlineButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button onClick={onClick} className={cn('btn btn-outline', className)}>
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button onClick={onClick} className={cn('btn btn-ghost', className)}>
      {children}
    </button>
  )
}

export function IconButton({
  children,
  onClick,
  title,
  tone = 'neutral',
}: {
  children: ReactNode
  onClick?: () => void
  title: string
  tone?: 'neutral' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('icon-btn', tone === 'danger' && 'icon-btn-danger')}
    >
      {children}
    </button>
  )
}