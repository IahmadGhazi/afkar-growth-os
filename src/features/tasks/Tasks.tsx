import { useState } from 'react'
import {
  Plus,
  Search,
  Clock,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Trash2,
  X,
  Pencil,
} from 'lucide-react'
import { useApp, type TaskInput } from '../../lib/store'
import {
  tasksForClient,
  departmentLabel,
  DEPARTMENT_LABELS,
  nameById,
} from '../../lib/selectors'
import { PriorityBadge } from '../../components/shared/ui'
import type { Department, Task, TaskPriority, TaskStatus } from '../../types/database'
import { formatShort } from '../../lib/date'

const statusColumns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'var(--text-muted)' },
  { status: 'planned', label: 'Planned', color: 'var(--brand)' },
  { status: 'in_progress', label: 'In Progress', color: 'var(--warning)' },
  { status: 'review', label: 'Review', color: 'var(--brand)' },
  { status: 'approved', label: 'Approved', color: 'var(--positive)' },
  { status: 'done', label: 'Done', color: 'var(--positive)' },
  { status: 'blocked', label: 'Blocked', color: 'var(--critical)' },
]

const FLOW: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'review', 'approved', 'done']

function nextStatus(status: TaskStatus): TaskStatus | null {
  const index = FLOW.indexOf(status)
  if (index === -1 || index === FLOW.length - 1) return null
  return FLOW[index + 1]
}

function prevStatus(status: TaskStatus): TaskStatus | null {
  const index = FLOW.indexOf(status)
  if (index <= 0) return null
  return FLOW[index - 1]
}

const emptyForm: TaskInput = {
  title: '',
  department: null,
  priority: 'medium',
  assigneeId: null,
  dueDate: null,
}

