// Vepari settlement — daily total per vepari (all bills that day combined).
// Payments still store billId; a day payment is FIFO-allocated across
// that day's bills. Collection: vepariPayments.

import { useMemo, useState } from 'react'
import { Plus, Pencil, Ban } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useBills } from '../../hooks/useBills'
import { useVepariPayments } from '../../hooks/useVepariPayments'
import { useVeparis } from '../../hooks/useVeparis'
import { useBusiness } from '../../hooks/useBusiness'
import { useLocale } from '../../context/LocaleContext'
import {
  getDakhlaClearingInfo,
  excludeVoided,
  isRecordExcluded,
  resolveRates,
  allocateVepariPaymentFifo,
  summarizeVepariDayClearing,
} from '../../utils/calc'
import { findVepari, vepariDisplayName, vepariStableId } from '../../utils/vepari'
import { resolveCreatedByName } from '../../utils/createdBy'
import { sortByNoteOrDate, noteSortFilter, dateSortFilter } from '../../utils/tableSort'
import PaymentForm from '../rojmer/PaymentForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import SearchableSelect from '../../components/SearchableSelect'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { buildVepariPayRows, buildVepariPayPdfColumns } from './vepariPayExport'

function GroupPayments({ billIds, payments, canWrite, isOwner, currentUser, onEditPayment, onVoidPayment }) {
  const { t, formatCurrency, formatDate, formatDigits } = useLocale()
  const idSet = new Set(billIds)
  const groupPayments = payments
    .filter((p) => idSet.has(p.billId))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (groupPayments.length === 0) {
    return <p className="text-caption text-ink-muted">—</p>
  }
  return (
    <ul className="space-y-1.5">
      {groupPayments.map((payment) => (
        <li
          key={payment.id}
          className={`flex items-center justify-between text-caption gap-2 ${
            isRecordExcluded(payment) ? 'opacity-60' : ''
          }`}
        >
          <span className={`text-ink ${isRecordExcluded(payment) ? 'line-through' : ''}`}>
            {formatCurrency(payment.amount)} · {t(`vepariPay.${payment.type}`)} ·{' '}
            {formatDate(payment.date)}
            {` · ${t('common.createdBy')} ${resolveCreatedByName(payment, currentUser)}`}
            {isRecordExcluded(payment) ? ` · ${t('common.voided')}` : ''}
            {payment.syncStatus === 'pending' && (
              <span className="text-accent"> · {t('common.syncing')}</span>
            )}
            {payment.editHistory?.length > 0 && (
              <span className="text-ink-muted"> · {t('common.edited')}</span>
            )}
          </span>
          {!isRecordExcluded(payment) && (canWrite || isOwner) && (
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
                  aria-label={t('vepariPay.delete')}
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
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{t('vepariPay.deleteConfirmTitle')}</p>
        <p className="text-caption text-ink-muted mb-4">{t('vepariPay.deleteConfirmBody')}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onConfirm()}
            className="flex-1 min-h-12 rounded-xl bg-danger text-surface font-semibold text-body"
          >
            {t('vepariPay.confirmDelete')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {t('vepariPay.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

function buildDayRows(bills, payments, veparis, business) {
  const groups = new Map()
  for (const bill of excludeVoided(bills)) {
    if (!bill.date) continue
    const vepari = findVepari(veparis, bill.vepariId)
    const vepariKey = vepariStableId(vepari) || String(bill.vepariId || 'unknown')
    const key = `${bill.date}|${vepariKey}`
    const rates = resolveRates(vepari, business)
    const clearing = getDakhlaClearingInfo(bill, payments, rates)
    const line = { bill, ...clearing }
    const existing = groups.get(key)
    if (existing) {
      existing.billLines.push(line)
    } else {
      groups.set(key, {
        key,
        date: bill.date,
        vepariId: bill.vepariId,
        vepariKey,
        billLines: [line],
      })
    }
  }

  return [...groups.values()]
    .map((g) => {
      const summary = summarizeVepariDayClearing(g.billLines)
      const entryNumbers = g.billLines
        .map((l) => l.bill.entryNumber)
        .filter((n) => n != null)
        .sort((a, b) => Number(a) - Number(b))
      const dakhlaNumbers = g.billLines
        .map((l) => l.bill.dakhlaNumber)
        .filter((n) => n != null)
        .sort((a, b) => Number(a) - Number(b))
      return {
        ...g,
        ...summary,
        billCount: g.billLines.length,
        entryNumbers,
        dakhlaNumbers,
        sortNote: dakhlaNumbers[0] ?? entryNumbers[0] ?? 0,
        billIds: g.billLines.map((l) => l.bill.firestoreId).filter(Boolean),
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export default function VepariPayScreen() {
  const { user, canWrite, isOwner } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const { bills, loading: billsLoading } = useBills()
  const {
    payments,
    loading: paymentsLoading,
    addPayment,
    updatePayment,
    deletePayment,
  } = useVepariPayments()
  const { veparis } = useVeparis()
  const { business } = useBusiness()

  const [tab, setTab] = useState('pending')
  const [expandedKey, setExpandedKey] = useState(null)
  const [editingPayment, setEditingPayment] = useState(null)
  const [voidingPayment, setVoidingPayment] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [addingPayment, setAddingPayment] = useState(false)
  const [manualGroupKey, setManualGroupKey] = useState('')

  const loading = billsLoading || paymentsLoading

  const allRows = useMemo(
    () => buildDayRows(bills, payments, veparis, business),
    [bills, payments, veparis, business],
  )

  const pendingRows = useMemo(() => allRows.filter((r) => !r.isCleared), [allRows])

  const pendingGroupOptions = useMemo(
    () =>
      pendingRows.map((r) => ({
        value: r.key,
        label: `${formatDate(r.date)} · ${vepariDisplayName(veparis, r.vepariId)} · ${r.billCount} · ${formatCurrency(r.balance)}`,
        searchText: `${r.date} ${vepariDisplayName(veparis, r.vepariId)} ${r.dakhlaNumbers.join(' ')} ${r.entryNumbers.join(' ')}`,
      })),
    [pendingRows, veparis, formatCurrency, formatDate],
  )

  const manualRow = useMemo(
    () => pendingRows.find((r) => r.key === manualGroupKey) || null,
    [pendingRows, manualGroupKey],
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
        const vepari = vepariDisplayName(veparis, r.vepariId).toLowerCase()
        const notes = r.dakhlaNumbers.join(' ')
        const farmerNotes = r.entryNumbers.join(' ')
        const farmers = r.billLines.map((l) => l.bill.farmerName || '').join(' ').toLowerCase()
        return (
          vepari.includes(q) ||
          notes.includes(q) ||
          farmerNotes.includes(q) ||
          farmers.includes(q) ||
          r.date.includes(q)
        )
      })
    }
    return sortByNoteOrDate(rows, {
      sortKey,
      sortDir,
      getNote: (r) => r.sortNote,
      getDate: (r) => r.date,
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

  async function handleAddGroupPayment(row, values) {
    const allocations = allocateVepariPaymentFifo(row.billLines, values.amount)
    for (const part of allocations) {
      await addPayment({
        billId: part.billId,
        amount: part.amount,
        type: values.type,
        date: values.date,
        createdBy: user?.email,
        createdByName: user?.name || user?.email || '',
      })
    }
    setAddingPayment(false)
    setManualGroupKey('')
    setEditingPayment(null)
  }

  async function handleManualAddPayment(values) {
    if (!manualRow) return
    await handleAddGroupPayment(manualRow, values)
  }

  function openAddPayment() {
    setAddingPayment(true)
    setEditingPayment(null)
    setExpandedKey(null)
    setManualGroupKey('')
  }

  function cancelAddPayment() {
    setAddingPayment(false)
    setManualGroupKey('')
  }

  async function handleUpdatePayment(values) {
    await updatePayment(editingPayment.payment.id, values, user?.email)
    setEditingPayment(null)
  }

  async function handleConfirmVoid() {
    await deletePayment(voidingPayment.id, user?.email)
    setVoidingPayment(null)
  }

  async function doExport(format) {
    const exportRows = buildVepariPayRows(filteredRows, veparis, payments)
    const filename = `vepari_pay_${tab}`
    const title = `Vepari pay — ${tab}`
    if (format === 'excel') await exportRowsToExcel(exportRows, filename, 'VepariPay')
    if (format === 'csv') await exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') await exportRowsToPDF(exportRows, buildVepariPayPdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(
      buildVepariPayRows(filteredRows, veparis, payments),
      buildVepariPayPdfColumns(),
      `Vepari pay — ${tab}`,
    )
  }

  async function exportOne(row, format) {
    const exportRows = buildVepariPayRows([row], veparis, payments)
    const filename = `vepari_pay_${row.date}_${row.vepariKey}`
    const title = `Vepari pay — ${vepariDisplayName(veparis, row.vepariId)} — ${row.date}`
    if (format === 'excel') await exportRowsToExcel(exportRows, filename, 'VepariPay')
    if (format === 'csv') await exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') await exportRowsToPDF(exportRows, buildVepariPayPdfColumns(), filename, title)
  }

  function printOne(row) {
    printRows(
      buildVepariPayRows([row], veparis, payments),
      buildVepariPayPdfColumns(),
      `Vepari pay — ${vepariDisplayName(veparis, row.vepariId)} — ${row.date}`,
    )
  }

  const columns = [
    {
      key: 'entry',
      header: t('vepariPay.billsLabel'),
      filter: noteSortFilter(t, sortKey, sortDir, setNoteSort),
      render: (row) => (
        <div>
          <span className="font-numeric font-semibold">
            {formatDigits(row.billCount)}
          </span>
          <p className="text-caption text-ink-muted font-numeric">
            {row.dakhlaNumbers.map((n) => formatDigits(n)).join(', ')}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: t('bills.dateLabel'),
      filter: dateSortFilter(t, sortKey, sortDir, setDateSort),
      render: (row) => (
        <span className="font-numeric whitespace-nowrap">{formatDate(row.date)}</span>
      ),
    },
    {
      key: 'vepari',
      header: t('bills.vepariLabel'),
      render: (row) => (
        <p className="font-semibold">{vepariDisplayName(veparis, row.vepariId)}</p>
      ),
    },
    {
      key: 'total',
      header: t('vepariPay.dakhlaTotalLabel'),
      align: 'right',
      render: (row) => (
        <span className="font-semibold">{formatCurrency(row.dakhlaTotal)}</span>
      ),
    },
    {
      key: 'paid',
      header: t('vepariPay.paidLabel'),
      align: 'right',
      render: (row) => formatCurrency(row.totalPaid ?? 0),
    },
    {
      key: 'balance',
      header: t('vepariPay.balanceLabel'),
      align: 'right',
      filter: {
        value: statusFilter || (tab === 'all' ? '' : tab),
        onChange: (value) => {
          setStatusFilter(value)
          if (value === 'pending' || value === 'cleared') setTab(value)
          else setTab('all')
        },
        allLabel: t('vepariPay.allTab'),
        options: [
          { value: 'pending', label: t('vepariPay.pendingTab') },
          { value: 'cleared', label: t('vepariPay.clearedTab') },
        ],
      },
      render: (row) =>
        row.isCleared ? (
          <span className="badge badge-green">{t('vepariPay.clearedBadge')}</span>
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
              aria-label={t('vepariPay.recordPayment')}
              onClick={() => setExpandedKey((id) => (id === row.key ? null : row.key))}
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
          <h1 className="page-title">{t('vepariPay.title')}</h1>
          <p className="text-body text-ink-muted mt-1">{t('nav.vepariPay')}</p>
        </div>
        {canWrite && !addingPayment && (
          <button type="button" onClick={openAddPayment} className="btn-primary">
            <Plus size={18} strokeWidth={2} />
            {t('vepariPay.recordPayment')}
          </button>
        )}
      </div>

      {addingPayment && canWrite && (
        <div className="card px-5 py-5 mb-4 space-y-4">
          <div>
            <label className="block text-caption text-ink-muted mb-1.5">
              {t('vepariPay.selectDayLabel')}
            </label>
            <SearchableSelect
              options={pendingGroupOptions}
              value={manualGroupKey}
              onChange={setManualGroupKey}
              allowEmpty
              emptyLabel="—"
              placeholder={t('vepariPay.selectDayPlaceholder')}
              searchPlaceholder={t('vepariPay.searchPlaceholder')}
              aria-label={t('vepariPay.selectDayLabel')}
            />
            {pendingGroupOptions.length === 0 && (
              <p className="text-caption text-ink-muted mt-2">{t('vepariPay.noPending')}</p>
            )}
          </div>
          {manualRow ? (
            <div className="space-y-3">
              <p className="text-caption text-ink-muted">
                {t('vepariPay.balanceLabel')}:{' '}
                <span className="font-semibold text-danger">
                  {formatCurrency(manualRow.balance)}
                </span>
                <span className="text-ink-muted">
                  {' '}
                  · {t('vepariPay.billCountLabel', { count: formatDigits(manualRow.billCount) })}
                </span>
              </p>
              <PaymentForm
                i18nPrefix="vepariPay"
                maxAmount={manualRow.balance}
                onSubmit={handleManualAddPayment}
                onCancel={cancelAddPayment}
                submitLabel={t('vepariPay.savePayment')}
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
          ['pending', t('vepariPay.pendingTab')],
          ['cleared', t('vepariPay.clearedTab')],
          ['all', t('vepariPay.allTab')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key)
              setStatusFilter(key === 'all' ? '' : key)
              setExpandedKey(null)
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
          rowKey={(row) => row.key}
          selectedKey={expandedKey}
          onRowClick={(row) => setExpandedKey((id) => (id === row.key ? null : row.key))}
          empty={
            <p className="text-body text-ink-muted">
              {tab === 'pending'
                ? t('vepariPay.noPending')
                : tab === 'cleared'
                  ? t('vepariPay.noCleared')
                  : t('vepariPay.noBills')}
            </p>
          }
          meta={t('common.showingCount', { count: formatDigits(filteredRows.length) })}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('vepariPay.searchPlaceholder')}
              actions={
                filteredRows.length > 0 ? (
                  <>
                    <PrintButton onClick={handlePrint} />
                    <ExportMenu
                      label={t('vepariPay.exportList', { count: filteredRows.length })}
                      onExportExcel={() => doExport('excel')}
                      onExportCSV={() => doExport('csv')}
                      onExportPDF={() => doExport('pdf')}
                    />
                  </>
                ) : null
              }
            />
          }
          renderExpanded={(row) => {
            const billIdSet = new Set(row.billIds)
            const editingInGroup =
              editingPayment && billIdSet.has(editingPayment.payment.billId)
            return (
              <div className="space-y-4">
                {row.isCleared && (
                  <p className="text-caption text-success">
                    {t('vepariPay.clearedBadge')} · {formatDate(row.clearingDate)}
                  </p>
                )}
                <ul className="text-caption text-ink-muted space-y-1">
                  {row.billLines.map((line) => (
                    <li key={line.bill.firestoreId || line.bill.id}>
                      {t('bills.dakhlaNumberLabel')} {formatDigits(line.bill.dakhlaNumber)} ·{' '}
                      {t('bills.entryNumberLabel')} {formatDigits(line.bill.entryNumber)} ·{' '}
                      {line.bill.farmerName} · {formatCurrency(line.dakhlaTotal)}
                      {!line.isCleared && (
                        <span className="text-danger">
                          {' '}
                          · {t('vepariPay.balanceLabel')} {formatCurrency(line.balance)}
                        </span>
                      )}
                      <span className="block text-ink-muted">
                        {t('common.createdBy')}: {resolveCreatedByName(line.bill, user)}
                      </span>
                    </li>
                  ))}
                </ul>
                <GroupPayments
                  billIds={row.billIds}
                  payments={payments}
                  canWrite={canWrite}
                  isOwner={isOwner}
                  currentUser={user}
                  onEditPayment={(payment) => setEditingPayment({ groupKey: row.key, payment })}
                  onVoidPayment={(payment) => setVoidingPayment(payment)}
                />

                {canWrite &&
                  (editingInGroup ? (
                    <PaymentForm
                      i18nPrefix="vepariPay"
                      maxAmount={row.balance}
                      initialValues={{
                        amount: editingPayment.payment.amount,
                        type: editingPayment.payment.type,
                        date: editingPayment.payment.date,
                      }}
                      onSubmit={handleUpdatePayment}
                      onCancel={() => setEditingPayment(null)}
                      submitLabel={t('vepariPay.saveChanges')}
                    />
                  ) : (
                    !row.isCleared && (
                      <PaymentForm
                        i18nPrefix="vepariPay"
                        maxAmount={row.balance}
                        onSubmit={(values) => handleAddGroupPayment(row, values)}
                        submitLabel={t('vepariPay.recordPayment')}
                      />
                    )
                  ))}
              </div>
            )
          }}
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
