import { 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight,
  Calendar
} from 'lucide-react'

const todayTasks = [
  { id: '1', title: 'Create 3 creatives for wall-art campaign', department: 'Design', priority: 'high', status: 'in_progress' },
  { id: '2', title: 'Review SEO keyword opportunities', department: 'SEO', priority: 'medium', status: 'planned' },
]

const overdueTasks = [
  { id: '3', title: 'Finalize product research shortlist', department: 'Product Research', priority: 'critical', status: 'blocked', dueDate: '2024-01-15' },
]

const thisWeekTasks = [
  { id: '4', title: 'Launch Meta campaign for new products', department: 'Media', priority: 'high', status: 'planned' },
  { id: '5', title: 'Create 5 Instagram reels', department: 'Social', priority: 'medium', status: 'planned' },
  { id: '6', title: 'Optimize product pages for SEO', department: 'SEO', priority: 'medium', status: 'planned' },
  { id: '7', title: 'Test 3 winning creatives', department: 'Media', priority: 'high', status: 'planned' },
]

const completedTasks = [
  { id: '8', title: 'Research 40 wall-art products', department: 'Product Research', completedAt: '2024-01-14' },
  { id: '9', title: 'Create mood board for new campaign', department: 'Design', completedAt: '2024-01-13' },
]

export function MyWork() {
  return (
    <div className="space-y-6">
      {/* Today */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-[var(--brand)]" />
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Today
          </h2>
        </div>
        <div className="space-y-3">
          {todayTasks.map((task) => (
            <div 
              key={task.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
            >
              <div className={`w-2 h-2 rounded-full ${
                task.status === 'in_progress' ? 'bg-[var(--brand)]' : 'bg-[var(--text-muted)]'
              }`} />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-primary)]">{task.title}</div>
                <div className="text-sm text-[var(--text-muted)]">{task.department}</div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                task.priority === 'critical' 
                  ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
                  : task.priority === 'high'
                  ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                  : 'bg-[var(--brand-soft)] text-[var(--brand)]'
              }`}>
                {task.priority}
              </span>
              <ArrowRight size={16} className="text-[var(--text-muted)]" />
            </div>
          ))}
        </div>
      </section>

      {/* Overdue */}
      {overdueTasks.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-[var(--critical)]" />
            <h2 className="text-sm font-medium text-[var(--critical)] uppercase tracking-wide">
              Overdue
            </h2>
          </div>
          <div className="space-y-3">
            {overdueTasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--critical)] bg-[var(--critical-soft)]"
              >
                <div className="w-2 h-2 rounded-full bg-[var(--critical)]" />
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)]">{task.title}</div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {task.department} • Due {task.dueDate}
                  </div>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--critical-soft)] text-[var(--critical)]">
                  {task.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* This Week */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
          This Week
        </h2>
        <div className="space-y-3">
          {thisWeekTasks.map((task) => (
            <div 
              key={task.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
            >
              <div className="w-2 h-2 rounded-full bg-[var(--text-muted)]" />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-primary)]">{task.title}</div>
                <div className="text-sm text-[var(--text-muted)]">{task.department}</div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                task.priority === 'critical' 
                  ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
                  : task.priority === 'high'
                  ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                  : 'bg-[var(--brand-soft)] text-[var(--brand)]'
              }`}>
                {task.priority}
              </span>
              <ArrowRight size={16} className="text-[var(--text-muted)]" />
            </div>
          ))}
        </div>
      </section>

      {/* Completed */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
          Completed
        </h2>
        <div className="space-y-3">
          {completedTasks.map((task) => (
            <div 
              key={task.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] opacity-60"
            >
              <CheckCircle size={18} className="text-[var(--positive)]" />
              <div className="flex-1">
                <div className="font-medium text-[var(--text-primary)] line-through">{task.title}</div>
                <div className="text-sm text-[var(--text-muted)]">
                  {task.department} • Completed {task.completedAt}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
