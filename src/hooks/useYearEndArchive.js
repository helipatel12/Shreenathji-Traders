// Year-end archive — Phase 9. Detects crossing into a new financial
// year and offers a one-tap backup of everything from the year that
// just closed, bundled as a single zip (architecture.md §5b: client-
// side, JSZip, no Cloud Functions).
//
// "Prompted once" is tracked PER DEVICE via localStorage, not a
// Firestore flag on the business. Two reasons: (1) this is meant as a
// local safety-net download, and a multi-location business (prd.md
// §5) plausibly wants each location's own device to get its own
// backup copy rather than one device's dismissal silencing it
// everywhere; (2) it sidesteps a coordination problem — no need to
// worry about two devices racing to be "the one" that marks it
// prompted. This is a genuine interpretation call (phases.md doesn't
// specify "once" as per-device or business-wide) — flagged in
// memory.md's decisions log.
//
// A manual "download an archive for any past year" trigger also
// exists in Settings (Phase 8's Settings screen) for owners who
// dismissed the prompt, or want an older year's backup — the
// automatic prompt is a convenience, not the only way to get one.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBills } from './useBills'
import { usePayments } from './usePayments'
import { useVeparis } from './useVeparis'
import { useJansaSilakRange } from './useJansaSilak'
import { useAllVepariDakhlaSummary } from './useVepariDakhla'
import { getBillClearingInfo, excludeVoided } from '../utils/calc'
import { todayKeyIST, financialYearBounds, previousFinancialYearBounds } from '../utils/dates'
import { buildExcelBlobForArchive } from '../utils/export'
import { buildBillListRows } from '../features/bills/billExport'
import { buildAllVepariSummaryRows } from '../features/vepariDakhla/dakhlaExport'
import { buildRojmerRows } from '../features/rojmer/rojmerExport'
import { buildRangeRows as buildSilakRangeRows } from '../features/jansaSilak/silakExport'
import { buildVepariListRows } from '../features/settings/veparisExport'

const LOCAL_STORAGE_KEY = 'shreenath-traders:lastSeenFYStart'

// Should the "financial year closed" prompt show right now? True only
// once per device per rollover: the device's last-recorded FY start
// (localStorage) differs from the current one, AND there's actually
// data in the year that just closed (no point prompting an empty
// backup for a business that only just started).
export function useYearEndArchiveCheck() {
  const { bills: allBills } = useBills()
  const bills = useMemo(() => excludeVoided(allBills), [allBills])
  const [dismissed, setDismissed] = useState(false)

  const today = todayKeyIST()
  const currentFYStart = financialYearBounds(today).start
  const closedFY = previousFinancialYearBounds(today)

  const hasDataInClosedFY = useMemo(
    () => bills.some((b) => b.date >= closedFY.start && b.date <= closedFY.end),
    [bills, closedFY]
  )

  const [lastSeenFYStart, setLastSeenFYStart] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null
  )

  // First-ever visit on this device: just record the current FY
  // quietly, don't treat "no prior record" as a rollover to prompt
  // about — there's nothing to compare against yet.
  useEffect(() => {
    if (lastSeenFYStart === null && typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, currentFYStart)
      setLastSeenFYStart(currentFYStart)
    }
  }, [lastSeenFYStart, currentFYStart])

  const shouldPrompt =
    !dismissed &&
    hasDataInClosedFY &&
    lastSeenFYStart !== null &&
    lastSeenFYStart !== currentFYStart

  function dismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, currentFYStart)
    }
    setLastSeenFYStart(currentFYStart)
    setDismissed(true)
  }

  return { shouldPrompt, closedFY, dismiss }
}

// Gathers and zips everything for a given FY range (used by both the
// automatic prompt and Settings' manual re-trigger, which is why this
// is a separate hook from useYearEndArchiveCheck above — the check is
// about WHEN to offer it, this is about actually building it, and
// they don't always happen together).
export function useYearEndArchiveBuilder(fyStart, fyEnd) {
  const { bills: allBills, loading: billsLoading } = useBills()
  const { payments, loading: paymentsLoading } = usePayments()
  const { veparis, loading: veparisLoading } = useVeparis()
  const { rows: dakhlaRows, loading: dakhlaLoading } = useAllVepariDakhlaSummary(fyStart, fyEnd)
  const { days: silakDays, loading: silakLoading } = useJansaSilakRange(fyStart, fyEnd)

  const bills = useMemo(() => excludeVoided(allBills), [allBills])

  const loading =
    billsLoading || paymentsLoading || veparisLoading || dakhlaLoading || silakLoading

  const buildZip = useCallback(async () => {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()

    const fyBills = bills.filter((b) => b.date >= fyStart && b.date <= fyEnd)
    const billRows = buildBillListRows(fyBills, veparis)
    zip.file('bills.xlsx', await buildExcelBlobForArchive(billRows, 'Bills'))

    const dakhlaSummaryRows = buildAllVepariSummaryRows(dakhlaRows)
    zip.file('vepari_dakhla.xlsx', await buildExcelBlobForArchive(dakhlaSummaryRows, 'Dakhla'))

    const rojmerRows = fyBills.map((bill) => ({ bill, ...getBillClearingInfo(bill, payments) }))
    const rojmerExportRows = buildRojmerRows(rojmerRows, veparis, payments)
    zip.file('rojmer.xlsx', await buildExcelBlobForArchive(rojmerExportRows, 'Rojmer'))

    const silakRows = buildSilakRangeRows(silakDays)
    zip.file('jansa_silak.xlsx', await buildExcelBlobForArchive(silakRows, 'Silak'))

    const vepariListRows = buildVepariListRows(veparis)
    zip.file('vepari_master_list.xlsx', await buildExcelBlobForArchive(vepariListRows, 'Veparis'))

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shreenath-traders-archive-${fyStart}-to-${fyEnd}.zip`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [bills, payments, veparis, dakhlaRows, silakDays, fyStart, fyEnd])

  return { loading, buildZip }
}
