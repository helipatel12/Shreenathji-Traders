import { User } from 'lucide-react'
import { useLocale } from '../context/LocaleContext'
import { resolveCreatedByName } from '../utils/createdBy'

export default function CreatedByLine({ record, currentUser, className = '' }) {
  const { t } = useLocale()
  const name = resolveCreatedByName(record, currentUser)
  return (
    <p className={`text-caption text-ink-muted flex items-center gap-1.5 ${className}`.trim()}>
      <User size={14} strokeWidth={1.75} />
      <span>
        {t('common.createdBy')}: <span className="text-ink font-medium">{name}</span>
      </span>
    </p>
  )
}
