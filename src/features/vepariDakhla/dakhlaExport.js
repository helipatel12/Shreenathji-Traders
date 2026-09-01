// Shapes vepari-dakhla data into flat rows for export.js's Excel/CSV/
// PDF functions — mirrors src/features/bills/billExport.js's pattern.
// Two shapes, per prd.md §4.2: a single vepari's full ledger (one row
// per bill), and the all-veparis date-range summary (one row per
// vepari).

import { formatCurrency } from '../../utils/calc'
import gu from '../../locales/gu.json'

export function buildVepariLedgerRows(lines) {
  const rows = lines.map(({ bill, weightKg, goodsAmount, tolai, shes, commission, total }) => ({
    Date: bill.date,
    [gu.bills.entryNumberLabel]: bill.entryNumber,
    Farmer: bill.farmerName,
    [gu.dakhla.weightLabel]: weightKg,
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
    { header: 'Weight (kg)', key: gu.dakhla.weightLabel },
    { header: 'Goods amount', key: gu.dakhla.goodsAmountLabel },
    { header: 'Tolai', key: gu.dakhla.tolaiLabel },
    { header: 'Shes', key: gu.dakhla.shesLabel },
    { header: 'Commission', key: gu.dakhla.commissionLabel },
    { header: 'Total owed', key: gu.dakhla.totalLabel },
  ]
}

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
