import { Person } from './types'

export function extractYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined
  const m = dateStr.match(/\d{4}/)
  return m ? parseInt(m[0]) : undefined
}

function fmtDate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, mo, d] = dateStr.split('-')
    return `${d}/${mo}/${y}`
  }
  return dateStr
}

export function personDateLabel(person: Person, defaultDisplay?: string): string {
  const mode = person.dateDisplay ?? defaultDisplay ?? 'year'
  const { birthDate, deathDate, deceased } = person

  if (mode === 'year') {
    const by = extractYear(birthDate)
    const dy = extractYear(deathDate)
    if (!by && !dy) return ''
    return deceased ? `${by ?? '?'}–${dy ?? '?'}` : String(by ?? '')
  }

  if (mode === 'date') {
    const b = birthDate ? fmtDate(birthDate) : ''
    const d = deathDate ? fmtDate(deathDate) : ''
    if (deceased) return b || d ? `${b}–${d}` : ''
    return b ? `b. ${b}` : ''
  }

  if (mode === 'age') {
    const by = extractYear(birthDate)
    if (!by) return ''
    const dy = extractYear(deathDate)
    const to = deceased ? (dy ?? new Date().getFullYear()) : new Date().getFullYear()
    return String(to - by)
  }

  return ''
}

// Convert a GEDCOM date string like "15 JAN 1945" or "1945" to "YYYY-MM-DD" or "YYYY"
const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
}

export function normalizeGedcomDate(raw?: string): string | undefined {
  if (!raw) return undefined
  const parts = raw.trim().toUpperCase().split(/\s+/)
  if (parts.length === 3) {
    const [d, mon, y] = parts
    const mo = MONTHS[mon]
    if (mo && /^\d{4}$/.test(y)) return `${y}-${mo}-${d.padStart(2, '0')}`
  }
  if (parts.length === 2) {
    const [mon, y] = parts
    const mo = MONTHS[mon]
    if (mo && /^\d{4}$/.test(y)) return `${y}-${mo}-01`
  }
  const yearMatch = raw.match(/\d{4}/)
  return yearMatch ? yearMatch[0] : undefined
}
