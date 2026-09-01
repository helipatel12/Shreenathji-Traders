// The automatic "financial year closed" prompt — Phase 9. Rendered
// from AppShell so it can appear over any screen the moment a
// rollover is detected, not tied to one particular route. See
// useYearEndArchive.js for the detection/build logic; this is just
// the modal.

import { useState } from 'react'
import { useYearEndArchiveCheck, useYearEndArchiveBuilder } from '../hooks/useYearEndArchive'
import gu from '../locales/gu.json'

export default function YearEndArchivePrompt() {
  const { shouldPrompt, closedFY, dismiss } = useYearEndArchiveCheck()
  const { buildZip } = useYearEndArchiveBuilder(closedFY.start, closedFY.end)
  const [downloading, setDownloading] = useState(false)

  if (!shouldPrompt) return null

  async function handleDownload() {
    setDownloading(true)
    try {
      await buildZip()
      dismiss()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-30">
      <div className="card px-6 py-6 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{gu.archive.promptTitle}</p>
        <p className="text-caption text-ink-muted mb-5">{gu.archive.promptBody}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
          >
            {downloading ? gu.archive.preparing : gu.archive.downloadBackup}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={downloading}
            className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {gu.archive.notNow}
          </button>
        </div>
      </div>
    </div>
  )
}
