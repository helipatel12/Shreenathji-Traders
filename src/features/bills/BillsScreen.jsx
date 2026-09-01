// Bills (કેશ મેમો) — Phase 4. List + add/edit + export. Entry numbers
// (નોંધ નં., design.md §4) are derived from creation order by
// useBills, not stored — see that hook's header comment for why.

import { useMemo, useState } from 'react'
import { Plus, Pencil, History, Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBills } from '../../hooks/useBills'
import { useVeparis } from '../../hooks/useVeparis'
import { useBusiness } from '../../hooks/useBusiness'
import { formatCurrency } from '../../utils/calc'
import { todayKeyIST } from '../../utils/dates'
import gu from '../../locales/gu.json'
import BillForm, { billToFormValues } from './BillForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { printBill } from './billPrint'
import {
  buildSingleBillRows,
  buildSingleBillPdfColumns,
  buildBillListRows,
  buildBillListPdfColumns,
} from './billExport'

function vepariName(veparis, vepariId) {
  return veparis.find((v) => String(v.id) === String(vepariId))?.name ?? '—'
}

function EditHistoryList({ editHistory }) {
  if (!editHistory?.length) return null
  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-caption text-ink-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <History size={14} strokeWidth={1.75} />
        Edit history
      </p>
      <ul className="space-y-1">
        {editHistory.map((entry, i) => (
          <li key={i} className="text-caption text-ink-muted">
            <span className="text-ink">{entry.field}</span> changed —{' '}
            {new Date(entry.editedAt).toLocaleString('en-IN')}
          </li>
        ))}
      </ul>
    </div>
  )
}

