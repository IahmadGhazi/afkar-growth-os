import { 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react'

const teamMembers = [
  {
    id: '1',
    name: 'Ahmad',
    role: 'Designer',
    department: 'Design',
    avatar: null,
    stats: {
      activeTasks: 2,
      completedToday: 1,
      overdue: 0,
    }
  },
  {
    id: '2',
    name: 'Sara',
    role: 'SEO Specialist',
    department: 'SEO',
    avatar: null,
    stats: {
      activeTasks: 3,
      completedToday: 2,
      overdue: 0,
    }
  },
  {
    id: '3',
    name: 'Mohammed',
    role: 'Product Researcher',
    department: 'Product Research',
    avatar: null,
    stats: {
      activeTasks: 1,
      completedToday: 3,
      overdue: 1,
    }
  },
  {
    id: '4',
    name: 'Ali',
    role: 'Media Buyer',
    department: 'Media',
    avatar: null,
    stats: {
      activeTasks: 2,
      completedToday: 1,
      overdue: 0,
    }
  },
  {
    id: '5',
    name: 'Fatima',
    role: 'Social Media',
    department: 'Social',
    avatar: null,
    stats: {
      activeTasks: 1,
      completedToday: 4,
      overdue: 0,
    }
  },
]

export function Team() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Team Members
        </h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Users size={16} />
          Add Member
        </button>
      </div>

      {/* Team Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teamMembers.map((member) => (
          <div 
            key={member.id}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--brand)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--brand-soft)] flex items-center justify-center">
                <span className="text-sm font-medium text-[var(--brand)]">
                  {member.name.charAt(0)}
                </span>
              </div>
              <div>
                <div className="font-medium text-[var(--text-primary)]">{member.name}</div>
                <div className="text-sm text-[var(--text-muted)]">{member.role}</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <Clock size={14} />
                  Active Tasks
                </div>
                <span className="font-medium text-[var(--text-primary)]">
                  {member.stats.activeTasks}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                  <CheckCircle size={14} />
                  Completed Today
                </div>
                <span className="font-medium text-[var(--positive)]">
                  {member.stats.completedToday}
                </span>
              </div>
              {member.stats.overdue > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-[var(--critical)]">
                    <AlertTriangle size={14} />
                    Overdue
                  </div>
                  <span className="font-medium text-[var(--critical)]">
                    {member.stats.overdue}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <button className="flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
                View Work
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
