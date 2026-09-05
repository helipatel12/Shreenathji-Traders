// Settings — reports, veparis beside business profile + rates (owner),
// admin links, year-end archive.

import { Link } from 'react-router-dom'
import { FileBarChart2, Shield, ListTodo } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import VepariListSection from './VepariListSection'
import BusinessProfileSection from './BusinessProfileSection'
import DefaultRatesSection from './DefaultRatesSection'
import YearEndArchiveSection from './YearEndArchiveSection'

function SectionLabel({ children }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted mb-3">
      {children}
    </h2>
  )
}

function QuickLink({ to, icon: Icon, title, body }) {
  return (
    <Link
      to={to}
      className="card group flex items-start gap-3 px-4 py-3.5 transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
    >
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-caption font-semibold text-ink group-hover:text-accent">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] text-ink-muted leading-snug">{body}</span>
      </span>
    </Link>
  )
}

export default function SettingsScreen() {
  const { user, role, isOwner, isCa } = useAuth()
  const { t } = useLocale()

  const displayName = user?.name || user?.email || ''
  const roleLabel = role ? t(`roles.${role}`) : ''

  return (
    <div className="max-w-6xl">
      <header className="mb-5">
        <h1 className="page-title mb-1">{t('settings.title')}</h1>
        <p className="text-caption text-ink-muted">
          {displayName}
          {roleLabel ? <span> · {roleLabel}</span> : null}
        </p>
      </header>

      <section className="mb-5">
        <SectionLabel>{t('nav.reports')}</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            to="/reports"
            icon={FileBarChart2}
            title={t('reports.title')}
            body={t('reports.subtitle')}
          />
          {isOwner && (
            <>
              <QuickLink
                to="/admin/users"
                icon={Shield}
                title={t('nav.userManagement')}
                body={t('admin.usersSubtitle')}
              />
              <QuickLink
                to="/admin/queue"
                icon={ListTodo}
                title={t('nav.queueMonitor')}
                body={t('admin.queueSubtitle')}
              />
            </>
          )}
        </div>
      </section>

      {/* Buyers | Business profile + Default rates (side by side) */}
      {(isOwner || !isCa) && (
        <section className="mb-5">
          <div
            className={[
              'grid gap-3',
              isOwner ? 'lg:grid-cols-[1.15fr_1fr]' : '',
            ].join(' ')}
          >
            {!isCa && (
              <div className="min-w-0">
                <VepariListSection />
              </div>
            )}

            {isOwner && (
              <div className="grid gap-3 content-start">
                <BusinessProfileSection />
                <DefaultRatesSection />
              </div>
            )}
          </div>

          {!isOwner && !isCa && (
            <div className="card px-4 py-4 mt-3 max-w-md">
              <p className="text-caption text-ink-muted">{t('settings.ownerOnlyNote')}</p>
            </div>
          )}
        </section>
      )}

      {isOwner && (
        <section className="mb-2">
          <YearEndArchiveSection />
        </section>
      )}
    </div>
  )
}
