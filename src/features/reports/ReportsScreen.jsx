// Phase 10 — CA / reporting (prd.md §4.7). Read-only FY / date-range
// view: bill list, vepari-wise totals, commission earned, outstanding
// rojmer. Export Excel/CSV/PDF for handing to the CA.

import { useMemo, useState } from 'react'
import { FileBarChart2 } from 'lucide-react'
import { useCaReport } from '../../hooks/useCaReport'
import { useBusiness } from '../../hooks/useBusiness'
import { useLocale } from '../../context/LocaleContext'
import { financialYearBounds, todayKeyIST, orderedDateRange } from '../../utils/dates'
import { sortByNoteOrDate, noteSortFilter, dateSortFilter } from '../../utils/tableSort'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable, SkeletonCard } from '../../components/Skeleton'
import { printBill } from '../bills/billPrint'
import {
  buildCaSummaryRows,
  buildCaBillRows,
  buildCaVepariRows,
  buildCaOutstandingRows,
  buildCaBillPdfColumns,
  buildCaVepariPdfColumns,
  buildCaOutstandingPdfColumns,
  buildCaSummaryPdfColumns,
  exportCaReportWorkbook,
} from './caReportExport'

function Metric({ label, value }) {
  return (
    <div className="card px-4 py-4">
      <p className="text-caption text-ink-muted">{label}</p>
      <p className="font-numeric text-heading font-semibold mt-1 text-ink">{value}</p>
    </div>
  )
}

