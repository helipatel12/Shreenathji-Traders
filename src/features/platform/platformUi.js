import { todayKeyIST } from '../../utils/dates'

export function greetingKey() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  )
  if (hour < 12) return 'dashboard.greetingMorning'
  if (hour < 17) return 'dashboard.greetingAfternoon'
  return 'dashboard.greetingEvening'
}

export function formatYardDate(localeTag) {
  const [y, m, d] = todayKeyIST().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 6))
  return new Intl.DateTimeFormat(localeTag === 'gu' ? 'gu-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(dt)
}

export function companyInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function operatorName(user) {
  const named = String(user?.name || '').trim()
  if (named) return named
  return String(user?.email || '').split('@')[0] || ''
}

export function timestampToDateKey(value) {
  if (!value) return ''
  const date = typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date)
}

export function hasPendingAdmin(company) {
  return !company?.adminUid
}

export function currentYearMonth() {
  const [y, m] = todayKeyIST().split('-').map(Number)
  return { year: y, month: m - 1 }
}

export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function monthTitle(year, month, lang) {
  return new Intl.DateTimeFormat(lang === 'gu' ? 'gu-IN' : 'en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1))
}

export function weekdayLabels(lang) {
  const fmt = new Intl.DateTimeFormat(lang === 'gu' ? 'gu-IN' : 'en-IN', { weekday: 'narrow' })
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)))
}

export function calendarCells(year, month) {
  const firstDow = new Date(year, month, 1).getDay()
  const start = firstDow === 0 ? 6 : firstDow - 1
  const days = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < start; i += 1) cells.push(null)
  for (let day = 1; day <= days; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ day, key })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function companiesByDate(companies) {
  const map = {}
  companies.forEach((company) => {
    const key = timestampToDateKey(company.createdAt)
    if (!key) return
    if (!map[key]) map[key] = []
    map[key].push(company)
  })
  return map
}

export function monthlyAddSeries(companies, months = 6, lang = 'en') {
  const [ty, tm] = todayKeyIST().split('-').map(Number)
  const buckets = []
  for (let i = months - 1; i >= 0; i -= 1) {
    let y = ty
    let m = tm - i
    while (m <= 0) {
      m += 12
      y -= 1
    }
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat(lang === 'gu' ? 'gu-IN' : 'en-IN', {
      month: 'short',
    }).format(new Date(y, m - 1, 1))
    buckets.push({ key, label, value: 0 })
  }
  companies.forEach((company) => {
    const dateKey = timestampToDateKey(company.createdAt)
    if (!dateKey) return
    const bucket = buckets.find((b) => b.key === dateKey.slice(0, 7))
    if (bucket) bucket.value += 1
  })
  return buckets
}

export function addedThisMonthCount(companies) {
  const ym = todayKeyIST().slice(0, 7)
  return companies.filter((c) => timestampToDateKey(c.createdAt).startsWith(ym)).length
}

export function searchHaystack(company) {
  return [company.name, company.adminEmail, company.adminName, company.id]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}
