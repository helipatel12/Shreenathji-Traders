// Shapes vepari-dakhla data into flat rows for export.js's Excel/CSV/
// PDF functions — mirrors src/features/bills/billExport.js's pattern.
// Two shapes, per prd.md §4.2: a single vepari's full ledger (one row
// per bill), and the all-veparis list (one row per dakhla line).

import { formatCurrency } from '../../utils/calc'
import gu from '../../locales/gu.json'
import { formatDisplayDate } from '../../utils/dates'

export function buildVepariLedgerRows(lines) {
  const rows = lines.map(({ bill, weightKg, ratePer20kg, goodsAmount, tolai, shes, commission, total }) => ({
    Date: formatDisplayDate(bill.date),
    [gu.bills.entryNumberLabel]: bill.entryNumber,
    Farmer: bill.farmerName,
    Village: bill.farmerVillage || '',
    [gu.dakhla.weightLabel]: weightKg,
    [gu.bills.rateLabel]: ratePer20kg,
    [gu.dakhla.goodsAmountLabel]: goodsAmount,
    [gu.dakhla.tolaiLabel]: tolai,
    [gu.dakhla.shesLabel]: shes,
    [gu.dakhla.commissionLabel]: commission,
    [gu.dakhla.totalLabel]: total,
  }))
  return rows
}

export function buildVepariLedgerPdfColumns() {
  return [
    { header: 'Date', key: 'Date' },
    { header: gu.bills.entryNumberLabel, key: gu.bills.entryNumberLabel },
    { header: 'Farmer', key: 'Farmer' },
    { header: 'Village', key: 'Village' },
    { header: 'Weight (kg)', key: gu.dakhla.weightLabel },
    { header: gu.bills.rateLabel, key: gu.bills.rateLabel },
    { header: 'Goods amount', key: gu.dakhla.goodsAmountLabel },
    { header: 'Tolai', key: gu.dakhla.tolaiLabel },
    { header: 'Shes', key: gu.dakhla.shesLabel },
    { header: 'Commission', key: gu.dakhla.commissionLabel },
    { header: 'Total owed', key: gu.dakhla.totalLabel },
  ]
}

export function buildAllVepariDayRows(dayGroups) {
  return dayGroups.map((g) => ({
    [gu.bills.dakhlaNumberLabel]: g.dakhlaNumber,
    Date: formatDisplayDate(g.date),
    Vepari: g.vepari?.name || '',
    Village: g.vepari?.village || '',
    [gu.dakhla.billCountLabel]: g.billCount,
    Bills: (g.entryNumbers || []).join(', '),
    [gu.dakhla.totalLabel]: formatCurrency(g.totals.total),
  }))
}

export function buildAllVepariDayPdfColumns() {
  return [
    { header: gu.bills.dakhlaNumberLabel, key: gu.bills.dakhlaNumberLabel },
    { header: 'Date', key: 'Date' },
    { header: 'Vepari', key: 'Vepari' },
    { header: gu.dakhla.billCountLabel, key: gu.dakhla.billCountLabel },
    { header: 'Total owed', key: gu.dakhla.totalLabel },
  ]
}

/** @deprecated line-level export — prefer buildAllVepariDayRows */
export function buildAllVepariLineRows(lines) {
  return lines.map(({ bill, vepari, weightKg, goodsAmount, tolai, shes, commission, total }) => ({
    [gu.bills.dakhlaNumberLabel]: bill.dakhlaNumber,
    Date: formatDisplayDate(bill.date),
    Vepari: vepari?.name || '',
    Village: vepari?.village || '',
    Farmer: bill.farmerName,
    [gu.bills.entryNumberLabel]: bill.entryNumber,
    [gu.dakhla.weightLabel]: weightKg,
    [gu.dakhla.goodsAmountLabel]: goodsAmount,
    [gu.dakhla.tolaiLabel]: tolai,
    [gu.dakhla.shesLabel]: shes,
    [gu.dakhla.commissionLabel]: commission,
    [gu.dakhla.totalLabel]: formatCurrency(total),
  }))
}

export function buildAllVepariLinePdfColumns() {
  return buildAllVepariDayPdfColumns()
}

/** @deprecated kept for year-end archive that still uses summary shape */
export function buildAllVepariSummaryRows(rows) {
  return rows.map(({ vepari, billCount, totals }) => ({
    Vepari: vepari.name,
    Village: vepari.village,
    [gu.dakhla.billCountLabel]: billCount,
    [gu.dakhla.weightLabel]: totals.weightKg,
    [gu.dakhla.goodsAmountLabel]: totals.goodsAmount,
    [gu.dakhla.tolaiLabel]: totals.tolai,
    [gu.dakhla.shesLabel]: totals.shes,
    [gu.dakhla.commissionLabel]: totals.commission,
    [gu.dakhla.totalLabel]: formatCurrency(totals.total),
  }))
}

export function buildAllVepariSummaryPdfColumns() {
  return [
    { header: 'Vepari', key: 'Vepari' },
    { header: 'Village', key: 'Village' },
    { header: 'Bills', key: gu.dakhla.billCountLabel },
    { header: 'Total owed', key: gu.dakhla.totalLabel },
  ]
}
