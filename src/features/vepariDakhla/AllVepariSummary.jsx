// Dakhla → All veparis: one row per vepari per day (combined bills,
// one દાખલા નં., combined total owed).

import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBills } from '../../hooks/useBills'
import { useBusiness } from '../../hooks/useBusiness'
import { useAllVepariDakhlaSummary } from '../../hooks/useVepariDakhla'
import { useLocale } from '../../context/LocaleContext'
import { todayKeyIST, formatDisplayDate, orderedDateRange } from '../../utils/dates'
import { sortByNoteOrDate, noteSortFilter, dateSortFilter } from '../../utils/tableSort'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { resolveCreatedByName } from '../../utils/createdBy'
import { printDakhla } from './dakhlaPrint'
import { buildAllVepariDayRows, buildAllVepariDayPdfColumns } from './dakhlaExport'

export default function AllVepariSummary() {
  const { user, isOwner } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const { updateBill } = useBills()
  const { business } = useBusiness()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('dakhlaNumber')
  const [sortDir, setSortDir] = useState('asc')
  const [editingKey, setEditingKey] = useState(null)
  const [draftNumber, setDraftNumber] = useState('')
  const [numberError, setNumberError] = useState('')
  const range = orderedDateRange(fromDate, toDate)
  const { dayGroups, loading } = useAllVepariDakhlaSummary(range.fromDate, range.toDate)

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = dayGroups.filter((g) => {
      if (!q) return true
      const hay = [
        g.vepari?.name,
        g.vepari?.village,
        g.dakhlaNumber,
        g.date,
        formatDisplayDate(g.date),
        ...(g.entryNumbers || []),
        ...g.lines.map((l) => l.bill.farmerName || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    return sortByNoteOrDate(filtered, {
      sortKey,
      sortDir,
      getNote: (g) => g.dakhlaNumber,
      getDate: (g) => g.date,
    })
  }, [dayGroups, search, sortKey, sortDir])

  function setNoteSort(value) {
    setSortKey('dakhlaNumber')
    setSortDir(value || 'asc')
  }

  function setDateSort(value) {
    setSortKey('date')
    setSortDir(value || 'asc')
  }

  function startEditNumber(g) {
    setEditingKey(g.key)
    setDraftNumber(String(g.dakhlaNumber ?? ''))
    setNumberError('')
  }

  async function saveDakhlaNumber(g) {
    setNumberError('')
    try {
      await updateBill(g.seedBillId, { dakhlaNumber: draftNumber }, user?.email)
      setEditingKey(null)
    } catch (err) {
      if (err?.message === 'DAKHLA_NUMBER_TAKEN') {
        setNumberError(t('bills.dakhlaNumberTaken'))
        return
      }
      throw err
    }
  }

  async function doExport(format) {
    const exportRows = buildAllVepariDayRows(visibleGroups)
    const rangeLabel =
      fromDate || toDate ? `${fromDate || 'start'}_to_${toDate || todayKeyIST()}` : 'all'
    const filename = `dakhla_all_${rangeLabel}`
    const title = 'Vepari Dakhla — All veparis'
    if (format === 'excel') await exportRowsToExcel(exportRows, filename, 'Dakhla')
    if (format === 'csv') await exportRowsToCSV(exportRows, filename)
    if (format === 'pdf')
      await exportRowsToPDF(exportRows, buildAllVepariDayPdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(
      buildAllVepariDayRows(visibleGroups),
      buildAllVepariDayPdfColumns(),
      'Vepari Dakhla — All veparis',
    )
  }

  async function exportOne(g, format) {
    const exportRows = buildAllVepariDayRows([g])
    const filename = `dakhla_${g.dakhlaNumber || g.date}`
    const title = `Dakhla — ${g.vepari?.name || ''} — ${g.date}`
    if (format === 'excel') await exportRowsToExcel(exportRows, filename, 'Dakhla')
    if (format === 'csv') await exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') await exportRowsToPDF(exportRows, buildAllVepariDayPdfColumns(), filename, title)
  }

  function printOne(g) {
    printDakhla(g.vepari, g.lines, g.totals.total, { business, totals: g.totals })
  }

  const columns = [
    {
      key: 'dakhlaNumber',
      header: t('bills.dakhlaNumberLabel'),
      filter: noteSortFilter(t, sortKey, sortDir, setNoteSort),
      render: (g) =>
        editingKey === g.key ? (
          <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              inputMode="numeric"
              value={draftNumber}
              onChange={(e) => setDraftNumber(e.target.value)}
              className="text-body text-ink bg-surface border border-border rounded-lg py-1.5 px-2 w-24 font-numeric"
              aria-label={t('bills.dakhlaNumberLabel')}
            />
            {numberError && <p className="text-caption text-danger">{numberError}</p>}
            <div className="flex gap-1">
              <button
                type="button"
                className="text-caption text-accent font-semibold"
                onClick={() => saveDakhlaNumber(g)}
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                className="text-caption text-ink-muted"
                onClick={() => setEditingKey(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="font-numeric font-semibold">{formatDigits(g.dakhlaNumber)}</span>
            {isOwner && (
              <button
                type="button"
                className="min-h-8 min-w-8 inline-flex items-center justify-center text-ink-muted hover:text-accent"
                aria-label={t('common.edit')}
                onClick={(e) => {
                  e.stopPropagation()
                  startEditNumber(g)
                }}
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ),
    },
    {
      key: 'date',
      header: t('bills.dateLabel'),
      filter: dateSortFilter(t, sortKey, sortDir, setDateSort),
      render: (g) => (
        <span className="font-numeric whitespace-nowrap">{formatDate(g.date)}</span>
      ),
    },
    {
      key: 'vepari',
      header: t('bills.vepariLabel'),
      render: (g) => (
        <div>
          <p className="font-semibold">{g.vepari?.name}</p>
          <p className="text-caption text-ink-muted">{g.vepari?.village}</p>
        </div>
      ),
    },
    {
      key: 'bills',
      header: t('dakhla.billCountLabel'),
      align: 'right',
      render: (g) => (
        <div>
          <span className="font-numeric font-semibold">{formatDigits(g.billCount)}</span>
          <p className="text-caption text-ink-muted font-numeric">
            {g.entryNumbers.map((n) => formatDigits(n)).join(', ')}
          </p>
        </div>
      ),
    },
    {
      key: 'total',
      header: t('dakhla.totalLabel'),
      align: 'right',
      render: (g) => <span className="font-semibold">{formatCurrency(g.totals.total)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (g) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printOne(g)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOne(g, 'excel')}
            onExportCSV={() => exportOne(g, 'csv')}
            onExportPDF={() => exportOne(g, 'pdf')}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          rows={visibleGroups}
          rowKey={(g) => g.key}
          selectedKey={selectedId}
          onRowClick={(g) => setSelectedId((cur) => (cur === g.key ? null : g.key))}
          empty={<p className="text-body text-ink-muted">{t('dakhla.noSummary')}</p>}
          meta={t('common.showingCount', { count: formatDigits(visibleGroups.length) })}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('dakhla.searchPlaceholder')}
              actions={
                <>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    aria-label={t('common.from')}
                    className="text-body text-ink bg-surface border border-border rounded-lg py-2 px-3 min-h-10"
                  />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    aria-label={t('common.to')}
                    className="text-body text-ink bg-surface border border-border rounded-lg py-2 px-3 min-h-10"
                  />
                  {visibleGroups.length > 0 && (
                    <>
                      <PrintButton onClick={handlePrint} />
                      <ExportMenu
                        label={t('dakhla.exportSummary')}
                        onExportExcel={() => doExport('excel')}
                        onExportCSV={() => doExport('csv')}
                        onExportPDF={() => doExport('pdf')}
                      />
                    </>
                  )}
                </>
              }
            />
          }
          renderExpanded={(g) => (
            <ul className="text-caption text-ink-muted space-y-1">
              {g.lines.map((line) => (
                <li key={line.bill.firestoreId || line.bill.id}>
                  {t('bills.entryNumberLabel')} {formatDigits(line.bill.entryNumber)} ·{' '}
                  {line.bill.farmerName} · {formatCurrency(line.total)}
                  <span className="block">
                    {t('common.createdBy')}: {resolveCreatedByName(line.bill, user)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        />
      )}
    </div>
  )
}
