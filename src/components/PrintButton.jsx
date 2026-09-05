import { Printer } from 'lucide-react'
import { useLocale } from '../context/LocaleContext'

export default function PrintButton({ onClick, label, compact = false }) {
  const { t } = useLocale()
  const text = label === undefined ? t('common.print') : label

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className={
        compact
          ? 'action-btn action-btn-muted'
          : 'inline-flex items-center gap-1.5 min-h-12 px-3 rounded-xl text-body font-semibold text-ink-muted border border-border hover:border-accent hover:text-accent'
      }
      aria-label={text || t('common.print')}
      title={text || t('common.print')}
    >
      <Printer size={compact ? 14 : 18} strokeWidth={compact ? 2 : 1.75} />
      {!compact && text}
    </button>
  )
}
