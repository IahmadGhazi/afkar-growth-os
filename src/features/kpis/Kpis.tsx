import { useState } from 'react'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { useApp, type KpiInput } from '../../lib/store'
import { kpisForClient, departmentLabel, DEPARTMENT_LABELS } from '../../lib/selectors'
import { SectionTitle, PrimaryButton } from '../../components/shared/ui'
import type { Department, KpiDefinition } from '../../types/database'

const statusColors: Record<string, string> = {
  achieved: 'var(--positive)',
  on_track: 'var(--brand)',
  at_risk: 'var(--warning)',
  behind: 'var(--critical)',
}

const statusLabels: Record<string, string> = {
  achieved: 'Achieved',
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
}

const units: Record<string, string> = {
  currency: 'SAR',
  percentage: '%',
  count: '',
  ratio: 'x',
}

const emptyForm: KpiInput = {
  name: '',
  department: null,
  unit: 'count',
  direction: 'higher_better',
  target: 0,
}

function formatKpi(value: number, unit: KpiDefinition['unit'] | null): string {
  const u = unit ? units[unit] : ''
  const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)
  return `${formatted}${u ? ` ${u}` : ''}`
}

function KpiCard({ kpi }: { kpi: ReturnType<typeof kpisForClient>[number] }) {
  const { actions } = useApp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(kpi.current))

  const save = () => {
    const parsed = parseFloat(value)
    if (isNaN(parsed)) return
    actions.setKpiValue(kpi.id, parsed)
    setEditing(false)
  }

  return (
    <div className="glass-card hover-lift p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--text-muted)]">{departmentLabel(kpi.department)}</span>
        <span
          className="badge"
          style={{
            backgroundColor: `color-mix(in srgb, ${statusColors[kpi.status]} 15%, transparent)`,
            color: statusColors[kpi.status],
          }}
        >
          {statusLabels[kpi.status]}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatKpi(kpi.current, kpi.unit)}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="icon-btn"
            aria-label="Edit KPI value"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
      <div className="text-sm text-[var(--text-muted)] mb-3">
        Target: {formatKpi(kpi.target, kpi.unit)}
      </div>

      {editing && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="field w-28"
            autoFocus
          />
          <button onClick={save} className="icon-btn icon-btn-success">
            <Check size={15} />
          </button>
          <button onClick={() => setEditing(false)} className="icon-btn icon-btn-danger">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="h-2 bg-[var(--track)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${kpi.progress}%`, backgroundColor: statusColors[kpi.status] }}
        />
      </div>
    </div>
  )
}

export function Kpis() {
  const { state, actions } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<KpiInput>(emptyForm)

  const kpis = kpisForClient(state, state.currentClientId)

  const submit = () => {
    if (!form.name.trim()) return
    actions.addKpi(form)
    setForm(emptyForm)
    setShowForm(false)
  }

  const departments = ['management', 'media', 'seo', 'social', 'design', 'product_research']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Key Performance Indicators
          </h2>
          <div className="text-sm text-[var(--text-muted)]">{kpis.length} active KPIs</div>
        </div>
        <PrimaryButton onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Close' : 'Add KPI'}
        </PrimaryButton>
      </div>

      {showForm && (
        <div className="glass-card p-5 space-y-3">
          <SectionTitle>Add KPI</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="KPI name (e.g. Email List Size)"
              className="field md:col-span-2"
            />
            <select
              value={form.department ?? ''}
              onChange={(e) => setForm({ ...form, department: (e.target.value || null) as Department | null })}
              className="field"
            >
              <option value="">Department</option>
              {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={form.unit ?? ''}
              onChange={(e) => setForm({ ...form, unit: e.target.value as KpiDefinition['unit'] })}
              className="field"
            >
              {(['currency', 'percentage', 'count', 'ratio'] as const).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <select
              value={form.direction ?? 'higher_better'}
              onChange={(e) => setForm({ ...form, direction: e.target.value as KpiDefinition['direction'] })}
              className="field"
            >
              <option value="higher_better">Higher is better</option>
              <option value="lower_better">Lower is better</option>
              <option value="target">Target value</option>
            </select>
            <input
              type="number"
              value={form.target || ''}
              onChange={(e) => setForm({ ...form, target: parseFloat(e.target.value) || 0 })}
              placeholder="Target"
              className="field"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={!form.name.trim()}
              className="btn btn-primary"
            >
              Add KPI
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => <KpiCard key={kpi.id} kpi={kpi} />)}
      </div>

      {kpis.length === 0 && (
        <div className="glass-card p-8 text-center text-sm text-[var(--text-muted)]">
          No KPIs configured for this client yet.
        </div>
      )}

      {/* Department Summary */}
      <section>
        <SectionTitle>Department KPIs</SectionTitle>
        <div className="space-y-4">
          {departments.map((dept) => {
            const deptKpis = kpis.filter((k) => (k.department ?? 'management') === dept)
            if (deptKpis.length === 0) return null
            return (
              <div key={dept} className="glass-card p-5">
                <div className="font-semibold text-[var(--text-primary)] mb-3">
                  {departmentLabel(dept)}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {deptKpis.map((kpi) => (
                    <div key={kpi.id}>
                      <div className="text-sm text-[var(--text-muted)]">{kpi.name}</div>
                      <div className="text-lg font-semibold text-[var(--text-primary)]">
                        {formatKpi(kpi.current, kpi.unit)}
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
