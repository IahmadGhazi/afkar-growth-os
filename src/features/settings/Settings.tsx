import { 
  Building2, 
  Users, 
  Key, 
  Bell,
  Palette,
  Database
} from 'lucide-react'

const settingsSections = [
  {
    id: 'organization',
    name: 'Organization',
    icon: Building2,
    description: 'Manage your organization settings',
    items: [
      { name: 'Organization Name', value: 'AFKAR Growth' },
      { name: 'Industry', value: 'E-commerce' },
      { name: 'Timezone', value: 'Asia/Riyadh' },
    ]
  },
  {
    id: 'team',
    name: 'Team & Roles',
    icon: Users,
    description: 'Manage team members and permissions',
    items: [
      { name: 'Team Members', value: '5' },
      { name: 'Roles', value: '9 defined' },
      { name: 'Pending Invites', value: '0' },
    ]
  },
  {
    id: 'integrations',
    name: 'Integrations',
    icon: Database,
    description: 'Connect external services',
    items: [
      { name: 'Supabase', value: 'Connected' },
      { name: 'Meta Ads', value: 'Not connected' },
      { name: 'Google Analytics', value: 'Not connected' },
    ]
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: Bell,
    description: 'Configure notification preferences',
    items: [
      { name: 'Email Notifications', value: 'Enabled' },
      { name: 'Task Assignments', value: 'Enabled' },
      { name: 'Overdue Alerts', value: 'Enabled' },
    ]
  },
]

export function Settings() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Settings
      </h2>

      <div className="space-y-4">
        {settingsSections.map((section) => (
          <div 
            key={section.id}
            className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]"
          >
            <div className="flex items-center gap-3 mb-4">
              <section.icon size={20} className="text-[var(--brand)]" />
              <div>
                <div className="font-medium text-[var(--text-primary)]">{section.name}</div>
                <div className="text-sm text-[var(--text-muted)]">{section.description}</div>
              </div>
            </div>

            <div className="space-y-3">
              {section.items.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
                >
                  <span className="text-sm text-[var(--text-secondary)]">{item.name}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
