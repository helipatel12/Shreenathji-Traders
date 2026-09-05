/** Grouped bar chart — SVG, sparse readable x labels. */
export default function BarChart({
  series = [],
  height = 260,
  barColor = 'var(--color-accent)',
  barColorSecondary = '#8fa396',
  emptyLabel = '—',
  formatValue,
  maxLabels = 8,
}) {
  if (!series.length) {
    return (
      <div className="flex items-center justify-center text-ink-muted text-body" style={{ height }}>
        {emptyLabel}
      </div>
    )
  }

  const width = 640
  const padL = 12
  const padR = 12
  const padT = 14
  const padB = 48
  const hasSecondary = series.some((p) => p.value2 != null)
  const values = series.flatMap((p) => [p.value || 0, hasSecondary ? p.value2 || 0 : 0])
  const max = Math.max(...values, 1)
  const slot = (width - padL - padR) / series.length
  const barW = Math.min(hasSecondary ? slot * 0.34 : slot * 0.58, 36)
  const gap = hasSecondary ? Math.min(4, slot * 0.08) : 0

  // Show only a readable subset of labels (always include first + last).
  const labelCount = Math.min(maxLabels, series.length)
  const labelIdx = new Set()
  if (series.length <= labelCount) {
    series.forEach((_, i) => labelIdx.add(i))
  } else {
    labelIdx.add(0)
    labelIdx.add(series.length - 1)
    const inner = labelCount - 2
    for (let k = 1; k <= inner; k++) {
      const i = Math.round((k * (series.length - 1)) / (inner + 1))
      labelIdx.add(i)
    }
  }

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img">
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + (1 - t) * (height - padT - padB)
          return (
            <line
              key={t}
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          )
        })}
        {series.map((p, i) => {
          const cx = padL + i * slot + slot / 2
          const h1 = ((p.value || 0) / max) * (height - padT - padB)
          const x1 = hasSecondary ? cx - barW - gap / 2 : cx - barW / 2
          const y1 = height - padB - h1
          const h2 = hasSecondary ? ((p.value2 || 0) / max) * (height - padT - padB) : 0
          const x2 = cx + gap / 2
          const y2 = height - padB - h2
          const showLabel = labelIdx.has(i)
          return (
            <g key={i}>
              <title>
                {p.tip || p.label}
                {formatValue ? ` · ${formatValue(p.value)}` : ''}
                {hasSecondary && formatValue ? ` / ${formatValue(p.value2 || 0)}` : ''}
              </title>
              <rect
                x={x1}
                y={y1}
                width={Math.max(barW, 2)}
                height={Math.max(h1, 0)}
                rx="3"
                fill={barColor}
              />
              {hasSecondary && (
                <rect
                  x={x2}
                  y={y2}
                  width={Math.max(barW, 2)}
                  height={Math.max(h2, 0)}
                  rx="3"
                  fill={barColorSecondary}
                />
              )}
              {showLabel && (
                <text
                  x={cx}
                  y={height - 18}
                  textAnchor="middle"
                  fill="var(--color-ink-muted)"
                  style={{ fontSize: series.length > 14 ? 10 : 11, fontWeight: 600 }}
                >
                  {p.label}
                </text>
              )}
              {showLabel && (
                <line
                  x1={cx}
                  x2={cx}
                  y1={height - padB + 2}
                  y2={height - padB + 8}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between px-1 -mt-1">
        <span className="text-[11px] font-semibold text-ink-muted font-numeric">
          {series[0]?.label}
        </span>
        <span className="text-[11px] font-semibold text-ink-muted font-numeric">
          {series[series.length - 1]?.label}
        </span>
      </div>
      {formatValue && series.length > 0 && (
        <p className="sr-only">
          {series.map((p) => `${p.label}: ${formatValue(p.value)}`).join(', ')}
        </p>
      )}
    </div>
  )
}
