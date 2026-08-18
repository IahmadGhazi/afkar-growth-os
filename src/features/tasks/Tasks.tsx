import { useState } from 'react'
import { 
  Plus, 
  Filter, 
  Search,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'review' | 'approved' | 'done' | 'blocked'

interface Task {
  id: string
  title: string
  department: string
  assignee: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: TaskStatus
  dueDate: string | null
}

const mockTasks: Task[] = [
  { id: '1', title: 'Create 3 creatives for wall-art campaign', department: 'Design', assignee: 'Ahmad', priority: 'high', status: 'in_progress', dueDate: '2024-01-20' },
  { id: '2', title: 'Review SEO keyword opportunities', department: 'SEO', assignee: 'Sara', priority: 'medium', status: 'planned', dueDate: '2024-01-21' },
  { id: '3', title: 'Finalize product research shortlist', department: 'Product Research', assignee: 'Mohammed', priority: 'critical', status: 'blocked', dueDate: '2024-01-18' },
  { id: '4', title: 'Launch Meta campaign for new products', department: 'Media', assignee: 'Ali', priority: 'high', status: 'planned', dueDate: '2024-01-22' },
  { id: '5', title: 'Create 5 Instagram reels', department: 'Social', assignee: 'Fatima', priority: 'medium', status: 'planned', dueDate: '2024-01-23' },
  { id: '6', title: 'Optimize product pages for SEO', department: 'SEO', assignee: 'Sara', priority: 'medium', status: 'in_progress', dueDate: '2024-01-24' },
  { id: '7', title: 'Test 3 winning creatives', department: 'Media', assignee: 'Ali', priority: 'high', status: 'planned', dueDate: '2024-01-25' },
  { id: '8', title: 'Research 40 wall-art products', department: 'Product Research', assignee: 'Mohammed', priority: 'medium', status: 'done', dueDate: '2024-01-15' },
]

const statusColumns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'var(--text-muted)' },
  { status: 'planned', label: 'Planned', color: 'var(--brand)' },
  { status: 'in_progress', label: 'In Progress', color: 'var(--warning)' },
  { status: 'review', label: 'Review', color: 'var(--brand)' },
  { status: 'approved', label: 'Approved', color: 'var(--positive)' },
  { status: 'done', label: 'Done', color: 'var(--positive)' },
  { status: 'blocked', label: 'Blocked', color: 'var(--critical)' },
]

export function Tasks() {
  const [filter, setFilter] = useState<string>('all')

  const filteredTasks = filter === 'all' 
    ? mockTasks 
    : mockTasks.filter(t => t.department === filter)

  const departments = [...new Set(mockTasks.map(t => t.department))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg">
            <Search size={14} className="text-[var(--text-muted)]" />
            <input 
              type="text" 
              placeholder="Search tasks..."
              className="bg-transparent border-none outline-none text-sm w-48"
            />
          </div>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} />
          New Task
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statusColumns.map((column) => {
          const columnTasks = filteredTasks.filter(t => t.status === column.status)
          return (
            <div 
              key={column.status}
              className="flex-shrink-0 w-72"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color }} />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {column.label}
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto">
                  {columnTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {columnTasks.map((task) => (
                  <div 
                    key={task.id}
                    className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] cursor-pointer hover:border-[var(--brand)] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        task.priority === 'critical' 
                          ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
                          : task.priority === 'high'
                          ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                          : 'bg-[var(--brand-soft)] text-[var(--brand)]'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="font-medium text-sm text-[var(--text-primary)] mb-2">
                      {task.title}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>{task.department}</span>
                      <span>{task.assignee}</span>
                    </div>
                    {task.dueDate && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-[var(--text-muted)]">
                        <Clock size={12} />
                        {task.dueDate}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
