import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import { db as localDb } from '../../db/localDb'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'

export default function QueueMonitorScreen() {
  const { isOwner } = useAuth()
  const { t, formatDate } = useLocale()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)

  useEffect(() => {
    if (!isOwner) return undefined
    let cancelled = false

    async function load() {
      const [bills, payments, silak, veparis] = await Promise.all([
        localDb.bills.toArray(),
        localDb.payments.toArray(),
        localDb.silakEntries.toArray(),
        localDb.veparis.toArray(),
      ])
      if (cancelled) return
      const queue = [
        ...bills
          .filter((r) => r.syncStatus === 'pending')
          .map((r) => ({
            key: `bill-${r.id}`,
            type: 'bill',
            label: `${t('bills.entryNumberLabel')} ${r.entryNumber ?? '—'} · ${r.farmerName || ''}`,
            date: r.date,
            detail: r.firestoreId || t('admin.localOnly'),
          })),
        ...payments
          .filter((r) => r.syncStatus === 'pending')
          .map((r) => ({
            key: `payment-${r.id}`,
            type: 'payment',
            label: `${t('rojmer.amountLabel')} ${r.amount}`,
            date: r.date,
            detail: r.billId || t('admin.localOnly'),
          })),
        ...silak
          .filter((r) => r.syncStatus === 'pending')
          .map((r) => ({
            key: `silak-${r.id}`,
            type: 'silak',
            label: r.label || t('nav.silak'),
            date: r.date,
            detail: r.side,
          })),
        ...veparis
          .filter((r) => r.syncStatus === 'pending')
          .map((r) => ({
            key: `vepari-${r.id}`,
            type: 'vepari',
            label: r.name,
            date: '',
            detail: r.village || '',
          })),
      ]
      setItems(queue)
      setLoading(false)
    }

    load()
    const id = setInterval(load, 4000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [t, isOwner])

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
      render: (row) => <span className="font-numeric">{row.date ? formatDate(row.date) : '—'}</span>,
    },
    {
      key: 'status',
      header: t('admin.queueStatus'),
      render: () => <span className="badge badge-blue">{t('common.syncing')}</span>,
    },
  ]

  return (
    <div>
      <h1 className="page-title mb-1">{t('admin.queueTitle')}</h1>
      <p className="text-body text-ink-muted mb-6">{t('admin.queueSubtitle')}</p>

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
            />
          }
          renderExpanded={(row) => (
            <p className="text-body text-ink-muted">
              {row.detail}
            </p>
          )}
        />
      )}
    </div>
  )
}
