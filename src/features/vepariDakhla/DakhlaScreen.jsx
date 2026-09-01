// Vepari Dakhla (auto-ledger) — Phase 5. No manual entry step: every
// saved bill (Phase 4) automatically appears here, grouped by vepari,
// with tolai/shes/commission/total computed live via calc.js. Two
// views, matching prd.md §4.2's two export requirements: a single
// vepari's full ledger, or an all-veparis summary for a date range.

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useVeparis } from '../../hooks/useVeparis'
import { useBills } from '../../hooks/useBills'
import { useBusiness } from '../../hooks/useBusiness'
import { useVepariDakhla, useAllVepariDakhlaSummary } from '../../hooks/useVepariDakhla'
import { formatCurrency } from '../../utils/calc'
import { todayKeyIST } from '../../utils/dates'
import gu from '../../locales/gu.json'
import BillForm, { billToFormValues } from '../bills/BillForm'
import ExportMenu from '../../components/ExportMenu'
import PrintButton from '../../components/PrintButton'
import { exportRowsToExcel, exportRowsToCSV, exportRowsToPDF, printRows } from '../../utils/export'
import { printDakhla } from './dakhlaPrint'
import {
  buildVepariLedgerRows,
  buildVepariLedgerPdfColumns,
  buildAllVepariSummaryRows,
  buildAllVepariSummaryPdfColumns,
} from './dakhlaExport'

