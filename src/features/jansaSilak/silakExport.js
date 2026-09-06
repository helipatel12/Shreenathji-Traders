// Shapes jansa silak data into flat rows for export.js's Excel/CSV/
// PDF functions. Two shapes, per prd.md §4.4: a single day (one row
// per જમા/ઉધાર entry, opening/closing shown once), and a
// monthly/yearly sheet (one row per day, matching a real ledger
// page's day-by-day layout — design.md §4/§7).

import { formatCurrency } from '../../utils/calc'
import { formatDisplayDate } from '../../utils/dates'
import gu from '../../locales/gu.json'

export function buildDayRows(day) {
  const rows = day.entries.map((entry) => ({
    Date: formatDisplayDate(entry.date),
    [gu.silak.sideField]: entry.side === 'jama' ? gu.silak.jamaLabel : gu.silak.udharLabel,
    [gu.silak.labelField]: entry.label,
    [gu.silak.amountField]: formatCurrency(entry.amount),
    Source: entry.isManual ? gu.silak.manualBadge : 'Auto',
  }))
  rows.push({
    Date: '',
    [gu.silak.sideField]: '',
    [gu.silak.labelField]: gu.silak.openingLabel,
    [gu.silak.amountField]: formatCurrency(day.openingBalance),
    Source: '',
  })
  rows.push({
    Date: '',
    [gu.silak.sideField]: '',
    [gu.silak.labelField]: gu.silak.closingLabel,
    [gu.silak.amountField]: formatCurrency(day.closingBalance),
    Source: '',
  })
  return rows
}

export function buildDayPdfColumns() {
  return [
    { header: gu.silak.sideField, key: gu.silak.sideField },
    { header: gu.silak.labelField, key: gu.silak.labelField },
    { header: gu.silak.amountField, key: gu.silak.amountField },
    { header: 'Source', key: 'Source' },
  ]
}

export function buildRangeRows(days) {
  return days.map((day) => ({
    Date: formatDisplayDate(day.date),
    [gu.silak.openingLabel]: formatCurrency(day.openingBalance),
    [gu.silak.jamaLabel]: formatCurrency(day.jamaTotal),
    [gu.silak.udharLabel]: formatCurrency(day.udharTotal),
    [gu.silak.closingLabel]: formatCurrency(day.closingBalance),
  }))
}

export function buildRangePdfColumns() {
  return [
    { header: 'Date', key: 'Date' },
    { header: 'Opening', key: gu.silak.openingLabel },
    { header: 'Jama', key: gu.silak.jamaLabel },
    { header: 'Udhar', key: gu.silak.udharLabel },
    { header: 'Closing', key: gu.silak.closingLabel },
  ]
}
