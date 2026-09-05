// Vepari Dakhla (auto-ledger) — Phase 5. No manual entry step: every
// saved bill (Phase 4) automatically appears here, grouped by vepari,
// with tolai/shes/commission/total computed live via calc.js. Two
// views, matching prd.md §4.2's two export requirements: a single
// vepari's full ledger, or an all-veparis summary for a date range.

import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useVeparis } from '../../hooks/useVeparis'
import { useBills } from '../../hooks/useBills'
import { useBusiness } from '../../hooks/useBusiness'
import { useVepariDakhla, useAllVepariDakhlaSummary } from '../../hooks/useVepariDakhla'
import { useLocale } from '../../context/LocaleContext'
import { todayKeyIST } from '../../utils/dates'
import { vepariStableId } from '../../utils/vepari'
import { sortByNoteOrDate, noteSortFilter, dateSortFilter } from '../../utils/tableSort'
import BillForm, { billToFormValues } from '../bills/BillForm'
import { printBill } from '../bills/billPrint'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { printDakhla } from './dakhlaPrint'
import {
  buildVepariLedgerRows,
  buildVepariLedgerPdfColumns,
  buildAllVepariSummaryRows,
  buildAllVepariSummaryPdfColumns,
} from './dakhlaExport'

function SingleVepariLedger() {
  const { user, canWrite } = useAuth()
  const { t, formatCurrency, formatDigits } = useLocale()
  const { veparis } = useVeparis()
  const { updateBill } = useBills()
  const { business } = useBusiness()
  const [vepariId, setVepariId] = useState('')
  const [editingLocalId, setEditingLocalId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('entryNumber')
  const [sortDir, setSortDir] = useState('asc')
  const { vepari, lines, totals, loading } = useVepariDakhla(vepariId)

  const editingLine = lines.find((l) => l.bill.id === editingLocalId)

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = lines.filter((line) => {
      if (!q) return true
      return (
        String(line.bill.farmerName || '').toLowerCase().includes(q) ||
        String(line.bill.entryNumber || '').toLowerCase().includes(q) ||
        String(line.bill.farmerVillage || '').toLowerCase().includes(q)
      )
    })
    return sortByNoteOrDate(filtered, {
      sortKey,
      sortDir,
      getNote: (line) => line.bill.entryNumber,
      getDate: (line) => line.bill.date,
    })
  }, [lines, search, sortKey, sortDir])

  function setNoteSort(value) {
    setSortKey('entryNumber')
    setSortDir(value || 'asc')
  }

  function setDateSort(value) {
    setSortKey('date')
    setSortDir(value || 'asc')
  }

  async function handleUpdate(payload) {
    await updateBill(editingLocalId, payload, user?.email)
    setEditingLocalId(null)
  }

  function doExport(format) {
    const rows = buildVepariLedgerRows(lines)
    const filename = `dakhla_${vepari?.name?.replace(/\s+/g, '_') || 'vepari'}`
    const title = `${vepari?.name} — Vepari Dakhla`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'Dakhla')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildVepariLedgerPdfColumns(), filename, title)
  }

  function handlePrint() {
    printDakhla(vepari, lines, totals.total, { business, totals })
  }

  function exportOne(line, format) {
    const rows = buildVepariLedgerRows([line])
    const filename = `dakhla_${line.bill.entryNumber}`
    const title = `Dakhla — ${line.bill.entryNumber}`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'Dakhla')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildVepariLedgerPdfColumns(), filename, title)
  }

  function printOne(line) {
    printBill(line.bill, {
      business,
      vepariName: vepari?.name ?? '—',
      vepariVillage: vepari?.village,
    })
  }

  const columns = [
    {
      key: 'date',
      header: t('bills.dateLabel'),
      filter: dateSortFilter(t, sortKey, sortDir, setDateSort),
      render: (line) => (
        <span className="font-numeric whitespace-nowrap">{formatDigits(line.bill.date)}</span>
      ),
    },
    {
      key: 'entry',
      header: t('bills.entryNumberLabel'),
      filter: noteSortFilter(t, sortKey, sortDir, setNoteSort),
      render: (line) => <span className="font-numeric">{formatDigits(line.bill.entryNumber)}</span>,
    },
    {
      key: 'farmer',
      header: t('bills.farmerNameLabel'),
      render: (line) => (
        <div>
          <p className="font-semibold">{line.bill.farmerName}</p>
          <p className="text-caption text-ink-muted">{line.bill.farmerVillage}</p>
        </div>
      ),
    },
    {
      key: 'weight',
      header: t('dakhla.weightLabel'),
      align: 'right',
      render: (line) => formatDigits(line.weightKg),
    },
    {
      key: 'goods',
      header: t('dakhla.goodsAmountLabel'),
      align: 'right',
      render: (line) => formatCurrency(line.goodsAmount),
    },
    {
      key: 'tolai',
      header: t('dakhla.tolaiLabel'),
      align: 'right',
      render: (line) => formatCurrency(line.tolai),
    },
    {
      key: 'shes',
      header: t('dakhla.shesLabel'),
      align: 'right',
      render: (line) => formatCurrency(line.shes),
    },
    {
      key: 'commission',
      header: t('dakhla.commissionLabel'),
      align: 'right',
      render: (line) => formatCurrency(line.commission),
    },
    {
      key: 'total',
      header: t('dakhla.totalLabel'),
      align: 'right',
      render: (line) => <span className="font-semibold">{formatCurrency(line.total)}</span>,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (line) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printOne(line)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOne(line, 'excel')}
            onExportCSV={() => exportOne(line, 'csv')}
            onExportPDF={() => exportOne(line, 'pdf')}
          />
          {canWrite && (
            <button
              type="button"
              className="action-btn action-btn-edit"
              aria-label={t('common.edit')}
              onClick={() => setEditingLocalId(line.bill.id)}
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-caption text-ink-muted mb-1.5">
            {t('dakhla.selectVepariLabel')}
          </label>
          <select
            value={vepariId}
            onChange={(e) => {
              setVepariId(e.target.value)
              setSelectedId(null)
            }}
            className="text-body text-ink bg-surface border border-border rounded-xl py-2.5 px-3 min-h-12 min-w-48"
          >
            <option value="">—</option>
            {veparis.map((v) => (
              <option key={vepariStableId(v) || v.id} value={vepariStableId(v)}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {editingLine && canWrite && (
        <div className="card px-5 py-5 mb-6">
          <BillForm
            initialValues={billToFormValues(editingLine.bill)}
            onSubmit={handleUpdate}
            onCancel={() => setEditingLocalId(null)}
            submitLabel={t('bills.saveChanges')}
          />
        </div>
      )}

      {!vepariId ? (
        <p className="text-body text-ink-muted">{t('dakhla.pickVepari')}</p>
      ) : loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <DataTable
          columns={columns}
          rows={visibleLines}
          rowKey={(line) => line.bill.id}
          selectedKey={selectedId}
          onRowClick={(line) =>
            setSelectedId((id) => (id === line.bill.id ? null : line.bill.id))
          }
          empty={<p className="text-body text-ink-muted">{t('dakhla.noBills')}</p>}
          meta={t('common.showingCount', { count: formatDigits(visibleLines.length) })}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('bills.searchPlaceholder')}
              actions={
                lines.length > 0 ? (
                  <>
                    <PrintButton onClick={handlePrint} />
                    <ExportMenu
                      label={t('dakhla.exportLedger')}
                      onExportExcel={() => doExport('excel')}
                      onExportCSV={() => doExport('csv')}
                      onExportPDF={() => doExport('pdf')}
                    />
                  </>
                ) : null
              }
            />
          }
          renderExpanded={(line) => (
            <p className="text-caption text-ink-muted">
              {line.bill.farmerName} · {formatDigits(line.bill.date)}
            </p>
          )}
          footer={
            visibleLines.length > 0 ? (
              <tr className="bg-accent-soft font-numeric font-semibold">
                <td />
                <td className="px-4 py-3" colSpan={3}>
                  {t('dakhla.totalLabel')}
                </td>
                <td className="px-4 py-3 text-right">{formatDigits(totals.weightKg)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.goodsAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.tolai)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.shes)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.commission)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.total)}</td>
                <td />
              </tr>
            ) : null
          }
        />
      )}
    </div>
  )
}

