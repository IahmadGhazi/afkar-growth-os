import * as XLSX from 'xlsx'
import type { KpiDefinition, KpiSnapshot } from '../../types/database'

export interface SheetKpiRow {
  name: string
  value: number
  date?: string
}

const NAME_KEYS = /^(kpi|name|metric|indicator|title)$/i
const VALUE_KEYS = /^(value|amount|current|number)$/i

function normalizeCell(raw: unknown): string {
  if (raw == null) return ''
  return String(raw).trim()
}

function parseCellNumber(raw: unknown): number | null {
  if (raw == null) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  const text = String(raw).replace(/[^\d.-]/g, '')
  if (!text) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

function parseCellDate(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = Math.round((raw - 25569) * 86400 * 1000)
    const date = new Date(ms)
    if (isNaN(date.getTime())) return null
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const text = String(raw).trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  const parsed = new Date(text)
  if (isNaN(parsed.getTime())) return null
  const y = parsed.getFullYear()
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseWorkbook(buffer: ArrayBuffer): SheetKpiRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  const rows: SheetKpiRow[] = []
  for (const cells of matrix) {
    if (!Array.isArray(cells) || cells.length < 2) continue
    const name = normalizeCell(cells[0])
    const value = parseCellNumber(cells[1])
    if (!name || value == null) continue
    if (NAME_KEYS.test(name) && VALUE_KEYS.test(normalizeCell(cells[1]))) continue
    rows.push({ name, value, date: parseCellDate(cells[2]) ?? undefined })
  }
  return rows
}

export function parseSheetsText(text: string): SheetKpiRow[] {
  const rows: SheetKpiRow[] = []
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines) {
    const parts = line.split(/[,\t;]/).map((part) => part.trim()).filter(Boolean)
    if (parts.length < 2) continue
    const name = parts[0]
    const value = parseCellNumber(parts[1])
    if (!name || value == null) continue
    if (NAME_KEYS.test(name) && VALUE_KEYS.test(parts[1])) continue
    rows.push({ name, value, date: parts[2] && /^\d{4}-\d{2}-\d{2}$/.test(parts[2]) ? parts[2] : undefined })
  }
  return rows
}

export function extractSheetId(input: string): string | null {
  const trimmed = input.trim()
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (match) return match[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  return null
}

export async function fetchGoogleSheetCsv(sheetId: string): Promise<string> {
  const gviz = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`
  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`
  for (const url of [gviz, exportUrl]) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.text()
    } catch {
      // try next endpoint
    }
  }
  throw new Error('Could not fetch the sheet. Make sure it is shared with "Anyone with the link" (Viewer).')
}

export function exportKpisToWorkbook(
  definitions: KpiDefinition[],
  snapshots: KpiSnapshot[],
): ArrayBuffer {
  const workbook = XLSX.utils.book_new()

  const currentRows = definitions.map((definition) => {
    const latest = snapshots
      .filter((snap) => snap.kpi_id === definition.id)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0]
    return { KPI: definition.name, Value: latest?.value ?? 0, Unit: definition.unit ?? '' }
  })
  const currentSheet = XLSX.utils.json_to_sheet(currentRows)
  currentSheet['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, currentSheet, 'KPIs')

  const historyRows = snapshots.map((snap) => {
    const definition = definitions.find((d) => d.id === snap.kpi_id)
    return {
      KPI: definition?.name ?? snap.kpi_id,
      Date: snap.snapshot_date,
      Value: snap.value,
      Source: snap.source ?? '',
    }
  })
  const historySheet = XLSX.utils.json_to_sheet(historyRows)
  historySheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(workbook, historySheet, 'History')

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}