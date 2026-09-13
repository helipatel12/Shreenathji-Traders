// Single source of truth for all money math — tolai, shes, commission,
// bill/dakhla/rojmer totals (rules.md §3, prd.md §4.2). No component may
// reimplement a formula inline; everything resolves rates as
// `vepari.customRates ?? business.defaultRates`.
//
// Do not change these formulas without explicit confirmation from the
// project owner (rules.md §6) — they are real money calculations tied
// to actual business rates. Tolai/shes/commission formulas are
// implemented starting in Phase 5 (vepariDakhla) — see phases.md.

// All currency math rounds to 2 decimals at the point of computation,
// never left to float drift (rules.md §3).
export function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

// Balances are always derived, never stored (architecture.md §7,
// rules.md §3) — a bill's remaining balance is its total minus the
// sum of payments recorded against it.
//
// Matches on `bill.firestoreId`, NOT `bill.id` — `bill.id` means two
// different things depending on where the bill object came from: a
// Dexie-sourced bill has `id` as Dexie's own local auto-increment
// integer (device-specific, never synced), while a Firestore-sourced
// bill in some hooks has `id` set to the Firestore document ID
// string. `firestoreId` is the one identifier guaranteed present and
// consistent everywhere — including fully offline, since
// useBills.js's addBill() generates and stores it on the local row
// up front, before any network round trip. A payment's own `billId`
// field is always this same `firestoreId` (see usePayments.js) —
// never a local Dexie id, which wouldn't mean anything on another
// device.
// Shared filter for excluding voided bills/payments from any
// calculation. A voided record stays in Dexie/Firestore for audit
// (rules.md §3 — never hard-deleted) but must never count toward
// totals, balances, dakhla, silak, dashboard, or archives.
export function isRecordVoided(record) {
  if (!record) return false
  const v = record.isVoided
  return v === true || v === 1 || v === 'true' || v === '1'
}

/** Hidden from books: voided or stuck pending hard-delete. */
export function isRecordExcluded(record) {
  return isRecordVoided(record) || record?.syncStatus === 'pendingDelete'
}

export function excludeVoided(records) {
  return (records || []).filter((r) => !isRecordExcluded(r))
}

