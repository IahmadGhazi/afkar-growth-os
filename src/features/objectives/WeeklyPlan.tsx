import { useState } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import {
  activeObjective,
  tasksForClient,
  departmentLabel,
  DEPARTMENT_LABELS,
  DONE_STATUSES,
} from '../../lib/selectors'
import { SectionTitle } from '../../components/shared/ui'
import { formatFull } from '../../lib/date'
import type { KeyResult } from '../../types/database'

function deriveKrStatus(current: number, target: number): KeyResult['status'] {
  if (current >= target) return 'achieved'
  if (current >= target * 0.85) return 'on_track'
  if (current >= target * 0.7) return 'at_risk'
  return 'behind'
}

function KrStatusIcon({ status }: { status: KeyResult['status'] }) {
  if (status === 'achieved') return <TrendingUp size={16} className="text-[var(--positive)]" />
  if (status === 'on_track') return <Minus size={16} className="text-[var(--brand)]" />
  if (status === 'at_risk') return <TrendingDown size={16} className="text-[var(--warning)]" />
  return <TrendingDown size={16} className="text-[var(--critical)]" />
}

function EditableKeyResult({ kr }: { kr: KeyResult }) {
  const { actions } = useApp()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(kr.metric_current ?? 0))

  const save = () => {
    const parsed = parseFloat(value)
    if (isNaN(parsed)) return
    const target = kr.metric_target ?? 1
    actions.updateKeyResult(kr.id, {
      metric_current: parsed,
      status: deriveKrStatus(parsed, target),
    })
    setEditing(false)
  }

  return (
    <div className="glass-inset flex items-center gap-4 p-3">
      <div className="flex-1">
        <div className="font-medium text-[var(--text-primary)]">{kr.title}</div>
        {kr.metric_name && (
          <div className="text-xs text-[var(--text-muted)]">{kr.metric_name}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field w-24"
              autoFocus
            />
            <button onClick={save} className="icon-btn icon-btn-success">
              <Check size={16} />
            </button>
            <button onClick={() => setEditing(false)} className="icon-btn icon-btn-danger">
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-[var(--text-muted)]">
              {kr.metric_current} / {kr.metric_target} {kr.metric_unit}
            </span>
            <KrStatusIcon status={kr.status} />
            <button
              onClick={() => { setValue(String(kr.metric_current ?? 0)); setEditing(true) }}
              className="icon-btn"
            >
              <Pencil size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function WeeklyPlan() {
  const { state } = useApp()
  const clientId = state.currentClientId
  const objective = activeObjective(state, clientId)
  const tasks = tasksForClient(state, clientId)
  const keyResults = state.keyResults.filter((kr) => kr.objective_id === objective?.id)

  const weekStart = objective?.week_start ?? ''
  const weekEnd = objective?.week_end ?? ''

  const departmentBoards = Object.keys(DEPARTMENT_LABELS)
    .map((department) => {
      const deptTasks = tasks.filter(
        (task) => task.department === department && task.due_date && task.due_date >= weekStart && task.due_date <= weekEnd,
      )
      if (deptTasks.length === 0) return null
      const done = deptTasks.filter((task) => DONE_STATUSES.includes(task.status)).length
      const progress = Math.round((done / deptTasks.length) * 100)
      return { department: departmentLabel(department), done, total: deptTasks.length, progress, tasks: deptTasks }
    })
    .filter(Boolean) as { department: string; done: number; total: number; progress: number; tasks: typeof tasks }[]

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
          {objective && (
            <span className="text-sm text-[var(--text-muted)]">
              {formatFull(objective.week_start)} - {formatFull(objective.week_end)}
            </span>
          )}
        </div>

        {!objective ? (
          <div className="glass-card p-6 text-center text-sm text-[var(--text-muted)]">
            No active objective for this client yet.
          </div>
        ) : (
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  {objective.title}
                </h3>
                {objective.description && (
                  <p className="text-sm text-[var(--text-muted)] mt-1">{objective.description}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold bg-gradient-to-br from-[#6177ff] to-[#4459e8] bg-clip-text text-transparent">
                  {objective.progress_pct}%
                </div>
                <div className="text-sm text-[var(--text-muted)]">complete</div>
              </div>
            </div>

            <div className="h-2.5 bg-[rgba(22,26,34,0.07)] rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-[#6177ff] to-[#4459e8] rounded-full transition-all"
                style={{ width: `${objective.progress_pct}%` }}
              />
            </div>

            <div className="space-y-3">
              <SectionTitle>Key Results</SectionTitle>
              {keyResults.length === 0 ? (
                <div className="text-sm text-[var(--text-muted)]">No key results set yet.</div>
              ) : keyResults.map((kr) => <EditableKeyResult key={kr.id} kr={kr} />)}
            </div>
          </div>
        )}
      </section>

      {/* Department Execution */}
      <section>
        <SectionTitle>Department Execution</SectionTitle>
        <div className="space-y-4">
          {departmentBoards.length === 0 ? (
            <div className="text-sm text-[var(--text-muted)]">No tasks scheduled this week.</div>
          ) : departmentBoards.map((dept) => (
            <div key={dept.department} className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-[var(--text-primary)]">{dept.department}</div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {dept.progress}%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{dept.done}/{dept.total} done</div>
                </div>
              </div>
              <div className="h-2 bg-[rgba(22,26,34,0.07)] rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    dept.progress === 100
                      ? 'bg-gradient-to-r from-[#19b87a] to-[#0f9c68]'
                      : dept.progress >= 70
                      ? 'bg-gradient-to-r from-[#6177ff] to-[#4459e8]'
                      : 'bg-gradient-to-r from-[#f2b04a] to-[#e0902e]'
                  }`}
                  style={{ width: `${dept.progress}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {dept.tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      DONE_STATUSES.includes(task.status)
                        ? 'bg-[var(--positive-soft)] text-[var(--positive)] line-through'
                        : task.status === 'in_progress'
                        ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                        : task.status === 'blocked'
                        ? 'bg-[var(--critical-soft)] text-[var(--critical)]'
                        : 'bg-[rgba(22,26,34,0.05)] text-[var(--text-muted)]'
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
