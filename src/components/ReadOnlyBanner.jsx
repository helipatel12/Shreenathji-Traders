import { useLocale } from '../context/LocaleContext'

export default function ReadOnlyBanner() {
  const { t } = useLocale()
  return (
    <div
      className="mb-4 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-body text-accent"
      role="status"
    >
      {t('common.readOnlyBanner')}
    </div>
  )
}