function SingleVepariLedger() {
  const { user } = useAuth()
  const { veparis } = useVeparis()
  const { updateBill } = useBills()
  const { business } = useBusiness()
  const [vepariId, setVepariId] = useState('')
  const [editingLocalId, setEditingLocalId] = useState(null)
  const { vepari, lines, totals, loading } = useVepariDakhla(vepariId)

  const editingLine = lines.find((l) => l.bill.id === editingLocalId)

  async function handleUpdate(payload) {
    await updateBill(editingLocalId, payload, user?.email)
    setEditingLocalId(null)
  }

  function doExport(format) {
    const rows = buildVepariLedgerRows(lines)
    const filename = `dakhla_${vepari?.name?.replace(/\s+/g, '_') || 'vepari'}`
    const title = `${vepari?.name} — Vepari Dakhla`
    if (format === 'excel') exportRowsToExcel(rows, filename, 'Dakhla')
    if (format === 'csv') exportRowsToCSV(rows, filename)
    if (format === 'pdf') exportRowsToPDF(rows, buildVepariLedgerPdfColumns(), filename, title)
  }

  function handlePrint() {
    printDakhla(vepari, lines, totals.total, { business })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-caption text-ink-muted mb-1.5">
            {gu.dakhla.selectVepariLabel}
          </label>
          <select
            value={vepariId}
            onChange={(e) => setVepariId(e.target.value)}
            className="text-body text-ink bg-surface border border-border rounded-xl py-2.5 px-3 min-h-11 min-w-48"
          >
            <option value="">—</option>
            {veparis.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {vepariId && lines.length > 0 && (
          <>
            <PrintButton onClick={handlePrint} />
            <ExportMenu
              label="Export ledger"
              onExportExcel={() => doExport('excel')}
              onExportCSV={() => doExport('csv')}
              onExportPDF={() => doExport('pdf')}
            />
          </>
        )}
      </div>

      {editingLine && (
        <div className="card px-5 py-5 mb-6">
          <BillForm
            initialValues={billToFormValues(editingLine.bill)}
            onSubmit={handleUpdate}
            onCancel={() => setEditingLocalId(null)}
            submitLabel={gu.bills.saveChanges}
          />
        </div>
      )}

      {!vepariId ? (
        <p className="text-body text-ink-muted">Select a vepari to see their ledger.</p>
      ) : loading ? (
        <p className="text-caption text-ink-muted">Loading…</p>
      ) : lines.length === 0 ? (
        <div className="card px-5 py-5 max-w-md">
          <p className="text-body text-ink-muted">
            No bills for {vepari?.name} yet — they'll appear here as soon as one's saved.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-caption text-ink-muted text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">{gu.bills.entryNumberLabel}</th>
                <th className="px-4 py-3 font-medium">Farmer</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.weightLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.goodsAmountLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.tolaiLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.shesLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.commissionLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.totalLabel}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="font-numeric">
              {lines.map((line) => (
                <tr key={line.bill.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{line.bill.date}</td>
                  <td className="px-4 py-3">{line.bill.entryNumber}</td>
                  <td className="px-4 py-3 font-sans">{line.bill.farmerName}</td>
                  <td className="px-4 py-3 text-right">{line.weightKg}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(line.goodsAmount)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(line.tolai)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(line.shes)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(line.commission)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(line.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingLocalId(line.bill.id)}
                      aria-label={`Edit bill ${line.bill.entryNumber}`}
                      className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-accent"
                    >
                      <Pencil size={16} strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-accent-soft font-numeric font-semibold">
                <td className="px-4 py-3" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-3 text-right">{totals.weightKg}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.goodsAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.tolai)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.shes)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.commission)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totals.total)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function AllVepariSummary() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const { rows, loading } = useAllVepariDakhlaSummary(fromDate, toDate)

  function doExport(format) {
    const exportRows = buildAllVepariSummaryRows(rows)
    const range = fromDate || toDate ? `${fromDate || 'start'}_to_${toDate || todayKeyIST()}` : 'all'
    const filename = `dakhla_summary_${range}`
    const title = 'Vepari Dakhla — All veparis'
    if (format === 'excel') exportRowsToExcel(exportRows, filename, 'Dakhla Summary')
    if (format === 'csv') exportRowsToCSV(exportRows, filename)
    if (format === 'pdf') exportRowsToPDF(exportRows, buildAllVepariSummaryPdfColumns(), filename, title)
  }

  function handlePrint() {
    printRows(buildAllVepariSummaryRows(rows), buildAllVepariSummaryPdfColumns(), 'Vepari Dakhla — All veparis')
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
        {rows.length > 0 && (
          <>
            <PrintButton onClick={handlePrint} />
            <ExportMenu
              label={`Export summary (${rows.length})`}
              onExportExcel={() => doExport('excel')}
              onExportCSV={() => doExport('csv')}
              onExportPDF={() => doExport('pdf')}
            />
          </>
        )}
      </div>

      {loading ? (
        <p className="text-caption text-ink-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card px-5 py-5 max-w-md">
          <p className="text-body text-ink-muted">No bills in that range yet.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-caption text-ink-muted text-left">
                <th className="px-4 py-3 font-medium">Vepari</th>
                <th className="px-4 py-3 font-medium">Village</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.billCountLabel}</th>
                <th className="px-4 py-3 font-medium text-right">{gu.dakhla.totalLabel}</th>
              </tr>
            </thead>
            <tbody className="font-numeric">
              {rows.map(({ vepari, billCount, totals }) => (
                <tr key={vepari.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-sans">{vepari.name}</td>
                  <td className="px-4 py-3 font-sans text-ink-muted">{vepari.village}</td>
                  <td className="px-4 py-3 text-right">{billCount}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(totals.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DakhlaScreen() {
  const [tab, setTab] = useState('single') // 'single' | 'all'

  return (
    <div>
      <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
        {gu.dakhla.titleGu}
      </p>
      <h1 className="font-display text-heading text-ink font-semibold mt-1 mb-4">Vepari Dakhla</h1>

      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('single')}
          className={`px-4 py-2.5 text-body -mb-px border-b-2 ${
            tab === 'single' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-muted'
          }`}
        >
          {gu.dakhla.singleVepariTab}
        </button>
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-4 py-2.5 text-body -mb-px border-b-2 ${
            tab === 'all' ? 'border-accent text-accent font-semibold' : 'border-transparent text-ink-muted'
          }`}
        >
          {gu.dakhla.allVeparisTab}
        </button>
      </div>

      {tab === 'single' ? <SingleVepariLedger /> : <AllVepariSummary />}
    </div>
  )
}
