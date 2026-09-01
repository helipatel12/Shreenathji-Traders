// Dashboard — Phase 2 (phases.md): today's summary cards, a "New
// Bill" quick action, and navigation to every main screen (nav itself
// lives in components/AppShell.jsx, which wraps this route).
//
// "Done when": dashboard shows correct live numbers from Firestore,
// reads local-first per offline rules. Today those numbers are
// legitimately zero across the board — nothing writes bills/payments/
// silak entries yet (that starts Phase 4) — but the data path is
// real, not mocked, so the cards will start showing real counts the
// moment Phase 4 lands.
//
// Card styling per design.md's 2026-07-24 modern-SaaS switch (§1/§4).

import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardSummary } from '../../hooks/useDashboardSummary'
import { formatCurrency } from '../../utils/calc'
import gu from '../../locales/gu.json'

function SummaryCard({ eyebrow, value, caption }) {
  return (
    <div className="card px-5 py-5">
      <p className="text-caption text-accent font-semibold uppercase tracking-wide">
        {eyebrow}
      </p>
      <p className="font-numeric text-heading text-ink mt-1">{value}</p>
      <p className="text-caption text-ink-muted mt-1">{caption}</p>
    </div>
  )
}

export default function DashboardScreen() {
  const { user, role } = useAuth()
  const {
    loading,
    billsTodayCount,
    rojmerPendingCount,
    rojmerPendingAmount,
    silakPosition,
  } = useDashboardSummary()

  return (
    <div>
      <div className="mb-6">
        <p className="text-caption text-accent font-semibold uppercase tracking-wide">
          {gu.dashboard.welcome}
        </p>
        <p className="text-body text-ink mt-1">
          {user?.name ? user.name : user?.email}
          {role && (
            <span className="text-ink-muted"> · {gu.roles[role] ?? role}</span>
          )}
        </p>
      </div>

      <Link
        to="/bills"
        className="inline-flex items-center gap-2 min-h-11 px-5 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body mb-6 transition-colors"
      >
        <Plus size={18} strokeWidth={2} />
        {gu.dashboard.newBill}
      </Link>

      <div className="grid gap-4 sm:grid-cols-3 max-w-3xl">
        <SummaryCard
          eyebrow={gu.dashboard.billsTodayLabel}
          value={loading ? '—' : billsTodayCount}
          caption={
            !loading && billsTodayCount === 0
              ? 'No bills yet today'
              : 'Bills entered today'
          }
        />
        <SummaryCard
          eyebrow={gu.dashboard.rojmerPendingLabel}
          value={loading ? '—' : formatCurrency(rojmerPendingAmount)}
          caption={
            !loading && rojmerPendingCount === 0
              ? 'No pending payments — nice and clear'
              : `${rojmerPendingCount} bill${rojmerPendingCount === 1 ? '' : 's'} pending`
          }
        />
        <SummaryCard
          eyebrow={gu.dashboard.silakTodayLabel}
          value={loading ? '—' : formatCurrency(silakPosition)}
          caption="Today's cash position"
        />
      </div>
    </div>
  )
}
