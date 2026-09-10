/**
 * Spider / radar chart — pure SVG, same style as BarChart / DonutChart.
 * series: [{ label, value, tip? }]
 * Values are normalized to the max absolute value (or `max`).
 */
export default function SpiderChart({
  series = [],
  size = 280,
  max,
  emptyLabel = '—',
  formatValue,
  fill = 'rgba(26, 54, 48, 0.18)',
  stroke = 'var(--color-accent)',
}) {
  const points = (series || [])
    .map((s) => ({
      label: String(s.label || ''),
      value: Number(s.value) || 0,
      tip: s.tip,
    }))
    .filter((s) => s.label)

  if (points.length < 3) {
    return (
      <div
        className="flex items-center justify-center text-ink-muted text-body"
        style={{ height: size }}
      >
        {emptyLabel}
      </div>
    )
  }

  const n = points.length
  const rawMax = Math.max(
    ...points.map((p) => Math.abs(p.value)),
    Number(max) > 0 ? Number(max) : 0,
    1,
  )

  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.34
  const levels = 4

  function angle(i) {
    return -Math.PI / 2 + (i * 2 * Math.PI) / n
  }

  function polar(i, t) {
    const a = angle(i)
    const r = radius * Math.max(0, Math.min(1, t))
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }

  function ringPath(t) {
    return points
      .map((_, i) => {
        const [x, y] = polar(i, t)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
      .concat(' Z')
  }

  const dataPath = points
    .map((p, i) => {
      const t = Math.abs(p.value) / rawMax
      const [x, y] = polar(i, t)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
    .concat(' Z')

  const labelRadius = radius + size * 0.1

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <svg
        width="100%"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="max-w-full"
        role="img"
        aria-label="Spider chart"
      >
        {/* Grid rings */}
        {Array.from({ length: levels }, (_, li) => {
          const t = (li + 1) / levels
          return (
            <path
              key={li}
              d={ringPath(t)}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={li === levels - 1 ? 1.25 : 1}
              opacity={0.9}
            />
          )
        })}

        {/* Axes */}
        {points.map((_, i) => {
          const [x, y] = polar(i, 1)
          return (
            <line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          )
        })}

        {/* Filled polygon */}
        <path d={dataPath} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

        {/* Vertex dots */}
        {points.map((p, i) => {
          const t = Math.abs(p.value) / rawMax
          const [x, y] = polar(i, t)
          return (
            <circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r="3.5"
              fill="#fff"
              stroke={stroke}
              strokeWidth="2"
            >
              <title>
                {p.label}: {formatValue ? formatValue(p.value) : p.value}
                {p.tip ? ` · ${p.tip}` : ''}
              </title>
            </circle>
          )
        })}

        {/* Labels */}
        {points.map((p, i) => {
          const a = angle(i)
          const x = cx + labelRadius * Math.cos(a)
          const y = cy + labelRadius * Math.sin(a)
          const anchor =
            Math.abs(Math.cos(a)) < 0.25 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fill="var(--color-ink-muted)"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {p.label}
            </text>
          )
        })}
      </svg>

      <ul className="w-full grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 text-caption">
        {points.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2 min-w-0">
            <span className="truncate text-ink-muted">{p.label}</span>
            <span className="font-numeric font-semibold text-ink shrink-0">
              {formatValue ? formatValue(p.value) : p.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
