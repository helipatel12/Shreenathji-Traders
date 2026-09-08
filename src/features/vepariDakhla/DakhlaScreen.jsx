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
import { useVepariDakhla } from '../../hooks/useVepariDakhla'
import { useLocale } from '../../context/LocaleContext'
import { formatDisplayDate } from '../../utils/dates'
import { sortByNoteOrDate, noteSortFilter, dateSortFilter } from '../../utils/tableSort'
import BillForm, { billToFormValues } from '../bills/BillForm'
import { printBill } from '../bills/billPrint'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import VepariSelect from '../../components/VepariSelect'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF } from '../../utils/export'
import { roundCurrency } from '../../utils/calc'
import { printDakhla } from './dakhlaPrint'
import {
  buildVepariLedgerRows,
  buildVepariLedgerPdfColumns,
} from './dakhlaExport'
import AllVepariSummary from './AllVepariSummary'

function SingleVepariLedger() {
  const { user, canWrite, isOwner } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const { veparis } = useVeparis()
  const { updateBill } = useBills()
  const { business } = useBusiness()
  const [vepariId, setVepariId] = useState('')
  const [editingLocalId, setEditingLocalId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('entryNumber')
  const [sortDir, setSortDir] = useState('asc')
  const { vepari, lines, loading } = useVepariDakhla(vepariId)

  const editingLine = lines.find((l) => l.bill.id === editingLocalId)

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = lines.filter((line) => {
      if (!q) return true
      const goods = (line.bill.items || [])
        .map((item) => item.type || item.customType || '')
        .join(' ')
        .toLowerCase()
      const haystack = [
        line.bill.farmerName,
        line.bill.farmerVillage,
        line.bill.entryNumber,
        vepari?.name,
        vepari?.village,
        goods,
        line.bill.date,
        formatDisplayDate(line.bill.date),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
    return sortByNoteOrDate(filtered, {
      sortKey,
      sortDir,
      getNote: (line) => line.bill.entryNumber,
      getDate: (line) => line.bill.date,
    })
  }, [lines, search, sortKey, sortDir, vepari])

  const visibleTotals = useMemo(() => {
    const raw = visibleLines.reduce(
      (acc, line) => ({
        weightKg: (acc.weightKg || 0) + (line.weightKg || 0),
        tolai: (acc.tolai || 0) + (line.tolai || 0),
        shes: (acc.shes || 0) + (line.shes || 0),
        commission: (acc.commission || 0) + (line.commission || 0),
        goodsAmount: (acc.goodsAmount || 0) + (line.goodsAmount || 0),
        total: (acc.total || 0) + (line.total || 0),
      }),
      {
        weightKg: 0,
        tolai: 0,
        shes: 0,
        commission: 0,
        goodsAmount: 0,
        total: 0,
      },
    )
    return {
      weightKg: roundCurrency(raw.weightKg),
      tolai: roundCurrency(raw.tolai),
      shes: roundCurrency(raw.shes),
      commission: roundCurrency(raw.commission),
      goodsAmount: roundCurrency(raw.goodsAmount),
      total: roundCurrency(raw.total),
    }
  }, [visibleLines])

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

  async function doExport(format) {
    const rows = buildVepariLedgerRows(visibleLines)
    const filename = `dakhla_${vepari?.name?.replace(/\s+/g, '_') || 'vepari'}`
    const title = `${vepari?.name} — Vepari Dakhla`
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Dakhla')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildVepariLedgerPdfColumns(), filename, title)
  }

  function handlePrint() {
    printDakhla(vepari, visibleLines, visibleTotals.total, {
      business,
      totals: visibleTotals,
    })
  }

  async function exportOne(line, format) {
    const rows = buildVepariLedgerRows([line])
    const filename = `dakhla_${line.bill.entryNumber}`
    const title = `Dakhla — ${line.bill.entryNumber}`
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Dakhla')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildVepariLedgerPdfColumns(), filename, title)
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
        <span className="font-numeric whitespace-nowrap">{formatDate(line.bill.date)}</span>
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
      key: 'rate',
      header: t('bills.rateLabel'),
      align: 'right',
      render: (line) =>
        line.ratePer20kg === '' || line.ratePer20kg == null
          ? '—'
          : formatDigits(line.ratePer20kg),
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
      <div className="mb-4">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('dakhla.searchPlaceholder')}
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="min-w-64 max-w-md w-full">
          <label className="block text-caption text-ink-muted mb-1.5">
            {t('dakhla.selectVepariLabel')}
          </label>
          <VepariSelect
            veparis={veparis}
            value={vepariId}
            onChange={(id) => {
              setVepariId(id)
              setSelectedId(null)
            }}
            emptyLabel="—"
            placeholder={t('dakhla.selectVepariLabel')}
          />
        </div>
      </div>

      {editingLine && canWrite && (
        <div className="card px-5 py-5 mb-6">
          <BillForm
            initialValues={billToFormValues(editingLine.bill)}
            onSubmit={handleUpdate}
            onCancel={() => setEditingLocalId(null)}
            submitLabel={t('bills.saveChanges')}
            canEditEntryNumber={isOwner}
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
            lines.length > 0 ? (
              <TableToolbar
                actions={
                  <>
                    <PrintButton onClick={handlePrint} />
                    <ExportMenu
                      label={t('dakhla.exportLedger')}
                      onExportExcel={() => doExport('excel')}
                      onExportCSV={() => doExport('csv')}
                      onExportPDF={() => doExport('pdf')}
                    />
                  </>
                }
              />
            ) : null
          }
          renderExpanded={(line) => (
            <p className="text-caption text-ink-muted">
              {line.bill.farmerName} · {formatDate(line.bill.date)}
            </p>
          )}
          footer={
            visibleLines.length > 0 ? (
              <tr className="bg-accent-soft font-numeric font-semibold">
                <td />
                <td className="px-4 py-3" colSpan={3}>
                  {t('dakhla.totalLabel')}
                </td>
                <td className="px-4 py-3 text-right">{formatDigits(visibleTotals.weightKg)}</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">{formatCurrency(visibleTotals.goodsAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(visibleTotals.tolai)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(visibleTotals.shes)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(visibleTotals.commission)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(visibleTotals.total)}</td>
                <td />
              </tr>
            ) : null
          }
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
