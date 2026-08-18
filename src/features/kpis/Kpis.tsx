import { Plus } from 'lucide-react'

const kpis = [
  {
    name: 'ROAS',
    department: 'Media',
    current: 5.2,
    target: 5,
    unit: 'x',
    direction: 'higher_better',
    status: 'achieved',
  },
  {
    name: 'Revenue',
    department: 'Business',
    current: 125400,
    target: 150000,
    unit: 'SAR',
    direction: 'higher_better',
    status: 'on_track',
  },
  {
    name: 'Orders',
    department: 'Business',
    current: 1247,
    target: 1500,
    unit: '',
    direction: 'higher_better',
    status: 'on_track',
  },
  {
    name: 'CAC',
    department: 'Media',
    current: 45,
    target: 50,
    unit: 'SAR',
    direction: 'lower_better',
    status: 'achieved',
  },
  {
    name: 'AOV',
    department: 'Business',
    current: 320,
    target: 350,
    unit: 'SAR',
    direction: 'higher_better',
    status: 'at_risk',
  },
  {
    name: 'Conversion Rate',
    department: 'Business',
    current: 2.8,
    target: 3.5,
    unit: '%',
    direction: 'higher_better',
    status: 'behind',
  },
  {
    name: 'Organic Sessions',
    department: 'SEO',
    current: 4500,
    target: 5000,
    unit: '',
    direction: 'higher_better',
    status: 'on_track',
  },
  {
    name: 'Content Output',
    department: 'Social',
    current: 15,
    target: 15,
    unit: 'pieces',
    direction: 'higher_better',
    status: 'achieved',
  },
]

const statusColors = {
  achieved: 'var(--positive)',
  on_track: 'var(--brand)',
  at_risk: 'var(--warning)',
  behind: 'var(--critical)',
}

const statusLabels = {
  achieved: 'Achieved',
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
}

export function Kpis() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Key Performance Indicators
        </h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} />
          Add KPI
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => {
          const progress = kpi.direction === 'higher_better'
            ? Math.min(100, (kpi.current / kpi.target) * 100)
            : Math.min(100, (kpi.target / kpi.current) * 100)

          return (
            <div 
              key={index}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-muted)]">{kpi.department}</span>
                <span 
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ 
                    backgroundColor: `color-mix(in srgb, ${statusColors[kpi.status as keyof typeof statusColors]} 15%, transparent)`,
                    color: statusColors[kpi.status as keyof typeof statusColors]
                  }}
                >
                  {statusLabels[kpi.status as keyof typeof statusLabels]}
                </span>
              </div>

              <div className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                {kpi.current.toLocaleString()}{kpi.unit && ` ${kpi.unit}`}
              </div>

              <div className="text-sm text-[var(--text-muted)] mb-3">
                Target: {kpi.target.toLocaleString()}{kpi.unit && ` ${kpi.unit}`}
              </div>

              <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${progress}%`,
                    backgroundColor: statusColors[kpi.status as keyof typeof statusColors]
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Department Summary */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
          Department KPIs
        </h2>
        <div className="space-y-4">
          {['Media', 'SEO', 'Social', 'Business'].map((dept) => {
            const deptKpis = kpis.filter(k => k.department === dept)
            return (
              <div 
                key={dept}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
              >
                <div className="font-medium text-[var(--text-primary)] mb-3">{dept}</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {deptKpis.map((kpi, index) => (
                    <div key={index}>
                      <div className="text-sm text-[var(--text-muted)]">{kpi.name}</div>
                      <div className="text-lg font-semibold text-[var(--text-primary)]">
                        {kpi.current.toLocaleString()}{kpi.unit && ` ${kpi.unit}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
