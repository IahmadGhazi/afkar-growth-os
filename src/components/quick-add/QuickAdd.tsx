import { useState } from 'react'
import { Plus, CheckSquare, BarChart3, Users, X } from 'lucide-react'
import { useApp, type TaskInput, type KpiInput, type MemberInput } from '../../lib/store'
import { DEPARTMENT_LABELS, roleLabel } from '../../lib/selectors'
import type { Department, Profile } from '../../types/database'

type Tab = 'task' | 'kpi' | 'member'

const tabs: { id: Tab; label: string; icon: typeof Plus }[] = [
  { id: 'task', label: 'Task', icon: CheckSquare },
  { id: 'kpi', label: 'KPI', icon: BarChart3 },
  { id: 'member', label: 'Member', icon: Users },
]

interface QuickAddProps {
  open: boolean
  onClose: () => void
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

export function QuickAdd({ open, onClose }: QuickAddProps) {
  const { state, actions } = useApp()
  const [tab, setTab] = useState<Tab>('task')

  const [task, setTask] = useState<TaskInput>({
    title: '',
    department: null,
    priority: 'medium',
    assigneeId: state.currentUserId,
    dueDate: null,
  })
  const [kpi, setKpi] = useState<KpiInput>({
    name: '',
    department: null,
    unit: 'count',
    direction: 'higher_better',
    target: 0,
  })
  const [member, setMember] = useState<MemberInput>({ fullName: '', email: '', role: 'viewer' })

  if (!open) return null

  const close = () => {
    onClose()
    setTab('task')
  }

  const submitTask = () => {
    if (!task.title.trim()) return
    actions.addTask(task)
    setTask({ ...task, title: '', dueDate: null, department: null })
    close()
  }

  const submitKpi = () => {
    if (!kpi.name.trim()) return
    actions.addKpi(kpi)
    setKpi({ ...kpi, name: '', target: 0 })
    close()
  }

  const submitMember = () => {
    if (!member.fullName.trim() || !member.email.trim()) return
    actions.addMember(member)
    setMember({ fullName: '', email: '', role: 'viewer' })
    close()
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="glass-lg relative w-full max-w-xl scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="font-semibold text-[var(--text-primary)]">Quick Add</span>
          <button onClick={close} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                tab === t.id
                  ? 'bg-[var(--brand-soft)] text-[var(--brand)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]'
                  : 'text-[var(--text-muted)] hover:bg-[rgba(22,26,34,0.05)] hover:text-[var(--text-primary)]'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3">
          {tab === 'task' && (
            <>
              <input
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                placeholder="Task title (e.g. 'Launch TikTok retargeting')"
                className="field"
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={task.department ?? ''}
                  onChange={(e) => setTask({ ...task, department: (e.target.value || null) as Department | null })}
                  className="field"
                >
                  <option value="">Department</option>
                  {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <select
                  value={task.assigneeId ?? ''}
                  onChange={(e) => setTask({ ...task, assigneeId: e.target.value || null })}
                  className="field"
                >
                  <option value="">Assignee</option>
                  {state.profiles.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
                <select
                  value={task.priority}
                  onChange={(e) => setTask({ ...task, priority: e.target.value as TaskInput['priority'] })}
                  className="field"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex items-center justify-end">
                <button
                  onClick={submitTask}
                  disabled={!task.title.trim()}
                  className="btn btn-primary"
                >
                  Add Task
                </button>
              </div>
            </>
          )}

          {tab === 'kpi' && (
            <>
              <input
                value={kpi.name}
                onChange={(e) => setKpi({ ...kpi, name: e.target.value })}
                placeholder="KPI name (e.g. 'Email List Size')"
                className="field"
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={kpi.unit ?? 'count'}
                  onChange={(e) => setKpi({ ...kpi, unit: e.target.value as KpiInput['unit'] })}
                  className="field"
                >
                  <option value="currency">Currency (SAR)</option>
                  <option value="percentage">Percentage</option>
                  <option value="count">Count</option>
                  <option value="ratio">Ratio</option>
                </select>
                <select
                  value={kpi.direction ?? 'higher_better'}
                  onChange={(e) => setKpi({ ...kpi, direction: e.target.value as KpiInput['direction'] })}
                  className="field"
                >
                  <option value="higher_better">Higher is better</option>
                  <option value="lower_better">Lower is better</option>
                  <option value="target">Target value</option>
                </select>
                <input
                  type="number"
                  value={kpi.target || ''}
                  onChange={(e) => setKpi({ ...kpi, target: parseFloat(e.target.value) || 0 })}
                  placeholder="Target"
                  className="field"
                />
              </div>
              <div className="flex items-center justify-end">
                <button
                  onClick={submitKpi}
                  disabled={!kpi.name.trim()}
                  className="btn btn-primary"
                >
                  Add KPI
                </button>
              </div>
            </>
          )}

          {tab === 'member' && (
            <>
              <input
                value={member.fullName}
                onChange={(e) => setMember({ ...member, fullName: e.target.value })}
                placeholder="Full name"
                className="field"
                autoFocus
              />
              <input
                value={member.email}
                onChange={(e) => setMember({ ...member, email: e.target.value })}
                placeholder="Email"
                className="field"
              />
              <select
                value={member.role}
                onChange={(e) => setMember({ ...member, role: e.target.value as Profile['role'] })}
                className="field"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{roleLabel(role)}</option>
                ))}
              </select>
              <div className="flex items-center justify-end">
                <button
                  onClick={submitMember}
                  disabled={!member.fullName.trim() || !member.email.trim()}
                  className="btn btn-primary"
                >
                  Add Member
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}