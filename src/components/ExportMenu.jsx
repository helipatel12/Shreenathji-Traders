import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { useLocale } from '../context/LocaleContext'

export default function ExportMenu({
  onExportExcel,
  onExportCSV,
  onExportPDF,
  label,
  compact = false,
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const buttonLabel = label === undefined ? t('common.export') : label

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function pick(fn) {
    setOpen(false)
    if (!fn) return
    try {
      await fn()
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label={buttonLabel || t('common.export')}
        aria-expanded={open}
        title={buttonLabel || t('common.export')}
        className={
          compact
            ? 'action-btn action-btn-muted'
            : 'inline-flex items-center gap-1.5 min-h-12 px-3 rounded-xl text-body font-semibold text-ink-muted border border-border hover:border-accent hover:text-accent'
        }
      >
        <Download size={compact ? 14 : 18} strokeWidth={compact ? 2 : 1.75} />
        {!compact && buttonLabel}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 card py-1 min-w-44 z-30 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => pick(onExportExcel)}
            className="w-full text-left px-4 py-3 text-body text-ink hover:bg-accent-soft min-h-12"
          >
            {t('common.exportExcel')}
          </button>
          <button
            type="button"
            onClick={() => pick(onExportCSV)}
            className="w-full text-left px-4 py-3 text-body text-ink hover:bg-accent-soft min-h-12"
          >
            {t('common.exportCsv')}
          </button>
          <button
            type="button"
            onClick={() => pick(onExportPDF)}
            className="w-full text-left px-4 py-3 text-body text-ink hover:bg-accent-soft min-h-12"
          >
            {t('common.exportPdf')}
          </button>
        </div>
      )}
    </div>
  )
}
