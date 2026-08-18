import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ChevronRight,
  Plus
} from 'lucide-react'

const weeklyObjective = {
  title: 'Increase wall-art revenue',
  description: 'Focus on scaling winning wall-art products and testing new creatives',
  progress: 65,
  keyResults: [
    { title: 'ROAS > 5', current: 5.2, target: 5, status: 'achieved' as const },
    { title: '5 new creatives tested', current: 3, target: 5, status: 'on_track' as const },
    { title: '10 products shortlisted', current: 8, target: 10, status: 'on_track' as const },
    { title: '8 SEO actions completed', current: 6, target: 8, status: 'at_risk' as const },
  ],
}

const departmentObjectives = [
  {
    department: 'SEO',
    objective: 'Find high-intent wall-art keywords',
    progress: 75,
    tasks: [
      { title: 'Keyword research', status: 'done' },
      { title: 'Competitor analysis', status: 'done' },
      { title: 'Content optimization', status: 'in_progress' },
      { title: 'Technical audit', status: 'planned' },
    ]
  },
  {
    department: 'Product Research',
    objective: 'Identify and validate top products',
    progress: 80,
    tasks: [
      { title: 'Research 40 products', status: 'done' },
      { title: 'Score and shortlist', status: 'done' },
      { title: 'Manager review', status: 'in_progress' },
      { title: 'Approve top 3', status: 'planned' },
    ]
  },
  {
    department: 'Design',
    objective: 'Create high-converting creatives',
    progress: 50,
    tasks: [
      { title: 'Create 3 wall-art creatives', status: 'in_progress' },
      { title: 'Design product images', status: 'planned' },
      { title: 'Create story templates', status: 'planned' },
    ]
  },
  {
    department: 'Social',
    objective: 'Increase organic engagement',
    progress: 100,
    tasks: [
      { title: 'Create 3 reels', status: 'done' },
      { title: 'Create 5 stories', status: 'done' },
      { title: 'Schedule posts', status: 'done' },
    ]
  },
  {
    department: 'Media',
    objective: 'Test and optimize campaigns',
    progress: 60,
    tasks: [
      { title: 'Launch test campaign', status: 'done' },
      { title: 'Monitor performance', status: 'in_progress' },
      { title: 'Scale winners', status: 'planned' },
    ]
  },
]

export function WeeklyPlan() {
  return (
    <div className="space-y-6">
      {/* Weekly Objective */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Target size={20} className="text-[var(--brand)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Weekly Objective
            </h2>
          </div>
          <span className="text-sm text-[var(--text-muted)]">Jan 15 - Jan 21, 2024</span>
        </div>

        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                {weeklyObjective.title}
              </h3>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {weeklyObjective.description}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[var(--brand)]">
                {weeklyObjective.progress}%
              </div>
              <div className="text-sm text-[var(--text-muted)]">complete</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 bg-[var(--border)] rounded-full overflow-hidden mb-6">
            <div 
              className="h-full bg-[var(--brand)] rounded-full transition-all"
              style={{ width: `${weeklyObjective.progress}%` }}
            />
          </div>

          {/* Key Results */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Key Results
            </h4>
            {weeklyObjective.keyResults.map((kr, index) => (
              <div 
                key={index}
                className="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
              >
                <div className="flex-1">
                  <div className="font-medium text-[var(--text-primary)]">{kr.title}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-muted)]">
                    {kr.current} / {kr.target}
                  </span>
                  {kr.status === 'achieved' && <TrendingUp size={16} className="text-[var(--positive)]" />}
                  {kr.status === 'on_track' && <Minus size={16} className="text-[var(--brand)]" />}
                  {kr.status === 'at_risk' && <TrendingDown size={16} className="text-[var(--warning)]" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Department Objectives */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide">
            Department Objectives
          </h2>
          <button className="flex items-center gap-1 text-sm text-[var(--brand)] hover:underline">
            <Plus size={14} />
            Add Department
          </button>
        </div>

        <div className="space-y-4">
          {departmentObjectives.map((dept) => (
            <div 
              key={dept.department}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{dept.department}</div>
                  <div className="text-sm text-[var(--text-muted)]">{dept.objective}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-[var(--text-primary)]">
                    {dept.progress}%
                  </div>
                </div>
              </div>

              <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden mb-3">
                <div 
                  className={`h-full rounded-full transition-all ${
                    dept.progress === 100 
                      ? 'bg-[var(--positive)]' 
                      : dept.progress >= 70 
                      ? 'bg-[var(--brand)]' 
                      : 'bg-[var(--warning)]'
                  }`}
                  style={{ width: `${dept.progress}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {dept.tasks.map((task, index) => (
                  <div 
                    key={index}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                      task.status === 'done' 
                        ? 'bg-[var(--positive-soft)] text-[var(--positive)] line-through'
                        : task.status === 'in_progress'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                        : 'bg-[var(--border)] text-[var(--text-muted)]'
                    }`}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
