// Manual year-end archive trigger — Phase 9. The automatic prompt
// (components/YearEndArchivePrompt.jsx) only fires once per device
// per rollover; this lets the owner grab a backup for any past
// financial year on demand — after dismissing the prompt, on a new
// device, or just because they want one right now.

import { useState } from 'react'
import { financialYearBounds, todayKeyIST } from '../../utils/dates'
import { useYearEndArchiveBuilder } from '../../hooks/useYearEndArchive'
import gu from '../../locales/gu.json'

function recentFYOptions() {
  const currentStart = Number(financialYearBounds(todayKeyIST()).start.slice(0, 4))
  // This year plus the 4 before it — plenty for a business this size
  // (prd.md §5: 1-5 users) without an unbounded dropdown.
  return Array.from({ length: 5 }, (_, i) => {
    const startYear = currentStart - i
    return { start: `${startYear}-04-01`, end: `${startYear + 1}-03-31` }
  })
}

export default function YearEndArchiveSection() {
  const options = recentFYOptions()
  const [selected, setSelected] = useState(options[1] ?? options[0]) // default: most recently closed FY
  const { loading, buildZip } = useYearEndArchiveBuilder(selected.start, selected.end)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await buildZip()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="card px-5 py-5 max-w-lg">
      <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-2">
        {gu.archive.manualTitle}
      </p>
      <p className="text-body text-ink-muted mb-4">{gu.archive.manualBody}</p>
      <div className="flex flex-wrap items-end gap-3">
        <select
          value={selected.start}
          onChange={(e) => setSelected(options.find((o) => o.start === e.target.value))}
          className="text-body text-ink bg-surface border border-border rounded-xl py-2.5 px-3 min-h-11"
        >
          {options.map((o) => (
            <option key={o.start} value={o.start}>
              {o.start} – {o.end}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleDownload}
          disabled={loading || downloading}
          className="min-h-11 px-5 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
        >
          {downloading ? gu.archive.preparing : gu.archive.downloadFor}
        </button>
      </div>
    </div>
  )
}
