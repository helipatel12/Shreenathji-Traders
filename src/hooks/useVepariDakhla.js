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

// Single vepari's full ledger — every bill of theirs, each turned
// into a dakhla line via computeDakhlaLine(), sorted by date.
export function useVepariDakhla(vepariId) {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { business, loading: businessLoading } = useBusiness()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const vepari = veparis.find((v) => String(v.id) === String(vepariId))
  // Phase 8 made business.defaultRates real and owner-editable
  // (Settings → Default rates) — resolveRates() still falls back to
  // calc.js's hardcoded DEFAULT_RATES if the owner has never saved
  // their own, per rules.md §3's resolution order.
  const rates = resolveRates(vepari, business)

  const lines = useMemo(() => {
    if (!vepariId) return []
    return bills
      .filter((b) => String(b.vepariId) === String(vepariId))
      .map((bill) => ({ bill, ...computeDakhlaLine(bill, rates) }))
      .sort((a, b) => (a.bill.date < b.bill.date ? -1 : a.bill.date > b.bill.date ? 1 : 0))
  }, [bills, vepariId, rates])

  const totals = useMemo(() => sumDakhlaLines(lines), [lines])

  return {
    vepari,
    rates,
    lines,
    totals,
    loading: billsLoading || veparisLoading || businessLoading,
  }
}

// All-veparis summary — one row per vepari with bills in the given
// date range (inclusive), each resolving its OWN rates (a vepari with
// customRates doesn't get lumped in with the business default). Used
// by the "export all veparis for a date range" requirement (prd.md
// §4.2) — see phases.md Phase 5.
export function useAllVepariDakhlaSummary(fromDate, toDate) {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { business, loading: businessLoading } = useBusiness()

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const rows = useMemo(() => {
    return veparis
      .map((vepari) => {
        const rates = resolveRates(vepari, business)
        const vepariBills = bills.filter((b) => {
          if (String(b.vepariId) !== String(vepari.id)) return false
          if (fromDate && b.date < fromDate) return false
          if (toDate && b.date > toDate) return false
          return true
        })
        const lines = vepariBills.map((bill) => computeDakhlaLine(bill, rates))
        return { vepari, billCount: vepariBills.length, totals: sumDakhlaLines(lines) }
      })
      .filter((row) => row.billCount > 0)
  }, [bills, veparis, business, fromDate, toDate])

  return { rows, loading: billsLoading || veparisLoading || businessLoading }
}
