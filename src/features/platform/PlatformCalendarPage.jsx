import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLocale } from '../../context/LocaleContext'
import { usePlatformData } from './PlatformDataContext'
import PlatformCalendar from './PlatformCalendar'
import StatusBadge from './StatusBadge'
import { companiesByDate, companyInitials, currentYearMonth } from './platformUi'
import { todayKeyIST } from '../../utils/dates'
import { SkeletonCard } from '../../components/Skeleton'

export default function PlatformCalendarPage() {
  const { t, lang, formatDate } = useLocale()
  const navigate = useNavigate()
  const { companies, loading } = usePlatformData()
  const [{ year, month }, setMonth] = useState(currentYearMonth)
  const [selectedKey, setSelectedKey] = useState(todayKeyIST)
  const byDate = useMemo(() => companiesByDate(companies), [companies])
  const selected = byDate[selectedKey] || []

  return (
    <div className="max-w-4xl">
      <Link
        to="/platform"
        className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink mb-3"
      >
        <ArrowLeft size={14} />
        {t('platform.home')}
      </Link>
      <header className="mb-4 pl-3 border-l-[3px] border-[#b3413a]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {t('platform.eyebrow')}
        </p>
        <h1 className="mt-0.5 text-xl font-display font-bold text-ink tracking-tight">
          {t('platform.calendar')}
        </h1>
        <p className="text-[13px] text-ink-muted mt-0.5">{t('platform.calendarHint')}</p>
      </header>

      {loading ? (
        <SkeletonCard />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card px-4 py-4">
            <PlatformCalendar
              companies={companies}
              year={year}
              month={month}
              onMonthChange={setMonth}
              selectedKey={selectedKey}
              onSelectDay={(key) => setSelectedKey(key)}
              lang={lang}
              t={t}
            />
          </section>
          <section className="card px-4 py-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-3">
              {formatDate(selectedKey)}
            </h2>
            {selected.length === 0 ? (
              <p className="text-[13px] text-ink-muted">{t('platform.calendarEmptyDay')}</p>
            ) : (
              <ul className="space-y-1.5">
                {selected.map((company) => (
                  <li key={company.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/platform/companies/${company.id}`)}
                      className="w-full flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent-soft text-left"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[10px] font-semibold text-white">
                        {companyInitials(company.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink truncate">{company.name}</span>
                      </span>
                      <StatusBadge company={company} t={t} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
