import { 
  Building2, 
  TrendingUp, 
  Users,
  ArrowRight
} from 'lucide-react'

const clients = [
  {
    id: '1',
    name: 'Afkar Modern',
    domain: 'afkar-modern.com',
    status: 'active',
    stats: {
      revenue: '125,400 SAR',
      roas: '5.2x',
      teamSize: 5,
      activeTasks: 12,
    }
  },
  {
    id: '2',
    name: 'Future Client',
    domain: 'future-client.com',
    status: 'active',
    stats: {
      revenue: '45,000 SAR',
      roas: '3.8x',
      teamSize: 3,
      activeTasks: 8,
    }
  },
]

export function Clients() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Clients
        </h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Building2 size={16} />
          Add Client
        </button>
      </div>

      {/* Client List */}
      <div className="space-y-4">
        {clients.map((client) => (
          <div 
            key={client.id}
            className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--brand)] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
                  <Building2 size={24} className="text-[var(--brand)]" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-[var(--text-primary)]">
                    {client.name}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">{client.domain}</div>
                </div>
              </div>
              <ArrowRight size={20} className="text-[var(--text-muted)]" />
            </div>

            <div className="grid grid-cols-4 gap-4 mt-6">
              <div>
                <div className="text-sm text-[var(--text-muted)]">Revenue</div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  {client.stats.revenue}
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-muted)]">ROAS</div>
                <div className="text-lg font-semibold text-[var(--positive)]">
                  {client.stats.roas}
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-muted)]">Team</div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  {client.stats.teamSize}
                </div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-muted)]">Active Tasks</div>
                <div className="text-lg font-semibold text-[var(--brand)]">
                  {client.stats.activeTasks}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
