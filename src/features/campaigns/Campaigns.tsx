import { useState } from 'react'
import {
  Plus,
  Megaphone,
  X,
  Trash2,
  CalendarDays,
  PencilLine,
  ExternalLink,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { SectionTitle, EmptyState } from '../../components/shared/ui'
import { nameById } from '../../lib/selectors'
import { todayISO } from '../../lib/date'
import type { Campaign, CampaignMetric, CampaignPlatform } from '../../types/database'

const PLATFORM_LABELS: Record<CampaignPlatform, string> = {
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  snap_ads: 'Snapchat Ads',
  salla: 'Salla',
  other: 'Other',
}

const STATUS_TONES: Record<Campaign['status'], string> = {
  active: 'var(--positive)',
  planned: 'var(--brand)',
  paused: 'var(--warning)',
  completed: 'var(--text-muted)',
  archived: 'var(--text-muted)',
}

function campaignTotals(metrics: CampaignMetric[]) {
  return metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      revenue: acc.revenue + m.revenue,
      purchases: acc.purchases + m.purchases,
      clicks: acc.clicks + m.clicks,
      impressions: acc.impressions + m.impressions,
    }),
    { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0 },
  )
}

function MetricRow({ metric }: { metric: CampaignMetric }) {
  const roas = metric.spend > 0 ? metric.revenue / metric.spend : null
  return (
    <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] py-1.5 border-t border-[var(--hairline)]">
      <span className="w-20 shrink-0">{metric.date}</span>
      <span className="flex-1">{metric.impressions.toLocaleString()} impr · {metric.clicks.toLocaleString()} clicks</span>
      <span className="tabular-nums">{Math.round(metric.spend).toLocaleString()} / {Math.round(metric.revenue).toLocaleString()} SAR</span>
      <span className={`w-14 text-right font-semibold tabular-nums ${roas && roas >= 4 ? 'text-[var(--positive)]' : roas ? 'text-[var(--warning)]' : ''}`}>
        {roas ? `${roas.toFixed(1)}x` : '—'}
      </span>
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { state, actions } = useApp()
  const [logging, setLogging] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [form, setForm] = useState({ date: todayISO(), impressions: '', clicks: '', spend: '', purchases: '', revenue: '' })

  const metrics = state.campaignMetrics
    .filter((m) => m.campaign_id === campaign.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const totals = campaignTotals(metrics)
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : null
  const budgetUsed = campaign.budget && campaign.budget > 0 ? Math.min(100, (totals.spend / campaign.budget) * 100) : null

  const submitLog = () => {
    const num = (v: string) => (v.trim() === '' ? 0 : Math.max(0, parseFloat(v)))
    actions.logMetric({
      campaignId: campaign.id,
      date: form.date || todayISO(),
      impressions: num(form.impressions),
      clicks: num(form.clicks),
      spend: num(form.spend),
      purchases: num(form.purchases),
      revenue: num(form.revenue),
    })
    setForm({ date: todayISO(), impressions: '', clicks: '', spend: '', purchases: '', revenue: '' })
    setLogging(false)
  }

  return (
    <div className="glass-card hover-lift p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--text-primary)] leading-snug">{campaign.name}</div>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
            <span className="badge bg-[var(--surface)] text-[var(--text-secondary)]">{PLATFORM_LABELS[campaign.platform]}</span>
            <span className="inline-flex items-center gap-1" style={{ color: STATUS_TONES[campaign.status] }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_TONES[campaign.status] }} />
              {campaign.status}
            </span>
          </div>
        </div>
        <button
          onClick={() => actions.deleteCampaign(campaign.id)}
          className="icon-btn icon-btn-danger w-7 h-7 shrink-0"
          aria-label="Delete campaign"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {campaign.objective && (
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed">🎯 {campaign.objective}</div>
      )}

      {/* Budget pacing */}
      {budgetUsed != null && (
        <div>
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>Budget</span>
            <span>{Math.round(totals.spend).toLocaleString()} / {campaign.budget!.toLocaleString()} SAR</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--track)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${budgetUsed}%`, backgroundColor: budgetUsed > 95 ? 'var(--critical)' : budgetUsed > 80 ? 'var(--warning)' : 'var(--positive)' }}
            />
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-[var(--surface)] py-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Spend</div>
          <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{compactNum(totals.spend)}</div>
        </div>
        <div className="rounded-lg bg-[var(--surface)] py-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Revenue</div>
          <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{compactNum(totals.revenue)}</div>
        </div>
        <div className="rounded-lg bg-[var(--surface)] py-2">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">ROAS</div>
          <div className={`text-sm font-bold tabular-nums ${roas && roas >= 4 ? 'text-[var(--positive)]' : roas ? 'text-[var(--warning)]' : 'text-[var(--text-primary)]'}`}>
            {roas ? `${roas.toFixed(1)}x` : '—'}
          </div>
        </div>
      </div>

      {/* History toggle */}
      {metrics.length > 0 && (
        <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-[var(--brand)] hover:underline flex items-center gap-1">
          <CalendarDays size={12} />
          {showHistory ? 'Hide' : 'Show'} daily log ({metrics.length})
        </button>
      )}
      {showHistory && (
        <div>
          {metrics.map((m) => <MetricRow key={m.id} metric={m} />)}
        </div>
      )}

      {/* Daily log form */}
      {logging ? (
        <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Log daily numbers</span>
            <button onClick={() => setLogging(false)} className="icon-btn w-6 h-6" aria-label="Close log form">
              <X size={13} />
            </button>
          </div>
          <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="field !py-1.5 !text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={form.impressions} onChange={(e) => setForm({ ...form, impressions: e.target.value })} placeholder="Impressions" className="field !py-1.5 !text-xs" />
            <input type="number" value={form.clicks} onChange={(e) => setForm({ ...form, clicks: e.target.value })} placeholder="Clicks" className="field !py-1.5 !text-xs" />
            <input type="number" value={form.spend} onChange={(e) => setForm({ ...form, spend: e.target.value })} placeholder="Spend (SAR)" className="field !py-1.5 !text-xs" />
            <input type="number" value={form.purchases} onChange={(e) => setForm({ ...form, purchases: e.target.value })} placeholder="Purchases" className="field !py-1.5 !text-xs" />
            <input type="number" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} placeholder="Revenue (SAR)" className="field !py-1.5 !text-xs col-span-2" />
          </div>
          <button onClick={submitLog} className="btn btn-primary w-full !py-1.5 !text-xs">
            <PencilLine size={12} /> Save day
          </button>
        </div>
      ) : (
        <button onClick={() => setLogging(true)} className="btn btn-outline w-full !py-1.5 !text-xs">
          <PencilLine size={12} /> Log today's numbers
        </button>
      )}

      <div className="text-[11px] text-[var(--text-muted)]">by {nameById(state, campaign.created_by)}</div>
    </div>
  )
}

function compactNum(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return Math.round(v).toLocaleString()
}

export function Campaigns() {
  const { state, actions } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', platform: 'google_ads' as CampaignPlatform, budget: '', objective: '', startDate: todayISO() })

  const campaigns = state.campaigns.filter((c) => c.client_id === state.currentClientId)

  const submit = () => {
    if (!form.name.trim()) return
    actions.addCampaign({
      name: form.name.trim(),
      platform: form.platform,
      budget: form.budget.trim() === '' ? null : parseFloat(form.budget),
      objective: form.objective.trim() || null,
      startDate: form.startDate || null,
    })
    setForm({ name: '', platform: 'google_ads', budget: '', objective: '', startDate: todayISO() })
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Campaigns</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {campaigns.filter((c) => c.status === 'active').length} active · {state.campaignMetrics.length} days logged
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary shrink-0">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          <span className="hidden sm:inline">{showForm ? 'Close' : 'New Campaign'}</span>
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-5 space-y-3">
          <SectionTitle>New Campaign</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name *" className="field md:col-span-2" />
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as CampaignPlatform })} className="field">
              {(Object.keys(PLATFORM_LABELS) as CampaignPlatform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="Budget (SAR)" className="field" />
            <input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Objective (what does success look like?)" className="field md:col-span-3" />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="field" />
          </div>
          <div className="flex justify-end">
            <button onClick={submit} disabled={!form.name.trim()} className="btn btn-primary">
              <Megaphone size={15} /> Create campaign
            </button>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState title="No campaigns yet" hint="Create the first campaign and start logging daily numbers." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}

      {campaigns.length === 0 && state.campaigns.length === 0 && (
        <div className="glass-card p-4 flex items-start gap-2 text-xs text-[var(--text-muted)]">
          <ExternalLink size={13} className="shrink-0 mt-0.5" />
          Campaign data lives in Supabase. If this is empty after creating one, run the latest supabase/schema.sql.
        </div>
      )}
    </div>
  )
}
