// Manual year-end archive trigger — Phase 9. The automatic prompt
// (components/YearEndArchivePrompt.jsx) only fires once per device
// per rollover; this lets the owner grab a backup for any past
// financial year on demand.

import { useState } from 'react'
import { Download } from 'lucide-react'
import { financialYearBounds, todayKeyIST } from '../../utils/dates'
import { useYearEndArchiveBuilder } from '../../hooks/useYearEndArchive'
import { useLocale } from '../../context/LocaleContext'

function recentFYOptions() {
  const currentStart = Number(financialYearBounds(todayKeyIST()).start.slice(0, 4))
  return Array.from({ length: 5 }, (_, i) => {
    const startYear = currentStart - i
    return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` }
  })
}

function fyLabel(option, currentStart) {
  const startYear = Number(option.start.slice(0, 4))
  const base = `${option.start} – ${option.end}`
  if (startYear === currentStart) return `${base} (current)`
  return base
}

export default function YearEndArchiveSection() {
  const { t } = useLocale()
  const options = recentFYOptions()
  const currentStart = options[0]?.start
  const [selected, setSelected] = useState(options[1] ?? options[0])
  const { loading, buildZip } = useYearEndArchiveBuilder(selected?.start, selected?.end)
  const [downloading, setDownloading] = useState(false)
  const [status, setStatus] = useState('') // '' | 'ok' | 'err'
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDownload() {
    if (!selected || downloading) return
    setDownloading(true)
    setStatus('')
    setErrorMsg('')
    try {
      await buildZip()
      setStatus('ok')
    } catch (err) {
      console.error('Year-end archive failed:', err)
      setStatus('err')
      setErrorMsg(err?.message ? String(err.message) : t('archive.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  const busy = downloading
  const waitingData = loading && !downloading

  return (
    <div className="card px-5 py-5 sm:px-6 sm:py-6">
      <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-1">
        {t('archive.manualTitle')}
      </p>
      <p className="text-body text-ink-muted mb-5 max-w-2xl">{t('archive.manualBody')}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="archive-fy" className="block text-caption text-ink-muted mb-1.5">
            {t('settings.fyBoundaryLabel')}
          </label>
          <select
            id="archive-fy"
            value={selected?.start || ''}
            onChange={(e) => {
              const next = options.find((o) => o.start === e.target.value)
              if (next) {
                setSelected(next)
                setStatus('')
                setErrorMsg('')
              }
            }}
            disabled={busy}
            className="w-full text-body text-ink bg-surface border border-border rounded-xl py-2.5 px-3 min-h-12 outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            {options.map((o) => (
              <option key={o.start} value={o.start}>
                {fyLabel(o, Number(currentStart?.slice(0, 4)))}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={busy || waitingData || !selected}
          className="btn-primary disabled:opacity-40 sm:min-w-[11rem]"
        >
          <Download size={16} strokeWidth={2} />
          {busy || waitingData ? t('archive.preparing') : t('archive.downloadFor')}
        </button>
      </div>

      {waitingData && (
        <p className="text-caption text-ink-muted mt-3">{t('archive.loadingData')}</p>
      )}
      {status === 'ok' && (
        <p className="text-caption text-success mt-3">{t('archive.downloadOk')}</p>
      )}
      {status === 'err' && (
        <p className="text-caption text-danger mt-3 rounded-lg bg-red-50 px-3 py-2">
          {errorMsg || t('archive.downloadFailed')}
        </p>
      )}
    </div>
  )
}
