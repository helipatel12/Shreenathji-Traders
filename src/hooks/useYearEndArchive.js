// Year-end archive — Phase 9. Detects crossing into a new financial
// year and offers a one-tap backup of everything from the year that
// just closed, bundled as a single zip (architecture.md §5b: client-
// side, JSZip, no Cloud Functions).
//
// "Prompted once" is tracked PER DEVICE via localStorage, not a
// Firestore flag on the business. See memory.md decisions log.
//
// Manual re-download lives in Settings (YearEndArchiveSection).

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

function sheetRowsOrPlaceholder(rows, emptyNote) {
  if (Array.isArray(rows) && rows.length > 0) return rows
  return [{ Note: emptyNote }]
}

export function useYearEndArchiveCheck() {
  const { bills: allBills } = useBills()
  const bills = useMemo(() => excludeVoided(allBills), [allBills])
  const [dismissed, setDismissed] = useState(false)

  const today = todayKeyIST()
  const currentFYStart = financialYearBounds(today).start
  const closedFY = previousFinancialYearBounds(today)

  const hasDataInClosedFY = useMemo(
    () => bills.some((b) => b.date >= closedFY.start && b.date <= closedFY.end),
    [bills, closedFY],
  )

  const [lastSeenFYStart, setLastSeenFYStart] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) : null,
  )

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
    if (!fyStart || !fyEnd) {
      throw new Error('Financial year range is missing')
    }

    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    const emptyNote = `No records for ${fyStart} to ${fyEnd}`

    const fyBills = bills.filter((b) => b.date >= fyStart && b.date <= fyEnd)
    const billRows = sheetRowsOrPlaceholder(buildBillListRows(fyBills, veparis), emptyNote)
    zip.file('bills.xlsx', await buildExcelBlobForArchive(billRows, 'Bills'))

    const dakhlaSummaryRows = sheetRowsOrPlaceholder(
      buildAllVepariSummaryRows(dakhlaRows),
      emptyNote,
    )
    zip.file('vepari_dakhla.xlsx', await buildExcelBlobForArchive(dakhlaSummaryRows, 'Dakhla'))

    const rojmerRows = fyBills.map((bill) => ({ bill, ...getBillClearingInfo(bill, payments) }))
    const rojmerExportRows = sheetRowsOrPlaceholder(
      buildRojmerRows(rojmerRows, veparis, payments),
      emptyNote,
    )
    zip.file('rojmer.xlsx', await buildExcelBlobForArchive(rojmerExportRows, 'Rojmer'))

    // Only days with cash movement — a full FY of empty ledger days
    // bloated the zip and made the download feel broken/hung.
    const activeSilakDays = silakDays.filter(
      (d) => Number(d.jamaTotal) !== 0 || Number(d.udharTotal) !== 0,
    )
    const silakRows = sheetRowsOrPlaceholder(buildSilakRangeRows(activeSilakDays), emptyNote)
    zip.file('jansa_silak.xlsx', await buildExcelBlobForArchive(silakRows, 'Silak'))

    const vepariListRows = sheetRowsOrPlaceholder(buildVepariListRows(veparis), 'No veparis')
    zip.file('vepari_master_list.xlsx', await buildExcelBlobForArchive(vepariListRows, 'Veparis'))

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    if (!blob || blob.size < 64) {
      throw new Error('Archive file was empty')
    }

    const url = URL.createObjectURL(blob)
    try {
      const link = document.createElement('a')
      link.href = url
      link.download = `shreenath-traders-archive-${fyStart}-to-${fyEnd}.zip`
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      // Revoke after the browser has a chance to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 1500)
    }
  }, [bills, payments, veparis, dakhlaRows, silakDays, fyStart, fyEnd])

  return { loading, buildZip }
}
