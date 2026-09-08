import { useMemo, useState } from 'react'
import { Plus, Pencil, History, Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBills } from '../../hooks/useBills'
import { useVeparis } from '../../hooks/useVeparis'
import { useBusiness } from '../../hooks/useBusiness'
import { useLocale } from '../../context/LocaleContext'
import { excludeVoided } from '../../utils/calc'
import { todayKeyIST, orderedDateRange } from '../../utils/dates'
import { findVepari, vepariDisplayName, vepariStableId } from '../../utils/vepari'
import BillForm, { billToFormValues } from './BillForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { printBill } from './billPrint'
import {
  buildSingleBillRows,
  buildSingleBillPdfColumns,
  buildBillListRows,
  buildBillListPdfColumns,
} from './billExport'

function EditHistoryList({ editHistory }) {
  const { t, lang } = useLocale()
  if (!editHistory?.length) return null
  const locale = lang === 'gu' ? 'gu-IN' : 'en-IN'
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-caption text-ink-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <History size={14} strokeWidth={1.75} />
        {t('bills.editHistory')}
      </p>
      <ul className="space-y-1">
        {editHistory.map((entry, i) => (
          <li key={i} className="text-caption text-ink-muted">
            <span className="text-ink">{entry.field}</span> —{' '}
            {new Date(entry.editedAt).toLocaleString(locale)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function VoidConfirmDialog({ onConfirm, onCancel }) {
  const { t } = useLocale()
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{t('bills.voidConfirmTitle')}</p>
        <p className="text-caption text-ink-muted mb-4">{t('bills.voidConfirmBody')}</p>
        <label htmlFor="bill-void-reason" className="block text-caption text-ink-muted mb-1.5">
          {t('bills.voidReasonLabel')}
        </label>
        <input
          id="bill-void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 mb-4 focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className="flex-1 min-h-12 rounded-xl bg-danger text-surface font-semibold text-body"
          >
            {t('bills.confirmVoid')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {t('bills.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BillsScreen() {
  const { user, isOwner, canWrite } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const { bills, loading, addBill, updateBill, voidBill } = useBills()
  const { veparis } = useVeparis()
  const { business } = useBusiness()
  const [mode, setMode] = useState('list')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [voidingBillId, setVoidingBillId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [vepariFilter, setVepariFilter] = useState('')
  // Default: note ascending. Changing date/note sort switches the active key.
  const [sortKey, setSortKey] = useState('entryNumber') // entryNumber | date
  const [sortDir, setSortDir] = useState('asc') // asc | desc

  const editingBill =
    typeof mode === 'object' && mode.edit != null ? bills.find((b) => b.id === mode.edit) : null

  const filteredBills = useMemo(() => {
    const { fromDate: from, toDate: to } = orderedDateRange(fromDate, toDate)
    const q = search.trim().toLowerCase()
    const list = excludeVoided(bills).filter((bill) => {
      if (from && bill.date < from) return false
      if (to && bill.date > to) return false
      if (vepariFilter) {
        const matched = findVepari(veparis, bill.vepariId)
        const billKey = matched ? vepariStableId(matched) : String(bill.vepariId)
        if (
          billKey !== String(vepariFilter) &&
          String(bill.vepariId) !== String(vepariFilter)
        ) {
          return false
        }
      }
      if (!q) return true
      const vepariName = vepariDisplayName(veparis, bill.vepariId).toLowerCase()
      return (
        String(bill.farmerName || '').toLowerCase().includes(q) ||
        String(bill.farmerVillage || '').toLowerCase().includes(q) ||
        String(bill.entryNumber || '').toLowerCase().includes(q) ||
        vepariName.includes(q)
      )
    })

    const dir = sortDir === 'desc' ? -1 : 1
    return list.slice().sort((a, b) => {
      if (sortKey === 'date') {
        if (a.date < b.date) return -1 * dir
        if (a.date > b.date) return 1 * dir
        // Stable tie-break by note no.
        return (Number(a.entryNumber) || 0) - (Number(b.entryNumber) || 0)
      }
      const na = Number(a.entryNumber) || 0
      const nb = Number(b.entryNumber) || 0
      if (na !== nb) return (na - nb) * dir
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return 0
    })
  }, [bills, fromDate, toDate, search, vepariFilter, veparis, sortKey, sortDir])

  function setNoteSort(value) {
    if (!value) {
      setSortKey('entryNumber')
      setSortDir('asc')
      return
    }
    setSortKey('entryNumber')
    setSortDir(value)
  }

  function setDateSort(value) {
    if (!value) {
      setSortKey('date')
      setSortDir('asc')
      return
    }
    setSortKey('date')
    setSortDir(value)
  }

  async function handleAdd(payload) {
    await addBill({ ...payload, createdBy: user?.email })
    setMode('list')
  }

  async function handleUpdate(payload) {
    await updateBill(editingBill.id, payload, user?.email)
    setMode('list')
  }

  async function handleConfirmVoid(reason) {
    await voidBill(voidingBillId, reason, user?.email)
    setVoidingBillId(null)
  }

  function exportListFilename() {
    const range = fromDate || toDate ? `${fromDate || 'start'}_to_${toDate || todayKeyIST()}` : 'all'
    return `bills_${range}`
  }

  async function exportSingleBill(bill, format) {
    const name = vepariDisplayName(veparis, bill.vepariId)
    const filename = `bill_${bill.entryNumber}_${(bill.farmerName || 'bill').replace(/\s+/g, '_')}`
    const title = `${t('bills.entryNumberLabel')} ${bill.entryNumber} — ${bill.farmerName} (${name})`
    if (format === 'excel') await exportRowsToExcel(buildSingleBillRows(bill, name), filename, 'Bill')
    if (format === 'csv') await exportRowsToCSV(buildSingleBillRows(bill, name), filename)
    if (format === 'pdf') {
      await exportRowsToPDF(
        buildSingleBillRows(bill, name),
        buildSingleBillPdfColumns(),
        filename,
        title,
      )
    }
  }

  function printSingleBill(bill) {
    const vepari = findVepari(veparis, bill.vepariId)
    printBill(bill, {
      business,
      vepariName: vepari?.name ?? '—',
      vepariVillage: vepari?.village,
    })
  }

  async function exportList(format) {
    const filename = exportListFilename()
    const rows = buildBillListRows(filteredBills, veparis)
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Bills')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildBillListPdfColumns(), filename, 'Bills')
  }

  function printList() {
    printRows(buildBillListRows(filteredBills, veparis), buildBillListPdfColumns(), 'Bills')
  }

  const columns = [
    {
      key: 'entryNumber',
      header: t('bills.entryNumberLabel'),
      filter: {
        value: sortKey === 'entryNumber' ? sortDir : '',
        onChange: setNoteSort,
        allLabel: t('bills.sortNote'),
        options: [
          { value: 'asc', label: t('bills.sortNoteAsc') },
          { value: 'desc', label: t('bills.sortNoteDesc') },
        ],
      },
      render: (bill) => (
        <span className="font-numeric font-semibold">
          {formatDigits(bill.entryNumber)}
          {bill.syncStatus === 'pending' && (
            <span className="badge badge-amber ml-2">{t('common.syncing')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('bills.dateLabel'),
      filter: {
        value: sortKey === 'date' ? sortDir : '',
        onChange: setDateSort,
        allLabel: t('bills.sortDate'),
        options: [
          { value: 'asc', label: t('bills.sortDateOlder') },
          { value: 'desc', label: t('bills.sortDateNewer') },
        ],
      },
      render: (bill) => (
        <span className="font-numeric whitespace-nowrap">{formatDate(bill.date)}</span>
      ),
    },
    {
      key: 'farmer',
      header: t('bills.farmerNameLabel'),
      render: (bill) => (
        <div>
          <p className="font-semibold text-ink">{bill.farmerName}</p>
          <p className="text-caption text-ink-muted">{bill.farmerVillage}</p>
        </div>
      ),
    },
    {
      key: 'vepari',
      header: t('bills.vepariLabel'),
      filter: {
        value: vepariFilter,
        onChange: setVepariFilter,
        allLabel: t('bills.allVeparis'),
        veparis,
      },
      render: (bill) => (
        <span className="badge badge-blue">{vepariDisplayName(veparis, bill.vepariId)}</span>
      ),
    },
    {
      key: 'total',
      header: t('bills.totalLabel'),
      align: 'right',
      render: (bill) => (
        <span className="font-semibold">{formatCurrency(bill.totalAmount)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (bill) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printSingleBill(bill)} />
          <ExportMenu
            compact
            onExportExcel={() => exportSingleBill(bill, 'excel')}
            onExportCSV={() => exportSingleBill(bill, 'csv')}
            onExportPDF={() => exportSingleBill(bill, 'pdf')}
          />
          {canWrite && (
            <button
              type="button"
              className="action-btn action-btn-edit"
              aria-label={t('common.edit')}
              onClick={() => setMode({ edit: bill.id })}
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              className="action-btn action-btn-danger"
              aria-label={t('bills.void')}
              onClick={() => setVoidingBillId(bill.id)}
            >
              <Ban size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      {!canWrite && <ReadOnlyBanner />}

      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t('bills.titleEn')}</h1>
          <p className="text-body text-ink-muted mt-1">{t('bills.title')}</p>
        </div>
        {mode === 'list' && canWrite && (
          <button type="button" onClick={() => setMode('add')} className="btn-primary">
            <Plus size={18} strokeWidth={2} />
            {t('dashboard.newBill')}
          </button>
        )}
      </div>

      {mode === 'add' && canWrite && (
        <div className="card px-5 py-5 mb-6">
          <BillForm
            onSubmit={handleAdd}
            onCancel={() => setMode('list')}
            submitLabel={t('bills.saveBill')}
          />
        </div>
      )}

      {editingBill && canWrite && (
        <div className="card px-5 py-5 mb-6">
          <BillForm
            initialValues={billToFormValues(editingBill)}
            onSubmit={handleUpdate}
            onCancel={() => setMode('list')}
            submitLabel={t('bills.saveChanges')}
            canEditEntryNumber={isOwner}
          />
          <EditHistoryList editHistory={editingBill.editHistory} />
        </div>
      )}

      {mode === 'list' && (
        <>
          {loading ? (
            <SkeletonTable rows={6} cols={5} />
          ) : (
            <DataTable
              columns={columns}
              rows={filteredBills}
              rowKey="id"
              selectedKey={selectedId}
              onRowClick={(bill) =>
                setSelectedId((id) => (id === bill.id ? null : bill.id))
              }
              empty={
                <p className="text-body text-ink-muted">
                  {excludeVoided(bills).length === 0 ? t('bills.emptyList') : t('bills.emptyRange')}
                </p>
              }
              meta={t('common.showingCount', { count: formatDigits(filteredBills.length) })}
              toolbar={
                <TableToolbar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder={t('bills.searchPlaceholder')}
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
                      {excludeVoided(bills).length > 0 && (
                        <>
                          <PrintButton onClick={printList} />
                          <ExportMenu
                            label={t('bills.exportList', { count: filteredBills.length })}
                            onExportExcel={() => exportList('excel')}
                            onExportCSV={() => exportList('csv')}
                            onExportPDF={() => exportList('pdf')}
                          />
                        </>
                      )}
                    </>
                  }
                />
              }
              renderExpanded={(bill) =>
                bill.editHistory?.length ? (
                  <EditHistoryList editHistory={bill.editHistory} />
                ) : null
              }
            />
          )}
        </>
      )}

      {voidingBillId != null && (
        <VoidConfirmDialog onConfirm={handleConfirmVoid} onCancel={() => setVoidingBillId(null)} />
      )}
    </div>
  )
}
