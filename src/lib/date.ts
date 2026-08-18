export function todayISO(): string {
  return toISO(new Date())
}

export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return toISO(date)
}

export function startOfWeekISO(): string {
  const date = new Date()
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return toISO(date)
}

export function endOfWeekISO(): string {
  const date = new Date()
  const day = date.getDay()
  const diff = day === 0 ? 0 : 7 - day
  date.setDate(date.getDate() + diff)
  return toISO(date)
}

export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso + 'T00:00:00')
  return isNaN(date.getTime()) ? null : date
}

export function isPast(iso: string | null | undefined): boolean {
  const date = parseDate(iso)
  if (!date) return false
  return date < startOfToday()
}

export function startOfToday(): Date {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

export function formatShort(iso: string | null | undefined): string {
  const date = parseDate(iso)
  if (!date) return ''
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function formatFull(iso: string | null | undefined): string {
  const date = parseDate(iso)
  if (!date) return ''
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
