import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, MessageSquare, Search, Smile, Pencil, Trash2, Check, X, ArrowDown } from 'lucide-react'
import { useApp } from '../../lib/store'
import { roleLabel } from '../../lib/selectors'
import type { ChatMessage, Profile } from '../../types/database'

const QUICK_REACTIONS = ['👍', '🎉', '❤️', '😄', '👀']

function authorName(profiles: Profile[], id: string): string {
  return profiles.find((p) => p.id === id)?.full_name ?? 'Unknown'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function dayLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  const today = new Date()
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function Avatar({ profile, size = 36 }: { profile: Profile | undefined; size?: number }) {
  return (
    <div
      className="rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shadow-[0_4px_12px_rgba(210,154,12,0.3)] shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-[#1a1405]" style={{ fontSize: size * 0.38 }}>
        {profile?.full_name?.charAt(0) ?? '?'}
      </span>
    </div>
  )
}

/** Slack-style row: everyone left-aligned; name + time header on the first
    message of a group; hover toolbar for react / edit / delete. */
function MessageRow({
  message,
  author,
  grouped,
  isMine,
  currentUserId,
  onReact,
  onEdit,
  onDelete,
  editing,
  onSaveEdit,
  onCancelEdit,
}: {
  message: ChatMessage
  author: Profile | undefined
  grouped: boolean
  isMine: boolean
  currentUserId: string | null
  onReact: (emoji: string) => void
  onEdit: () => void
  onDelete: () => void
  editing: boolean
  onSaveEdit: (body: string) => void
  onCancelEdit: () => void
}) {
  const [draft, setDraft] = useState(message.body)
  const [reactOpen, setReactOpen] = useState(false)

  const save = () => {
    if (!draft.trim()) return
    onSaveEdit(draft.trim())
  }

  if (editing) {
    return (
      <div className="flex gap-3 px-4 pt-3">
        <Avatar profile={author} size={32} />
        <div className="flex-1">
          <div className="text-xs font-semibold text-[var(--brand)] mb-1">Editing message</div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="field resize-none text-sm"
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={onCancelEdit} className="btn btn-outline !py-1 !px-2.5 !text-xs">
              <X size={12} /> Cancel
            </button>
            <button onClick={save} disabled={!draft.trim()} className="btn btn-primary !py-1 !px-2.5 !text-xs">
              <Check size={12} /> Save
            </button>
          </div>
        </div>
      </div>
    )
  }

  const reactions = Object.entries(message.reactions ?? {})

  return (
    <div className={`group relative flex gap-3 px-4 ${grouped ? 'pt-0.5' : 'pt-4'} hover:bg-[var(--hover)] transition-colors`}>
      <div className="w-9 shrink-0">
        {!grouped && <Avatar profile={author} />}
      </div>
      <div className="min-w-0 flex-1 pb-0.5">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">{author?.full_name ?? 'Unknown'}</span>
            {author && <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{roleLabel(author.role)}</span>}
            <span className="text-[11px] text-[var(--text-muted)]">{formatTime(message.created_at)}</span>
          </div>
        )}
        <div className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap break-words pr-16">
          {message.body}
          {message.edited_at && (
            <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">(edited)</span>
          )}
        </div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {reactions.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-colors ${
                  users.includes(currentUserId ?? '')
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--brand)]'
                }`}
              >
                {emoji} {users.length}
              </button>
            ))}
          </div>
        )}

        {/* Hover toolbar */}
        <div className="absolute right-6 top-1 hidden group-hover:flex items-center gap-0.5 glass-strong rounded-lg px-1 py-0.5 z-10">
          <div className="relative">
            <button onClick={() => setReactOpen(!reactOpen)} className="icon-btn w-7 h-7" title="Add reaction" aria-label="Add reaction">
              <Smile size={14} />
            </button>
            {reactOpen && (
              <div className="absolute bottom-full mb-1 right-0 glass-strong rounded-lg px-2 py-1.5 flex gap-1 shadow-lift">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onReact(emoji); setReactOpen(false) }}
                    className="text-base hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isMine && (
            <>
              <button onClick={onEdit} className="icon-btn w-7 h-7" title="Edit message" aria-label="Edit message">
                <Pencil size={13} />
              </button>
              <button onClick={onDelete} className="icon-btn icon-btn-danger w-7 h-7" title="Delete message" aria-label="Delete message">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function Chat() {
  const { state, actions } = useApp()
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showJump, setShowJump] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const clientId = state.currentClientId

  const messages = useMemo(() => {
    let list = (state.messages ?? []).filter((m) => !clientId || m.client_id === clientId)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.body.toLowerCase().includes(q) ||
          authorName(state.profiles, m.author_id).toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [state.messages, clientId, search])

  const currentUserId = state.currentUserId

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
  }

  const jumpToLatest = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const send = () => {
    if (!draft.trim()) return
    // @mention engine: notify teammates named in the message
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]"># team</h2>
          <div className="text-sm text-[var(--text-muted)]">One place for updates and handoffs.</div>
        </div>
        {/* Slack-ease: live search */}
        <div className="relative w-48 sm:w-64 shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="field !pl-8 !py-1.5 !text-xs"
          />
        </div>
      </div>

      <div className="glass-card flex-1 flex flex-col overflow-hidden min-h-[420px] h-[calc(100dvh-240px)] lg:h-auto relative">
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-2">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <MessageSquare size={32} className="text-[var(--text-muted)] mb-3" />
              <div className="text-sm font-medium text-[var(--text-secondary)]">
                {search ? `No results for "${search}"` : 'No messages yet'}
              </div>
              <div className="text-sm text-[var(--text-muted)] mt-1">
                {search ? 'Try a different search.' : 'Start the conversation below.'}
              </div>
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
                    <div key={`day-${key}`} className="flex items-center justify-center px-4 pt-4 pb-1">
                      <span className="glass-strong rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] shadow-sm">
                        {dayLabel(key)}
                      </span>
                    </div>,
                  )
                  lastDay = key
                  lastAuthor = ''
                }
                const grouped = m.author_id === lastAuthor
                const author = state.profiles.find((pr) => pr.id === m.author_id)
                nodes.push(
                  <MessageRow
                    key={m.id}
                    message={m}
                    author={author}
                    grouped={grouped}
                    isMine={m.author_id === currentUserId}
                    currentUserId={currentUserId}
                    onReact={(emoji) => actions.toggleReaction(m.id, emoji)}
                    onEdit={() => setEditingId(m.id)}
                    onDelete={() => actions.deleteMessage(m.id)}
                    editing={editingId === m.id}
                    onSaveEdit={(body) => { actions.editMessage(m.id, body); setEditingId(null) }}
                    onCancelEdit={() => setEditingId(null)}
                  />,
                )
                lastAuthor = m.author_id
              }
              return nodes
            })()
          )}
          <div ref={bottomRef} />
        </div>

        {/* Jump to latest */}
        {showJump && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-24 right-6 icon-btn glass-strong rounded-full w-10 h-10 shadow-lift"
            aria-label="Jump to latest"
          >
            <ArrowDown size={17} />
          </button>
        )}

        <div className="border-t border-[var(--hairline)] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={`Message #team as ${currentUserId ? authorName(state.profiles, currentUserId) : '...'}`}
              className="field resize-none flex-1 min-h-[44px] max-h-32 focus:!shadow-[0_0_0_3px_rgba(210,154,12,0.12),0_4px_16px_rgba(210,154,12,0.08)] transition-shadow"
            />
            <button onClick={send} disabled={!draft.trim()} className="btn btn-primary h-[44px] shrink-0" aria-label="Send message">
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1.5 px-1">
            Enter to send · Shift + Enter for a new line · hover a message to react or edit
          </div>
        </div>
      </div>
    </div>
  )
}
