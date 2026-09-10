/** Donut chart — income vs payouts share. SVG only. */
export default function DonutChart({
  income = 0,
  payout = 0,
  size = 160,
  incomeLabel = 'Income',
  payoutLabel = 'Payouts',
  emptyLabel = '—',
  formatValue,
}) {
  const total = Math.max(0, Number(income) || 0) + Math.max(0, Number(payout) || 0)
  if (total <= 0) {
    return (
      <div className="flex items-center justify-center text-ink-muted text-body" style={{ height: size }}>
        {emptyLabel}
      </div>
    )
  }

  const r = 54
  const c = 2 * Math.PI * r
  const incomeFrac = Math.max(0, Number(income) || 0) / total
  const incomeLen = incomeFrac * c
  const payoutLen = c - incomeLen

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox="0 0 140 140" className="shrink-0" role="img">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-border)" strokeWidth="16" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="16"
          strokeDasharray={`${incomeLen} ${c}`}
          strokeLinecap="butt"
          transform="rotate(-90 70 70)"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="#8fa396"
          strokeWidth="16"
          strokeDasharray={`${payoutLen} ${c}`}
          strokeDashoffset={-incomeLen}
          strokeLinecap="butt"
          transform="rotate(-90 70 70)"
        />
        <text
          x="70"
          y="66"
          textAnchor="middle"
          fill="var(--color-ink-muted)"
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          {Math.round(incomeFrac * 100)}%
        </text>
        <text
          x="70"
          y="82"
          textAnchor="middle"
          fill="var(--color-ink)"
          style={{ fontSize: 11, fontWeight: 700 }}
        >
          {incomeLabel}
        </text>
      </svg>
      <div className="space-y-2 text-caption w-full">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-sm bg-success" />
            {incomeLabel}
          </span>
          <span className="font-numeric font-semibold text-ink">
            {formatValue ? formatValue(income) : income}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#8fa396]" />
            {payoutLabel}
          </span>
          <span className="font-numeric font-semibold text-ink">
            {formatValue ? formatValue(payout) : payout}
          </span>
        </div>
      </div>
    </div>
  )
}
