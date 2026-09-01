// Shapes rojmer data into flat rows for export.js's Excel/CSV/PDF
// functions. One row PER PAYMENT (not per bill) — a bill with 3
// payments produces 3 rows, each showing that payment's own date,
// amount, and mode, so the export actually answers "on which date did
// I get paid, how much, and how" rather than just a single rolled-up
// total. A bill with no payments yet still gets one row (with blank
// payment fields) so fully-pending bills aren't silently missing from
// the export — matches prd.md §4.3's "who do I still owe money to."
// Voided payments are skipped (see architecture.md §5a) since they no
// longer represent real money received.

import { formatCurrency } from '../../utils/calc'
import gu from '../../locales/gu.json'

export function buildRojmerRows(rows, veparis, payments) {
  const exportRows = []

  for (const { bill, balance, isCleared, clearingDate } of rows) {
    const vepari = veparis.find((v) => String(v.id) === String(bill.vepariId))?.name ?? '—'
    const billPayments = payments
      .filter((p) => p.billId === bill.firestoreId && !p.isVoided)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    const status = isCleared ? gu.rojmer.clearedBadge : gu.rojmer.pendingTab

    if (billPayments.length === 0) {
      exportRows.push({
        [gu.bills.entryNumberLabel]: bill.entryNumber,
        'Bill date': bill.date,
        Farmer: bill.farmerName,
        Vepari: vepari,
        'Bill total': formatCurrency(bill.totalAmount),
        'Payment date': '',
        'Payment amount': '',
        [gu.rojmer.paymentTypeLabel]: '',
        [gu.rojmer.balanceLabel]: formatCurrency(balance),
        Status: status,
        [gu.rojmer.clearedOnLabel]: '',
      })
      continue
    }

    billPayments.forEach((payment, index) => {
      const isLast = index === billPayments.length - 1
      exportRows.push({
        // Bill-level columns repeat on every payment row (so each row
        // is self-contained if the sheet gets sorted/filtered), but
        // balance/status/cleared-date only show once, on the last
        // payment row — otherwise a partially-paid bill would show
        // its FINAL balance next to every one of its earlier partial
        // payments too, which reads as if that balance existed at
        // that point in time rather than reflecting all payments.
        [gu.bills.entryNumberLabel]: bill.entryNumber,
        'Bill date': bill.date,
        Farmer: bill.farmerName,
        Vepari: vepari,
        'Bill total': formatCurrency(bill.totalAmount),
        'Payment date': payment.date,
        'Payment amount': formatCurrency(payment.amount),
        [gu.rojmer.paymentTypeLabel]: gu.rojmer[payment.type],
        [gu.rojmer.balanceLabel]: isLast ? formatCurrency(balance) : '',
        Status: isLast ? status : '',
        [gu.rojmer.clearedOnLabel]: isLast ? clearingDate || '' : '',
      })
    })
  }

  return exportRows
}

export function buildRojmerPdfColumns() {
  return [
    { header: gu.bills.entryNumberLabel, key: gu.bills.entryNumberLabel },
    { header: 'Farmer', key: 'Farmer' },
    { header: 'Vepari', key: 'Vepari' },
    { header: 'Bill total', key: 'Bill total' },
    { header: 'Payment date', key: 'Payment date' },
    { header: 'Payment amount', key: 'Payment amount' },
    { header: gu.rojmer.paymentTypeLabel, key: gu.rojmer.paymentTypeLabel },
    { header: gu.rojmer.balanceLabel, key: gu.rojmer.balanceLabel },
    { header: 'Status', key: 'Status' },
  ]
}
