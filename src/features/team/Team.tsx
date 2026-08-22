import { useState } from 'react'
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Eye,
  ArrowLeftRight,
} from 'lucide-react'
import { useApp, type MemberInput } from '../../lib/store'
import { teamMemberStats, roleLabel } from '../../lib/selectors'
import { SectionTitle, PrimaryButton, EmptyState } from '../../components/shared/ui'
import type { Profile } from '../../types/database'

const emptyForm: MemberInput = {
  fullName: '',
  email: '',
  role: 'viewer',
}

const roles: Profile['role'][] = [
  'account_manager',
  'seo',
  'media_buyer',
  'social_media',
  'designer',
  'product_research',
  'viewer',
]

function MemberCard({ member }: { member: Profile }) {
  const { state, actions } = useApp()
  const stats = teamMemberStats(state, member)
  const isViewing = state.currentUserId === member.id
  const me = state.profiles.find((p) => p.id === state.currentUserId)
  const canImpersonate = me?.role === 'super_admin' || me?.role === 'account_manager'
  return (
    <div className={`glass-card hover-lift p-5 ${isViewing ? 'ring-2 ring-[var(--brand)]' : ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center shadow-[0_4px_12px_rgba(210,154,12,0.3)]">
          <span className="text-sm font-bold text-[#1a1405]">
            {member.full_name?.charAt(0) ?? '?'}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-[var(--text-primary)]">{member.full_name}</div>
            {isViewing && (
              <span className="badge bg-[var(--brand-soft)] text-[var(--brand)]">
                <Eye size={10} /> Viewing
              </span>
            )}
          </div>
          <div className="text-sm text-[var(--text-muted)]">{roleLabel(member.role)}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Clock size={14} />
            Active Tasks
          </div>
          <span className="font-medium text-[var(--text-primary)]">{stats.active}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <CheckCircle size={14} />
            Completed Today
          </div>
          <span className="font-medium text-[var(--positive)]">{stats.completedToday}</span>
        </div>
        {stats.overdue > 0 && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-[var(--critical)]">
              <AlertTriangle size={14} />
              Overdue
            </div>
            <span className="font-medium text-[var(--critical)]">{stats.overdue}</span>
          </div>
        )}
      </div>

      {canImpersonate && (
        <button
          onClick={() => actions.setCurrentUser(member.id)}
          className={`btn w-full mt-4 ${isViewing ? 'btn-outline' : 'btn-primary'}`}
        >
          <Eye size={15} />
          {isViewing ? 'Currently viewing' : `View as ${member.full_name}`}
        </button>
      )}
    </div>
  )
}

export function Team() {
  const { state, actions } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<MemberInput>(emptyForm)

  const members = state.profiles.filter((profile) => profile.is_active)
  const viewing = state.profiles.find((profile) => profile.id === state.currentUserId)
  const isAdminView = state.currentUserId === state.profiles.find((p) => p.role === 'super_admin')?.id

  const submit = () => {
    if (!form.fullName.trim() || !form.email.trim()) return
    actions.addMember(form)
    setForm(emptyForm)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Members</h2>
          <div className="text-sm text-[var(--text-muted)]">{members.length} active members</div>
        </div>
        <PrimaryButton onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Users size={16} />}
          {showForm ? 'Close' : 'Add Member'}
        </PrimaryButton>
      </div>

      {!isAdminView && (
        <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-[var(--brand)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f0c42e] to-[#d29a0c] flex items-center justify-center">
              <span className="text-sm font-bold text-[#1a1405]">{viewing?.full_name?.charAt(0) ?? '?'}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Viewing as {viewing?.full_name} — {viewing ? roleLabel(viewing.role) : ''}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                My Work, notifications and the top bar now show this member's perspective.
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const admin = state.profiles.find((p) => p.role === 'super_admin')
              if (admin) actions.setCurrentUser(admin.id)
            }}
            className="btn btn-outline"
          >
            <ArrowLeftRight size={15} />
            Back to admin
          </button>
        </div>
      )}

      {showForm && (
        <div className="glass-card p-5 space-y-3">
          <SectionTitle>Add Team Member</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Full name"
              className="field"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="field"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Profile['role'] })}
              className="field"
            >
              {roles.map((role) => (
                <option key={role} value={role}>{roleLabel(role)}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={!form.fullName.trim() || !form.email.trim()}
              className="btn btn-primary"
            >
              Add Member
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {members.length === 0 && <EmptyState title="No team members yet" hint="Add your first member." />}
    </div>
  )
}
