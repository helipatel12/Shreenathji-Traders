/** Simple SVG area/line chart — no chart library dependency. */
export default function TrendChart({
  series = [],
  height = 220,
  stroke = 'var(--color-accent)',
  fill = 'var(--color-accent-soft)',
  emptyLabel = '—',
}) {
  if (!series.length) {
    return (
      <div
        className="flex items-center justify-center text-ink-muted text-body"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    )
  }

  const width = 640
  const padX = 12
  const padY = 16
  const values = series.map((p) => p.value)
  const min = Math.min(0, ...values)
  const max = Math.max(...values, 1)
  const span = max - min || 1

  const points = series.map((p, i) => {
    const x = padX + (i / Math.max(series.length - 1, 1)) * (width - padX * 2)
    const y = height - padY - ((p.value - min) / span) * (height - padY * 2)
    return { x, y, ...p }
  })

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = `${line} L${points[points.length - 1].x},${height - padY} L${points[0].x},${height - padY} Z`

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Trend chart"
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.9" />
            <stop offset="100%" stopColor={fill} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => {
          const y = padY + t * (height - padY * 2)
          return (
            <line
              key={t}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          )
        })}
        <path d={area} fill="url(#chartFill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={stroke} />
        ))}
      </svg>
      <div className="flex justify-between px-1 mt-1">
        <span className="text-caption text-ink-muted font-numeric">{series[0]?.label}</span>
        <span className="text-caption text-ink-muted font-numeric">
          {series[series.length - 1]?.label}
        </span>
      </div>
    </div>
  )
}
