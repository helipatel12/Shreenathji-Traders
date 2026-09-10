import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  Plus,
  FileText,
  BookOpen,
  HandCoins,
  Landmark,
  ChevronRight,
} from 'lucide-react'
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

function formatYardDate(dateKey, localeTag) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 6))
  return new Intl.DateTimeFormat(localeTag === 'gu' ? 'gu-IN' : 'en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(dt)
}

const RANGE_OPTIONS = DASHBOARD_PRESETS

const BOOKS = [
  {
    to: '/bills',
    icon: FileText,
    labelKey: 'dashboard.bookMemo',
    hintKey: 'dashboard.bookMemoHint',
  },
  {
    to: '/dakhla',
    icon: BookOpen,
    labelKey: 'dashboard.bookDakhla',
    hintKey: 'dashboard.bookDakhlaHint',
  },
  {
    to: '/rojmer',
    icon: HandCoins,
    labelKey: 'dashboard.bookRojmer',
    hintKey: 'dashboard.bookRojmerHint',
  },
  {
    to: '/silak',
    icon: Landmark,
    labelKey: 'dashboard.bookSilak',
    hintKey: 'dashboard.bookSilakHint',
  },
]

export default function DashboardScreen() {
  const { user, role, canWrite, isOwner, isCa } = useAuth()
  const { t, formatCurrency, formatDigits, lang } = useLocale()
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

  const today = todayKeyIST()
  const name = (user?.name || '').trim() || (user?.email || '').split('@')[0]
  const location = (user?.location || '').trim()
  const periodLabel = preset ? t(`dashboard.period${preset}`) : t('dashboard.periodCustom')
  const yardDate = useMemo(() => formatYardDate(today, lang), [today, lang])

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

  const netShare =
    incomeTotal > 0
      ? Math.min(100, Math.max(0, Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 100)))
      : 0
  const maxLabels = chartSeries.length <= 14 ? Math.max(chartSeries.length, 1) : 8
  const rankMax = Math.max(...ranking.map((r) => r.total || 0), 1)
  const roleLine = [
    role ? t(`roles.${role}`) : '',
    location,
    isOwner ? t('dashboard.brokerDesk') : isCa ? t('nav.caPanel') : t('nav.staffPanel'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="pb-4">
      {!canWrite && <ReadOnlyBanner />}

      {/* Yard desk header */}
      <header className="mb-5 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 pl-3 border-l-[3px] border-[#b3413a]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {t('common.businessNameEn')}
            </p>
            <h1 className="mt-1 text-2xl sm:text-[1.75rem] font-display font-bold text-ink tracking-tight">
              {t(greetingKey())}
              {name ? `, ${name}` : ''}
            </h1>
            <p className="mt-1 text-caption text-ink-muted">
              {yardDate}
              {roleLine ? ` · ${roleLine}` : ''}
            </p>
          </div>
          {canWrite && (
            <Link to="/bills" className="btn-primary shrink-0">
              <Plus size={17} strokeWidth={2} />
              {t('dashboard.newBill')}
            </Link>
          )}
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Today's book — three broker figures */}
          <section>
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                {t('dashboard.todayBook')}
              </h2>
              <p className="text-[11px] text-ink-muted">{t('dashboard.todayBookHint')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card px-4 py-4 sm:px-5 sm:py-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {t('dashboard.silakTodayLabel')}
                </p>
                <p className="mt-2 font-numeric text-2xl sm:text-3xl font-bold text-ink leading-none">
                  {formatCurrency(silakPosition)}
                </p>
                <p className="mt-2 text-[12px] text-ink-muted">{t('dashboard.silakCaption')}</p>
              </div>

              <div className="card px-4 py-4 sm:px-5 sm:py-5 border-l-[3px] border-l-success">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
                  {t('dashboard.jamaLabel')}
                </p>
                <p className="mt-2 font-numeric text-2xl sm:text-3xl font-bold text-success leading-none">
                  {formatCurrency(incomeTotal)}
                </p>
                <p className="mt-2 text-[12px] text-ink-muted">
                  {t('dashboard.incomePeriod', { period: periodLabel })}
                </p>
              </div>

              <div className="card px-4 py-4 sm:px-5 sm:py-5 border-l-[3px] border-l-danger">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">
                  {t('dashboard.udharLabel')}
                </p>
                <p className="mt-2 font-numeric text-2xl sm:text-3xl font-bold text-danger leading-none">
                  {formatCurrency(rojmerPendingAmount)}
                </p>
                <p className="mt-2 text-[12px] text-ink-muted">
                  {t('dashboard.rojmerPendingCaption', {
                    count: formatDigits(rojmerPendingCount),
                  })}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">
                  {t('dashboard.billsTodayLabel')}
                </p>
                <p className="font-numeric text-lg font-semibold text-ink mt-0.5">
                  {formatDigits(billsTodayCount)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">
                  {t('dashboard.payoutsPeriod', { period: periodLabel })}
                </p>
                <p className="font-numeric text-lg font-semibold text-ink mt-0.5">
                  {formatCurrency(expenseTotal)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold">
                  {t('dashboard.netPeriod')}
                </p>
                <p
                  className={`font-numeric text-lg font-semibold mt-0.5 ${
                    profitTotal >= 0 ? 'text-success' : 'text-danger'
                  }`}
                >
                  {formatCurrency(profitTotal)}
                </p>
              </div>
            </div>
          </section>

          {/* Four books */}
          <section>
            <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {t('dashboard.openBooks')}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {BOOKS.map(({ to, icon: Icon, labelKey, hintKey }) => (
                <Link
                  key={to}
                  to={to}
                  className="group card px-3.5 py-3.5 hover:border-accent/35 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="h-9 w-9 rounded-lg bg-accent-soft text-accent inline-flex items-center justify-center">
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                    />
                  </div>
                  <p className="mt-3 text-body font-semibold text-ink">{t(labelKey)}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted leading-snug">{t(hintKey)}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* Period movement + vepari book */}
          <section className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8 card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 bg-[#fafaf8]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {t('dashboard.periodMovement')}
                  </p>
                  <p className="text-[12px] text-ink-muted mt-0.5">
                    {chartTab === 'income'
                      ? t('dashboard.storeTrendIncome')
                      : t('dashboard.storeTrendProfit')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex rounded-lg border border-border bg-surface p-0.5">
                    <button
                      type="button"
                      onClick={() => setChartTab('income')}
                      className={[
                        'min-h-8 px-2.5 rounded-md text-[11px] font-semibold',
                        chartTab === 'income'
                          ? 'bg-accent text-white'
                          : 'text-ink-muted hover:text-ink',
                      ].join(' ')}
                    >
                      {t('dashboard.tabGoodsPayout')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartTab('profit')}
                      className={[
                        'min-h-8 px-2.5 rounded-md text-[11px] font-semibold',
                        chartTab === 'profit'
                          ? 'bg-accent text-white'
                          : 'text-ink-muted hover:text-ink',
                      ].join(' ')}
                    >
                      {t('dashboard.tabNet')}
                    </button>
                  </div>
                  <div className="flex rounded-lg border border-border bg-surface p-0.5">
                    {RANGE_OPTIONS.map(({ id }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPreset(id)}
                        className={[
                          'min-h-8 px-2 rounded-md text-[10px] font-semibold',
                          preset === id
                            ? 'bg-surface-muted text-ink'
                            : 'text-ink-muted hover:text-ink',
                        ].join(' ')}
                      >
                        {t(`dashboard.range${id}`)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-1.5 py-0.5">
                    <input
                      id="dash-from"
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="min-h-7 max-w-[8.5rem] rounded-md border-0 bg-transparent px-1 text-[11px] font-numeric text-ink outline-none"
                      aria-label={t('common.from')}
                    />
                    <span className="text-[10px] text-ink-muted">–</span>
                    <input
                      id="dash-to"
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      max={today}
                      onChange={(e) => setToDate(e.target.value)}
                      className="min-h-7 max-w-[8.5rem] rounded-md border-0 bg-transparent px-1 text-[11px] font-numeric text-ink outline-none"
                      aria-label={t('common.to')}
                    />
                  </div>
                </div>
              </div>

              <div className="px-4 py-4">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <p className="font-numeric text-2xl font-bold text-ink leading-none">
                    {chartTab === 'income'
                      ? formatCurrency(incomeTotal)
                      : formatCurrency(profitTotal)}
                  </p>
                  {chartTab === 'income' && (
                    <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-[2px] bg-accent" />
                        {t('dashboard.legendGoods')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-[2px] bg-[#8fa396]" />
                        {t('dashboard.legendFarmerPay')}
                      </span>
                    </div>
                  )}
                </div>
                <BarChart
                  series={barSeries}
                  height={228}
                  maxLabels={maxLabels}
                  emptyLabel={t('dashboard.chartEmpty')}
                  formatValue={formatCurrency}
                  barColor="var(--color-accent)"
                />
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="card px-4 py-4 flex-1">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                      {t('dashboard.vepariBook')}
                    </p>
                    <p className="text-[12px] text-ink-muted mt-0.5">
                      {t('dashboard.vepariBookHint')}
                    </p>
                  </div>
                  <Link
                    to="/dakhla"
                    className="text-[11px] font-semibold text-accent hover:underline"
                  >
                    {t('dashboard.open')}
                  </Link>
                </div>
                {ranking.length === 0 ? (
                  <p className="text-caption text-ink-muted py-6 text-center">
                    {t('dashboard.chartEmpty')}
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {ranking.slice(0, 5).map((row, i) => (
                      <li key={row.vepariId || i}>
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <div className="min-w-0 flex items-baseline gap-2">
                            <span className="font-numeric text-[11px] text-ink-muted w-4 shrink-0">
                              {formatDigits(i + 1)}.
                            </span>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-ink truncate">
                                {row.name}
                              </p>
                              {row.village ? (
                                <p className="text-[11px] text-ink-muted truncate">
                                  {row.village}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <p className="font-numeric text-[12px] font-semibold text-ink shrink-0">
                            {formatCurrency(row.total)}
                          </p>
                        </div>
                        <div className="ml-6 h-1 rounded-full bg-surface-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent/75"
                            style={{
                              width: `${Math.max(6, (row.total / rankMax) * 100)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="card px-4 py-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {t('dashboard.netTrend')}
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
                  fill={profitTotal >= 0 ? '#e8f2ea' : '#f8e8e6'}
                  emptyLabel={t('dashboard.chartEmpty')}
                  height={100}
                />
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-muted">
                  <span>{t('dashboard.marginLabel')}</span>
                  <span className="font-numeric font-semibold text-ink">
                    {formatDigits(netShare)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-surface-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${netShare}%` }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
