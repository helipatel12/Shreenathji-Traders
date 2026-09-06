// Jansa Silak (daily cash position) — Phase 7. Auto-populated જમા/
// ઉધાર entries derived from bills + rojmer (phases.md's own words),
// plus manual entries (useSilakEntries.js), rolled forward day by day
// so opening balance = the previous day's computed closing balance
// (architecture.md §4).
//
// Interpretation note (flagged for owner validation — see memory.md's
// decisions log): prd.md §4.4's wording for જમા/ઉધાર is a little
// ambiguous and this app doesn't yet track "cash actually collected
// from a vepari" as its own event (only what they OWE, via Phase 5's
// dakhla). Given Phase 7's own stated dependency is "bills + rojmer +
// vepari dakhla" specifically (not a new vepari-payment feature),
// this hook treats:
//   જમા (credit)  = each bill's goods amount, on the bill's date —
//                    the value newly "held" the moment a sale is
//                    recorded (prd.md: "money currently held...
//                    includes farmer balances not yet paid")
//   ઉધાર (debit)  = each non-voided rojmer payment, on the payment's
//                    date — money actually paid out to a farmer
// This is the most internally-consistent reading using only what's
// already built, but it hasn't been checked against the owner's own
// paper ledger or EX1.xlsx (phases.md's own "done when" for this
// phase). Worth confirming before trusting this for real bookkeeping.

import { useMemo } from 'react'
import { useBills } from './useBills'
import { usePayments } from './usePayments'
import { useSilakEntries } from './useSilakEntries'
import { useVeparis } from './useVeparis'
import { useBusiness } from './useBusiness'
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

  // A voided bill never contributes જમા, and a payment recorded
  // against a bill that's since been voided shouldn't contribute
  // ઉધાર either — the whole transaction is being treated as if it
  // didn't happen (calc.js's excludeVoided()).
  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const allEntries = useMemo(() => {
    const autoJama = bills.map((bill) => ({
      date: bill.date,
      side: 'jama',
      label: `${gu.bills.entryNumberLabel} ${bill.entryNumber} — ${bill.farmerName}`, // ledger labels stay Gujarati
      amount: bill.totalAmount,
      isManual: false,
      key: `bill-${bill.firestoreId}`,
    }))
    const autoUdhar = excludeVoided(payments)
      .filter((p) => bills.some((b) => b.firestoreId === p.billId))
      .map((payment) => {
        const bill = bills.find((b) => b.firestoreId === payment.billId)
        return {
          date: payment.date,
          side: 'udhar',
          label: `ચુકવણી — ${bill ? bill.farmerName : ''}`.trim(),
          amount: payment.amount,
          isManual: false,
          key: `payment-${payment.firestoreId}`,
        }
      })
    const manual = manualEntries.map((entry) => ({ ...entry, key: `manual-${entry.id}` }))
    return [...autoJama, ...autoUdhar, ...manual]
  }, [bills, payments, manualEntries])

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
    loading: billsLoading || paymentsLoading || manualLoading || veparisLoading || businessLoading,
    addEntry,
    updateEntry,
    deleteEntry,
  }
}

// One day's detail — entries, opening balance (rolled forward from
// the earliest activity date), totals, closing balance.
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

// A range of days (monthly/yearly export, phases.md Phase 7) — same
// rollover math, one summary row per day in [fromDate, toDate].
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
