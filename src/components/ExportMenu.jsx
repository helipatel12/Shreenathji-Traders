// Reusable "Export" dropdown (Excel / CSV / PDF) — prd.md §5's
// "editability & export everywhere" requirement means every module
// needs this (bills here in Phase 4; vepari dakhla/rojmer/silak in
// Phases 5–7; year-end archive in Phase 9; CA reports in Phase 10),
// so it's a shared component rather than rebuilt per screen. Print is
// a separate, standalone button (components/PrintButton.jsx) placed
// beside this one, not a dropdown item — owner-requested, so it's
// immediately visible rather than one tap deeper.

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'

export default function ExportMenu({ onExportExcel, onExportCSV, onExportPDF, label = 'Export' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function pick(fn) {
    fn()
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-caption font-semibold text-ink-muted border border-border hover:border-accent hover:text-accent"
      >
        <Download size={16} strokeWidth={1.75} />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 card py-1 min-w-40 z-20">
          <button
            type="button"
            onClick={() => pick(onExportExcel)}
            className="w-full text-left px-4 py-2.5 text-body text-ink hover:bg-accent-soft"
          >
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => pick(onExportCSV)}
            className="w-full text-left px-4 py-2.5 text-body text-ink hover:bg-accent-soft"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => pick(onExportPDF)}
            className="w-full text-left px-4 py-2.5 text-body text-ink hover:bg-accent-soft"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  )
}
