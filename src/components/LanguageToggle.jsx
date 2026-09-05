import { useLocale } from '../context/LocaleContext'

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useLocale()
  const dark = className.includes('bg-sidebar') || className.includes('bg-white/10')

  return (
    <div
      className={`inline-flex items-center rounded-lg border p-0.5 ${
        dark ? 'border-white/15 bg-white/5' : 'border-border bg-surface'
      } ${className}`}
      role="group"
      aria-label={t('common.languageToggle')}
    >
      <button
        type="button"
        onClick={() => setLang('gu')}
        className={[
          'min-h-7 rounded-md px-2 text-xs font-semibold leading-none transition-colors',
          lang === 'gu'
            ? 'bg-accent text-white'
            : dark
              ? 'text-slate-300 hover:text-white'
              : 'text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        {t('common.languageGu')}
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={[
          'min-h-7 rounded-md px-2 text-xs font-semibold leading-none uppercase transition-colors',
          lang === 'en'
            ? 'bg-accent text-white'
            : dark
              ? 'text-slate-300 hover:text-white'
              : 'text-ink-muted hover:text-ink',
        ].join(' ')}
      >
        {t('common.languageEn')}
      </button>
    </div>
  )
}
