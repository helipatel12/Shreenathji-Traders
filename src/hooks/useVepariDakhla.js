// Vepari Dakhla (auto-ledger) — Phase 5. No new Firestore collection:
// architecture.md §4 doesn't list one, because a dakhla is entirely a
// computed VIEW over existing bills + veparis — "calculated on read,
// not stored" (architecture.md §7). This hook just groups/derives;
// Phase 4's useBills() and Phase 3's useVeparis() remain the only
// sources of truth.

import { useMemo } from 'react'
import { useBills } from './useBills'
import { useVeparis } from './useVeparis'
import { useBusiness } from './useBusiness'
import { resolveRates, computeDakhlaLine, sumDakhlaLines, excludeVoided } from '../utils/calc'
import { findVepari, vepariStableId } from '../utils/vepari'

function billMatchesVepari(bill, vepari) {
  if (!vepari) return false
  const billId = String(bill.vepariId)
  const stable = vepariStableId(vepari)
  return billId === stable || billId === String(vepari.id)
}

export function useVepariDakhla(vepariId) {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { business, loading: businessLoading } = useBusiness()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])
  const vepari = findVepari(veparis, vepariId)
  const rates = resolveRates(vepari, business)

  const lines = useMemo(() => {
    if (!vepariId || !vepari) return []
    return bills
      .filter((b) => billMatchesVepari(b, vepari))
      .map((bill) => ({ bill, ...computeDakhlaLine(bill, rates) }))
      .sort((a, b) => (a.bill.date < b.bill.date ? -1 : a.bill.date > b.bill.date ? 1 : 0))
  }, [bills, vepariId, vepari, rates])

  const totals = useMemo(() => sumDakhlaLines(lines), [lines])

  return {
    vepari,
    rates,
    lines,
    totals,
    loading: billsLoading || veparisLoading || businessLoading,
  }
}

export function useAllVepariDakhlaSummary(fromDate, toDate) {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { business, loading: businessLoading } = useBusiness()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const dayGroups = useMemo(() => {
    const groups = new Map()
    for (const bill of bills) {
      if (fromDate && bill.date < fromDate) continue
      if (toDate && bill.date > toDate) continue
      if (!bill.date) continue
      const vepari = findVepari(veparis, bill.vepariId)
      if (!vepari) continue
      const vepariKey = vepariStableId(vepari) || String(bill.vepariId)
      const key = `${bill.date}|${vepariKey}`
      const rates = resolveRates(vepari, business)
      const line = { bill, ...computeDakhlaLine(bill, rates) }
      const existing = groups.get(key)
      if (existing) {
        existing.lines.push(line)
      } else {
        groups.set(key, {
          key,
          date: bill.date,
          vepari,
          vepariKey,
          lines: [line],
        })
      }
    }

    return [...groups.values()]
      .map((g) => {
        const totals = sumDakhlaLines(g.lines)
        const dakhlaNumber =
          g.lines.map((l) => Number(l.bill.dakhlaNumber)).find((n) => Number.isFinite(n) && n > 0) ??
          null
        const entryNumbers = g.lines
          .map((l) => l.bill.entryNumber)
          .filter((n) => n != null)
          .sort((a, b) => Number(a) - Number(b))
        return {
          ...g,
          totals,
          dakhlaNumber,
          billCount: g.lines.length,
          entryNumbers,
          billLocalIds: g.lines.map((l) => l.bill.id),
          seedBillId: g.lines[0]?.bill.id,
        }
      })
      .sort((a, b) => {
        const da = Number(a.dakhlaNumber) || 0
        const db = Number(b.dakhlaNumber) || 0
        if (da !== db) return da - db
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return String(a.vepari?.name || '').localeCompare(String(b.vepari?.name || ''))
      })
  }, [bills, veparis, business, fromDate, toDate])

  const rows = useMemo(() => {
    return veparis
      .map((vepari) => {
        const rates = resolveRates(vepari, business)
        const vepariBills = bills.filter((b) => {
          if (!billMatchesVepari(b, vepari)) return false
          if (fromDate && b.date < fromDate) return false
          if (toDate && b.date > toDate) return false
          return true
        })
        const vepariLines = vepariBills.map((bill) => computeDakhlaLine(bill, rates))
        return { vepari, billCount: vepariBills.length, totals: sumDakhlaLines(vepariLines) }
      })
      .filter((row) => row.billCount > 0)
  }, [bills, veparis, business, fromDate, toDate])

  return { dayGroups, rows, loading: billsLoading || veparisLoading || businessLoading }
}