export function Tasks() {
  const { state, actions } = useApp()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TaskInput>(emptyForm)
  const [editing, setEditing] = useState<Task | null>(null)

  const clientId = state.currentClientId
  const tasks = tasksForClient(state, clientId)
  const team = state.profiles.filter((profile) => profile.is_active)

  const filteredTasks = tasks.filter((task) => {
    if (filter !== 'all' && task.department !== filter) return false
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const submit = () => {
    if (!form.title.trim()) return
    actions.addTask(form)
    setForm(emptyForm)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="glass-inset flex items-center gap-2 px-3 py-2">
            <Search size={14} className="text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent border-none outline-none text-sm w-48"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="field w-auto"
          >
            <option value="all">All Departments</option>
            {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={showForm ? 'btn btn-outline' : 'btn btn-primary'}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Close' : 'New Task'}
        </button>
      </div>

      {/* New Task Form */}
      {showForm && (
        <div className="glass-card p-5 space-y-3 page-enter">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-[var(--text-primary)]">New Task</div>
          </div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Task title (e.g. Create 3 creatives for wall-art campaign)"
            className="field"
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={form.department ?? ''}
              onChange={(e) => setForm({ ...form, department: (e.target.value || null) as Department | null })}
              className="field"
            >
              <option value="">Department</option>
              {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              className="field"
            >
              {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={form.assigneeId ?? ''}
              onChange={(e) => setForm({ ...form, assigneeId: e.target.value || null })}
              className="field"
            >
              <option value="">Assignee</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.full_name}</option>
              ))}
            </select>
            <input
              type="date"
              value={form.dueDate ?? ''}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })}
              className="field"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={!form.title.trim()}
              className="btn btn-primary"
            >
              Create Task
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
        {statusColumns.map((column) => {
          const columnTasks = filteredTasks.filter((t) => t.status === column.status)
          return (
            <div key={column.status} className="flex-shrink-0 w-72 snap-start">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {column.label}
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {columnTasks.length}
                </span>
              </div>
              <div className="glass-inset rounded-2xl p-3 space-y-3 min-h-[160px]">
                {columnTasks.length === 0 && (
                  <div className="p-3 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] text-center">
                    Drop nothing here yet
                  </div>
                )}
                {columnTasks.map((task) => {
                  const next = nextStatus(task.status)
                  const prev = prevStatus(task.status)
                  return (
                    <div
                      key={task.id}
                      className={`glass-sm p-3 ${task.status === 'blocked' ? 'glass-danger' : 'glass-hover-brand'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <PriorityBadge priority={task.priority} />
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditing(task)}
                            title="Edit"
                            aria-label="Edit task"
                            className="icon-btn"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => actions.deleteTask(task.id)}
                            title="Delete"
                            aria-label="Delete task"
                            className="icon-btn icon-btn-danger"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="font-medium text-sm text-[var(--text-primary)] mb-2">
                        {task.title}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <span>{departmentLabel(task.department)}</span>
                        <span>{nameById(state, task.assignee_id)}</span>
                      </div>
                      {task.due_date && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-[var(--text-muted)]">
                          <Clock size={12} />
                          {formatShort(task.due_date)}
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[var(--hairline)]">
                        <button
                          onClick={prev ? () => actions.moveTask(task.id, prev) : undefined}
                          disabled={!prev}
                          className="icon-btn disabled:opacity-30"
                          title="Move back"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        {task.status === 'blocked'
                          ? (
                            <button
                              onClick={() => actions.moveTask(task.id, 'planned')}
                              className="btn btn-danger text-xs flex-1 py-1.5"
                            >
                              <LockOpen size={12} />
                              Unblock
                            </button>
                          )
                          : (
                            <>
                              <button
                                onClick={() => actions.moveTask(task.id, 'blocked')}
                                className="icon-btn icon-btn-danger"
                                title="Block task"
                              >
                                <Lock size={14} />
                              </button>
                              <button
                                onClick={next ? () => actions.moveTask(task.id, next) : undefined}
                                disabled={!next}
                                className="btn flex-1 py-1.5 text-xs font-semibold bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white disabled:opacity-40"
                                title="Advance"
                              >
                                {next ? `Move to ${statusColumns.find((c) => c.status === next)?.label}` : 'Final'}
                              </button>
                            </>
                          )}
                        <button
                          onClick={next ? () => actions.moveTask(task.id, next) : undefined}
                          disabled={!next}
                          className="icon-btn disabled:opacity-30"
                          title="Move forward"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Task Modal */}
      {editing && (
        <TaskEditModal task={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

function TaskEditModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, actions } = useApp()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [department, setDepartment] = useState<Department | null>(task.department)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assignee_id)
  const [reviewerId, setReviewerId] = useState<string | null>(task.reviewer_id)
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? '')
  const [blockedReason, setBlockedReason] = useState(task.blocked_reason ?? '')

  const team = state.profiles.filter((profile) => profile.is_active)

  const save = () => {
    actions.updateTask(task.id, {
      title: title.trim() || task.title,
      description: description.trim() || null,
      department,
      priority,
      assignee_id: assigneeId,
      reviewer_id: reviewerId,
      due_date: dueDate || null,
      blocked_reason: blockedReason.trim() || null,
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-lg relative w-full max-w-md p-5 space-y-3 scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-primary)]">Edit Task</span>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Description"
          className="field"
        />

        <div className="grid grid-cols-2 gap-2">
          <select value={department ?? ''} onChange={(e) => setDepartment((e.target.value || null) as Department | null)} className="field">
            <option value="">Department</option>
            {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="field">
            {(['critical', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select value={assigneeId ?? ''} onChange={(e) => setAssigneeId(e.target.value || null)} className="field">
            <option value="">Assignee</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name}</option>
            ))}
          </select>
          <select value={reviewerId ?? ''} onChange={(e) => setReviewerId(e.target.value || null)} className="field">
            <option value="">Reviewer</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name}</option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="field"
          />
        </div>

        {task.status === 'blocked' && (
          <input
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            placeholder="Blocked reason"
            className="field"
          />
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!title.trim()}
            className="btn btn-primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}