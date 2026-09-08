// Jansa Silak (daily cash position) — Phase 7.
//
// Owner-confirmed (2026-09-08):
//   જમા = day commission + day shes/tolai + khedut pending (rojmer) + cleared cheques
//   ઉધાર = vepari dakhla (per vepari per day) + manual entries
//   (Auto cash payments are not in udhar.)
//   Opening = previous day's closing

import { useMemo } from 'react'
import { useBills } from './useBills'
import { usePayments } from './usePayments'
import { useSilakEntries } from './useSilakEntries'
import { useVeparis } from './useVeparis'
import { useBusiness } from './useBusiness'
import { useLocale } from '../context/LocaleContext'
import {
  computeSilakDay,
  excludeVoided,
  resolveRates,
  computeDakhlaLine,
  sumDakhlaLines,
  roundCurrency,
} from '../utils/calc'
import { findVepari } from '../utils/vepari'
import { eachDateKeyInRange } from '../utils/dates'
import { buildSilakLedgerEntries } from '../utils/silakLedger'

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
  const { t } = useLocale()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const allEntries = useMemo(
    () =>
      buildSilakLedgerEntries({
        bills,
        payments,
        veparis,
        business,
        manualEntries,
        t,
      }),
    [bills, payments, veparis, business, manualEntries, t],
  )

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

    const byDate = new Map()
    for (const entry of allEntries) {
      if (!entry?.date) continue
      const list = byDate.get(entry.date)
      if (list) list.push(entry)
      else byDate.set(entry.date, [entry])
    }

    let runningBalance = 0
    let result = null
    for (const dateKey of dateKeys) {
      const dayEntries = byDate.get(dateKey) || []
      const { jamaTotal, udharTotal, closingBalance } = computeSilakDay(dayEntries, runningBalance)
      if (dateKey === selectedDate) {
        const dayBills = bills.filter((b) => b.date === dateKey)
        const fees = computeDayFeeTotals(dayBills, veparis, business)
        result = {
          date: dateKey,
          entries: dayEntries.slice().sort((a, b) => (a.key < b.key ? -1 : 1)),
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
