// Jansa Silak (daily cash position) — Phase 7. Day / Month / Year
// tabs. See useJansaSilak.js's header comment for the જમા/ઉધાર
// interpretation this screen displays — flagged there and in
// memory.md as needing owner validation against real numbers.

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useJansaSilak, useJansaSilakRange } from '../../hooks/useJansaSilak'
import { formatCurrency } from '../../utils/calc'
import { todayKeyIST, monthBounds, financialYearBounds } from '../../utils/dates'
import gu from '../../locales/gu.json'
import ManualEntryForm from './ManualEntryForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import {
  buildDayRows,
  buildDayPdfColumns,
  buildRangeRows,
  buildRangePdfColumns,
} from './silakExport'

function DayView() {
  const { user } = useAuth()
  const [date, setDate] = useState(todayKeyIST())
  const [mode, setMode] = useState('list') // 'list' | 'add' | { edit }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const { loading, day, addEntry, updateEntry, deleteEntry } = useJansaSilak(date)

  const editingEntry =
    typeof mode === 'object' && mode.edit != null
      ? day?.entries.find((e) => e.isManual && e.id === mode.edit)
      : null

  async function handleAdd(values) {
    await addEntry({ ...values, createdBy: user?.email })
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

  function doExport(format) {
    if (!day) return
    const rows = buildDayRows(day)
    const filename = `silak_${date}`
    const title = `Jansa Silak — ${date}`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'Silak')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildDayPdfColumns(), filename, title)
  }

  function handlePrint() {
    if (!day) return
    printRows(buildDayRows(day), buildDayPdfColumns(), `Jansa Silak — ${date}`)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-caption text-ink-muted mb-1.5">{gu.silak.dateField}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-body text-ink bg-surface border border-border rounded-xl py-2 px-3 min-h-11"
          />
        </div>
        {mode === 'list' && (
          <button
            type="button"
            onClick={() => setMode('add')}
            className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body"
          >
            <Plus size={18} strokeWidth={2} />
            {gu.silak.addManualEntry}
          </button>
        )}
        {day && day.entries.length > 0 && (
          <>
            <PrintButton onClick={handlePrint} />
            <ExportMenu
              label="Export day"
              onExportExcel={() => doExport('excel')}
              onExportCSV={() => doExport('csv')}
              onExportPDF={() => doExport('pdf')}
            />
          </>
        )}
      </div>

      {mode === 'add' && (
        <div className="card px-5 py-5 mb-4">
          <ManualEntryForm defaultDate={date} onSubmit={handleAdd} onCancel={() => setMode('list')} />
        </div>
      )}

      {editingEntry && (
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

      {loading || !day ? (
        <p className="text-caption text-ink-muted">Loading…</p>
      ) : (
        <>
          <div className="card px-4 py-3 mb-3 flex items-center justify-between">
            <p className="text-body text-ink-muted">{gu.silak.openingLabel}</p>
            <p className="font-numeric text-body text-ink font-semibold">
              {formatCurrency(day.openingBalance)}
            </p>
          </div>

          {day.entries.length === 0 ? (
            <div className="card px-5 py-5 max-w-md mb-3">
              <p className="text-body text-ink-muted">{gu.silak.noEntries}</p>
            </div>
          ) : (
            <ul className="space-y-2 mb-3">
              {day.entries.map((entry) => (
                <li key={entry.key} className="card px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body text-ink truncate">{entry.label}</p>
                    <p className="text-caption text-ink-muted">
                      {entry.side === 'jama' ? gu.silak.jamaLabel : gu.silak.udharLabel}
                      {entry.isManual && <span> · {gu.silak.manualBadge}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <p
                      className={`font-numeric text-body font-semibold ${
                        entry.side === 'jama' ? 'text-accent' : 'text-danger'
                      }`}
                    >
                      {entry.side === 'jama' ? '+' : '−'}
                      {formatCurrency(entry.amount)}
                    </p>
                    {entry.isManual && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMode({ edit: entry.id })}
                          aria-label="Edit entry"
                          className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-accent"
                        >
                          <Pencil size={16} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          aria-label="Delete entry"
                          className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-danger"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="card px-4 py-3 flex items-center justify-between bg-accent-soft">
            <p className="text-body text-ink font-semibold">{gu.silak.closingLabel}</p>
            <p className="font-numeric text-heading text-ink font-semibold">
              {formatCurrency(day.closingBalance)}
            </p>
          </div>
        </>
      )}

      {confirmDeleteId != null && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
          <div className="card px-5 py-5 max-w-sm w-full">
            <p className="text-body text-ink mb-4">{gu.silak.deleteConfirm}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 min-h-11 rounded-xl bg-danger text-surface font-semibold text-body"
              >
                {gu.silak.confirmDelete}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
              >
                {gu.silak.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RangeView({ mode }) {
  const today = todayKeyIST()
  const bounds = mode === 'month' ? monthBounds(today) : financialYearBounds(today)
  const [fromDate, setFromDate] = useState(bounds.start)
  const [toDate, setToDate] = useState(bounds.end)
  const { loading, days } = useJansaSilakRange(fromDate, toDate)

  function doExport(format) {
    const rows = buildRangeRows(days)
    const filename = `silak_${mode}_${fromDate}_to_${toDate}`
    const title = `Jansa Silak — ${fromDate} to ${toDate}`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'Silak')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildRangePdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(buildRangeRows(days), buildRangePdfColumns(), `Jansa Silak — ${fromDate} to ${toDate}`)
  }

  return (
    <div>
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
        {days.length > 0 && (
          <>
            <PrintButton onClick={handlePrint} />
            <ExportMenu
              label={`Export (${days.length} days)`}
              onExportExcel={() => doExport('excel')}
              onExportCSV={() => doExport('csv')}
              onExportPDF={() => doExport('pdf')}
            />
          </>
        )}
      </div>

      {loading ? (
        <p className="text-caption text-ink-muted">Loading…</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-caption text-ink-muted text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">{gu.silak.openingLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.silak.jamaLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.silak.udharLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.silak.closingLabel}</th>
              </tr>
            </thead>
            <tbody className="font-numeric">
              {days.map((day) => (
                <tr key={day.date} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{day.date}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(day.openingBalance)}</td>
                  <td className="px-4 py-3 text-right text-accent">{formatCurrency(day.jamaTotal)}</td>
                  <td className="px-4 py-3 text-right text-danger">{formatCurrency(day.udharTotal)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(day.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SilakScreen() {
  const [tab, setTab] = useState('day') // 'day' | 'month' | 'year'

  return (
    <div>
      <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
        {gu.silak.titleGu}
      </p>
      <h1 className="font-display text-heading text-ink font-semibold mt-1 mb-4">Jansa Silak</h1>

      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          ['day', gu.silak.dayTab],
          ['month', gu.silak.monthTab],
          ['year', gu.silak.yearTab],
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

      {tab === 'day' ? <DayView /> : <RangeView mode={tab} />}
    </div>
  )
}
