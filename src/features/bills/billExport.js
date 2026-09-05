// Shapes bill data into flat rows for export.js's Excel/CSV/PDF
// functions. Two shapes, matching prd.md §4.1's "any single bill, or
// the full bill list": a single bill exports one row per goods line
// (with a totals row); a bill list exports one row per bill.

import { formatCurrency } from '../../utils/calc'
import { vepariDisplayName } from '../../utils/vepari'
import gu from '../../locales/gu.json'

const entryNumberLabel = gu.bills.entryNumberLabel

export function buildSingleBillRows(bill, vepariName) {
  const rows = bill.items.map((item) => ({
    [entryNumberLabel]: bill.entryNumber,
    Farmer: bill.farmerName,
    Village: bill.farmerVillage,
    Date: bill.date,
    Vepari: vepariName,
    Goods: item.type,
    'Weight (kg)': item.weightKg,
    'Rate (per 20kg)': item.ratePer20kg,
    Amount: item.amount,
  }))
  rows.push({
    [entryNumberLabel]: '',
    Farmer: '',
    Village: '',
    Date: '',
    Vepari: '',
    Goods: '',
    'Weight (kg)': '',
    'Rate (per 20kg)': 'Total',
    Amount: bill.totalAmount,
  })
  return rows
}

export function buildSingleBillPdfColumns() {
  return [
    { header: 'Goods', key: 'Goods' },
    { header: 'Weight (kg)', key: 'Weight (kg)' },
    { header: 'Rate (per 20kg)', key: 'Rate (per 20kg)' },
    { header: 'Amount', key: 'Amount' },
  ]
}

export function buildBillListRows(bills, veparis) {
  return bills.map((bill) => ({
    [entryNumberLabel]: bill.entryNumber,
    Farmer: bill.farmerName,
    Village: bill.farmerVillage,
    Date: bill.date,
    Vepari: vepariDisplayName(veparis, bill.vepariId),
    'Line items': bill.items.length,
    Total: formatCurrency(bill.totalAmount),
  }))
}

export function buildBillListPdfColumns() {
  return [
    { header: entryNumberLabel, key: entryNumberLabel },
    { header: 'Farmer', key: 'Farmer' },
    { header: 'Village', key: 'Village' },
    { header: 'Date', key: 'Date' },
    { header: 'Vepari', key: 'Vepari' },
    { header: 'Total', key: 'Total' },
  ]
}
