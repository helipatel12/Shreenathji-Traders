// Phase 10 — CA / reporting aggregates. Read-only derived view over
// bills + payments + vepari rates (prd.md §4.7). No new collection.

import { useMemo } from 'react'
import { useBills } from './useBills'
import { usePayments } from './usePayments'
import { useVeparis } from './useVeparis'
import { useBusiness } from './useBusiness'
import {
  excludeVoided,
  resolveRates,
  computeDakhlaLine,
  sumDakhlaLines,
  getBillClearingInfo,
  roundCurrency,
} from '../utils/calc'
import { findVepari, vepariDisplayName, vepariStableId } from '../utils/vepari'

function inRange(date, fromDate, toDate) {
  if (fromDate && date < fromDate) return false
  if (toDate && date > toDate) return false
  return true
}

export function useCaReport(fromDate, toDate) {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { payments, loading: paymentsLoading } = usePayments()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { business, loading: businessLoading } = useBusiness()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const filteredBills = useMemo(
    () => bills.filter((b) => inRange(b.date, fromDate, toDate)),
    [bills, fromDate, toDate],
  )

  const billRows = useMemo(() => {
    return filteredBills
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map((bill) => {
        const clearing = getBillClearingInfo(bill, payments)
        return {
          bill,
          vepariName: vepariDisplayName(veparis, bill.vepariId),
          ...clearing,
        }
      })
  }, [filteredBills, payments, veparis])

  const vepariRows = useMemo(() => {
    return veparis
      .map((vepari) => {
        const rates = resolveRates(vepari, business)
        const vepariBills = filteredBills.filter((b) => {
          const id = String(b.vepariId)
          const stable = vepariStableId(vepari)
          return id === stable || id === String(vepari.id)
        })
        const lines = vepariBills.map((bill) => computeDakhlaLine(bill, rates))
        const totals = sumDakhlaLines(lines)
        return {
          vepari,
          billCount: vepariBills.length,
          totals,
        }
      })
      .filter((row) => row.billCount > 0)
      .sort((a, b) => b.totals.commission - a.totals.commission)
  }, [veparis, business, filteredBills])

  const outstanding = useMemo(() => {
    return billRows
      .filter((row) => !row.isCleared && row.balance > 0.005)
      .sort((a, b) => b.balance - a.balance)
  }, [billRows])

  const summary = useMemo(() => {
    const goodsTotal = roundCurrency(
      filteredBills.reduce((s, b) => s + (b.totalAmount || 0), 0),
    )
    const commissionEarned = roundCurrency(
      vepariRows.reduce((s, r) => s + (r.totals.commission || 0), 0),
    )
    const tolaiTotal = roundCurrency(
      vepariRows.reduce((s, r) => s + (r.totals.tolai || 0), 0),
    )
    const shesTotal = roundCurrency(
      vepariRows.reduce((s, r) => s + (r.totals.shes || 0), 0),
    )
    const dakhlaTotal = roundCurrency(
      vepariRows.reduce((s, r) => s + (r.totals.total || 0), 0),
    )
    const outstandingAmount = roundCurrency(
      outstanding.reduce((s, r) => s + r.balance, 0),
    )
    return {
      billCount: filteredBills.length,
      goodsTotal,
      commissionEarned,
      tolaiTotal,
      shesTotal,
      dakhlaTotal,
      outstandingCount: outstanding.length,
      outstandingAmount,
    }
  }, [filteredBills, vepariRows, outstanding])

  return {
    loading: billsLoading || paymentsLoading || veparisLoading || businessLoading,
    billRows,
    vepariRows,
    outstanding,
    summary,
    findVepari: (id) => findVepari(veparis, id),
  }
}
