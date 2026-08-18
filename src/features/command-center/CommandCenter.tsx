import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Users,
  Target,
  ArrowRight
} from 'lucide-react'

const stats = [
  { name: 'Revenue', value: '125,400 SAR', change: '+12%', trend: 'up' },
  { name: 'Orders', value: '1,247', change: '+8%', trend: 'up' },
  { name: 'ROAS', value: '5.2x', change: '+0.3', trend: 'up' },
  { name: 'AOV', value: '320 SAR', change: '+5%', trend: 'up' },
]

const needsAttention = [
  { type: 'overdue', title: '3 tasks overdue', department: 'Design', priority: 'high' },
  { type: 'blocked', title: 'Campaign creative waiting for approval', department: 'Media', priority: 'critical' },
  { type: 'review', title: '5 tasks awaiting review', department: 'Various', priority: 'medium' },
]

const teamExecution = [
  { department: 'SEO', completed: 8, total: 12, percentage: 67 },
  { department: 'Media', completed: 5, total: 6, percentage: 83 },
  { department: 'Social', completed: 10, total: 10, percentage: 100 },
  { department: 'Design', completed: 4, total: 8, percentage: 50 },
  { department: 'Product Research', completed: 6, total: 7, percentage: 86 },
]

export function CommandCenter() {
  return (
    <div className="space-y-6">
      {/* Business Performance */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
          Business Performance
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div 
              key={stat.name}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
            >
              <div className="text-sm text-[var(--text-muted)]">{stat.name}</div>
              <div className="text-2xl font-semibold text-[var(--text-primary)] mt-1">
                {stat.value}
              </div>
              <div className={`flex items-center gap-1 mt-2 text-sm ${
                stat.trend === 'up' ? 'text-[var(--positive)]' : 'text-[var(--critical)]'
              }`}>
                {stat.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {stat.change}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-6">
        {/* Needs Attention */}
        <section className="col-span-2">
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
            Needs Attention
          </h2>
          <div className="space-y-3">
            {needsAttention.map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
              >
                {item.type === 'overdue' && <AlertTriangle size={18} className="text-[var(--warning)]" />}
                {item.type === 'blocked' && <AlertTriangle size={18} className="text-[var(--critical)]" />}
                {item.type === 'review' && <Clock size={18} className="text-[var(--brand)]" />}
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)]">{item.title}</div>
                  <div className="text-sm text-[var(--text-muted)]">{item.department}</div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  item.priority === 'critical' 
                    ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
                    : item.priority === 'high'
                    ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                    : 'bg-[var(--brand-soft)] text-[var(--brand)]'
                }`}>
                  {item.priority}
                </span>
                <ArrowRight size={16} className="text-[var(--text-muted)]" />
              </div>
            ))}
          </div>
        </section>

        {/* Team Execution */}
        <section>
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
            Team Execution
          </h2>
          <div className="space-y-3">
            {teamExecution.map((dept) => (
              <div 
                key={dept.department}
                className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {dept.department}
                  </span>
                  <span className="text-sm text-[var(--text-muted)]">
                    {dept.completed}/{dept.total}
                  </span>
                </div>
                <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      dept.percentage === 100 
                        ? 'bg-[var(--positive)]' 
                        : dept.percentage >= 70 
                        ? 'bg-[var(--brand)]' 
                        : 'bg-[var(--warning)]'
                    }`}
                    style={{ width: `${dept.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Weekly Objective Progress */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
          Weekly Objective
        </h2>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3 mb-3">
            <Target size={18} className="text-[var(--brand)]" />
            <span className="font-medium text-[var(--text-primary)]">
              Increase wall-art revenue
            </span>
            <span className="ml-auto text-sm text-[var(--text-muted)]">65% complete</span>
          </div>
          <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--brand)] rounded-full" style={{ width: '65%' }} />
          </div>
        </div>
      </section>
    </div>
  )
}
