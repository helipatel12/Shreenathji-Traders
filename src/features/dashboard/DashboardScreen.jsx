import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardRange, DASHBOARD_PRESETS } from '../../hooks/useDashboardSummary'
import { useLocale } from '../../context/LocaleContext'
import { todayKeyIST } from '../../utils/dates'
import ReadOnlyBanner from '../../components/ReadOnlyBanner'
import { SkeletonCard, Skeleton } from '../../components/Skeleton'
import BarChart from '../../components/BarChart'
import TrendChart from '../../components/TrendChart'

function greetingKey() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  )
  if (hour < 12) return 'dashboard.greetingMorning'
  if (hour < 17) return 'dashboard.greetingAfternoon'
  return 'dashboard.greetingEvening'
}

function MetricCard({ icon: Icon, label, value, tone = 'accent', hint }) {
  const tones = {
    accent: 'bg-accent-soft text-accent',
    success: 'bg-green-50 text-success',
    danger: 'bg-red-50 text-danger',
    muted: 'bg-surface-muted text-ink-muted',
  }
  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon size={15} strokeWidth={1.75} />
        </div>
        {hint}
      </div>
      <p className="font-numeric text-lg font-semibold text-ink mt-2 leading-tight">{value}</p>
      <p className="text-[11px] text-ink-muted mt-0.5 truncate">{label}</p>
    </div>
  )
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="card px-3 py-2.5 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] text-ink-muted truncate">{label}</p>
        <p
          className={`font-numeric text-sm font-semibold mt-0.5 ${
            tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

const RANGE_OPTIONS = DASHBOARD_PRESETS

export default function DashboardScreen() {
  const { user, role, canWrite, isOwner, isCa } = useAuth()
  const { t, formatCurrency, formatDigits } = useLocale()
  const [chartTab, setChartTab] = useState('income')
  const {
    loading,
    billsTodayCount,
    rojmerPendingCount,
    rojmerPendingAmount,
    silakPosition,
    chartSeries,
    profitSeries,
    ranking,
    incomeTotal,
    profitTotal,
    expenseTotal,
    preset,
    setPreset,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
  } = useDashboardRange('7d')

  const name = (user?.name || '').trim() || (user?.email || '').split('@')[0]
  const periodLabel = preset ? t(`dashboard.period${preset}`) : t('dashboard.periodCustom')
  const barSeries = chartSeries.map((p) => ({
    label: formatDigits(p.label),
    value: chartTab === 'income' ? p.value : p.profit,
    value2: chartTab === 'income' ? p.value2 : undefined,
    tip: p.tip || p.date,
    color:
      chartTab === 'profit'
        ? (p.profit || 0) >= 0
          ? 'var(--color-success)'
          : 'var(--color-danger)'
        : undefined,
  }))
  const profitSeriesLocale = profitSeries.map((p) => ({
    ...p,
    label: formatDigits(p.label),
  }))

  const clearedShare =
    incomeTotal > 0 ? Math.min(100, Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 100)) : 0

  // Presets stay fully labeled (7d/1m/6m/1y ≤ ~13 buckets). Longer custom spans stay sparse.
  const maxLabels = chartSeries.length <= 14 ? Math.max(chartSeries.length, 1) : 8

  return (
    <div>
      {!canWrite && <ReadOnlyBanner />}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-ink truncate">
            {t(greetingKey())}
            {name ? `, ${name}` : ''}
          </h1>
          {role && (
            <p className="text-caption text-ink-muted mt-0.5">
              {t(`roles.${role}`)}
              {isOwner
                ? ` · ${t('nav.adminPanel')}`
                : isCa
                  ? ` · ${t('nav.caPanel')}`
                  : ` · ${t('nav.staffPanel')}`}
            </p>
          )}
        </div>
        {canWrite && (
          <Link to="/bills" className="btn-primary !min-h-10 !px-3.5 text-caption">
            <Plus size={16} strokeWidth={2} />
            {t('dashboard.newBill')}
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-12">
          {/* Compact KPI strip */}
          <div className="lg:col-span-12 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={TrendingUp}
              label={t('dashboard.incomePeriod', { period: periodLabel })}
              value={formatCurrency(incomeTotal)}
              tone="success"
              hint={<ArrowUpRight size={14} className="text-success" />}
            />
            <MetricCard
              icon={TrendingDown}
              label={t('dashboard.expensePeriod', { period: periodLabel })}
              value={formatCurrency(expenseTotal)}
              tone="danger"
              hint={<ArrowDownRight size={14} className="text-danger" />}
            />
            <MetricCard
              icon={Wallet}
              label={t('dashboard.silakTodayLabel')}
              value={formatCurrency(silakPosition)}
              tone="accent"
            />
            <MetricCard
              icon={Receipt}
              label={t('dashboard.rojmerPendingLabel')}
              value={formatCurrency(rojmerPendingAmount)}
              tone="muted"
            />
          </div>

          {/* Mini stats row */}
          <div className="lg:col-span-12 grid gap-3 grid-cols-3">
            <MiniStat
              label={t('dashboard.billsTodayLabel')}
              value={formatDigits(billsTodayCount)}
            />
            <MiniStat
              label={t('dashboard.rojmerPendingCaption', { count: formatDigits(rojmerPendingCount) })}
              value={formatDigits(rojmerPendingCount)}
            />
            <MiniStat
              label={t('dashboard.profitLossTrend')}
              value={formatCurrency(profitTotal)}
              tone={profitTotal >= 0 ? 'success' : 'danger'}
            />
          </div>

          {/* Main trend + ranking */}
          <div className="lg:col-span-8 card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <div className="flex items-center gap-0.5 rounded-lg bg-surface-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setChartTab('income')}
                  className={[
                    'min-h-8 px-2.5 rounded-md text-[11px] font-semibold',
                    chartTab === 'income'
                      ? 'bg-surface text-accent shadow-sm'
                      : 'text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  {t('dashboard.tabIncome')}
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab('profit')}
                  className={[
                    'min-h-8 px-2.5 rounded-md text-[11px] font-semibold',
                    chartTab === 'profit'
                      ? 'bg-surface text-accent shadow-sm'
                      : 'text-ink-muted hover:text-ink',
                  ].join(' ')}
                >
                  {t('dashboard.tabProfit')}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
                  {RANGE_OPTIONS.map(({ id }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPreset(id)}
                      className={[
                        'min-h-7 px-2 rounded-md text-[10px] font-semibold',
                        preset === id
                          ? 'bg-accent text-white'
                          : 'text-ink-muted hover:text-ink',
                      ].join(' ')}
                    >
                      {t(`dashboard.range${id}`)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-0.5">
                  <label className="sr-only" htmlFor="dash-from">
                    {t('common.from')}
                  </label>
                  <input
                    id="dash-from"
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="min-h-7 max-w-[8.5rem] rounded-md border-0 bg-transparent px-1 text-[11px] font-numeric text-ink outline-none focus:ring-1 focus:ring-accent"
                  />
                  <span className="text-[10px] text-ink-muted">–</span>
                  <label className="sr-only" htmlFor="dash-to">
                    {t('common.to')}
                  </label>
                  <input
                    id="dash-to"
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    max={todayKeyIST()}
                    onChange={(e) => setToDate(e.target.value)}
                    className="min-h-7 max-w-[8.5rem] rounded-md border-0 bg-transparent px-1 text-[11px] font-numeric text-ink outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>
            </div>
            <div className="px-3.5 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">
                    {chartTab === 'income'
                      ? t('dashboard.storeTrendIncome')
                      : t('dashboard.storeTrendProfit')}
                  </p>
                  <p className="font-numeric text-lg font-semibold text-ink leading-tight mt-0.5">
                    {chartTab === 'income'
                      ? formatCurrency(incomeTotal)
                      : formatCurrency(profitTotal)}
                  </p>
                </div>
                {chartTab === 'income' && (
                  <div className="flex items-center gap-2.5 text-[10px] text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-accent" />
                      {t('dashboard.legendIncome')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm bg-[#8fa396]" />
                      {t('dashboard.legendPayout')}
                    </span>
                  </div>
                )}
              </div>
                <BarChart
                  series={barSeries}
                  height={200}
                  maxLabels={maxLabels}
                  emptyLabel={t('dashboard.chartEmpty')}
                  formatValue={formatCurrency}
                  barColor="var(--color-accent)"
                />
            </div>
          </div>

          {/* Side column: ranking + sparkline */}
          <div className="lg:col-span-4 grid gap-3 content-start">
            <div className="card px-3.5 py-3">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted mb-2.5">
                {t('dashboard.vepariRanking')}
              </p>
              {ranking.length === 0 ? (
                <p className="text-caption text-ink-muted">{t('dashboard.chartEmpty')}</p>
              ) : (
                <ol className="space-y-2">
                  {ranking.slice(0, 5).map((row, i) => (
                    <li key={row.vepariId || i} className="flex items-center gap-2">
                      <span
                        className={[
                          'h-6 w-6 shrink-0 rounded-full inline-flex items-center justify-center text-[10px] font-bold',
                          i < 3 ? 'bg-accent text-white' : 'bg-surface-muted text-ink-muted',
                        ].join(' ')}
                      >
                        {formatDigits(i + 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-ink truncate">{row.name}</p>
                      </div>
                      <p className="font-numeric text-[11px] font-semibold text-ink shrink-0">
                        {formatCurrency(row.total)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="card px-3.5 py-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">
                  {t('dashboard.profitLossTrend')}
                </p>
                <span
                  className={`font-numeric text-sm font-semibold ${
                    profitTotal >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatCurrency(profitTotal)}
                </span>
              </div>
              <TrendChart
                series={profitSeriesLocale}
                stroke={profitTotal >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
                fill={profitTotal >= 0 ? '#dcfce7' : '#fee2e2'}
                emptyLabel={t('dashboard.chartEmpty')}
                height={110}
              />
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-muted">
                <span>{t('dashboard.marginLabel')}</span>
                <span className="font-numeric font-semibold text-ink">
                  {formatDigits(clearedShare)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(0, Math.min(100, clearedShare))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