export function getBillClearingInfo(bill, payments = []) {
  const billPayments = excludeVoided(payments)
    .filter((p) => p.billId === bill.firestoreId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let cumulative = 0
  let clearingDate = null
  const total = bill.totalAmount || 0
  for (const payment of billPayments) {
    cumulative = roundCurrency(cumulative + (payment.amount || 0))
    if (clearingDate === null && cumulative >= total - 0.005) {
      clearingDate = payment.date
    }
  }
  const balance = roundCurrency(total - cumulative)
  const isCleared = balance <= 0.005
  return { balance, isCleared, clearingDate: isCleared ? clearingDate : null, totalPaid: cumulative }
}

export function getBillBalance(bill, payments = []) {
  return getBillClearingInfo(bill, payments).balance
}

/**
 * Vepari settlement clearing — same algorithm as getBillClearingInfo,
 * but the obligation is the dakhla line total (goods + tolai + shes +
 * commission), not bill.totalAmount (farmer goods only).
 */
export function getDakhlaClearingInfo(bill, vepariPayments = [], rates) {
  const line = computeDakhlaLine(bill, rates)
  const total = line.total || 0
  const billPayments = excludeVoided(vepariPayments)
    .filter((p) => p.billId === bill.firestoreId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  let cumulative = 0
  let clearingDate = null
  for (const payment of billPayments) {
    cumulative = roundCurrency(cumulative + (payment.amount || 0))
    if (clearingDate === null && cumulative >= total - 0.005) {
      clearingDate = payment.date
    }
  }
  const balance = roundCurrency(total - cumulative)
  const isCleared = balance <= 0.005
  return {
    balance,
    isCleared,
    clearingDate: isCleared ? clearingDate : null,
    totalPaid: cumulative,
    dakhlaTotal: total,
    line,
  }
}

/**
 * Split a payment amount across bills FIFO (by entry number / date),
 * each capped at that bill's remaining dakhla balance.
 */
export function allocateVepariPaymentFifo(billLines, amount) {
  let remaining = roundCurrency(amount || 0)
  const allocations = []
  const ordered = (billLines || [])
    .slice()
    .sort((a, b) => {
      const ea = Number(a.bill?.entryNumber) || 0
      const eb = Number(b.bill?.entryNumber) || 0
      if (ea !== eb) return ea - eb
      return String(a.bill?.firestoreId || '').localeCompare(String(b.bill?.firestoreId || ''))
    })
  for (const line of ordered) {
    if (remaining <= 0.005) break
    const due = roundCurrency(line.balance || 0)
    if (due <= 0.005) continue
    const pay = roundCurrency(Math.min(due, remaining))
    if (pay <= 0.005) continue
    allocations.push({ billId: line.bill.firestoreId, amount: pay })
    remaining = roundCurrency(remaining - pay)
  }
  return allocations
}

/**
 * Aggregate per-bill dakhla clearing into one day-group total.
 */
export function summarizeVepariDayClearing(billLines) {
  let dakhlaTotal = 0
  let totalPaid = 0
  let balance = 0
  let clearingDate = null
  for (const line of billLines || []) {
    dakhlaTotal = roundCurrency(dakhlaTotal + (line.dakhlaTotal || 0))
    totalPaid = roundCurrency(totalPaid + (line.totalPaid || 0))
    balance = roundCurrency(balance + (line.balance || 0))
    if (line.isCleared && line.clearingDate) {
      if (!clearingDate || line.clearingDate > clearingDate) clearingDate = line.clearingDate
    }
  }
  const isCleared = balance <= 0.005
  return {
    dakhlaTotal,
    totalPaid,
    balance,
    isCleared,
    clearingDate: isCleared ? clearingDate : null,
  }
}

// Indian digit grouping (₹1,23,456.78), not Western (rules.md §3).
// en-IN's Intl support handles the lakh/crore grouping correctly.
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount) {
  return currencyFormatter.format(roundCurrency(amount || 0))
}

// Bill line-item amount — prd.md §4.1: rate is quoted "per 20kg,
// matching current paper convention," so amount = weight × (rate / 20).
// Phase 4's single source of truth for this — no component computes
// it inline (rules.md §3).
export function computeLineAmount(weightKg, ratePer20kg) {
  return roundCurrency(((weightKg || 0) * (ratePer20kg || 0)) / 20)
}

// A bill's total is the sum of its line items' amounts — recomputed
// from the items array, never stored as a separately-editable number
// (architecture.md §7).
export function computeBillTotal(items = []) {
  return roundCurrency(items.reduce((sum, item) => sum + (item.amount || 0), 0))
}

// Default business rates — prd.md §4.2's stated formulas, used as the
// fallback when a vepari has no customRates. Phase 8 ("Global default
// rates") will make these owner-editable and stored on the business
// doc; until then this hardcoded constant IS the business default —
// not a placeholder guess, these are the exact values prd.md specifies.
export const DEFAULT_RATES = {
  tolaiPerKg: 0.006,
  shesPercent: 0.7,
  commissionPercent: 0.45,
}

// Rate resolution order, exactly as rules.md §3 states it: vepari
// override, then business default, then hardcoded DEFAULT_RATES.
// No component should read vepari.customRates directly — always go
// through this function.
//
// Normalizes legacy short keys ({ tolai, shes, commission }) that an
// earlier VepariForm wrote, so custom-rate veparis never produce NaN
// in dakhla math which expects tolaiPerKg / shesPercent / commissionPercent.
export function normalizeRates(raw) {
  if (!raw || typeof raw !== 'object') return null
  const tolaiPerKg = Number(
    raw.tolaiPerKg != null ? raw.tolaiPerKg : raw.tolai,
  )
  const shesPercent = Number(
    raw.shesPercent != null ? raw.shesPercent : raw.shes,
  )
  const commissionPercent = Number(
    raw.commissionPercent != null ? raw.commissionPercent : raw.commission,
  )
  if ([tolaiPerKg, shesPercent, commissionPercent].some((n) => Number.isNaN(n))) {
    return null
  }
  return { tolaiPerKg, shesPercent, commissionPercent }
}

export function resolveRates(vepari, business) {
  return (
    normalizeRates(vepari?.customRates) ||
    normalizeRates(business?.defaultRates) ||
    DEFAULT_RATES
  )
}

// A single bill's vepari-dakhla line — tolai/shes/commission/total,
// per prd.md §4.2's formulas, all derived at read time and never
// stored (architecture.md §7: "calculated on read... not stored as a
// number that gets edited directly"). One consequence worth knowing:
// if a vepari's customRates change later, historical dakhla totals
// for their older bills recompute under the new rate too, rather than
// freezing the rate at entry time — this follows directly from "always
// derived," not a separate choice. See memory.md's decisions log.
/** Rate(s) per 20 kg for display — one value, or "a / b" when items differ. */
export function billRatePer20kgDisplay(bill) {
  const rates = (bill.items || [])
    .map((item) => item.ratePer20kg)
    .filter((r) => r != null && r !== '')
    .map((r) => Number(r))
    .filter((n) => Number.isFinite(n))
  if (!rates.length) return ''
  const unique = [...new Set(rates.map((n) => roundCurrency(n)))]
  return unique.length === 1 ? unique[0] : unique.join(' / ')
}

export function computeDakhlaLine(bill, rates) {
  const weightKg = (bill.items || []).reduce((sum, item) => sum + (item.weightKg || 0), 0)
  const goodsAmount = bill.totalAmount || 0
  const ratePer20kg = billRatePer20kgDisplay(bill)
  const tolai = roundCurrency(rates.tolaiPerKg * weightKg)
  const shes = roundCurrency((rates.shesPercent / 100) * goodsAmount)
  const commission = roundCurrency((rates.commissionPercent / 100) * goodsAmount)
  const total = roundCurrency(goodsAmount + tolai + shes + commission)
  return { weightKg, ratePer20kg, goodsAmount, tolai, shes, commission, total }
}

// Sums a list of already-computed dakhla lines into one totals object
// — used for both a single vepari's grand total and, added up further
// still, for the all-veparis summary view/export.
export function sumDakhlaLines(lines) {
  return lines.reduce(
    (acc, line) => ({
      weightKg: roundCurrency(acc.weightKg + line.weightKg),
      goodsAmount: roundCurrency(acc.goodsAmount + line.goodsAmount),
      tolai: roundCurrency(acc.tolai + line.tolai),
      shes: roundCurrency(acc.shes + line.shes),
      commission: roundCurrency(acc.commission + line.commission),
      total: roundCurrency(acc.total + line.total),
    }),
    { weightKg: 0, goodsAmount: 0, tolai: 0, shes: 0, commission: 0, total: 0 }
  )
}

// Jansa Silak (Phase 7) — a day's closing balance = opening + જમા
// (credit) − ઉધાર (debit). Pure arithmetic over already-gathered
// entries for one day; see useJansaSilak.js for what actually counts
// as જમા/ઉધાર for a given day and how opening balance rolls forward
// day to day (architecture.md §4: "daily closing balance is always
// computed, never stored as a mutable total").
export function computeSilakDay(entries, openingBalance) {
  const jamaTotal = roundCurrency(
    entries.filter((e) => e.side === 'jama').reduce((sum, e) => sum + (e.amount || 0), 0)
  )
  const udharTotal = roundCurrency(
    entries.filter((e) => e.side === 'udhar').reduce((sum, e) => sum + (e.amount || 0), 0)
  )
  const closingBalance = roundCurrency(openingBalance + jamaTotal - udharTotal)
  return { jamaTotal, udharTotal, openingBalance, closingBalance }
}
