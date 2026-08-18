import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Calendar,
  Play,
  Flag,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  currentUser,
  isTaskOverdue,
  isTaskDueToday,
  isTaskThisWeek,
  tasksForUser,
  departmentLabel,
  DONE_STATUSES,
  activeObjective,
} from '../../lib/selectors'
import { EmptyState, PriorityBadge } from '../../components/shared/ui'
import { formatShort } from '../../lib/date'

function TaskRow({
  title,
  department,
  priority,
  status,
  dueDate,
  onAction,
  actionLabel,
  actionIcon,
  dimmed,
}: {
  title: string
  department: string
  priority: import('../../types/database').TaskPriority
  status: string
  dueDate?: string
  onAction?: () => void
  actionLabel?: string
  actionIcon?: React.ReactNode
  dimmed?: boolean
}) {
  return (
    <div
      className={`glass-card flex items-center gap-4 p-4 ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex-1">
        <div className="font-medium text-[var(--text-primary)]">{title}</div>
        <div className="text-sm text-[var(--text-muted)]">
          {department}
          {dueDate && ` • Due ${formatShort(dueDate)}`}
          {status === 'blocked' && <span className="text-[var(--critical)]"> • blocked</span>}
        </div>
      </div>
      <PriorityBadge priority={priority} />
      {onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary text-xs px-3 py-2"
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function MyWork() {
  const { state, actions } = useApp()
  const [doneFilter, setDoneFilter] = useState(false)
  const user = currentUser(state)
  const tasks = tasksForUser(state, user?.id ?? null)
  const objective = activeObjective(state, state.currentClientId)
  const weekStart = objective?.week_start ?? ''
  const weekEnd = objective?.week_end ?? ''

  const todayTasks = tasks.filter(isTaskDueToday)
  const overdueTasks = tasks.filter(isTaskOverdue)
  const thisWeekTasks = tasks.filter((task) => isTaskThisWeek(task, weekStart, weekEnd))
  const doneTasks = tasks.filter((task) => DONE_STATUSES.includes(task.status))
  const visibleDone = doneFilter ? doneTasks : doneTasks.slice(0, 3)

  const start = (id: string) => actions.moveTask(id, 'in_progress')
  const toReview = (id: string) => actions.moveTask(id, 'review')
  const complete = (id: string) => actions.moveTask(id, 'done')

  return (
    <div className="space-y-6">
      {/* Today */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-[var(--brand)]" />
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-[0.08em]">
            Today
          </h2>
        </div>
        <div className="space-y-3">
          {todayTasks.length === 0 ? (
            <EmptyState title="Nothing due today" hint="Enjoy the clear calendar." />
          ) : todayTasks.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              department={departmentLabel(task.department)}
              priority={task.priority}
              status={task.status}
              dueDate={task.due_date ?? undefined}
              onAction={
                task.status === 'in_progress'
                  ? () => toReview(task.id)
                  : task.status === 'review'
                  ? () => complete(task.id)
                  : () => start(task.id)
              }
              actionIcon={task.status === 'in_progress' ? <CheckCircle size={14} /> : <Play size={14} />}
              actionLabel={task.status === 'in_progress' ? 'Send to review' : task.status === 'review' ? 'Approve' : 'Start'}
            />
          ))}
        </div>
      </section>

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-[var(--critical)]" />
            <h2 className="text-sm font-medium text-[var(--critical)] uppercase tracking-[0.08em]">
              Overdue
            </h2>
          </div>
          <div className="space-y-3">
            {overdueTasks.map((task) => (
              <TaskRow
                key={task.id}
                title={task.title}
                department={departmentLabel(task.department)}
                priority={task.priority}
                status={task.status}
                dueDate={task.due_date ?? undefined}
                onAction={task.status === 'blocked' ? undefined : () => start(task.id)}
                actionLabel="Start now"
                actionIcon={<Play size={14} />}
              />
            ))}
          </div>
        </section>
      )}

      {/* This Week */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-[0.08em] mb-4">
          This Week
        </h2>
        <div className="space-y-3">
          {thisWeekTasks.length === 0 ? (
            <EmptyState title="Nothing scheduled this week" />
          ) : thisWeekTasks.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              department={departmentLabel(task.department)}
              priority={task.priority}
              status={task.status}
              dueDate={task.due_date ?? undefined}
              onAction={() => start(task.id)}
              actionLabel="Start"
              actionIcon={<Play size={14} />}
            />
          ))}
        </div>
      </section>

      {/* Completed */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-[0.08em]">
            Completed
          </h2>
          {doneTasks.length > 3 && (
            <button
              onClick={() => setDoneFilter(!doneFilter)}
              className="flex items-center gap-1 text-sm text-[var(--brand)] hover:underline"
            >
              <Flag size={14} />
              {doneFilter ? 'Show fewer' : `Show all (${doneTasks.length})`}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {visibleDone.length === 0 ? (
            <EmptyState title="Nothing completed yet" hint="Completed tasks will appear here." />
          ) : visibleDone.map((task) => (
            <TaskRow
              key={task.id}
              title={task.title}
              department={departmentLabel(task.department)}
              priority={task.priority}
              status={task.status}
              dueDate={task.completed_at?.slice(0, 10)}
              dimmed
            />
          ))}
        </div>
      </section>
    </div>
  )
}
