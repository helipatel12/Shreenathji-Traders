// Jansa Silak (daily cash position) — Phase 7. Day / Month / Year
// tabs. See useJansaSilak.js's header comment for the જમા/ઉધાર
// interpretation this screen displays — flagged there and in
// memory.md as needing owner validation against real numbers.

import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useJansaSilak, useJansaSilakRange } from '../../hooks/useJansaSilak'
import { useLocale } from '../../context/LocaleContext'
import { todayKeyIST, monthBounds, financialYearBounds, orderedDateRange } from '../../utils/dates'
import ManualEntryForm from './ManualEntryForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import CreatedByLine from '../../components/CreatedByLine'
import { SkeletonTable } from '../../components/Skeleton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { resolveCreatedByName } from '../../utils/createdBy'
import {
  buildDayRows,
  buildDayPdfColumns,
  buildRangeRows,
  buildRangePdfColumns,
} from './silakExport'

/** Expanded month/year row — lists every line that makes up જમા / ઉધાર. */
function DayEntriesBreakdown({ day, currentUser }) {
  const { t, formatCurrency } = useLocale()

  const entries = day?.entries || []
  const sortGuAsc = (list) =>
    list.slice().sort((a, b) =>
      String(a.label || '').localeCompare(String(b.label || ''), 'gu', { sensitivity: 'base' }),
    )
  const jama = sortGuAsc(entries.filter((e) => e.side === 'jama'))
  const udhar = sortGuAsc(entries.filter((e) => e.side === 'udhar'))

  function SideBlock({ title, lines, total, emptyLabel, tone }) {
    const amountClass = tone === 'success' ? 'text-success' : 'text-danger'
    return (
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
            {title}
          </p>
          <p className={`font-numeric text-caption font-semibold ${amountClass}`}>
            {formatCurrency(total)}
          </p>
        </div>
        {lines.length === 0 ? (
          <p className="text-caption text-ink-muted">{emptyLabel}</p>
        ) : (
          <ul className="divide-y divide-border/70 rounded-xl border border-border bg-surface overflow-hidden">
            {lines.map((entry) => (
              <li
                key={entry.key || `${entry.side}-${entry.label}-${entry.amount}`}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-body text-ink font-medium break-words">{entry.label}</p>
                  {entry.isManual ? (
                    <span className="badge badge-gray mt-1">{t('silak.manualBadge')}</span>
                  ) : null}
                  {(entry.createdByName || entry.createdBy) && (
                    <p className="text-caption text-ink-muted mt-1">
                      {t('common.createdBy')}: {resolveCreatedByName(entry, currentUser)}
                    </p>
                  )}
                </div>
                <p className={`shrink-0 font-numeric font-semibold ${amountClass}`}>
                  {tone === 'success' ? '+' : '−'}
                  {formatCurrency(entry.amount)}
                </p>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-muted">
              <p className="text-caption font-semibold text-ink">{t('silak.linesTotal')}</p>
              <p className={`font-numeric font-semibold ${amountClass}`}>
                {formatCurrency(total)}
              </p>
            </li>
          </ul>
        )}
      </div>
    )
  }

  if (!entries.length) {
    return <p className="text-body text-ink-muted">{t('silak.noEntries')}</p>
  }

  return (
    <div className="space-y-4 py-1">
      <p className="text-caption font-semibold text-ink">{t('silak.dayBreakdownTitle')}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <SideBlock
          title={t('silak.jamaBreakdown')}
          lines={jama}
          total={day.jamaTotal}
          emptyLabel={t('silak.noJamaLines')}
          tone="success"
        />
        <SideBlock
          title={t('silak.udharBreakdown')}
          lines={udhar}
          total={day.udharTotal}
          emptyLabel={t('silak.noUdharLines')}
          tone="danger"
        />
      </div>
    </div>
  )
}

function DayView() {
  const { user, canWrite, isOwner } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const [date, setDate] = useState(todayKeyIST())
  const [mode, setMode] = useState('list')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [selectedKey, setSelectedKey] = useState(null)
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState('')
  const { loading, day, addEntry, updateEntry, deleteEntry } = useJansaSilak(date)

  const editingEntry =
    typeof mode === 'object' && mode.edit != null
      ? day?.entries.find((e) => e.isManual && e.id === mode.edit)
      : null

  const filteredEntries = useMemo(() => {
    const entries = day?.entries || []
    const q = search.trim().toLowerCase()
    return entries.filter((entry) => {
      if (sideFilter && entry.side !== sideFilter) return false
      if (!q) return true
      return String(entry.label || '').toLowerCase().includes(q)
    })
  }, [day, search, sideFilter])

  async function handleAdd(values) {
    await addEntry({
      ...values,
      createdBy: user?.email,
      createdByName: user?.name || user?.email || '',
    })
    setMode('list')
  }

  async function handleUpdate(values) {
    await updateEntry(editingEntry.id, values)
    setMode('list')
  }

  async function confirmDelete() {
    await deleteEntry(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  async function doExport(format) {
    if (!day) return
    const rows = buildDayRows(day)
    const filename = `silak_${date}`
    const title = `Jansa Silak — ${date}`
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Silak')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildDayPdfColumns(), filename, title)
  }

  function handlePrint() {
    if (!day) return
    printRows(buildDayRows(day), buildDayPdfColumns(), `Jansa Silak — ${date}`)
  }

  async function exportOne(entry, format) {
    const rows = buildDayRows({
      entries: [entry],
      openingBalance: 0,
      closingBalance: 0,
    }).slice(0, 1)
    const filename = `silak_${date}_${entry.key || entry.id || 'entry'}`
    const title = `Jansa Silak — ${entry.label}`
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Silak')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildDayPdfColumns(), filename, title)
  }

  function printOne(entry) {
    const rows = buildDayRows({
      entries: [entry],
      openingBalance: 0,
      closingBalance: 0,
    }).slice(0, 1)
    printRows(rows, buildDayPdfColumns(), `Jansa Silak — ${entry.label}`)
  }

  const columns = [
    {
      key: 'label',
      header: t('silak.labelField'),
      render: (entry) => (
        <div>
          <p className="font-semibold">{entry.label}</p>
          {entry.isManual && (
            <span className="badge badge-gray mt-1">{t('silak.manualBadge')}</span>
          )}
        </div>
      ),
    },
    {
      key: 'side',
      header: t('silak.sideField'),
      filter: {
        value: sideFilter,
        onChange: setSideFilter,
        allLabel: t('silak.allSides'),
        options: [
          { value: 'jama', label: t('silak.jamaLabel') },
          { value: 'udhar', label: t('silak.udharLabel') },
        ],
      },
      render: (entry) =>
        entry.side === 'jama' ? (
          <span className="badge badge-green">{t('silak.jamaLabel')}</span>
        ) : (
          <span className="badge badge-red">{t('silak.udharLabel')}</span>
        ),
    },
    {
      key: 'amount',
      header: t('silak.amountField'),
      align: 'right',
      render: (entry) => (
        <span
          className={`font-semibold ${entry.side === 'jama' ? 'text-success' : 'text-danger'}`}
        >
          {entry.side === 'jama' ? '+' : '−'}
          {formatCurrency(entry.amount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (entry) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printOne(entry)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOne(entry, 'excel')}
            onExportCSV={() => exportOne(entry, 'csv')}
            onExportPDF={() => exportOne(entry, 'pdf')}
          />
          {entry.isManual && canWrite && (
            <button
              type="button"
              className="action-btn action-btn-edit"
              aria-label={t('common.edit')}
              onClick={() => setMode({ edit: entry.id })}
            >
              <Pencil size={14} strokeWidth={2} />
            </button>
          )}
          {entry.isManual && isOwner && (
            <button
              type="button"
              className="action-btn action-btn-danger"
              aria-label={t('common.delete')}
              onClick={() => setConfirmDeleteId(entry.id)}
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {mode === 'list' && canWrite && (
          <button type="button" onClick={() => setMode('add')} className="btn-primary ml-auto">
            <Plus size={18} strokeWidth={2} />
            {t('silak.addManualEntry')}
          </button>
        )}
      </div>

      {mode === 'add' && canWrite && (
        <div className="card px-5 py-5 mb-4">
          <ManualEntryForm defaultDate={date} onSubmit={handleAdd} onCancel={() => setMode('list')} />
        </div>
      )}

      {editingEntry && canWrite && (
        <div className="card px-5 py-5 mb-4">
          <ManualEntryForm
            initialValues={{
              label: editingEntry.label,
              amount: editingEntry.amount,
              side: editingEntry.side,
              date: editingEntry.date,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setMode('list')}
          />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : !date ? (
        <p className="text-body text-ink-muted card px-5 py-6">{t('silak.pickDate')}</p>
      ) : !day ? (
        <p className="text-body text-ink-muted card px-5 py-6">{t('silak.noEntries')}</p>
      ) : (
        <>
          <div className="card px-4 py-3 mb-3 flex items-center justify-between">
            <p className="text-body text-ink-muted">{t('silak.openingLabel')}</p>
            <p className="font-numeric text-body text-ink font-semibold">
              {formatCurrency(day.openingBalance)}
            </p>
          </div>

          <DataTable
            columns={columns}
            rows={filteredEntries}
            rowKey="key"
            selectedKey={selectedKey}
            onRowClick={(entry) =>
              setSelectedKey((k) => (k === entry.key ? null : entry.key))
            }
            empty={<p className="text-body text-ink-muted">{t('silak.noEntries')}</p>}
            meta={t('common.showingCount', { count: formatDigits(filteredEntries.length) })}
            toolbar={
              <TableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={t('silak.searchPlaceholder')}
                actions={
                  <>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value)
                        setSelectedKey(null)
                      }}
                      aria-label={t('silak.dateField')}
                      className="text-body text-ink bg-surface border border-border rounded-lg py-2 px-3 min-h-10"
                    />
                    {day.entries.length > 0 && (
                      <>
                        <PrintButton onClick={handlePrint} />
                        <ExportMenu
                          label={t('silak.exportDay')}
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
            renderExpanded={(entry) => (
              <div className="space-y-2">
                <p className="text-caption text-ink-muted">
                  {entry.side === 'jama' ? t('silak.jamaLabel') : t('silak.udharLabel')} ·{' '}
                  {formatCurrency(entry.amount)}
                  {entry.isManual ? ` · ${t('silak.manualBadge')}` : ''}
                </p>
                {(entry.createdByName || entry.createdBy) && (
                  <CreatedByLine record={entry} currentUser={user} />
                )}
              </div>
            )}
          />

          <div className="card px-4 py-3 mt-3 bg-accent-soft space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-body text-ink-muted">{t('silak.commissionTotalLabel')}</p>
              <p className="font-numeric text-body text-ink font-semibold">
                {formatCurrency(day.commissionTotal)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-body text-ink-muted">{t('silak.shesTolaiTotalLabel')}</p>
              <p className="font-numeric text-body text-ink font-semibold">
                {formatCurrency(day.shesTolaiTotal)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <p className="text-body text-ink font-semibold">{t('silak.closingLabel')}</p>
              <p className="font-numeric text-heading text-ink font-semibold">
                {formatCurrency(day.closingBalance)}
              </p>
            </div>
          </div>
        </>
      )}

      {confirmDeleteId != null && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
          <div className="card px-5 py-5 max-w-sm w-full">
            <p className="text-body text-ink mb-4">{t('silak.deleteConfirm')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 min-h-12 rounded-xl bg-danger text-surface font-semibold text-body"
              >
                {t('silak.confirmDelete')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
              >
                {t('silak.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RangeView({ mode }) {
  const { user } = useAuth()
  const { t, formatCurrency, formatDigits, formatDate } = useLocale()
  const today = todayKeyIST()
  const bounds = mode === 'month' ? monthBounds(today) : financialYearBounds(today)
  const [fromDate, setFromDate] = useState(bounds.start)
  const [toDate, setToDate] = useState(bounds.end)
  const [selectedDate, setSelectedDate] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const range = orderedDateRange(fromDate, toDate)
  const { loading, days, rangeFees } = useJansaSilakRange(range.fromDate, range.toDate)

  const sortedDays = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1
    return days.slice().sort((a, b) => {
      if (a.date < b.date) return -1 * dir
      if (a.date > b.date) return 1 * dir
      return 0
    })
  }, [days, sortDir])

  async function doExport(format) {
    const rows = buildRangeRows(sortedDays)
    const filename = `silak_${mode}_${fromDate}_to_${toDate}`
    const title = `Jansa Silak — ${fromDate} to ${toDate}`
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Silak')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildRangePdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(buildRangeRows(sortedDays), buildRangePdfColumns(), `Jansa Silak — ${fromDate} to ${toDate}`)
  }

  async function exportOne(day, format) {
    const rows = buildRangeRows([day])
    const filename = `silak_${day.date}`
    const title = `Jansa Silak — ${day.date}`
    if (format === 'excel') await exportRowsToExcel(rows, filename, 'Silak')
    if (format === 'csv') await exportRowsToCSV(rows, filename)
    if (format === 'pdf') await exportRowsToPDF(rows, buildRangePdfColumns(), filename, title)
  }

  function printOne(day) {
    printRows(buildRangeRows([day]), buildRangePdfColumns(), `Jansa Silak — ${day.date}`)
  }

  const columns = [
    {
      key: 'date',
      header: t('silak.dateField'),
      filter: {
        value: sortDir,
        onChange: (value) => setSortDir(value || 'asc'),
        allLabel: t('bills.sortDate'),
        options: [
          { value: 'asc', label: t('bills.sortDateOlder') },
          { value: 'desc', label: t('bills.sortDateNewer') },
        ],
      },
      render: (day) => (
        <span className="font-numeric whitespace-nowrap">{formatDate(day.date)}</span>
      ),
    },
    {
      key: 'opening',
      header: t('silak.openingLabel'),
      align: 'right',
      render: (day) => formatCurrency(day.openingBalance),
    },
    {
      key: 'jama',
      header: t('silak.jamaLabel'),
      align: 'right',
      render: (day) => (
        <span className="text-success">{formatCurrency(day.jamaTotal)}</span>
      ),
    },
    {
      key: 'udhar',
      header: t('silak.udharLabel'),
      align: 'right',
      render: (day) => (
        <span className="text-danger">{formatCurrency(day.udharTotal)}</span>
      ),
    },
    {
      key: 'closing',
      header: t('silak.closingLabel'),
      align: 'right',
      render: (day) => (
        <span className="font-semibold">{formatCurrency(day.closingBalance)}</span>
      ),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (day) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <PrintButton compact onClick={() => printOne(day)} />
          <ExportMenu
            compact
            onExportExcel={() => exportOne(day, 'excel')}
            onExportCSV={() => exportOne(day, 'csv')}
            onExportPDF={() => exportOne(day, 'pdf')}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={sortedDays}
            rowKey="date"
            selectedKey={selectedDate}
            onRowClick={(day) =>
              setSelectedDate((d) => (d === day.date ? null : day.date))
            }
            empty={<p className="text-body text-ink-muted">{t('silak.noRangeEntries')}</p>}
            meta={t('common.showingCount', { count: formatDigits(sortedDays.length) })}
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
                    {sortedDays.length > 0 && (
                      <>
                        <PrintButton onClick={handlePrint} />
                        <ExportMenu
                          label={t('silak.exportRange', { count: sortedDays.length })}
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
            renderExpanded={(day) => <DayEntriesBreakdown day={day} currentUser={user} />}
          />
          {sortedDays.length > 0 && (
            <div className="card px-4 py-3 mt-3 bg-accent-soft space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-body text-ink-muted">{t('silak.commissionTotalLabel')}</p>
                <p className="font-numeric text-body text-ink font-semibold">
                  {formatCurrency(rangeFees.commissionTotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-body text-ink-muted">{t('silak.shesTolaiTotalLabel')}</p>
                <p className="font-numeric text-body text-ink font-semibold">
                  {formatCurrency(rangeFees.shesTolaiTotal)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
                <p className="text-body text-ink font-semibold">{t('silak.closingLabel')}</p>
                <p className="font-numeric text-heading text-ink font-semibold">
                  {formatCurrency(days[days.length - 1]?.closingBalance || 0)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function SilakScreen() {
  const { canWrite } = useAuth()
  const { t } = useLocale()
  const [tab, setTab] = useState('day')

  return (
    <div>
      {!canWrite && <ReadOnlyBanner />}

      <h1 className="page-title">{t('silak.title')}</h1>
      <p className="text-body text-ink-muted mt-1 mb-4">{t('nav.silak')}</p>

      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          ['day', t('silak.dayTab')],
          ['month', t('silak.monthTab')],
          ['year', t('silak.yearTab')],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-body -mb-px border-b-2 min-h-12 ${
              tab === key ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'day' ? <DayView /> : <RangeView key={tab} mode={tab} />}
    </div>
  )
}
