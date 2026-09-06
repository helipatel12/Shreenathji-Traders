// Jansa Silak (daily cash position) — Phase 7. Auto-populated જમા/
// ઉધાર from bills + vepari dakhla + cleared rojmer payments, plus
// manual entries, rolled forward day by day (opening = previous closing).
//
// Owner-confirmed interpretation (2026-09-06):
//   જમા (credit)  = each bill's goods amount on the bill date
//                    + 1 row: that day's total commission
//                    + 1 row: that day's total shes + tolai
//   ઉધાર (debit)  = that day's vepari-dakhla totals (કુલ બેસણું, one line per vepari)
//                    + that day's cleared amounts (non-voided rojmer
//                    payments on active bills)
//   Manual entries stay as entered (jama or udhar)

import { useMemo } from 'react'
import { useBills } from './useBills'
import { usePayments } from './usePayments'
import { useSilakEntries } from './useSilakEntries'
import { useVeparis } from './useVeparis'
import { useBusiness } from './useBusiness'
import {
  computeSilakDay,
  excludeVoided,
  isRecordVoided,
  resolveRates,
  computeDakhlaLine,
  sumDakhlaLines,
  roundCurrency,
} from '../utils/calc'
import { findVepari, vepariDisplayName, vepariStableId } from '../utils/vepari'
import { eachDateKeyInRange } from '../utils/dates'
import gu from '../locales/gu.json'

function computeDayFeeTotals(dayBills, veparis, business) {
  const lines = dayBills.map((bill) => {
    const vepari = findVepari(veparis, bill.vepariId)
    return computeDakhlaLine(bill, resolveRates(vepari, business))
  })
  const fees = sumDakhlaLines(lines)
  return {
    commissionTotal: fees.commission,
    shesTolaiTotal: roundCurrency(fees.shes + fees.tolai),
  }
}