export default function ReportsScreen() {
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const { business } = useBusiness()
  const fy = useMemo(() => financialYearBounds(todayKeyIST()), [])
  const [fromDate, setFromDate] = useState(fy.start)
  const [toDate, setToDate] = useState(fy.end)
  const [tab, setTab] = useState('bills')
  const [selectedKey, setSelectedKey] = useState(null)
  const [sortKey, setSortKey] = useState('entryNumber')
  const [sortDir, setSortDir] = useState('asc')

  const range = orderedDateRange(fromDate, toDate)
  const { loading, billRows, vepariRows, outstanding, summary, findVepari } = useCaReport(
    range.fromDate,
    range.toDate,
  )

  const rangeLabel = `${range.fromDate || '…'} → ${range.toDate || '…'}`

  const sortedBillRows = useMemo(
    () =>
      sortByNoteOrDate(billRows, {
        sortKey,
        sortDir,
        getNote: (row) => row.bill.entryNumber,
        getDate: (row) => row.bill.date,
      }),
    [billRows, sortKey, sortDir],
  )

  const sortedOutstanding = useMemo(
    () =>
      sortByNoteOrDate(outstanding, {
        sortKey,
        sortDir,
        getNote: (row) => row.bill.entryNumber,
        getDate: (row) => row.bill.date,
      }),
    [outstanding, sortKey, sortDir],
  )

  function setNoteSort(value) {
    setSortKey('entryNumber')
    setSortDir(value || 'asc')
  }

  function setDateSort(value) {
    setSortKey('date')
    setSortDir(value || 'asc')
  }

  function setThisFy() {
    const bounds = financialYearBounds(todayKeyIST())
    setFromDate(bounds.start)
    setToDate(bounds.end)
  }

  async function doExport(format) {
    const filenameBase = `ca_report_${range.fromDate || 'start'}_${range.toDate || 'end'}`
    const title = `${t('reports.title')} — ${rangeLabel}`

    if (format === 'full-excel') {
      await exportCaReportWorkbook({
        summary,
        billRows: sortedBillRows,
        vepariRows,
        outstanding: sortedOutstanding,
        fromDate: range.fromDate,
        toDate: range.toDate,
        filename: filenameBase,
      })
      return
    }

    let rows
    let cols
    let name = filenameBase
    if (tab === 'bills') {
      rows = buildCaBillRows(sortedBillRows)
      cols = buildCaBillPdfColumns()
      name = `${filenameBase}_bills`
    } else if (tab === 'vepari') {
      rows = buildCaVepariRows(vepariRows)
      cols = buildCaVepariPdfColumns()
      name = `${filenameBase}_vepari`
    } else if (tab === 'outstanding') {
      rows = buildCaOutstandingRows(sortedOutstanding)
      cols = buildCaOutstandingPdfColumns()
      name = `${filenameBase}_outstanding`
    } else {
      rows = buildCaSummaryRows(summary, range.fromDate, range.toDate)
      cols = buildCaSummaryPdfColumns()
      name = `${filenameBase}_summary`
    }

    if (format === 'excel') await exportRowsToExcel(rows, name, 'CA Report')
    if (format === 'csv') await exportRowsToCSV(rows, name)
    if (format === 'pdf') await exportRowsToPDF(rows, cols, name, title)
  }

  function handlePrint() {
    const title = `${t('reports.title')} — ${rangeLabel}`
    if (tab === 'bills') {
      printRows(buildCaBillRows(sortedBillRows), buildCaBillPdfColumns(), title)
    } else if (tab === 'vepari') {
      printRows(buildCaVepariRows(vepariRows), buildCaVepariPdfColumns(), title)
    } else if (tab === 'outstanding') {
      printRows(buildCaOutstandingRows(sortedOutstanding), buildCaOutstandingPdfColumns(), title)
    } else {
      printRows(
        buildCaSummaryRows(summary, range.fromDate, range.toDate),
        buildCaSummaryPdfColumns(),
        title,
      )
    }
  }

  function printBillRow(row) {
    const vepari = findVepari(row.bill.vepariId)
    printBill(row.bill, {
      business,
      vepariName: row.vepariName || vepari?.name || '—',
      vepariVillage: vepari?.village,
    })
  }

  function exportBillRow(row, format) {
    const rows = buildCaBillRows([row])
    const filename = `ca_bill_${row.bill.entryNumber}`
    const title = `${t('reports.title')} — ${row.bill.entryNumber}`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'CA Report')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildCaBillPdfColumns(), filename, title)
  }

  function exportOutstandingRow(row, format) {
    const rows = buildCaOutstandingRows([row])
    const filename = `ca_outstanding_${row.bill.entryNumber}`
    const title = `${t('reports.title')} — ${row.bill.entryNumber}`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'CA Report')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') {
      exportRowsToPDF(rows, buildCaOutstandingPdfColumns(), filename, title)
    }
  }

  function exportVepariRow(row, format) {
    const rows = buildCaVepariRows([row])
    const filename = `ca_vepari_${row.vepari.name?.replace(/\s+/g, '_') || 'vepari'}`
    const title = `${t('reports.title')} — ${row.vepari.name}`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'CA Report')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildCaVepariPdfColumns(), filename, title)
  }

  function printVepariRow(row) {
    printRows(
      buildCaVepariRows([row]),
      buildCaVepariPdfColumns(),
      `${t('reports.title')} — ${row.vepari.name}`,
    )
  }

  const billColumns = [
    {
      key: 'entry',
      header: t('bills.entryNumberLabel'),
      filter: noteSortFilter(t, sortKey, sortDir, setNoteSort),
      render: (row) => (
        <span className="font-numeric font-semibold">{formatDigits(row.bill.entryNumber)}</span>
      ),
    },
    {
      key: 'date',
      header: t('bills.dateLabel'),
      filter: dateSortFilter(t, sortKey, sortDir, setDateSort),
      render: (row) => (
        <span className="font-numeric whitespace-nowrap">{formatDate(row.bill.date)}</span>
      ),
    },
    {
      key: 'farmer',
      header: t('bills.farmerNameLabel'),
      render: (row) => (
        <div>
          <p className="font-semibold">{row.bill.farmerName}</p>
          <p className="text-caption text-ink-muted">{row.vepariName}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: t('bills.totalLabel'),
      align: 'right',
      render: (row) => formatCurrency(row.bill.totalAmount),
    },
    {
      key: 'balance',
      header: t('rojmer.balanceLabel'),
      align: 'right',
      render: (row) =>
        row.isCleared ? (
          <span className="badge badge-green">{t('rojmer.clearedBadge')}</span>
        ) : (
          <span className="font-semibold text-danger">{formatCurrency(row.balance)}</span>
        ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printBillRow(row)} />
          <ExportMenu
            compact
            onExportExcel={() => exportBillRow(row, 'excel')}
            onExportCSV={() => exportBillRow(row, 'csv')}
            onExportPDF={() => exportBillRow(row, 'pdf')}
          />
        </div>
      ),
    },
  ]

  const vepariColumns = [
    {
      key: 'name',
      header: t('bills.vepariLabel'),
      render: (row) => (
        <div>
          <p className="font-semibold">{row.vepari.name}</p>
          <p className="text-caption text-ink-muted">{row.vepari.village || '—'}</p>
        </div>
      ),
    },
    {
      key: 'count',
      header: t('dakhla.billCountLabel'),
      align: 'right',
      render: (row) => formatDigits(row.billCount),
    },
    {
      key: 'commission',
      header: t('reports.commissionLabel'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-accent">{formatCurrency(row.totals.commission)}</span>
      ),
    },
    {
      key: 'total',
      header: t('dakhla.totalLabel'),
      align: 'right',
      render: (row) => formatCurrency(row.totals.total),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printVepariRow(row)} />
          <ExportMenu
            compact
            onExportExcel={() => exportVepariRow(row, 'excel')}
            onExportCSV={() => exportVepariRow(row, 'csv')}
            onExportPDF={() => exportVepariRow(row, 'pdf')}
          />
        </div>
      ),
    },
  ]

  const outstandingColumns = [
    {
      key: 'entry',
      header: t('bills.entryNumberLabel'),
      filter: noteSortFilter(t, sortKey, sortDir, setNoteSort),
      render: (row) => (
        <span className="font-numeric font-semibold">{formatDigits(row.bill.entryNumber)}</span>
      ),
    },
    {
      key: 'farmer',
      header: t('bills.farmerNameLabel'),
      render: (row) => (
        <div>
          <p className="font-semibold">{row.bill.farmerName}</p>
          <p className="text-caption text-ink-muted">{formatDate(row.bill.date)}</p>
        </div>
      ),
    },
    {
      key: 'balance',
      header: t('rojmer.balanceLabel'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-danger">{formatCurrency(row.balance)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printBillRow(row)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOutstandingRow(row, 'excel')}
            onExportCSV={() => exportOutstandingRow(row, 'csv')}
            onExportPDF={() => exportOutstandingRow(row, 'pdf')}
          />
        </div>
      ),
    },
  ]

  const tabs = [
    ['bills', t('reports.tabBills')],
    ['vepari', t('reports.tabVepari')],
    ['outstanding', t('reports.tabOutstanding')],
  ]

  const tableRows =
    tab === 'bills' ? sortedBillRows : tab === 'vepari' ? vepariRows : sortedOutstanding

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileBarChart2 size={22} className="text-accent" />
            {t('reports.title')}
          </h1>
          <p className="text-body text-ink-muted mt-1">{t('reports.subtitle')}</p>
        </div>
        <button type="button" onClick={setThisFy} className="btn-secondary">
          {t('reports.thisFy')}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonTable rows={6} cols={5} />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-5">
            <Metric
              label={t('reports.billCountLabel')}
              value={formatDigits(summary.billCount)}
            />
            <Metric
              label={t('reports.goodsTotalLabel')}
              value={formatCurrency(summary.goodsTotal)}
            />
            <Metric
              label={t('reports.commissionLabel')}
              value={formatCurrency(summary.commissionEarned)}
            />
            <Metric
              label={t('reports.outstandingLabel')}
              value={formatCurrency(summary.outstandingAmount)}
            />
          </div>

          <div className="flex gap-1 mb-4 border-b border-border">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key)
                  setSelectedKey(null)
                }}
                className={`px-4 py-2.5 text-body -mb-px border-b-2 min-h-12 ${
                  tab === key
                    ? 'border-accent text-accent font-semibold'
                    : 'border-transparent text-ink-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <DataTable
            columns={
              tab === 'bills'
                ? billColumns
                : tab === 'vepari'
                  ? vepariColumns
                  : outstandingColumns
            }
            rows={tableRows}
            rowKey={(row) =>
              tab === 'vepari'
                ? row.vepari.firestoreId || row.vepari.id
                : row.bill.id
            }
            selectedKey={selectedKey}
            onRowClick={(row) => {
              const key =
                tab === 'vepari'
                  ? row.vepari.firestoreId || row.vepari.id
                  : row.bill.id
              setSelectedKey((cur) => (String(cur) === String(key) ? null : key))
            }}
            empty={<p className="text-body text-ink-muted">{t('reports.empty')}</p>}
            meta={t('common.showingCount', {
              count: formatDigits(tableRows.length),
            })}
            toolbar={
              <TableToolbar
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
                    <PrintButton onClick={handlePrint} />
                    <ExportMenu
                      label={t('reports.exportTab')}
                      onExportExcel={() => doExport('excel')}
                      onExportCSV={() => doExport('csv')}
                      onExportPDF={() => doExport('pdf')}
                    />
                    <button
                      type="button"
                      onClick={() => doExport('full-excel')}
                      className="inline-flex items-center gap-1.5 min-h-12 px-3 rounded-xl text-body font-semibold text-accent border border-accent/30 hover:bg-accent-soft"
                    >
                      {t('reports.exportFull')}
                    </button>
                  </>
                }
              />
            }
            renderExpanded={(row) =>
              tab === 'vepari' ? (
                <p className="text-caption text-ink-muted">
                  {row.vepari.name}: {t('dakhla.tolaiLabel')}{' '}
                  {formatCurrency(row.totals.tolai)} · {t('dakhla.shesLabel')}{' '}
                  {formatCurrency(row.totals.shes)} · {t('reports.commissionLabel')}{' '}
                  {formatCurrency(row.totals.commission)}
                </p>
              ) : (
                <p className="text-caption text-ink-muted">
                  {row.bill.farmerName} · {row.vepariName} · {formatCurrency(row.bill.totalAmount)}
                </p>
              )
            }
          />
        </>
      )}
    </div>
  )
}