function VoidConfirmDialog({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{gu.bills.voidConfirmTitle}</p>
        <p className="text-caption text-ink-muted mb-4">{gu.bills.voidConfirmBody}</p>
        <label htmlFor="bill-void-reason" className="block text-caption text-ink-muted mb-1.5">
          {gu.bills.voidReasonLabel}
        </label>
        <input
          id="bill-void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 mb-4 focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className="flex-1 min-h-11 rounded-xl bg-danger text-surface font-semibold text-body"
          >
            {gu.bills.confirmVoid}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {gu.bills.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BillsScreen() {
  const { user, role } = useAuth()
  const isOwner = role === 'owner'
  const { bills, loading, addBill, updateBill, voidBill } = useBills()
  const { veparis } = useVeparis()
  const { business } = useBusiness()
  const [mode, setMode] = useState('list') // 'list' | 'add' | { edit: localId }
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [voidingBillId, setVoidingBillId] = useState(null)

  const editingBill =
    typeof mode === 'object' && mode.edit != null ? bills.find((b) => b.id === mode.edit) : null

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      if (fromDate && bill.date < fromDate) return false
      if (toDate && bill.date > toDate) return false
      return true
    })
  }, [bills, fromDate, toDate])

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

  function exportSingleBill(bill, format) {
    const name = vepariName(veparis, bill.vepariId)
    const filename = `bill_${bill.entryNumber}_${bill.farmerName.replace(/\s+/g, '_')}`
    const title = `${gu.bills.entryNumberLabel} ${bill.entryNumber} — ${bill.farmerName} (${name})`
    if (format === 'excel') exportRowsToExcel(buildSingleBillRows(bill, name), filename, 'Bill')
    if (format === 'csv') exportRowsToCSV(buildSingleBillRows(bill, name), filename)
    if (format === 'pdf') {
      exportRowsToPDF(buildSingleBillRows(bill, name), buildSingleBillPdfColumns(), filename, title)
    }
  }

  function printSingleBill(bill) {
    const vepari = veparis.find((v) => String(v.id) === String(bill.vepariId))
    printBill(bill, { business, vepariName: vepari?.name ?? '—', vepariVillage: vepari?.village })
  }

  function exportList(format) {
    const filename = exportListFilename()
    const rows = buildBillListRows(filteredBills, veparis)
    if (format === 'excel') exportRowsToExcel(rows, filename, 'Bills')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildBillListPdfColumns(), filename, 'Bills')
  }

  function printList() {
    printRows(buildBillListRows(filteredBills, veparis), buildBillListPdfColumns(), 'Bills')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
            {gu.bills.titleGu}
          </p>
          <h1 className="font-display text-heading text-ink font-semibold mt-1">Bills</h1>
        </div>
        {mode === 'list' && (
          <button
            type="button"
            onClick={() => setMode('add')}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body"
          >
            <Plus size={18} strokeWidth={2} />
            {gu.dashboard.newBill}
          </button>
        )}
      </div>

      {mode === 'add' && (
        <div className="card px-5 py-5 mb-6">
          <BillForm onSubmit={handleAdd} onCancel={() => setMode('list')} submitLabel={gu.bills.saveBill} />
        </div>
      )}

      {editingBill && (
        <div className="card px-5 py-5 mb-6">
          <BillForm
            initialValues={billToFormValues(editingBill)}
            onSubmit={handleUpdate}
            onCancel={() => setMode('list')}
            submitLabel={gu.bills.saveChanges}
          />
          <EditHistoryList editHistory={editingBill.editHistory} />
        </div>
      )}

      {mode === 'list' && (
        <>
          {bills.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-caption text-ink-muted mb-1.5">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="text-body text-ink bg-surface border border-border rounded-xl py-2 px-3 min-h-11"
                />
              </div>
              <div>
                <label className="block text-caption text-ink-muted mb-1.5">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="text-body text-ink bg-surface border border-border rounded-xl py-2 px-3 min-h-11"
                />
              </div>
              <PrintButton onClick={printList} />
              <ExportMenu
                label={`Export list (${filteredBills.length})`}
                onExportExcel={() => exportList('excel')}
                onExportCSV={() => exportList('csv')}
                onExportPDF={() => exportList('pdf')}
              />
            </div>
          )}

          {loading ? (
            <p className="text-caption text-ink-muted">Loading…</p>
          ) : filteredBills.length === 0 ? (
            <div className="card px-5 py-5 max-w-md">
              <p className="text-body text-ink-muted">
                {bills.length === 0
                  ? 'No bills yet — the first one you save will show up here.'
                  : 'No bills in that date range.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3 max-w-2xl">
              {filteredBills.map((bill) => (
                <li key={bill.id} className="card px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`min-w-0 ${bill.isVoided ? 'opacity-60' : ''}`}>
                      <p className="text-caption text-ink-muted">
                        {gu.bills.entryNumberLabel} {bill.entryNumber}
                        {bill.syncStatus === 'pending' && !bill.isVoided && (
                          <span className="text-accent"> · syncing…</span>
                        )}
                        {bill.isVoided && (
                          <span className="text-danger"> · {gu.bills.voidedBadge}</span>
                        )}
                      </p>
                      <p
                        className={`text-body text-ink mt-0.5 truncate ${
                          bill.isVoided ? 'line-through' : ''
                        }`}
                      >
                        {bill.farmerName}
                        <span className="text-ink-muted"> · {bill.farmerVillage}</span>
                      </p>
                      <p className="text-caption text-ink-muted mt-0.5">
                        {bill.date} · {vepariName(veparis, bill.vepariId)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <p
                        className={`font-numeric text-body text-ink font-semibold ${
                          bill.isVoided ? 'opacity-60 line-through' : ''
                        }`}
                      >
                        {formatCurrency(bill.totalAmount)}
                      </p>
                      {!bill.isVoided && (
                        <div className="flex items-center gap-1">
                          <PrintButton label="" onClick={() => printSingleBill(bill)} />
                          <ExportMenu
                            label=""
                            onExportExcel={() => exportSingleBill(bill, 'excel')}
                            onExportCSV={() => exportSingleBill(bill, 'csv')}
                            onExportPDF={() => exportSingleBill(bill, 'pdf')}
                          />
                          <button
                            type="button"
                            onClick={() => setMode({ edit: bill.id })}
                            aria-label={`Edit bill ${bill.entryNumber}`}
                            className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-accent"
                          >
                            <Pencil size={18} strokeWidth={1.75} />
                          </button>
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => setVoidingBillId(bill.id)}
                              aria-label={`Void bill ${bill.entryNumber}`}
                              className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-danger"
                            >
                              <Ban size={18} strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {voidingBillId != null && (
        <VoidConfirmDialog onConfirm={handleConfirmVoid} onCancel={() => setVoidingBillId(null)} />
      )}
    </div>
  )
}
