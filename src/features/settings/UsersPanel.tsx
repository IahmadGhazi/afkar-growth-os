import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, KeyRound } from 'lucide-react'
import { useApp } from '../../lib/store'
import { roleLabel } from '../../lib/selectors'
import { adminUsers } from '../../lib/admin-users'
import { PrimaryButton } from '../../components/shared/ui'
import type { Profile } from '../../types/database'

const roles: Profile['role'][] = [
  'super_admin',
  'account_manager',
  'seo',
  'media_buyer',
  'social_media',
  'designer',
  'product_research',
  'viewer',
]

interface FormState {
  id: string | null // null = create
  fullName: string
  email: string
  role: Profile['role']
  password: string
}

export function UsersPanel() {
  const { state, actions } = useApp()
  const [form, setForm] = useState<FormState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)

  const members = [...state.profiles].sort((a, b) => a.full_name?.localeCompare(b.full_name ?? '') ?? 0)
  const me = state.profiles.find((p) => p.id === state.currentUserId)

  const openCreate = () =>
    setForm({ id: null, fullName: '', email: '', role: 'viewer', password: '' })

  const openEdit = (m: Profile) =>
    setForm({ id: m.id, fullName: m.full_name ?? '', email: m.email, role: m.role, password: '' })

  const submit = async () => {
    if (!form) return
    setBusy(true)
    setError(null)
    if (form.id == null) {
      const { error: err } = await adminUsers.create({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
      })
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
      actions.addMember({ fullName: form.fullName, email: form.email, role: form.role })
    } else {
      const { error: err } = await adminUsers.update({
        id: form.id,
        fullName: form.fullName,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      })
      if (err) {
        setError(err)
        setBusy(false)
        return
      }
      actions.updateMember(form.id, { full_name: form.fullName, role: form.role })
    }
    setForm(null)
    setBusy(false)
  }

  const doDelete = async (m: Profile) => {
    setBusy(true)
    setError(null)
    const { error: err } = await adminUsers.remove(m.id)
    if (err) {
      setError(err)
      setBusy(false)
      setConfirmDelete(null)
      return
    }
    actions.updateMember(m.id, { is_active: false })
    setConfirmDelete(null)
    setBusy(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-[var(--text-primary)]">Team Accounts</div>
          <div className="text-sm text-[var(--text-muted)]">
            Logins, roles and passwords. Admins only.
          </div>
        </div>
        <PrimaryButton onClick={openCreate}>
          <Plus size={16} /> Add User
        </PrimaryButton>
      </div>

      {error && (
        <div className="rounded-lg bg-[var(--critical-soft)] text-[var(--critical)] text-xs px-3 py-2">
          {error}
        </div>
      )}

      {/* Create / edit form */}
      {form && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-primary)]">
              {form.id ? `Edit ${form.fullName}` : 'New team account'}
            </span>
            <button onClick={() => setForm(null)} className="icon-btn" aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Full name"
              className="field"
            />
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              disabled={form.id != null}
              className="field disabled:opacity-60"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Profile['role'] })}
              className="field"
            >
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabel(r)}</option>
              ))}
            </select>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.id ? 'New password (leave blank to keep)' : 'Password (min 6 chars)'}
              className="field"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setForm(null)} className="btn btn-outline">Cancel</button>
            <button
              onClick={submit}
              disabled={busy || !form.fullName.trim() || !form.email.trim() || (!form.id && form.password.length < 6)}
              className="btn btn-primary"
            >
              <Check size={15} /> {form.id ? 'Save changes' : 'Create account'}
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="glass-card divide-y divide-[var(--hairline)] overflow-hidden">
        {members.map((m) => (
          <div key={m.id} className={`flex items-center gap-3 px-5 py-3.5 ${m.is_active === false ? 'opacity-50' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[#1a1405]">{m.full_name?.charAt(0) ?? '?'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.full_name}</span>
                {m.auth_user_id ? (
                  <span className="badge bg-[var(--positive-soft)] text-[var(--positive)]"><KeyRound size={10} /> login</span>
                ) : (
                  <span className="badge bg-[var(--track)] text-[var(--text-muted)]">no login</span>
                )}
                {m.id === me?.id && <span className="badge bg-[var(--brand-soft)] text-[var(--brand)]">you</span>}
              </div>
              <div className="text-xs text-[var(--text-muted)] truncate">{m.email} · {roleLabel(m.role)}</div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => openEdit(m)} className="icon-btn" aria-label={`Edit ${m.full_name}`}>
                <Pencil size={14} />
              </button>
              {m.id !== me?.id && (
                <button
                  onClick={() => setConfirmDelete(m)}
                  className="icon-btn icon-btn-danger"
                  aria-label={`Delete ${m.full_name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="glass-lg p-6 max-w-sm w-full mx-4 scale-in space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-[var(--text-primary)]">Delete {confirmDelete.full_name}?</div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Removes their login and team profile. Their tasks stay, unassigned.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-outline">Cancel</button>
              <button onClick={() => doDelete(confirmDelete)} disabled={busy} className="btn btn-danger">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
