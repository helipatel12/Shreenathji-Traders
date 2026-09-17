import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Plus, PauseCircle, ShieldCheck, UserPlus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import { COMPANY_STATUSES } from '../../utils/roles'
import { todayKeyIST } from '../../utils/dates'
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/Skeleton'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import TrendChart from '../../components/TrendChart'
import StatusBadge from './StatusBadge'
import StatusDonut from './StatusDonut'
import PlatformCalendar from './PlatformCalendar'
import Reveal from './Reveal'
import { usePlatformData } from './PlatformDataContext'
import {
  addedThisMonthCount,
  companyInitials,
  currentYearMonth,
  formatYardDate,
  greetingKey,
  hasPendingAdmin,
  monthlyAddSeries,
  operatorName,
  searchHaystack,
  timestampToDateKey,
} from './platformUi'

function KpiCard({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className={`card px-3 py-2.5 ${accent || ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
        <Icon size={14} className="text-ink-muted" strokeWidth={1.75} />
      </div>
      <p className="mt-1 font-numeric text-xl font-bold text-ink leading-none">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted truncate">{hint}</p> : null}
    </div>
  )
}

export default function PlatformDashboard() {
  const { t, lang, formatDigits, formatDate } = useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { companies, loading, error, activeCount, suspendedCount, unread } = usePlatformData()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [{ year, month }, setCalMonth] = useState(currentYearMonth)
  const [selectedDay, setSelectedDay] = useState(todayKeyIST)

  const name = operatorName(user)
  const yardDate = useMemo(() => formatYardDate(lang), [lang])
  const pendingAdminCount = companies.filter(hasPendingAdmin).length
  const monthAdds = addedThisMonthCount(companies)
  const trend = useMemo(() => monthlyAddSeries(companies, 6, lang), [companies, lang])
  const mix = useMemo(() => {
    const paused = suspendedCount
    const pending = companies.filter(
      (c) => hasPendingAdmin(c) && c.status !== COMPANY_STATUSES.SUSPENDED,
    ).length
    const active = companies.filter(
      (c) => c.status === COMPANY_STATUSES.ACTIVE && !hasPendingAdmin(c),
    ).length
    return [
      { key: 'active', label: t('platform.statusActive'), value: active, color: 'var(--color-success)' },
      { key: 'paused', label: t('platform.statusSuspended'), value: paused, color: '#d97706' },
      { key: 'pending', label: t('platform.statPendingAdmin'), value: pending, color: 'var(--color-ink-muted)' },
    ]
  }, [t, companies, suspendedCount])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return companies.filter((company) => {
      if (statusFilter === COMPANY_STATUSES.ACTIVE && company.status !== COMPANY_STATUSES.ACTIVE) return false
      if (statusFilter === COMPANY_STATUSES.SUSPENDED && company.status !== COMPANY_STATUSES.SUSPENDED) {
        return false
      }
      if (statusFilter === 'pending' && !hasPendingAdmin(company)) return false
      if (q && !searchHaystack(company).includes(q)) return false
      return true
    })
  }, [companies, search, statusFilter])

  const filters = [
    { id: 'all', label: t('platform.allStatuses') },
    { id: COMPANY_STATUSES.ACTIVE, label: t('platform.statusActive') },
    { id: COMPANY_STATUSES.SUSPENDED, label: t('platform.statusSuspended') },
    { id: 'pending', label: t('platform.statPendingAdmin') },
  ]

  const columns = [
    {
      key: 'name',
      header: t('platform.colCompany'),
      render: (row) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[10px] font-semibold text-white">
            {companyInitials(row.name)}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{row.name}</p>
            <p className="text-[10px] text-ink-muted truncate font-numeric">{row.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'admin',
      header: t('platform.colAdmin'),
      render: (row) => (
        <p className="text-[13px] text-ink truncate">{row.adminName || row.adminEmail || '—'}</p>
      ),
    },
    {
      key: 'status',
      header: t('platform.colStatus'),
      render: (row) => <StatusBadge company={row} t={t} />,
    },
    {
      key: 'createdAt',
      header: t('platform.colCreated'),
      render: (row) => {
        const key = timestampToDateKey(row.createdAt)
        return <span className="font-numeric text-[12px] text-ink-muted">{key ? formatDate(key) : '—'}</span>
      },
    },
  ]

  return (
    <div className="max-w-6xl pb-2">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 pl-2.5 border-l-[3px] border-[#b3413a]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {t('platform.eyebrow')}
          </p>
          <h1 className="mt-0.5 text-xl sm:text-[1.4rem] font-display font-bold text-ink tracking-tight">
            {t(greetingKey())}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="text-[12px] text-ink-muted">
            {yardDate}
            {' · '}
            {t('roles.master_admin')}
          </p>
        </div>
        <Link to="/platform/companies/new" className="btn-primary min-h-9 px-3.5 text-[13px] shrink-0">
          <Plus size={15} strokeWidth={2} />
          {t('platform.addCompany')}
        </Link>
      </header>

      {error && (
        <p className="mb-3 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {t('platform.loadFailed')}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <SkeletonTable rows={4} cols={4} />
        </div>
      ) : (
        <>
          <Reveal>
            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <KpiCard
                icon={Building2}
                label={t('platform.statCompanies')}
                value={formatDigits(companies.length)}
                hint={t('platform.addedThisMonth', { count: formatDigits(monthAdds) })}
              />
              <KpiCard
                icon={ShieldCheck}
                label={t('platform.statActive')}
                value={formatDigits(activeCount)}
                hint={t('platform.statActiveHint')}
                accent="border-l-[3px] border-l-success"
              />
              <KpiCard
                icon={PauseCircle}
                label={t('platform.statSuspended')}
                value={formatDigits(suspendedCount)}
                hint={t('platform.statSuspendedHint')}
                accent="border-l-[3px] border-l-amber-500"
              />
              <KpiCard
                icon={UserPlus}
                label={t('platform.statPendingAdmin')}
                value={formatDigits(pendingAdminCount)}
                hint={t('platform.statPendingHint')}
              />
            </section>
          </Reveal>

          <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr] mb-4">
            <Reveal delay={60}>
              <section className="card px-4 py-3.5 h-full">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t('platform.chartAdds')}
                  </h2>
                  <p className="text-[11px] text-ink-muted">{t('platform.chartAddsHint')}</p>
                </div>
                <TrendChart series={trend} height={168} emptyLabel={t('platform.chartEmpty')} />
              </section>
            </Reveal>
            <Reveal delay={90}>
              <section className="card px-4 py-3.5 h-full">
                <h2 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-2">
                  {t('platform.chartMix')}
                </h2>
                <StatusDonut slices={mix} emptyLabel={t('platform.chartEmpty')} />
              </section>
            </Reveal>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr] mb-4">
            <Reveal delay={120}>
              <section className="card px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t('platform.calendar')}
                  </h2>
                  <Link to="/platform/calendar" className="text-[11px] font-semibold text-accent">
                    {t('platform.openCalendar')}
                  </Link>
                </div>
                <PlatformCalendar
                  compact
                  companies={companies}
                  year={year}
                  month={month}
                  onMonthChange={setCalMonth}
                  selectedKey={selectedDay}
                  onSelectDay={(key) => setSelectedDay(key)}
                  lang={lang}
                  t={t}
                />
              </section>
            </Reveal>
            <Reveal delay={150}>
              <section className="card px-4 py-3.5 h-full">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t('platform.tasks')}
                  </h2>
                  <Link to="/platform/inbox" className="text-[11px] font-semibold text-accent">
                    {t('platform.openInbox')}
                  </Link>
                </div>
                {unread.length === 0 ? (
                  <p className="text-[13px] text-ink-muted py-6 text-center">{t('platform.noNotifications')}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {unread.slice(0, 5).map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/platform/companies/${task.companyId}`)}
                          className="w-full text-left py-2.5 flex items-start gap-2 hover:text-accent"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-danger shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold text-ink truncate">{task.name}</span>
                            <span className="block text-[11px] text-ink-muted">
                              {task.type === 'paused' ? t('platform.taskPaused') : t('platform.taskPending')}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          </div>

          {companies.length === 0 ? (
            <Reveal delay={180}>
              <div className="card px-5 py-8 text-center">
                <Building2 className="mx-auto text-ink-muted mb-2" size={22} />
                <p className="text-[14px] font-semibold text-ink">{t('platform.emptyTitle')}</p>
                <p className="text-[12px] text-ink-muted mt-1 mb-4">{t('platform.emptyBody')}</p>
                <Link to="/platform/companies/new" className="btn-primary inline-flex min-h-9 text-[13px]">
                  <Plus size={15} />
                  {t('platform.addCompany')}
                </Link>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={180}>
              <section>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {t('platform.directory')}
                  </h2>
                  <p className="text-[11px] text-ink-muted">{t('platform.directoryHint')}</p>
                </div>
                <DataTable
                  columns={columns}
                  rows={filtered}
                  rowKey="id"
                  onRowClick={(row) => navigate(`/platform/companies/${row.id}`)}
                  empty={<p className="text-[13px] text-ink-muted">{t('platform.noSearchResults')}</p>}
                  toolbar={
                    <TableToolbar
                      search={search}
                      onSearchChange={setSearch}
                      searchPlaceholder={t('platform.searchCompanies')}
                      actions={
                        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5">
                          {filters.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setStatusFilter(f.id)}
                              className={[
                                'min-h-7 px-2 rounded-md text-[11px] font-semibold',
                                statusFilter === f.id
                                  ? 'bg-surface-muted text-ink'
                                  : 'text-ink-muted hover:text-ink',
                              ].join(' ')}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      }
                    />
                  }
                  meta={t('platform.showingCount', {
                    shown: formatDigits(filtered.length),
                    total: formatDigits(companies.length),
                  })}
                />
              </section>
            </Reveal>
          )}
        </>
      )}
    </div>
  )
}
