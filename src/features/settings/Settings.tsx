import { useState } from 'react'
import {
  Building2,
  Users,
  Bell,
  Database,
  RotateCcw,
  Check,
  Pencil,
  X,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { currentClient, getConnection } from '../../lib/selectors'
import { SOURCES } from '../../lib/integrations'
import { PrimaryButton } from '../../components/shared/ui'

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors duration-150 ${
        checked ? 'bg-[var(--positive)]' : 'bg-[rgba(22,26,34,0.18)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-150 ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

export function Settings() {
  const { state, actions } = useApp()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(state.organization.name)
  const [resetConfirm, setResetConfirm] = useState(false)

  const client = currentClient(state)

  const saveName = () => {
    if (!name.trim()) return
    actions.updateOrganization({ name: name.trim() })
    setEditingName(false)
  }

  const teams = state.profiles.filter((p) => p.is_active)
  const roles = new Set(teams.map((p) => p.role)).size
  const prefs = state.organization.settings
  const setPref = (key: string, value: boolean) => {
    actions.updateOrganization({ settings: { ...prefs, [key]: value } })
  }
  const integrationSources = SOURCES.filter((source) => source.id !== 'manual')
  const connectedCount = state.connections.filter((connection) => connection.connected).length

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Settings
      </h2>

      <div className="space-y-4">
        {/* Organization */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 size={20} className="text-[var(--brand)]" />
            <div>
              <div className="font-medium text-[var(--text-primary)]">Organization</div>
              <div className="text-sm text-[var(--text-muted)]">Manage your organization settings</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Organization Name</span>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field w-56"
                    autoFocus
                  />
                  <button onClick={saveName} className="icon-btn icon-btn-success">
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setName(state.organization.name) }}
                    className="icon-btn icon-btn-danger"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {state.organization.name}
                  </span>
                  <button onClick={() => setEditingName(true)} className="icon-btn" aria-label="Rename organization">
                    <Pencil size={13} />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Current Client</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {client?.name ?? 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Timezone</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">Asia/Riyadh</span>
            </div>
          </div>
        </div>

        {/* Team & Roles */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users size={20} className="text-[var(--brand)]" />
            <div>
              <div className="font-medium text-[var(--text-primary)]">Team & Roles</div>
              <div className="text-sm text-[var(--text-muted)]">Manage team members and permissions</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Team Members</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{teams.length}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Roles in Use</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{roles}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Pending Invites</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">0</span>
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database size={20} className="text-[var(--brand)]" />
            <div>
              <div className="font-medium text-[var(--text-primary)]">Integrations</div>
              <div className="text-sm text-[var(--text-muted)]">Connect external services</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Data Store</span>
              <span className="badge bg-[var(--brand-soft)] text-[var(--brand)]">
                Local (browser)
              </span>
            </div>
            {integrationSources.map((source) => {
              const connection = getConnection(state, source.id)
              return (
                <div key={source.id} className="flex items-center justify-between py-2 border-b border-[var(--hairline)] last:border-b-0">
                  <span className="text-sm text-[var(--text-secondary)]">{source.name}</span>
                  {connection?.connected ? (
                    <span className="badge bg-[var(--positive-soft)] text-[var(--positive)]">
                      Connected
                    </span>
                  ) : (
                    <span className="text-sm text-[var(--text-muted)]">Not connected</span>
                  )}
                </div>
              )
            })}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Sources active</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {connectedCount}/{integrationSources.length}
              </span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={20} className="text-[var(--brand)]" />
            <div>
              <div className="font-medium text-[var(--text-primary)]">Notifications</div>
              <div className="text-sm text-[var(--text-muted)]">
                Choose which alerts appear in the bell. In-app only for now — email delivery arrives with the backend.
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Task Assignments</span>
              <Toggle
                label="Task Assignments"
                checked={prefs.notify_task_assignments !== false}
                onChange={(checked) => setPref('notify_task_assignments', checked)}
              />
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--hairline)]">
              <span className="text-sm text-[var(--text-secondary)]">Review Requests</span>
              <Toggle
                label="Review Requests"
                checked={prefs.notify_review !== false}
                onChange={(checked) => setPref('notify_review', checked)}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Overdue Alerts</span>
              <Toggle
                label="Overdue Alerts"
                checked={prefs.notify_overdue !== false}
                onChange={(checked) => setPref('notify_overdue', checked)}
              />
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <RotateCcw size={20} className="text-[var(--critical)]" />
            <div>
              <div className="font-medium text-[var(--text-primary)]">Local Data</div>
              <div className="text-sm text-[var(--text-muted)]">
                All data lives in this browser. Reset removes it and restores the Afkar baseline data.
              </div>
            </div>
          </div>
          {resetConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--text-secondary)]">Reset all local data?</span>
              <button
                onClick={() => { actions.resetAll(); setResetConfirm(false) }}
                className="btn btn-danger"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <PrimaryButton onClick={() => setResetConfirm(true)}>
              <RotateCcw size={16} />
              Reset Local Data
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  )
}
