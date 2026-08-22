import { Bell, CheckCheck, X, ArrowRight } from 'lucide-react'
import { useApp } from '../../lib/store'
import { currentUser } from '../../lib/selectors'
import { formatShort } from '../../lib/date'

interface NotificationsPanelProps {
  open: boolean
  onClose: () => void
  onNavigate?: (path: string) => void
}

function typeAllowed(settings: Record<string, unknown>, type: string): boolean {
  if (type === 'task_overdue') return settings.notify_overdue !== false
  if (type === 'task_review') return settings.notify_review !== false
  return settings.notify_task_assignments !== false
}

export function NotificationsPanel({ open, onClose, onNavigate }: NotificationsPanelProps) {
  const { state, actions } = useApp()
  if (!open) return null

  const user = currentUser(state)
  const prefs = state.organization.settings
  const all = (state.notifications ?? [])
    .filter((n) => !user || n.user_id === user.id)
    .filter((n) => typeAllowed(prefs, n.type))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const unread = all.filter((n) => !n.is_read)
  const visible = [...unread, ...all.filter((n) => n.is_read)]

  const openNotification = (id: string, link: string | null) => {
    if (link) onNavigate?.(link)
    if (!unread.some((n) => n.id === id)) return
    actions.markNotificationRead(id)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-lg relative w-full max-w-md spring-in" style={{ transformOrigin: 'top right' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[var(--brand)]" />
            <span className="font-semibold text-[var(--text-primary)]">Notifications</span>
            {unread.length > 0 && (
              <span className="badge bg-[var(--brand-soft)] text-[var(--brand)]">
                {unread.length} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread.length > 0 && (
              <button
                onClick={() => actions.markNotificationsRead()}
                className="icon-btn"
                title="Mark all as read"
                aria-label="Mark all as read"
              >
                <CheckCheck size={16} />
              </button>
            )}
            <button onClick={onClose} className="icon-btn" aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-5 pt-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {visible.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)] text-center py-8">
              You're all caught up.
            </div>
          ) : (
            visible.map((notification) => (
              <button
                key={notification.id}
                onClick={() => openNotification(notification.id, notification.link)}
                className={`w-full text-left glass-inset p-3.5 transition-colors hover:border-[rgba(210,154,12,0.35)] ${
                  notification.is_read ? 'opacity-55' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {notification.title}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {formatShort(notification.created_at)}
                  </span>
                </div>
                {notification.body && (
                  <div className="text-sm text-[var(--text-muted)]">{notification.body}</div>
                )}
                {notification.link && (
                  <div className="flex items-center gap-1 text-xs text-[var(--brand)] font-medium mt-1.5">
                    Open <ArrowRight size={11} />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}