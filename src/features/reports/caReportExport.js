// Flat row shapers for Phase 10 CA / reporting exports.

import { formatCurrency } from '../../utils/calc'
import gu from '../../locales/gu.json'

export function buildCaSummaryRows(summary, fromDate, toDate) {
  return [
    { Field: 'From', Value: fromDate || '—' },
    { Field: 'To', Value: toDate || '—' },
    { Field: 'Bills', Value: summary.billCount },
    { Field: 'Goods total', Value: formatCurrency(summary.goodsTotal) },
    { Field: 'Commission earned', Value: formatCurrency(summary.commissionEarned) },
    { Field: gu.dakhla.tolaiLabel, Value: formatCurrency(summary.tolaiTotal) },
    { Field: gu.dakhla.shesLabel, Value: formatCurrency(summary.shesTotal) },
    { Field: gu.dakhla.totalLabel, Value: formatCurrency(summary.dakhlaTotal) },
    { Field: 'Outstanding rojmer', Value: formatCurrency(summary.outstandingAmount) },
    { Field: 'Outstanding bills', Value: summary.outstandingCount },
  ]
}

export function buildCaBillRows(billRows) {
  return billRows.map(({ bill, vepariName, totalPaid, balance, isCleared }) => ({
    Date: bill.date,
    [gu.bills.entryNumberLabel]: bill.entryNumber,
    Farmer: bill.farmerName,
    Village: bill.farmerVillage,
    Vepari: vepariName,
    Total: bill.totalAmount,
    Paid: totalPaid,
    Balance: balance,
    Status: isCleared ? 'Cleared' : 'Pending',
  }))
}

export function buildCaVepariRows(vepariRows) {
  return vepariRows.map(({ vepari, billCount, totals }) => ({
    Vepari: vepari.name,
    Village: vepari.village || '',
    Bills: billCount,
    [gu.dakhla.goodsAmountLabel]: totals.goodsAmount,
    [gu.dakhla.tolaiLabel]: totals.tolai,
    [gu.dakhla.shesLabel]: totals.shes,
    [gu.dakhla.commissionLabel]: totals.commission,
    [gu.dakhla.totalLabel]: totals.total,
  }))
}

export function buildCaOutstandingRows(outstanding) {
  return outstanding.map(({ bill, vepariName, totalPaid, balance }) => ({
    Date: bill.date,
    [gu.bills.entryNumberLabel]: bill.entryNumber,
    Farmer: bill.farmerName,
    Vepari: vepariName,
    Total: bill.totalAmount,
    Paid: totalPaid,
    Balance: balance,
  }))
}

export function buildCaBillPdfColumns() {
  return [
    { header: 'Date', key: 'Date' },
    { header: gu.bills.entryNumberLabel, key: gu.bills.entryNumberLabel },
    { header: 'Farmer', key: 'Farmer' },
    { header: 'Vepari', key: 'Vepari' },
    { header: 'Total', key: 'Total' },
    { header: 'Balance', key: 'Balance' },
    { header: 'Status', key: 'Status' },
  ]
}

export function buildCaVepariPdfColumns() {
  return [
    { header: 'Vepari', key: 'Vepari' },
    { header: 'Bills', key: 'Bills' },
    { header: gu.dakhla.commissionLabel, key: gu.dakhla.commissionLabel },
    { header: gu.dakhla.totalLabel, key: gu.dakhla.totalLabel },
  ]
}

export function buildCaOutstandingPdfColumns() {
  return [
    { header: 'Date', key: 'Date' },
    { header: gu.bills.entryNumberLabel, key: gu.bills.entryNumberLabel },
    { header: 'Farmer', key: 'Farmer' },
    { header: 'Balance', key: 'Balance' },
  ]
}

export function buildCaSummaryPdfColumns() {
  return [
    { header: 'Field', key: 'Field' },
    { header: 'Value', key: 'Value' },
  ]
}

/** Multi-sheet workbook: summary + bills + vepari + outstanding. */
export async function exportCaReportWorkbook({
  summary,
  billRows,
  vepariRows,
  outstanding,
  fromDate,
  toDate,
  filename,
}) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  function addSheet(rows, name) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: '—' }])
    XLSX.utils.book_append_sheet(workbook, ws, name.slice(0, 31))
  }

  addSheet(buildCaSummaryRows(summary, fromDate, toDate), 'Summary')
  addSheet(buildCaBillRows(billRows), 'Bills')
  addSheet(buildCaVepariRows(vepariRows), 'Vepari')
  addSheet(buildCaOutstandingRows(outstanding), 'Outstanding')

  const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
