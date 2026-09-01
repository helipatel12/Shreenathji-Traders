// Rojmer (payment tracking) — Phase 6. List of bills with derived
// balance due; record/edit payments; filter pending/cleared/all;
// export. No new "rojmer" collection — like Phase 5's dakhla, this is
// a computed view over bills (Phase 4) + payments, per architecture.md
// §7's "calculated on read, not stored."
//
// Payments can never be deleted (rules.md §3, firestore.rules) — a
// mistaken payment is voided instead (architecture.md §5a): it stays
// visible with its full history but no longer counts toward the
// balance.

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBills } from '../../hooks/useBills'
import { usePayments } from '../../hooks/usePayments'
import { useVeparis } from '../../hooks/useVeparis'
import { getBillClearingInfo, formatCurrency, excludeVoided } from '../../utils/calc'
import gu from '../../locales/gu.json'
import PaymentForm from './PaymentForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { buildRojmerRows, buildRojmerPdfColumns } from './rojmerExport'

function vepariName(veparis, vepariId) {
  return veparis.find((v) => String(v.id) === String(vepariId))?.name ?? '—'
}

function BillPayments({ bill, payments, isOwner, onEditPayment, onVoidPayment }) {
  const billPayments = payments.filter((p) => p.billId === bill.firestoreId)
  if (billPayments.length === 0) {
    return <p className="text-caption text-ink-muted">No payments recorded yet.</p>
  }
  return (
    <ul className="space-y-1.5">
      {billPayments.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between text-caption gap-2">
          <span className={payment.isVoided ? 'text-ink-muted line-through' : 'text-ink'}>
            {formatCurrency(payment.amount)} · {gu.rojmer[payment.type]} · {payment.date}
            {payment.isVoided && (
              <span className="text-danger no-underline"> · {gu.rojmer.voidedBadge}</span>
            )}
            {payment.syncStatus === 'pending' && !payment.isVoided && (
              <span className="text-accent"> · syncing…</span>
            )}
            {!payment.isVoided && payment.editHistory?.length > 0 && (
              <span className="text-ink-muted"> · edited</span>
            )}
          </span>
          {!payment.isVoided && (
            <span className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onEditPayment(payment)}
                aria-label="Edit payment"
                className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-accent"
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onVoidPayment(payment)}
                  aria-label={gu.rojmer.void}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-danger"
                >
                  <Ban size={14} strokeWidth={1.75} />
                </button>
              )}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

function VoidConfirmDialog({ payment, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{gu.rojmer.voidConfirmTitle}</p>
        <p className="text-caption text-ink-muted mb-4">{gu.rojmer.voidConfirmBody}</p>
        <label htmlFor="void-reason" className="block text-caption text-ink-muted mb-1.5">
          {gu.rojmer.voidReasonLabel}
        </label>
        <input
          id="void-reason"
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
            {gu.rojmer.confirmVoid}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {gu.rojmer.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RojmerScreen() {
  const { user, role } = useAuth()
  const isOwner = role === 'owner'
  const { bills, loading: billsLoading } = useBills()
  const { payments, loading: paymentsLoading, addPayment, updatePayment, voidPayment } = usePayments()
  const { veparis } = useVeparis()

  const [tab, setTab] = useState('pending') // 'pending' | 'cleared' | 'all'
  const [expandedBillId, setExpandedBillId] = useState(null)
  const [editingPayment, setEditingPayment] = useState(null) // { billLocalId, payment } | null
  const [voidingPayment, setVoidingPayment] = useState(null) // payment | null

  const loading = billsLoading || paymentsLoading

  const allRows = useMemo(() => {
    return excludeVoided(bills)
      .map((bill) => ({ bill, ...getBillClearingInfo(bill, payments) }))
      .sort((a, b) => (a.bill.date < b.bill.date ? 1 : a.bill.date > b.bill.date ? -1 : 0))
  }, [bills, payments])

  const filteredRows = useMemo(() => {
    if (tab === 'pending') return allRows.filter((r) => !r.isCleared)
    if (tab === 'cleared') return allRows.filter((r) => r.isCleared)
    return allRows
  }, [allRows, tab])

  async function handleAddPayment(billLocalId, billFirestoreId, maxAmount, values) {
    await addPayment({ billId: billFirestoreId, ...values, createdBy: user?.email })
  }

  async function handleUpdatePayment(values) {
    await updatePayment(editingPayment.payment.id, values, user?.email)
    setEditingPayment(null)
  }

  async function handleConfirmVoid(reason) {
    await voidPayment(voidingPayment.id, reason, user?.email)
    setVoidingPayment(null)
  }

  function doExport(format) {
    const exportRows = buildRojmerRows(filteredRows, veparis, payments)
    const filename = `rojmer_${tab}`
    const title = `Rojmer — ${tab}`
    if (format === 'excel') exportRowsToExcel(exportRows, filename, 'Rojmer')
    if (format === 'csv') exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') exportRowsToPDF(exportRows, buildRojmerPdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(buildRojmerRows(filteredRows, veparis, payments), buildRojmerPdfColumns(), `Rojmer — ${tab}`)
  }

  return (
    <div>
      <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
        {gu.rojmer.titleGu}
      </p>
      <h1 className="font-display text-heading text-ink font-semibold mt-1 mb-4">Rojmer</h1>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 border-b border-border">
          {[
            ['pending', gu.rojmer.pendingTab],
            ['cleared', gu.rojmer.clearedTab],
            ['all', gu.rojmer.allTab],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-body -mb-px border-b-2 ${
                tab === key ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {filteredRows.length > 0 && (
          <>
            <PrintButton onClick={handlePrint} />
            <ExportMenu
              label={`Export (${filteredRows.length})`}
              onExportExcel={() => doExport('excel')}
              onExportCSV={() => doExport('csv')}
              onExportPDF={() => doExport('pdf')}
            />
          </>
        )}
      </div>

      {loading ? (
        <p className="text-caption text-ink-muted">Loading…</p>
      ) : filteredRows.length === 0 ? (
        <div className="card px-5 py-5 max-w-md">
          <p className="text-body text-ink-muted">
            {tab === 'pending' ? gu.rojmer.noPending : 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3 max-w-2xl">
          {filteredRows.map((row) => {
            const isExpanded = expandedBillId === row.bill.id
            return (
              <li key={row.bill.id} className="card px-4 py-4">
                <button
                  type="button"
                  onClick={() => setExpandedBillId(isExpanded ? null : row.bill.id)}
                  className="w-full flex items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-caption text-ink-muted">
                      {gu.bills.entryNumberLabel} {row.bill.entryNumber} · {row.bill.date}
                    </p>
                    <p className="text-body text-ink mt-0.5 truncate">
                      {row.bill.farmerName}
                      <span className="text-ink-muted"> · {vepariName(veparis, row.bill.vepariId)}</span>
                    </p>
                    {row.isCleared ? (
                      <p className="text-caption text-accent mt-0.5">
                        {gu.rojmer.clearedBadge} · {row.clearingDate}
                      </p>
                    ) : (
                      <p className="text-caption text-danger mt-0.5">
                        {gu.rojmer.balanceLabel}: {formatCurrency(row.balance)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <p className="font-numeric text-body text-ink font-semibold">
                      {formatCurrency(row.bill.totalAmount)}
                    </p>
                    {isExpanded ? (
                      <ChevronUp size={18} strokeWidth={1.75} className="text-ink-muted" />
                    ) : (
                      <ChevronDown size={18} strokeWidth={1.75} className="text-ink-muted" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <BillPayments
                      bill={row.bill}
                      payments={payments}
                      isOwner={isOwner}
                      onEditPayment={(payment) =>
                        setEditingPayment({ billLocalId: row.bill.id, payment })
                      }
                      onVoidPayment={(payment) => setVoidingPayment(payment)}
                    />

                    {editingPayment?.payment.billId === row.bill.firestoreId ? (
                      <PaymentForm
                        maxAmount={row.balance}
                        initialValues={{
                          amount: editingPayment.payment.amount,
                          type: editingPayment.payment.type,
                          date: editingPayment.payment.date,
                        }}
                        onSubmit={handleUpdatePayment}
                        onCancel={() => setEditingPayment(null)}
                        submitLabel={gu.rojmer.saveChanges}
                      />
                    ) : (
                      !row.isCleared && (
                        <PaymentForm
                          maxAmount={row.balance}
                          onSubmit={(values) =>
                            handleAddPayment(row.bill.id, row.bill.firestoreId, row.balance, values)
                          }
                          submitLabel={gu.rojmer.recordPayment}
                        />
                      )
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {voidingPayment && (
        <VoidConfirmDialog
          payment={voidingPayment}
          onConfirm={handleConfirmVoid}
          onCancel={() => setVoidingPayment(null)}
        />
      )}
    </div>
  )
}
