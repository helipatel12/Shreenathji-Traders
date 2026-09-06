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
  const padB = series.length >= 10 ? 36 : 48
  const hasSecondary = series.some((p) => p.value2 != null)
  const values = series.flatMap((p) => [
    Math.abs(p.value || 0),
    hasSecondary ? Math.abs(p.value2 || 0) : 0,
  ])
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

  const labelFontSize = series.length >= 12 ? 10 : 11

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
          const v1 = p.value || 0
          const v2 = hasSecondary ? p.value2 || 0 : 0
          // Draw zero-height skip; allow negative values for profit/loss chart.
          const draw1 = v1 !== 0
          const draw2 = v2 !== 0
          const both = draw1 && draw2
          const chartH = height - padT - padB
          const zeroY = height - padB
          // One bar → center on the tick; both → pair centered on the tick.
          const groupW = barW * 2 + gap
          let x1
          let x2
          if (both) {
            x1 = cx - groupW / 2
            x2 = cx - groupW / 2 + barW + gap
          } else {
            x1 = cx - barW / 2
            x2 = cx - barW / 2
          }
          const h1 = (Math.abs(v1) / max) * chartH
          const h2 = (Math.abs(v2) / max) * chartH
          const y1 = zeroY - h1
          const y2 = zeroY - h2
          const showLabel = labelIdx.has(i)
          const fill1 = p.color || (v1 < 0 ? 'var(--color-danger, #b91c1c)' : barColor)
          return (
            <g key={i}>
              <title>
                {p.tip || p.label}
                {formatValue ? ` · ${formatValue(p.value)}` : ''}
                {hasSecondary && formatValue ? ` / ${formatValue(p.value2 || 0)}` : ''}
              </title>
              {draw1 && (
                <rect
                  x={x1}
                  y={y1}
                  width={Math.max(barW, 2)}
                  height={Math.max(h1, 0)}
                  rx="3"
                  fill={fill1}
                />
              )}
              {draw2 && (
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
                <line
                  x1={cx}
                  x2={cx}
                  y1={height - padB + 2}
                  y2={height - padB + 8}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                />
              )}
              {showLabel && (
                <text
                  x={cx}
                  y={height - 12}
                  textAnchor="middle"
                  fill="var(--color-ink-muted)"
                  style={{ fontSize: labelFontSize, fontWeight: 600 }}
                >
                  {p.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {formatValue && series.length > 0 && (
        <p className="sr-only">
          {series.map((p) => `${p.label}: ${formatValue(p.value)}`).join(', ')}
        </p>
      )}
    </div>
  )
}
