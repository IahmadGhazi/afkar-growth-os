import { useState, useRef } from 'react'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Link2,
  Link2Off,
  Zap,
  FileUp,
  FileSpreadsheet,
  Download,
  FileDown,
} from 'lucide-react'
import { useApp } from '../../lib/store'
import { currentClient, kpisForClient, getConnection } from '../../lib/selectors'
import { sourceInfo, parseMetricCsv } from '../../lib/integrations'
import {
  parseWorkbook,
  parseSheetsText,
  extractSheetId,
  fetchGoogleSheetCsv,
  exportKpisToWorkbook,
  type SheetKpiRow,
} from '../../lib/integrations/sheets'
import { SectionTitle } from '../../components/shared/ui'
import { formatShort } from '../../lib/date'
import { IntegrationsPanel } from './IntegrationsPanel'

function ManualEntry() {
  const { state, actions } = useApp()
  const kpis = kpisForClient(state, state.currentClientId)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const allFilled = kpis.length > 0 && kpis.every((kpi) => values[kpi.id] !== undefined && values[kpi.id] !== '')

  const save = () => {
    const parsed: Record<string, number> = {}
    for (const kpi of kpis) {
      const v = parseFloat(values[kpi.id] ?? '')
      if (!isNaN(v)) parsed[kpi.id] = v
    }
    actions.setKpiValues(parsed)
    actions.logSyncRun('manual', 'success', Object.keys(parsed).length, null)
    setValues({})
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (kpis.length === 0) {
    return (
      <div className="p-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-center text-sm text-[var(--text-muted)]">
        No KPIs for this client yet. Add one on the KPIs page first.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="flex flex-col gap-1">
            <label className="text-xs text-[var(--text-muted)]">
              {kpi.name}
              <span className="ml-1 opacity-60">({kpi.current.toLocaleString()})</span>
            </label>
            <input
              type="number"
              value={values[kpi.id] ?? ''}
              onChange={(e) => setValues({ ...values, [kpi.id]: e.target.value })}
              placeholder="Enter value"
              className="field"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!allFilled}
          className="btn btn-primary"
        >
          <CheckCircle2 size={15} /> Save today's numbers
        </button>
        {saved && <span className="text-sm text-[var(--positive)] font-medium">Saved for today</span>}
      </div>
    </div>
  )
}

function CsvImport() {
  const { state, actions } = useApp()
  const [text, setText] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)

  const importRows = () => {
    const rows = parseMetricCsv(text)
    if (rows.length === 0) {
      setFeedback({ ok: false, message: 'No valid rows found. Use: KPI name, value' })
      return
    }
    const byName = new Map(
      state.kpiDefinitions
        .filter((d) => d.client_id === state.currentClientId)
        .map((d) => [d.name.toLowerCase(), d.id]),
    )
    const values: Record<string, number> = {}
    let matched = 0
    for (const row of rows) {
      const kpiId = byName.get(row.name.toLowerCase())
      if (kpiId) {
        values[kpiId] = row.value
        matched++
      }
    }
    actions.setKpiValues(values)
    actions.logSyncRun('manual', 'success', matched, null)
    setFeedback({
      ok: matched > 0,
      message: matched > 0
        ? `Imported ${matched} value${matched > 1 ? 's' : ''} (unmatched rows ignored)`
        : 'No KPI names matched. Check the first column matches KPI names.',
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={`Paste rows, one per line:\nRevenue\t325000\nOrders\t1320\nROAS\t5.4`}
        className="field font-mono"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={importRows}
          disabled={!text.trim()}
          className="btn btn-primary"
        >
          <FileUp size={15} /> Import
        </button>
        {feedback && (
          <span className={`text-sm ${feedback.ok ? 'text-[var(--positive)]' : 'text-[var(--critical)]'}`}>
            {feedback.message}
          </span>
        )}
      </div>
    </div>
  )
}

function SheetSources() {
  const { state, actions } = useApp()
  const clientId = state.currentClientId
  const sheetsConnection = getConnection(state, 'google_sheets')
  const excelConnection = getConnection(state, 'excel')
  const [sheetLink, setSheetLink] = useState(sheetsConnection?.config?.sheetId ? String(sheetsConnection.config.sheetId) : '')
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [sheetFeedback, setSheetFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const importRows = (rows: SheetKpiRow[], source: 'excel' | 'google_sheets') => {
    if (rows.length === 0) return 0
    return actions.importKpiRows(source, rows, clientId)
  }

  const onExcelFile = async (file: File) => {
    setBusy(true)
    try {
      const buffer = await file.arrayBuffer()
      const rows = parseWorkbook(buffer)
      const matched = importRows(rows, 'excel')
      setFeedback(
        matched > 0
          ? { ok: true, message: `Imported ${matched} value${matched === 1 ? '' : 's'} from ${file.name}` }
          : { ok: false, message: 'No KPI names matched. Check column A holds KPI names and column B holds values.' },
      )
    } catch {
      setFeedback({ ok: false, message: 'Could not read that file. Use an .xlsx exported from Excel or Google Sheets.' })
    } finally {
      setBusy(false)
    }
  }

  const exportExcel = () => {
    const buffer = exportKpisToWorkbook(state.kpiDefinitions, state.kpiSnapshots)
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `afkar-kpis-${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  const connectSheet = async () => {
    const sheetId = extractSheetId(sheetLink)
    if (!sheetId) {
      setSheetFeedback({ ok: false, message: 'Paste a full Google Sheets link or the sheet ID.' })
      return
    }
    setBusy(true)
    try {
      const csv = await fetchGoogleSheetCsv(sheetId)
      const rows = parseSheetsText(csv)
      const matched = importRows(rows, 'google_sheets')
      if (matched > 0) {
        setSheetFeedback({ ok: true, message: `Connected and imported ${matched} value${matched === 1 ? '' : 's'}.` })
      } else {
        setSheetFeedback({ ok: false, message: 'Sheet reachable but no KPI names matched. Expected columns: KPI name, value.' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the sheet.'
      setSheetFeedback({ ok: false, message })
    } finally {
      setBusy(false)
    }
  }

  const syncSheet = async () => {
    const sheetId = sheetsConnection?.config?.sheetId ? String(sheetsConnection.config.sheetId) : extractSheetId(sheetLink)
    if (!sheetId) {
      setSheetFeedback({ ok: false, message: 'No sheet linked yet. Connect a sheet first.' })
      return
    }
    setBusy(true)
    try {
      const csv = await fetchGoogleSheetCsv(sheetId)
      const rows = parseSheetsText(csv)
      const matched = importRows(rows, 'google_sheets')
      setSheetFeedback(
        matched > 0
          ? { ok: true, message: `Synced ${matched} value${matched === 1 ? '' : 's'} from Google Sheets.` }
          : { ok: false, message: 'No KPI names matched the sheet rows.' },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the sheet.'
      setSheetFeedback({ ok: false, message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Excel */}
      <div className="glass-card hover-lift p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <FileSpreadsheet size={16} className="text-[var(--brand)]" /> Excel workbook
          </div>
          <span className={`badge ${excelConnection?.connected ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : 'bg-[var(--track)] text-[var(--text-muted)]'}`}>
            {excelConnection?.connected ? 'Synced' : 'Not synced'}
          </span>
        </div>
        <div className="text-sm text-[var(--text-muted)] mb-4">
          Keep your numbers in an Excel file and import them here — or export the current KPIs as a template.
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onExcelFile(file)
            e.target.value = ''
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} disabled={busy} className="btn btn-primary">
            <FileUp size={14} /> Import from Excel
          </button>
          <button onClick={exportExcel} className="btn btn-outline">
            <FileDown size={14} /> Export to Excel
          </button>
        </div>
        {feedback && (
          <div className={`mt-3 text-sm ${feedback.ok ? 'text-[var(--positive)]' : 'text-[var(--critical)]'}`}>
            {feedback.message}
          </div>
        )}
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Row format: <span className="font-mono">Revenue, 1400000</span> — column A name, column B value.
          A third <span className="font-mono">YYYY-MM-DD</span> date column is optional.
        </div>
      </div>

      {/* Google Sheets */}
      <div className="glass-card hover-lift p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
            <Download size={16} className="text-[var(--brand)]" /> Google Sheets
          </div>
          <span className={`badge ${sheetsConnection?.connected ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : 'bg-[var(--track)] text-[var(--text-muted)]'}`}>
            {sheetsConnection?.connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <div className="text-sm text-[var(--text-muted)] mb-3">
          Sync your KPIs straight from a sheet shared with "Anyone with the link". No API keys needed.
        </div>
        <input
          value={sheetLink}
          onChange={(e) => setSheetLink(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="field"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {sheetsConnection?.connected ? (
            <>
              <button onClick={syncSheet} disabled={busy} className="btn btn-primary">
                <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Sync now
              </button>
              <button onClick={() => actions.disconnectSource('google_sheets')} className="btn btn-outline">
                <Link2Off size={14} /> Disconnect
              </button>
            </>
          ) : (
            <button onClick={connectSheet} disabled={busy} className="btn btn-primary">
              <Link2 size={14} /> Connect &amp; import
            </button>
          )}
        </div>
        {sheetFeedback && (
          <div className={`mt-3 text-sm ${sheetFeedback.ok ? 'text-[var(--positive)]' : 'text-[var(--critical)]'}`}>
            {sheetFeedback.message}
          </div>
        )}
        <div className="mt-3 text-xs text-[var(--text-muted)]">
          Share your sheet: File → Share → "Anyone with the link" (Viewer), then paste the link here.
        </div>
      </div>
    </div>
  )
}

export function Data() {
  const { state } = useApp()
  const client = currentClient(state)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Zap size={14} />
        <span>{client?.name ?? 'Client'}</span>
      </div>

      {/* Live platform integrations — THE ONLY connection interface */}
      <section>
        <SectionTitle>Platform Integrations</SectionTitle>
        <IntegrationsPanel />
      </section>

      {/* Excel & Google Sheets */}
      <section>
        <SectionTitle>Excel &amp; Google Sheets</SectionTitle>
        <div className="text-sm text-[var(--text-muted)] mb-4">
          Edit your numbers in a spreadsheet and pull them in — no typing required. Supports manual file imports,
          an Excel template you keep updated, and live Google Sheets sync.
        </div>
        <SheetSources />
      </section>

      {/* Manual Entry */}
      <section>
        <SectionTitle>Log Today's Numbers</SectionTitle>
        <div className="glass-card p-5">
          <ManualEntry />
        </div>
      </section>

      {/* CSV Import */}
      <section>
        <SectionTitle>Import from Spreadsheet</SectionTitle>
        <div className="glass-card p-5">
          <div className="text-sm text-[var(--text-muted)] mb-3">
            Export from Salla or your ad platforms and paste here. First column = KPI name, second = value.
          </div>
          <CsvImport />
        </div>
      </section>

      {/* Sync Log */}
      <section>
        <SectionTitle>Sync Log</SectionTitle>
        {state.syncLog.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] text-center text-sm text-[var(--text-muted)]">
            No syncs yet.
          </div>
        ) : (
          <div className="glass-card divide-hairline overflow-hidden p-0">
            {state.syncLog.map((run) => (
              <div key={run.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                {run.status === 'success' ? (
                  <CheckCircle2 size={16} className="text-[var(--positive)] shrink-0" />
                ) : (
                  <XCircle size={16} className="text-[var(--critical)] shrink-0" />
                )}
                <span className="font-medium text-[var(--text-primary)]">{sourceLabel(run.source)}</span>
                <span className="text-[var(--text-muted)]">
                  {run.status === 'success'
                    ? `${run.row_count} metric${run.row_count === 1 ? '' : 's'} synced`
                    : run.error ?? 'Failed'}
                </span>
                <span className="ml-auto text-xs text-[var(--text-muted)]">{formatShort(run.synced_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function sourceLabel(source: string): string {
  return sourceInfo(source)?.name ?? source
}