function useAllSilakEntries() {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { payments, loading: paymentsLoading } = usePayments()
  const {
    entries: manualEntries,
    loading: manualLoading,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useSilakEntries()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { business, loading: businessLoading } = useBusiness()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const allEntries = useMemo(() => {
    const auto = []
    const activeBillIds = new Set(bills.map((b) => b.firestoreId).filter(Boolean))
    // One ઉધાર dakhla line per vepari per day; fees are day totals (2 rows).
    const dakhlaByDateVepari = new Map()
    const commissionByDate = new Map()
    const shesTolaiByDate = new Map()

    for (const bill of bills) {
      if (isRecordVoided(bill) || !bill.date) continue
      const vepari = findVepari(veparis, bill.vepariId)
      const line = computeDakhlaLine(bill, resolveRates(vepari, business))
      const vepariName = vepari?.name || vepariDisplayName(veparis, bill.vepariId) || '—'
      const vepariKey = vepariStableId(vepari) || String(bill.vepariId || 'unknown')
      const note = `${gu.bills.entryNumberLabel} ${bill.entryNumber}`
      const farmer = bill.farmerName || ''
      const groupKey = `${bill.date}|${vepariKey}`

      // જમા — goods side (farmer / bill)
      auto.push({
        date: bill.date,
        side: 'jama',
        label: `${note} — ${farmer}`.trim(),
        amount: line.goodsAmount,
        isManual: false,
        key: `jama-${bill.firestoreId || bill.id}`,
      })

      if (line.commission > 0) {
        const existing = commissionByDate.get(bill.date)
        if (existing) {
          existing.amount = roundCurrency(existing.amount + line.commission)
        } else {
          commissionByDate.set(bill.date, {
            date: bill.date,
            side: 'jama',
            label: gu.silak.commissionTotalLabel,
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
            label: gu.silak.shesTolaiTotalLabel,
            amount: shesTolai,
            isManual: false,
            key: `jama-shes-tolai-${bill.date}`,
          })
        }
      }

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

    // ઉધાર — cleared amounts (rojmer payments on active bills, by payment date)
    for (const payment of excludeVoided(payments)) {
      if (!payment.billId || !activeBillIds.has(payment.billId) || !payment.date) continue
      const bill = bills.find((b) => b.firestoreId === payment.billId)
      auto.push({
        date: payment.date,
        side: 'udhar',
        label: `ચુકવણી — ${bill ? bill.farmerName : ''}`.trim(),
        amount: payment.amount,
        isManual: false,
        key: `udhar-cleared-${payment.firestoreId || payment.id}`,
      })
    }

    const manual = manualEntries
      .filter((entry) => !isRecordVoided(entry))
      .map((entry) => ({ ...entry, key: `manual-${entry.id}` }))

    return [...auto, ...manual]
  }, [bills, payments, veparis, business, manualEntries])

  const earliestDate = useMemo(() => {
    const dates = allEntries.map((e) => e.date).filter(Boolean)
    return dates.length ? dates.reduce((min, d) => (d < min ? d : min)) : null
  }, [allEntries])

  return {
    allEntries,
    bills,
    veparis,
    business,
    earliestDate,
    loading:
      billsLoading ||
      paymentsLoading ||
      manualLoading ||
      veparisLoading ||
      businessLoading,
    addEntry,
    updateEntry,
    deleteEntry,
  }
}

export function useJansaSilak(selectedDate) {
  const {
    allEntries,
    bills,
    veparis,
    business,
    earliestDate,
    loading,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useAllSilakEntries()

  const day = useMemo(() => {
    if (!selectedDate) return null
    const startDate = earliestDate && earliestDate < selectedDate ? earliestDate : selectedDate
    const dateKeys = eachDateKeyInRange(startDate, selectedDate)
    let runningBalance = 0
    let result = null
    for (const dateKey of dateKeys) {
      const dayEntries = allEntries.filter((e) => e.date === dateKey)
      const { jamaTotal, udharTotal, closingBalance } = computeSilakDay(dayEntries, runningBalance)
      if (dateKey === selectedDate) {
        const dayBills = bills.filter((b) => b.date === dateKey)
        const fees = computeDayFeeTotals(dayBills, veparis, business)
        result = {
          date: dateKey,
          entries: dayEntries.sort((a, b) => (a.key < b.key ? -1 : 1)),
          openingBalance: runningBalance,
          jamaTotal,
          udharTotal,
          closingBalance,
          ...fees,
        }
      }
      runningBalance = closingBalance
    }
    return result
  }, [allEntries, bills, veparis, business, earliestDate, selectedDate])

  return { loading, day, addEntry, updateEntry, deleteEntry }
}

export function useJansaSilakRange(fromDate, toDate) {
  const { allEntries, bills, veparis, business, earliestDate, loading } = useAllSilakEntries()

  const { days, rangeFees } = useMemo(() => {
    if (!fromDate || !toDate) {
      return { days: [], rangeFees: { commissionTotal: 0, shesTolaiTotal: 0 } }
    }
    const startDate = earliestDate && earliestDate < fromDate ? earliestDate : fromDate
    const dateKeys = eachDateKeyInRange(startDate, toDate)

    const byDate = new Map()
    for (const entry of allEntries) {
      if (!entry?.date) continue
      const list = byDate.get(entry.date)
      if (list) list.push(entry)
      else byDate.set(entry.date, [entry])
    }

    let runningBalance = 0
    const results = []
    let commissionTotal = 0
    let shesTolaiTotal = 0
    for (const dateKey of dateKeys) {
      const dayEntries = byDate.get(dateKey) || []
      const { jamaTotal, udharTotal, closingBalance } = computeSilakDay(dayEntries, runningBalance)
      if (dateKey >= fromDate) {
        const dayBills = bills.filter((b) => b.date === dateKey)
        const fees = computeDayFeeTotals(dayBills, veparis, business)
        commissionTotal = roundCurrency(commissionTotal + fees.commissionTotal)
        shesTolaiTotal = roundCurrency(shesTolaiTotal + fees.shesTolaiTotal)
        results.push({
          date: dateKey,
          entries: dayEntries.slice().sort((a, b) => (a.key < b.key ? -1 : 1)),
          openingBalance: runningBalance,
          jamaTotal,
          udharTotal,
          closingBalance,
          ...fees,
        })
      }
      runningBalance = closingBalance
    }
    return {
      days: results,
      rangeFees: { commissionTotal, shesTolaiTotal },
    }
  }, [allEntries, bills, veparis, business, earliestDate, fromDate, toDate])

  return { loading, days, rangeFees }
}
