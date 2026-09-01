// Financial-year boundary (01/04–30/03) and IST date helpers, built on
// date-fns per rules.md §1. Used by the dashboard's "today" summary
// (Phase 2), the year-end archive (Phase 9), and jansa silak's daily
// rollover (Phase 7) — see phases.md.
//
// This app's users operate in India, and financial data should key
// off the IST calendar date regardless of the device's own OS
// timezone setting. Plain date-fns only works in the runtime's local
// timezone, so "today" is resolved via Intl's IST-aware formatter
// rather than assumed from the browser — no extra dependency needed
// (date-fns-tz isn't on rules.md §1's approved list, and isn't
// necessary just for this).
import { format } from 'date-fns'

const IST_TIME_ZONE = 'Asia/Kolkata'

// Bills/payments/silak entries store their `date` field as a plain
// "YYYY-MM-DD" string (IST calendar date), not a Firestore Timestamp —
// this matches how the physical registers work (a ledger entry has a
// date, not a moment in time) and makes "today's bills" a simple
// equality query rather than a Timestamp range query. `createdAt`
// stays a real serverTimestamp() alongside it for audit ordering.
// See architecture.md §4 and memory.md's decisions log.
export function todayKeyIST() {
  // en-CA locale formats as YYYY-MM-DD, which doubles as the dateKey.
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE }).format(new Date())
}

export function formatDateKey(date) {
  return format(date, 'yyyy-MM-dd')
}

// Financial year: 01/04–30/03 (prd.md §4.6, architecture.md §4).
export function financialYearBounds(dateKey = todayKeyIST()) {
  const [year, month] = dateKey.split('-').map(Number)
  const fyStartYear = month >= 4 ? year : year - 1
  return {
    start: `${fyStartYear}-04-01`,
    end: `${fyStartYear + 1}-03-31`,
  }
}

// The FY immediately before the one `dateKey` falls in — the "just
// closed" year the archive prompt (Phase 9) offers to back up the
// moment the app detects `dateKey` has crossed into a new FY.
export function previousFinancialYearBounds(dateKey = todayKeyIST()) {
  const current = financialYearBounds(dateKey)
  const fyStartYear = Number(current.start.slice(0, 4)) - 1
  return {
    start: `${fyStartYear}-04-01`,
    end: `${fyStartYear + 1}-03-31`,
  }
}

// Parses a "YYYY-MM-DD" dateKey into a LOCAL Date (year, month-1, day)
// rather than `new Date("YYYY-MM-DD")`, which JS interprets as UTC
// midnight — round-tripping that through local formatting can shift
// the displayed date by a day depending on the browser's own
// timezone offset. Pure calendar arithmetic on Y-M-D components stays
// correct as long as parsing and formatting both stay in local time
// consistently, which is all jansa silak's day-by-day rollover needs
// (unlike todayKeyIST(), this isn't about "what day is it right now"
// — it's arithmetic on dates already decided).
function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toDateKey(date) {
  return format(date, 'yyyy-MM-dd')
}

// Every calendar day from `startKey` to `endKey`, inclusive — jansa
// silak's opening balance carries forward day to day (phases.md
// Phase 7), including days with zero activity (their closing balance
// is just their opening balance, unchanged), so the rollover needs
// every day walked, not just days that happen to have entries.
export function eachDateKeyInRange(startKey, endKey) {
  const start = parseDateKey(startKey)
  const end = parseDateKey(endKey)
  const keys = []
  for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
    keys.push(toDateKey(d))
  }
  return keys
}

// Calendar-month bounds (not financial-year) for jansa silak's
// monthly export.
export function monthBounds(dateKey = todayKeyIST()) {
  const [year, month] = dateKey.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}
