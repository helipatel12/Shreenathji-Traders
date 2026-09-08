import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import { db as localDb } from '../../db/localDb'
import { flushPendingWrites } from '../../sync/syncEngine'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'

function isQueued(row) {
  return row.syncStatus === 'pending' || row.syncStatus === 'pendingDelete'
}

export default function QueueMonitorScreen() {
  const { isOwner } = useAuth()
  const { t, formatDate } = useLocale()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [flushing, setFlushing] = useState(false)
  const [flushMessage, setFlushMessage] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)

  async function loadQueue() {
    const [bills, payments, vepariPayments, silak, veparis] = await Promise.all([
      localDb.bills.toArray(),
      localDb.payments.toArray(),
      localDb.vepariPayments.toArray(),
      localDb.silakEntries.toArray(),
      localDb.veparis.toArray(),
    ])
    return [
      ...bills.filter(isQueued).map((r) => ({
        key: `bill-${r.id}`,
        type: 'bill',
        label: `${t('bills.entryNumberLabel')} ${r.entryNumber ?? '—'} · ${r.farmerName || ''}`,
        date: r.date,
        detail:
          r.syncStatus === 'pendingDelete'
            ? t('admin.pendingDelete')
            : r.firestoreId || t('admin.localOnly'),
      })),
      ...payments.filter(isQueued).map((r) => ({
        key: `payment-${r.id}`,
        type: 'payment',
        label: `${t('rojmer.amountLabel')} ${r.amount}`,
        date: r.date,
        detail:
          r.syncStatus === 'pendingDelete'
            ? t('admin.pendingDelete')
            : r.billId || t('admin.localOnly'),
      })),
      ...vepariPayments.filter(isQueued).map((r) => ({
        key: `vepariPayment-${r.id}`,
        type: 'vepariPayment',
        label: `${t('vepariPay.amountLabel')} ${r.amount}`,
        date: r.date,
        detail:
          r.syncStatus === 'pendingDelete'
            ? t('admin.pendingDelete')
            : r.billId || t('admin.localOnly'),
      })),
      ...silak.filter(isQueued).map((r) => ({
        key: `silak-${r.id}`,
        type: 'silak',
        label: r.label || t('nav.silak'),
        date: r.date,
        detail: r.syncStatus === 'pendingDelete' ? t('admin.pendingDelete') : r.side,
      })),
      ...veparis.filter(isQueued).map((r) => ({
        key: `vepari-${r.id}`,
        type: 'vepari',
        label: r.name,
        date: '',
        detail:
          r.syncStatus === 'pendingDelete'
            ? t('admin.pendingDelete')
            : r.village || '',
      })),
    ]
  }

  useEffect(() => {
    if (!isOwner) return undefined
    let cancelled = false

    async function load() {
      const queue = await loadQueue()
      if (cancelled) return
      setItems(queue)
      setLoading(false)
    }

    load()
    const id = setInterval(load, 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, isOwner])

  async function handleFlush() {
    setFlushing(true)
    setFlushMessage('')
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setFlushMessage(t('admin.queueOffline'))
        return
      }
      const result = await flushPendingWrites()
      if (result?.skipped === 'offline') {
        setFlushMessage(t('admin.queueOffline'))
      }
      setItems(await loadQueue())
    } finally {
      setFlushing(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((row) => {
      if (typeFilter && row.type !== typeFilter) return false
      if (!q) return true
      return (
        row.label.toLowerCase().includes(q) ||
        String(row.detail).toLowerCase().includes(q) ||
        row.type.includes(q)
      )
    })
  }, [items, search, typeFilter])

  if (!isOwner) return <Navigate to="/" replace />

  const columns = [
    {
      key: 'type',
      header: t('admin.queueType'),
      filter: {
        value: typeFilter,
        onChange: setTypeFilter,
        allLabel: t('admin.allTypes'),
        options: [
          { value: 'bill', label: t('admin.type.bill') },
          { value: 'payment', label: t('admin.type.payment') },
          { value: 'vepariPayment', label: t('admin.type.vepariPayment') },
          { value: 'silak', label: t('admin.type.silak') },
          { value: 'vepari', label: t('admin.type.vepari') },
        ],
      },
      render: (row) => <span className="badge badge-gray">{t(`admin.type.${row.type}`)}</span>,
    },
    {
      key: 'label',
      header: t('admin.queueItem'),
      render: (row) => <span className="font-semibold">{row.label}</span>,
    },
    {
      key: 'date',
      header: t('bills.dateLabel'),
      render: (row) => (row.date ? formatDate(row.date) : '—'),
    },
    {
      key: 'detail',
      header: t('admin.queueDetail'),
      render: (row) => <span className="text-ink-muted">{row.detail}</span>,
    },
  ]

  return (
    <div>
      <h1 className="page-title">{t('admin.queueTitle')}</h1>
      <p className="text-body text-ink-muted mt-1 mb-4">{t('admin.queueSubtitle')}</p>
      {flushMessage ? (
        <p className="text-caption text-danger mb-3" role="status">
          {flushMessage}
        </p>
      ) : null}

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey="key"
          selectedKey={selectedKey}
          onRowClick={(row) => setSelectedKey((k) => (k === row.key ? null : row.key))}
          empty={<p className="text-body text-ink-muted">{t('admin.queueEmpty')}</p>}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('admin.searchQueue')}
              actions={
                <button
                  type="button"
                  className="btn-primary"
                  disabled={flushing || items.length === 0}
                  onClick={handleFlush}
                >
                  {flushing ? t('common.syncing') : t('admin.retrySync')}
                </button>
              }
            />
          }
        />
      )}
    </div>
  )
}
