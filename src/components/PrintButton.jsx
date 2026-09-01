// Standalone "Print" button, placed beside ExportMenu (owner-
// requested: visible immediately, not a dropdown item one tap deep).
// What it actually prints varies by caller: Bills' single-bill print
// and Dakhla's single-vepari print use custom HTML templates matching
// the real paper forms (features/bills/billPrint.js,
// features/vepariDakhla/dakhlaPrint.js); list/summary/Rojmer/Silak
// views — with no paper-form equivalent to match — use the generic
// tabular PDF print (utils/export.js's printRows()). Either way, this
// button is just the trigger; the caller supplies onClick.

import { Printer } from 'lucide-react'

export default function PrintButton({ onClick, label = 'Print' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-caption font-semibold text-ink-muted border border-border hover:border-accent hover:text-accent"
    >
      <Printer size={16} strokeWidth={1.75} />
      {label}
    </button>
  )
}
