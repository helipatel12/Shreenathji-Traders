import { useState } from 'react'
import { useYearEndArchiveCheck, useYearEndArchiveBuilder } from '../hooks/useYearEndArchive'
import { useLocale } from '../context/LocaleContext'
import { useAuth } from '../hooks/useAuth'

/** Heavy builder only mounts when the prompt is actually shown. */
function YearEndArchivePromptActive({ closedFY, dismiss }) {
  const { t } = useLocale()
  const { loading, buildZip } = useYearEndArchiveBuilder(closedFY.start, closedFY.end)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setDownloading(true)
    setError('')
    try {
      await buildZip()
      dismiss()
    } catch (err) {
      console.error('Year-end archive failed:', err)
      setError(t('archive.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="year-end-archive-title"
    >
      <div className="card px-6 py-6 max-w-sm w-full">
        <p id="year-end-archive-title" className="text-body text-ink font-semibold mb-1">
          {t('archive.promptTitle')}
        </p>
        <p className="text-caption text-ink-muted mb-5">{t('archive.promptBody')}</p>
        {error && (
          <p className="text-caption text-danger rounded-lg bg-red-50 px-3 py-2 mb-4">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || loading}
            className="flex-1 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
          >
            {downloading || loading ? t('archive.preparing') : t('archive.downloadBackup')}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={downloading}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {t('archive.notNow')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function YearEndArchivePrompt() {
  const { isOwner } = useAuth()
  const { shouldPrompt, closedFY, dismiss } = useYearEndArchiveCheck()
  if (!isOwner || !shouldPrompt) return null
  return <YearEndArchivePromptActive closedFY={closedFY} dismiss={dismiss} />
}
