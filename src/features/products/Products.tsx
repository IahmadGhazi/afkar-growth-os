import { useState } from 'react'
import {
  Plus,
  X,
  ArrowRight,
  Ban,
  Trash2,
  ExternalLink,
  Trophy,
  FlaskConical,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { SectionTitle, EmptyState } from '../../components/shared/ui'
import { nameById } from '../../lib/selectors'
import type { ProductCandidate, ProductStatus } from '../../types/database'

/** The funnel in order. Many enter at discovered; one leaves as a winner. */
const STAGES: { id: ProductStatus; label: string }[] = [
  { id: 'discovered', label: 'Discovered' },
  { id: 'filtered', label: 'Filtered' },
  { id: 'validating', label: 'Validating' },
  { id: 'shortlisted', label: 'Shortlisted' },
  { id: 'testing', label: 'Testing' },
  { id: 'winner', label: 'Winner' },
]

const NEXT_STAGE: Partial<Record<ProductStatus, ProductStatus>> = {
  discovered: 'filtered',
  filtered: 'validating',
  validating: 'shortlisted',
  shortlisted: 'testing',
  testing: 'winner',
}

function scoreOf(p: ProductCandidate): number | null {
  const scores = [
    p.score_demand,
    p.score_competition,
    p.score_margin,
    p.score_creative,
    p.score_brand_fit,
    p.score_trend,
  ].filter((s): s is number => s != null)
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

function scoreColor(score: number): string {
  if (score >= 7) return 'var(--positive)'
  if (score >= 5) return 'var(--brand)'
  return 'var(--text-muted)'
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return null
  }
}

function ProductCard({ product }: { product: ProductCandidate }) {
  const { state, actions } = useApp()
  const score = scoreOf(product)
  const host = hostOf(product.source_url)
  const next = NEXT_STAGE[product.status]
  const isKilled = product.status === 'killed'

  return (
    <div className="glass-card hover-lift p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-[var(--text-primary)] leading-snug">{product.name}</div>
        {score != null && !isKilled && (
          <span
            className="badge shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${scoreColor(score)} 15%, transparent)`, color: scoreColor(score) }}
            title="Average of the scored dimensions"
          >
            {score.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
        {product.category && <span>{product.category}</span>}
        {product.estimated_price != null && (
          <span className="font-semibold text-[var(--text-secondary)]">
            ~{product.estimated_price.toLocaleString()} SAR
          </span>
        )}
        {host && (
          <a
            href={product.source_url ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline"
          >
            {host} <ExternalLink size={11} />
          </a>
        )}
      </div>

      {product.demand_evidence && (
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--surface)] rounded-lg px-3 py-2">
          📊 {product.demand_evidence}
        </div>
      )}

      <div className="mt-auto pt-1 flex items-center justify-between gap-2 text-xs text-[var(--text-muted)] border-t border-[var(--hairline)] pt-3">
        <span>by {nameById(state, product.researcher_id)}</span>
        {!isKilled && (
          <div className="flex items-center gap-1">
            {next && (
              <button
                onClick={() => actions.moveProduct(product.id, next)}
                className="btn btn-primary !px-2.5 !py-1.5 !text-xs"
                title={`Move to ${STAGES.find((s) => s.id === next)?.label}`}
              >
                {product.status === 'testing' ? (
                  <>
                    <Trophy size={12} /> Winner
                  </>
                ) : (
                  <>
                    <ArrowRight size={12} /> Advance
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => actions.moveProduct(product.id, 'killed')}
              className="icon-btn icon-btn-danger w-7 h-7"
              title="Kill candidate"
            >
              <Ban size={13} />
            </button>
            <button
              onClick={() => actions.deleteProduct(product.id)}
              className="icon-btn icon-btn-danger w-7 h-7"
              aria-label="Delete candidate"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface FormState {
  name: string
  category: string
  sourceUrl: string
  competitor: string
  estimatedPrice: string
  demandEvidence: string
  demand: string
  competition: string
  margin: string
  creative: string
  brandFit: string
  trend: string
}

const emptyForm: FormState = {
  name: '',
  category: '',
  sourceUrl: '',
  competitor: '',
  estimatedPrice: '',
  demandEvidence: '',
  demand: '',
  competition: '',
  margin: '',
  creative: '',
  brandFit: '',
  trend: '',
}

export function Products() {
  const { state, actions } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const products = state.products.filter((p) => p.client_id === state.currentClientId)
  const active = products.filter((p) => p.status !== 'killed')
  const killed = products.filter((p) => p.status === 'killed')

  const submit = () => {
    if (!form.name.trim()) return
    const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.min(10, parseFloat(v))))
    actions.addProduct({
      name: form.name.trim(),
      category: form.category.trim() || null,
      sourceUrl: form.sourceUrl.trim() || null,
      competitor: form.competitor.trim() || null,
      estimatedPrice: form.estimatedPrice.trim() === '' ? null : parseFloat(form.estimatedPrice),
      demandEvidence: form.demandEvidence.trim() || null,
      notes: null,
      scores: {
        demand: num(form.demand),
        competition: num(form.competition),
        margin: num(form.margin),
        creative: num(form.creative),
        brandFit: num(form.brandFit),
        trend: num(form.trend),
      },
    })
    setForm(emptyForm)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Product Research</h2>
          <div className="text-sm text-[var(--text-muted)]">
            {active.length} live candidates · {killed.length} killed
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary shrink-0">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          <span className="hidden sm:inline">{showForm ? 'Close' : 'Add Candidate'}</span>
        </button>
      </div>

      {/* The funnel strip */}
      <div className="glass-card px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {STAGES.map((stage, i) => {
            const count = products.filter((p) => p.status === stage.id).length
            return (
              <div key={stage.id} className="flex items-center gap-1">
                <button
                  onClick={() => {
                    document.getElementById(`stage-${stage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={`chip ${count > 0 ? '!border-[var(--brand)] !text-[var(--brand)] font-semibold' : ''}`}
                >
                  {stage.label}
                  <span className="ml-0.5 opacity-80">{count}</span>
                </button>
                {i < STAGES.length - 1 && <ArrowRight size={12} className="text-[var(--text-muted)] shrink-0" />}
              </div>
            )
          })}
          {killed.length > 0 && (
            <span className="chip ml-2">🪦 Killed {killed.length}</span>
          )}
        </div>
      </div>

      {showForm && (
        <div className="glass-card p-5 space-y-3">
          <SectionTitle>New Candidate</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Product name *"
              className="field md:col-span-2"
            />
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Category (Living Room…)"
              className="field"
            />
            <input
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              placeholder="Source URL"
              className="field"
            />
            <input
              value={form.competitor}
              onChange={(e) => setForm({ ...form, competitor: e.target.value })}
              placeholder="Competitor"
              className="field"
            />
            <input
              type="number"
              value={form.estimatedPrice}
              onChange={(e) => setForm({ ...form, estimatedPrice: e.target.value })}
              placeholder="Est. price (SAR)"
              className="field"
            />
            <input
              value={form.demandEvidence}
              onChange={(e) => setForm({ ...form, demandEvidence: e.target.value })}
              placeholder="Demand evidence (reviews, sold count…)"
              className="field md:col-span-3"
            />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(
              [
                ['demand', 'Demand'],
                ['competition', 'Competition'],
                ['margin', 'Margin'],
                ['creative', 'Creative'],
                ['brandFit', 'Brand fit'],
                ['trend', 'Trend'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs text-[var(--text-muted)] block">
                {label} 0–10
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="field mt-1"
                  placeholder="—"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button onClick={submit} disabled={!form.name.trim()} className="btn btn-primary">
              <FlaskConical size={15} /> Add to funnel
            </button>
          </div>
        </div>
      )}

      {/* Stage sections */}
      {active.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          hint="Add the first discovered product and start the funnel."
        />
      ) : (
        STAGES.map((stage) => {
          const stageProducts = products.filter((p) => p.status === stage.id)
          if (stageProducts.length === 0) return null
          return (
            <section key={stage.id} id={`stage-${stage.id}`}>
              <SectionTitle>
                {stage.label} · {stageProducts.length}
              </SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stageProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )
        })
      )}

      {killed.length > 0 && (
        <details className="glass-card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--text-muted)] select-none">
            🪦 Killed candidates ({killed.length})
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {killed.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
