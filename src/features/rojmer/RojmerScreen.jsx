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
import { Plus, Pencil, Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBills } from '../../hooks/useBills'
import { usePayments } from '../../hooks/usePayments'
import { useVeparis } from '../../hooks/useVeparis'
import { useBusiness } from '../../hooks/useBusiness'
import { useLocale } from '../../context/LocaleContext'
import { getBillClearingInfo, excludeVoided } from '../../utils/calc'
import { findVepari, vepariDisplayName } from '../../utils/vepari'
import { sortByNoteOrDate, noteSortFilter, dateSortFilter } from '../../utils/tableSort'
import PaymentForm from './PaymentForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import SearchableSelect from '../../components/SearchableSelect'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { printBill } from '../bills/billPrint'
import { buildRojmerRows, buildRojmerPdfColumns } from './rojmerExport'

function BillPayments({ bill, payments, canWrite, isOwner, onEditPayment, onVoidPayment }) {
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const billPayments = payments.filter(
    (p) => p.billId === bill.firestoreId && !p.isVoided,
  )
  if (billPayments.length === 0) {
    return <p className="text-caption text-ink-muted">—</p>
  }
  return (
    <ul className="space-y-1.5">
      {billPayments.map((payment) => (
        <li key={payment.id} className="flex items-center justify-between text-caption gap-2">
          <span className="text-ink">
            {formatCurrency(payment.amount)} · {t(`rojmer.${payment.type}`)} ·{' '}
            {formatDate(payment.date)}
            {payment.syncStatus === 'pending' && (
              <span className="text-accent"> · {t('common.syncing')}</span>
            )}
            {payment.editHistory?.length > 0 && (
              <span className="text-ink-muted"> · {t('common.edited')}</span>
            )}
          </span>
          {(canWrite || isOwner) && (
            <span className="flex items-center gap-0.5 shrink-0">
              {canWrite && (
                <button
                  type="button"
                  onClick={() => onEditPayment(payment)}
                  aria-label={t('common.edit')}
                  className="min-h-12 min-w-12 inline-flex items-center justify-center text-ink-muted hover:text-accent"
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onVoidPayment(payment)}
                  aria-label={t('rojmer.void')}
                  className="min-h-12 min-w-12 inline-flex items-center justify-center text-ink-muted hover:text-danger"
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

function VoidConfirmDialog({ onConfirm, onCancel }) {
  const { t } = useLocale()
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{t('rojmer.voidConfirmTitle')}</p>
        <p className="text-caption text-ink-muted mb-4">{t('rojmer.voidConfirmBody')}</p>
        <label htmlFor="void-reason" className="block text-caption text-ink-muted mb-1.5">
          {t('rojmer.voidReasonLabel')}
        </label>
        <input
          id="void-reason"
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
            {t('rojmer.confirmVoid')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {t('rojmer.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RojmerScreen() {
  const { user, canWrite, isOwner } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const { bills, loading: billsLoading } = useBills()
  const { payments, loading: paymentsLoading, addPayment, updatePayment, voidPayment } = usePayments()
  const { veparis } = useVeparis()
  const { business } = useBusiness()

  const [tab, setTab] = useState('pending')
  const [expandedBillId, setExpandedBillId] = useState(null)
  const [editingPayment, setEditingPayment] = useState(null)
  const [voidingPayment, setVoidingPayment] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState('entryNumber')
  const [sortDir, setSortDir] = useState('asc')
  const [addingPayment, setAddingPayment] = useState(false)
  const [manualBillId, setManualBillId] = useState('')

  const loading = billsLoading || paymentsLoading

  const allRows = useMemo(() => {
    return excludeVoided(bills)
      .map((bill) => ({ bill, ...getBillClearingInfo(bill, payments) }))
      .sort((a, b) => (a.bill.date < b.bill.date ? 1 : a.bill.date > b.bill.date ? -1 : 0))
  }, [bills, payments])

  const pendingRows = useMemo(() => allRows.filter((r) => !r.isCleared), [allRows])

  const pendingBillOptions = useMemo(
    () =>
      pendingRows.map((r) => ({
        value: String(r.bill.id),
        label: `${r.bill.entryNumber} · ${r.bill.farmerName} · ${vepariDisplayName(veparis, r.bill.vepariId)} · ${formatCurrency(r.balance)}`,
        searchText: `${r.bill.entryNumber} ${r.bill.farmerName} ${r.bill.farmerVillage || ''} ${vepariDisplayName(veparis, r.bill.vepariId)}`,
      })),
    [pendingRows, veparis, formatCurrency],
  )

  const manualRow = useMemo(
    () => pendingRows.find((r) => String(r.bill.id) === String(manualBillId)) || null,
    [pendingRows, manualBillId],
  )

  const filteredRows = useMemo(() => {
    let rows = allRows
    if (tab === 'pending') rows = rows.filter((r) => !r.isCleared)
    else if (tab === 'cleared') rows = rows.filter((r) => r.isCleared)

    if (statusFilter === 'pending') rows = rows.filter((r) => !r.isCleared)
    if (statusFilter === 'cleared') rows = rows.filter((r) => r.isCleared)

    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter((r) => {
        const vepari = vepariDisplayName(veparis, r.bill.vepariId).toLowerCase()
        return (
          String(r.bill.farmerName || '').toLowerCase().includes(q) ||
          String(r.bill.entryNumber || '').toLowerCase().includes(q) ||
          vepari.includes(q)
        )
      })
    }
    return sortByNoteOrDate(rows, {
      sortKey,
      sortDir,
      getNote: (r) => r.bill.entryNumber,
      getDate: (r) => r.bill.date,
    })
  }, [allRows, tab, search, statusFilter, veparis, sortKey, sortDir])

  function setNoteSort(value) {
    setSortKey('entryNumber')
    setSortDir(value || 'asc')
  }

  function setDateSort(value) {
    setSortKey('date')
    setSortDir(value || 'asc')
  }

  async function handleAddPayment(billLocalId, billFirestoreId, maxAmount, values) {
    await addPayment({ billId: billFirestoreId, ...values, createdBy: user?.email })
    setAddingPayment(false)
    setManualBillId('')
  }

  async function handleManualAddPayment(values) {
    if (!manualRow) return
    await handleAddPayment(
      manualRow.bill.id,
      manualRow.bill.firestoreId,
      manualRow.balance,
      values,
    )
  }

  function openAddPayment() {
    setAddingPayment(true)
    setEditingPayment(null)
    setExpandedBillId(null)
    setManualBillId('')
  }

  function cancelAddPayment() {
    setAddingPayment(false)
    setManualBillId('')
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

  function exportOne(row, format) {
    const exportRows = buildRojmerRows([row], veparis, payments)
    const filename = `rojmer_${row.bill.entryNumber}`
    const title = `Rojmer — ${row.bill.entryNumber}`
    if (format === 'excel') exportRowsToExcel(exportRows, filename, 'Rojmer')
    if (format === 'csv') exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') exportRowsToPDF(exportRows, buildRojmerPdfColumns(), filename, title)
  }

  function printOne(row) {
    const vepari = findVepari(veparis, row.bill.vepariId)
    printBill(row.bill, {
      business,
      vepariName: vepari?.name ?? '—',
      vepariVillage: vepari?.village,
    })
  }

  const columns = [
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
          <p className="text-caption text-ink-muted">
            {vepariDisplayName(veparis, row.bill.vepariId)}
          </p>
        </div>
      ),
    },
    {
      key: 'total',
      header: t('bills.totalLabel'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold">{formatCurrency(row.bill.totalAmount)}</span>
      ),
    },
    {
      key: 'paid',
      header: t('rojmer.paidLabel'),
      align: 'right',
      render: (row) => formatCurrency(row.totalPaid ?? 0),
    },
    {
      key: 'balance',
      header: t('rojmer.balanceLabel'),
      align: 'right',
      filter: {
        value: statusFilter || (tab === 'all' ? '' : tab),
        onChange: (value) => {
          setStatusFilter(value)
          if (value === 'pending' || value === 'cleared') setTab(value)
          else setTab('all')
        },
        allLabel: t('rojmer.allTab'),
        options: [
          { value: 'pending', label: t('rojmer.pendingTab') },
          { value: 'cleared', label: t('rojmer.clearedTab') },
        ],
      },
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
          <PrintButton compact onClick={() => printOne(row)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOne(row, 'excel')}
            onExportCSV={() => exportOne(row, 'csv')}
            onExportPDF={() => exportOne(row, 'pdf')}
          />
          {canWrite && !row.isCleared && (
            <button
              type="button"
              className="action-btn action-btn-edit"
              aria-label={t('rojmer.recordPayment')}
              onClick={() =>
                setExpandedBillId((id) => (id === row.bill.id ? null : row.bill.id))
              }
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
      {!canWrite && <ReadOnlyBanner />}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="page-title">{t('rojmer.title')}</h1>
          <p className="text-body text-ink-muted mt-1">{t('nav.rojmer')}</p>
        </div>
        {canWrite && !addingPayment && (
          <button type="button" onClick={openAddPayment} className="btn-primary">
            <Plus size={18} strokeWidth={2} />
            {t('rojmer.recordPayment')}
          </button>
        )}
      </div>

      {addingPayment && canWrite && (
        <div className="card px-5 py-5 mb-4 space-y-4">
          <div>
            <label className="block text-caption text-ink-muted mb-1.5">
              {t('rojmer.selectBillLabel')}
            </label>
            <SearchableSelect
              options={pendingBillOptions}
              value={manualBillId}
              onChange={setManualBillId}
              allowEmpty
              emptyLabel="—"
              placeholder={t('rojmer.selectBillPlaceholder')}
              searchPlaceholder={t('rojmer.searchPlaceholder')}
              aria-label={t('rojmer.selectBillLabel')}
            />
            {pendingBillOptions.length === 0 && (
              <p className="text-caption text-ink-muted mt-2">{t('rojmer.noPending')}</p>
            )}
          </div>
          {manualRow ? (
            <div className="space-y-3">
              <p className="text-caption text-ink-muted">
                {t('rojmer.balanceLabel')}:{' '}
                <span className="font-semibold text-danger">
                  {formatCurrency(manualRow.balance)}
                </span>
              </p>
              <PaymentForm
                maxAmount={manualRow.balance}
                onSubmit={handleManualAddPayment}
                onCancel={cancelAddPayment}
                submitLabel={t('rojmer.savePayment')}
              />
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={cancelAddPayment}
                className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-border">
        {[
          ['pending', t('rojmer.pendingTab')],
          ['cleared', t('rojmer.clearedTab')],
          ['all', t('rojmer.allTab')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key)
              setStatusFilter(key === 'all' ? '' : key)
              setExpandedBillId(null)
            }}
            className={`px-4 py-2.5 text-body -mb-px border-b-2 min-h-12 ${
              tab === key ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.bill.id}
          selectedKey={expandedBillId}
          onRowClick={(row) =>
            setExpandedBillId((id) => (id === row.bill.id ? null : row.bill.id))
          }
          empty={
            <p className="text-body text-ink-muted">
              {tab === 'pending'
                ? t('rojmer.noPending')
                : tab === 'cleared'
                  ? t('rojmer.noCleared')
                  : t('rojmer.noBills')}
            </p>
          }
          meta={t('common.showingCount', { count: formatDigits(filteredRows.length) })}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('rojmer.searchPlaceholder')}
              actions={
                filteredRows.length > 0 ? (
                  <>
                    <PrintButton onClick={handlePrint} />
                    <ExportMenu
                      label={t('rojmer.exportList', { count: filteredRows.length })}
                      onExportExcel={() => doExport('excel')}
                      onExportCSV={() => doExport('csv')}
                      onExportPDF={() => doExport('pdf')}
                    />
                  </>
                ) : null
              }
            />
          }
          renderExpanded={(row) => (
            <div className="space-y-4">
              {row.isCleared && (
                <p className="text-caption text-success">
                  {t('rojmer.clearedBadge')} · {formatDate(row.clearingDate)}
                </p>
              )}
              <BillPayments
                bill={row.bill}
                payments={payments}
                canWrite={canWrite}
                isOwner={isOwner}
                onEditPayment={(payment) =>
                  setEditingPayment({ billLocalId: row.bill.id, payment })
                }
                onVoidPayment={(payment) => setVoidingPayment(payment)}
              />

              {canWrite &&
                (editingPayment?.payment.billId === row.bill.firestoreId ? (
                  <PaymentForm
                    maxAmount={row.balance}
                    initialValues={{
                      amount: editingPayment.payment.amount,
                      type: editingPayment.payment.type,
                      date: editingPayment.payment.date,
                    }}
                    onSubmit={handleUpdatePayment}
                    onCancel={() => setEditingPayment(null)}
                    submitLabel={t('rojmer.saveChanges')}
                  />
                ) : (
                  !row.isCleared && (
                    <PaymentForm
                      maxAmount={row.balance}
                      onSubmit={(values) =>
                        handleAddPayment(row.bill.id, row.bill.firestoreId, row.balance, values)
                      }
                      submitLabel={t('rojmer.recordPayment')}
                    />
                  )
                ))}
            </div>
          )}
        />
      )}

      {voidingPayment && (
        <VoidConfirmDialog
          onConfirm={handleConfirmVoid}
          onCancel={() => setVoidingPayment(null)}
        />
      )}
    </div>
  )
}
