import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare } from 'lucide-react'
import { useApp } from '../../lib/store'
import { roleLabel } from '../../lib/selectors'
import type { ChatMessage, Profile } from '../../types/database'

function authorName(profiles: Profile[], id: string): string {
  return profiles.find((p) => p.id === id)?.full_name ?? 'Unknown'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function dayLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  const today = new Date()
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (dayKey(d.toISOString()) === dayKey(today.toISOString())) return 'Today'
  if (dayKey(d.toISOString()) === dayKey(yest.toISOString())) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function MessageRow({
  message,
  author,
  grouped,
  isMine,
}: {
  message: ChatMessage
  author: Profile | undefined
  grouped: boolean
  isMine: boolean
}) {
  return (
    <div className={`flex gap-3 px-4 ${grouped ? 'pt-1' : 'pt-5'} ${isMine ? 'flex-row-reverse' : ''}`}>
      <div className="shrink-0">
        {!grouped && (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shadow-[0_4px_12px_rgba(210,154,12,0.3)]">
            <span className="text-sm font-bold text-[#1a1405]">
              {author?.full_name?.charAt(0) ?? '?'}
            </span>
          </div>
        )}
      </div>
      <div className={`min-w-0 max-w-[75%] ${isMine ? 'items-end text-right' : 'items-start'}`}>
        {!grouped && (
          <div className={`flex items-baseline gap-2 mb-0.5 ${isMine ? 'justify-end' : ''}`}>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {author?.full_name ?? 'Unknown'}
            </span>
            {author && (
              <span className="text-xs text-[var(--text-muted)]">{roleLabel(author.role)}</span>
            )}
            <span className="text-xs text-[var(--text-muted)]">{formatTime(message.created_at)}</span>
          </div>
        )}
        <div
          className={`inline-block text-sm leading-relaxed whitespace-pre-wrap break-words px-3.5 py-2.5 ${
            isMine
              ? 'bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] text-[#1a1405] rounded-2xl rounded-tr-sm'
              : 'bg-[var(--surface)] text-[var(--text-primary)] rounded-2xl rounded-tl-sm'
          }`}
        >
          {message.body}
        </div>
      </div>
    </div>
  )
}

export function Chat() {
  const { state, actions } = useApp()
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const clientId = state.currentClientId

  const messages = (state.messages ?? [])
    .filter((m) => !clientId || m.client_id === clientId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const currentUserId = state.currentUserId

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = () => {
    if (!draft.trim()) return
    actions.sendMessage(draft)
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Chat</h2>
        <div className="text-sm text-[var(--text-muted)]">
          One place for updates, handoffs and decisions — no more WhatsApp chaos.
        </div>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden min-h-[420px]">
        <div className="flex-1 overflow-y-auto py-2">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <MessageSquare size={32} className="text-[var(--text-muted)] mb-3" />
              <div className="text-sm font-medium text-[var(--text-secondary)]">No messages yet</div>
              <div className="text-sm text-[var(--text-muted)] mt-1">Start the conversation below.</div>
            </div>
          ) : (
            (() => {
              const nodes: React.ReactNode[] = []
              let lastDay = ''
              let lastAuthor = ''
              for (let i = 0; i < messages.length; i++) {
                const m = messages[i]
                const key = dayKey(m.created_at)
                if (key !== lastDay) {
                  nodes.push(
                    <div key={`day-${key}`} className="flex items-center gap-3 px-4 pt-3 pb-1">
                      <div className="flex-1 h-px bg-[var(--hairline)]" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {dayLabel(key)}
                      </span>
                      <div className="flex-1 h-px bg-[var(--hairline)]" />
                    </div>,
                  )
                  lastDay = key
                  lastAuthor = ''
                }
                const grouped = m.author_id === lastAuthor
                const author = state.profiles.find((p) => p.id === m.author_id)
                nodes.push(
                  <MessageRow
                    key={m.id}
                    message={m}
                    author={author}
                    grouped={grouped}
                    isMine={m.author_id === currentUserId}
                  />,
                )
                lastAuthor = m.author_id
              }
              return nodes
            })()
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-[var(--hairline)] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={`Message #team as ${currentUserId ? authorName(state.profiles, currentUserId) : '...'}`}
              className="field resize-none flex-1 min-h-[44px] max-h-32"
            />
            <button
              onClick={send}
              disabled={!draft.trim()}
              className="btn btn-primary h-[44px] shrink-0"
              aria-label="Send message"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1.5 px-1">
            Enter to send · Shift + Enter for a new line
          </div>
        </div>
      </div>
    </div>
  )
}
