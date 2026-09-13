// Shared jansa-silak auto entries — dashboard KPI and Silak screen
// must use the same formula.
//
// Owner-confirmed (2026-09-08, updated 2026-09-12):
//   જમા = that day's total commission
//        + that day's total shes + tolai
//        + khedut rojmer pending (bill total − payments up to that day)
//   ઉધાર = vepari dakhla totals (કુલ બેસણું, one line per vepari per day)
//        + that day's cleared cheques (rojmer payments type=cheque)
//        + manual entries
//   (Auto cash payments are NOT auto-posted.)
//   Opening balance still rolls from previous closing.

import {
  excludeVoided,
  isRecordVoided,
  resolveRates,
  computeDakhlaLine,
  roundCurrency,
} from './calc'
import { findVepari, vepariDisplayName, vepariStableId } from './vepari'

function paymentsOnOrBefore(payments, billId, dateKey) {
  return excludeVoided(payments)
    .filter((p) => p.billId === billId && p.date && p.date <= dateKey)
    .reduce((sum, p) => roundCurrency(sum + (p.amount || 0)), 0)
}

function balanceAsOf(bill, payments, dateKey) {
  const paid = paymentsOnOrBefore(payments, bill.firestoreId, dateKey)
  return roundCurrency((bill.totalAmount || 0) - paid)
}

/**
 * Dates when a bill's pending should appear: bill date + each payment date.
 */
function pendingDatesForBill(bill, payments) {
  const dates = new Set()
  if (bill.date) dates.add(bill.date)
  for (const p of excludeVoided(payments)) {
    if (p.billId === bill.firestoreId && p.date) dates.add(p.date)
  }
  return [...dates].sort()
}

export function buildSilakLedgerEntries({
  bills,
  payments,
  veparis,
  business,
  manualEntries = [],
  t,
}) {
  const auto = []
  const commissionByDate = new Map()
  const shesTolaiByDate = new Map()
  const dakhlaByDateVepari = new Map()

  const entryLabel = t ? t('bills.entryNumberLabel') : 'No.'
  const commissionLabel = t ? t('silak.commissionTotalLabel') : 'Commission'
  const shesTolaiLabel = t ? t('silak.shesTolaiTotalLabel') : 'Shes + tolai'
  const pendingLabel = t ? t('silak.pendingRojmerLabel') : 'Pending (rojmer)'
  const chequeLabel = t ? t('silak.clearedChequeLabel') : 'Cleared cheque'

  for (const bill of bills) {
    if (isRecordVoided(bill) || !bill.date) continue
    const vepari = findVepari(veparis, bill.vepariId)
    const line = computeDakhlaLine(bill, resolveRates(vepari, business))
    const vepariName = vepari?.name || vepariDisplayName(veparis, bill.vepariId) || '—'
    const vepariKey = vepariStableId(vepari) || String(bill.vepariId || 'unknown')
    const groupKey = `${bill.date}|${vepariKey}`

    if (line.commission > 0) {
      const existing = commissionByDate.get(bill.date)
      if (existing) {
        existing.amount = roundCurrency(existing.amount + line.commission)
      } else {
        commissionByDate.set(bill.date, {
          date: bill.date,
          side: 'jama',
          label: commissionLabel,
          amount: line.commission,
          isManual: false,
          key: `jama-commission-${bill.date}`,
        })
      }
    }

    const shesTolai = roundCurrency((line.shes || 0) + (line.tolai || 0))
    if (shesTolai > 0) {
      const existing = shesTolaiByDate.get(bill.date)
      if (existing) {
        existing.amount = roundCurrency(existing.amount + shesTolai)
      } else {
        shesTolaiByDate.set(bill.date, {
          date: bill.date,
          side: 'jama',
          label: shesTolaiLabel,
          amount: shesTolai,
          isManual: false,
          key: `jama-shes-tolai-${bill.date}`,
        })
      }
    }

    // ઉધાર — vepari dakhla (one line per vepari per day)
    const existingDakhla = dakhlaByDateVepari.get(groupKey)
    if (existingDakhla) {
      existingDakhla.amount = roundCurrency(existingDakhla.amount + (line.total || 0))
      existingDakhla.billCount += 1
    } else {
      dakhlaByDateVepari.set(groupKey, {
        date: bill.date,
        side: 'udhar',
        label: vepariName,
        amount: line.total || 0,
        billCount: 1,
        isManual: false,
        key: `udhar-dakhla-${bill.date}-${vepariKey}`,
      })
    }

    // Khedut rojmer pending — one line per bill on its latest activity day
    // (bill date or last payment date). Example: ₹42,450 − pay ₹2,450 → ₹40,000.
    const farmer = bill.farmerName || '—'
    const note = `${entryLabel} ${bill.entryNumber}`
    const activityDates = pendingDatesForBill(bill, payments)
    const asOfDate = activityDates[activityDates.length - 1]
    if (asOfDate) {
      const pending = balanceAsOf(bill, payments, asOfDate)
      if (pending > 0.005) {
        auto.push({
          date: asOfDate,
          side: 'jama',
          label: `${pendingLabel} — ${note} — ${farmer}`.trim(),
          amount: pending,
          isManual: false,
          createdBy: bill.createdBy || null,
          createdByName: bill.createdByName || null,
          key: `jama-pending-${bill.firestoreId || bill.id}`,
        })
      }
    }
  }

  for (const row of commissionByDate.values()) auto.push(row)
  for (const row of shesTolaiByDate.values()) auto.push(row)

  for (const row of dakhlaByDateVepari.values()) {
    if (row.billCount > 1) {
      row.label = `${row.label} (${row.billCount})`
    }
    delete row.billCount
    auto.push(row)
  }

  // That day's cleared cheques (rojmer cheque payments) → ઉધાર
  // Cash payments are intentionally not auto-posted.
  for (const payment of excludeVoided(payments)) {
    if (!payment.date || !payment.billId) continue
    if (String(payment.type || '').toLowerCase() !== 'cheque') continue
    const bill = bills.find((b) => b.firestoreId === payment.billId)
    if (!bill || isRecordVoided(bill)) continue
    const farmer = bill.farmerName || ''
    auto.push({
      date: payment.date,
      side: 'udhar',
      label: `${chequeLabel} — ${farmer}`.trim(),
      amount: payment.amount,
      isManual: false,
      createdBy: payment.createdBy || null,
      createdByName: payment.createdByName || null,
      key: `udhar-cheque-${payment.firestoreId || payment.id}`,
    })
  }

  const manual = (manualEntries || [])
    .filter((entry) => !isRecordVoided(entry))
    .map((entry) => ({ ...entry, key: `manual-${entry.id}` }))

  return [...auto, ...manual]
}
