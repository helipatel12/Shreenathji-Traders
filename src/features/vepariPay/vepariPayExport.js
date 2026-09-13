// Vepari settlement export — one day-group per vepari (combined dakhla
// total). Payment rows still expand under that day.

import { formatCurrency, excludeVoided } from '../../utils/calc'
import { vepariDisplayName } from '../../utils/vepari'
import { formatDisplayDate } from '../../utils/dates'
import gu from '../../locales/gu.json'

export function buildVepariPayRows(rows, veparis, payments) {
  const exportRows = []

  for (const row of rows) {
    const vepari = vepariDisplayName(veparis, row.vepariId)
    const billIds = new Set(row.billIds || [])
    const groupPayments = excludeVoided(payments)
      .filter((p) => billIds.has(p.billId))
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    const status = row.isCleared ? gu.vepariPay.clearedBadge : gu.vepariPay.pendingTab
    const notes = (row.dakhlaNumbers || row.entryNumbers || []).join(', ')

    if (groupPayments.length === 0) {
      exportRows.push({
        [gu.bills.dateLabel]: formatDisplayDate(row.date),
        Vepari: vepari,
        [gu.vepariPay.billsLabel]: notes || row.billCount,
        'Dakhla total': formatCurrency(row.dakhlaTotal),
        'Payment date': '',
        'Payment amount': '',
        [gu.vepariPay.paymentTypeLabel]: '',
        [gu.vepariPay.balanceLabel]: formatCurrency(row.balance),
        Status: status,
        [gu.vepariPay.clearedOnLabel]: '',
      })
      continue
    }

    groupPayments.forEach((payment, index) => {
      const isLast = index === groupPayments.length - 1
      exportRows.push({
        [gu.bills.dateLabel]: formatDisplayDate(row.date),
        Vepari: vepari,
        [gu.vepariPay.billsLabel]: notes || row.billCount,
        'Dakhla total': formatCurrency(row.dakhlaTotal),
        'Payment date': formatDisplayDate(payment.date),
        'Payment amount': formatCurrency(payment.amount),
        [gu.vepariPay.paymentTypeLabel]: gu.vepariPay[payment.type] || payment.type,
        [gu.vepariPay.balanceLabel]: isLast ? formatCurrency(row.balance) : '',
        Status: isLast ? status : '',
        [gu.vepariPay.clearedOnLabel]:
          isLast && row.isCleared ? formatDisplayDate(row.clearingDate) : '',
      })
    })
  }

  return exportRows
}

export function buildVepariPayPdfColumns() {
  return [
    { header: gu.bills.dateLabel, key: gu.bills.dateLabel },
    { header: 'Vepari', key: 'Vepari' },
    { header: gu.vepariPay.billsLabel, key: gu.vepariPay.billsLabel },
    { header: 'Dakhla total', key: 'Dakhla total' },
    { header: 'Payment date', key: 'Payment date' },
    { header: 'Payment amount', key: 'Payment amount' },
    { header: gu.vepariPay.paymentTypeLabel, key: gu.vepariPay.paymentTypeLabel },
    { header: gu.vepariPay.balanceLabel, key: gu.vepariPay.balanceLabel },
    { header: 'Status', key: 'Status' },
  ]
}