function AllVepariSummary() {
  const { t, formatCurrency, formatDigits } = useLocale()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const { rows, loading } = useAllVepariDakhlaSummary(fromDate, toDate)

  function doExport(format) {
    const exportRows = buildAllVepariSummaryRows(rows)
    const range = fromDate || toDate ? `${fromDate || 'start'}_to_${toDate || todayKeyIST()}` : 'all'
    const filename = `dakhla_summary_${range}`
    const title = 'Vepari Dakhla — All veparis'
    if (format === 'excel') exportRowsToExcel(exportRows, filename, 'Dakhla Summary')
    if (format === 'csv') exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') exportRowsToPDF(exportRows, buildAllVepariSummaryPdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(buildAllVepariSummaryRows(rows), buildAllVepariSummaryPdfColumns(), 'Vepari Dakhla — All veparis')
  }

  function exportOne(row, format) {
    const exportRows = buildAllVepariSummaryRows([row])
    const filename = `dakhla_${row.vepari.name?.replace(/\s+/g, '_') || 'vepari'}`
    const title = `Vepari Dakhla — ${row.vepari.name}`
    if (format === 'excel') exportRowsToExcel(exportRows, filename, 'Dakhla Summary')
    if (format === 'csv') exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') exportRowsToPDF(exportRows, buildAllVepariSummaryPdfColumns(), filename, title)
  }

  function printOne(row) {
    printRows(buildAllVepariSummaryRows([row]), buildAllVepariSummaryPdfColumns(), `Vepari Dakhla — ${row.vepari.name}`)
  }

  const columns = [
    {
      key: 'name',
      header: t('bills.vepariLabel'),
      render: (row) => <span className="font-semibold">{row.vepari.name}</span>,
    },
    {
      key: 'village',
      header: t('bills.farmerVillageLabel'),
      render: (row) => <span className="text-ink-muted">{row.vepari.village}</span>,
    },
    {
      key: 'count',
      header: t('dakhla.billCountLabel'),
      align: 'right',
      render: (row) => formatDigits(row.billCount),
    },
    {
      key: 'total',
      header: t('dakhla.totalLabel'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold">{formatCurrency(row.totals.total)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printOne(row)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOne(row, 'excel')}
            onExportCSV={() => exportOne(row, 'csv')}
            onExportPDF={() => exportOne(row, 'pdf')}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => vepariStableId(row.vepari) || row.vepari.id}
          selectedKey={selectedId}
          onRowClick={(row) => {
            const id = vepariStableId(row.vepari) || row.vepari.id
            setSelectedId((cur) => (String(cur) === String(id) ? null : id))
          }}
          empty={<p className="text-body text-ink-muted">{t('dakhla.noSummary')}</p>}
          meta={t('common.showingCount', { count: formatDigits(rows.length) })}
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
                  {rows.length > 0 && (
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
          renderExpanded={(row) => (
            <p className="text-body text-ink-muted">
              {row.vepari.name} · {formatDigits(row.billCount)}{' '}
              {t('dakhla.billCountLabel').toLowerCase()} · {formatCurrency(row.totals.total)}
            </p>
          )}
        />
      )}
    </div>
  )
}

export default function DakhlaScreen() {
  const { canWrite } = useAuth()
  const { t } = useLocale()
  const [tab, setTab] = useState('single')

  return (
    <div>
      {!canWrite && <ReadOnlyBanner />}

      <h1 className="page-title mb-6">{t('dakhla.title')}</h1>

      <div className="flex gap-1 mb-5 border-b border-border">
        {[
          ['single', t('dakhla.singleVepariTab')],
          ['all', t('dakhla.allVeparisTab')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
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

      {tab === 'single' ? <SingleVepariLedger /> : <AllVepariSummary />}
    </div>
  )
}
