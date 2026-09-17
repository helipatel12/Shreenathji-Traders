export default function StatusDonut({ slices, emptyLabel }) {
  const total = slices.reduce((sum, s) => sum + (s.value || 0), 0)
  if (!total) {
    return <p className="text-caption text-ink-muted py-8 text-center">{emptyLabel}</p>
  }

  const size = 148
  const stroke = 16
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        {slices.map((slice) => {
          const len = (slice.value / total) * c
          const node = (
            <circle
              key={slice.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
          offset += len
          return node
        })}
      </svg>
      <ul className="min-w-0 space-y-2">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: slice.color }} />
            <span className="text-ink-muted truncate">{slice.label}</span>
            <span className="ml-auto font-numeric font-semibold text-ink">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
