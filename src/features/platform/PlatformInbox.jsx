import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react'
import { useLocale } from '../../context/LocaleContext'
import { usePlatformData } from './PlatformDataContext'
import StatusBadge from './StatusBadge'
import { Skeleton } from '../../components/Skeleton'

export default function PlatformInbox() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { companies, loading, tasks, unreadCount, read, markRead, markAllRead } = usePlatformData()

  return (
    <div className="max-w-2xl">
      <Link
        to="/platform"
        className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink mb-3"
      >
        <ArrowLeft size={14} />
        {t('platform.home')}
      </Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="pl-3 border-l-[3px] border-[#b3413a]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {t('platform.eyebrow')}
          </p>
          <h1 className="mt-0.5 text-xl font-display font-bold text-ink tracking-tight">
            {t('platform.inbox')}
          </h1>
          <p className="text-[13px] text-ink-muted mt-0.5">{t('platform.inboxSubtitle')}</p>
        </div>
        {tasks.length > 0 && (
          <button type="button" onClick={markAllRead} className="btn-secondary min-h-9 px-3 text-[12px]">
            <CheckCheck size={15} />
            {t('platform.markAllRead')}
          </button>
        )}
      </header>

      {loading ? (
        <div className="card divide-y divide-border">
          <Skeleton className="h-14 m-3" />
          <Skeleton className="h-14 m-3" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="card px-5 py-10 text-center">
          <Bell className="mx-auto text-ink-muted mb-2" size={22} />
          <p className="text-[14px] font-semibold text-ink">{t('platform.inboxEmpty')}</p>
        </div>
      ) : (
        <ul className="card divide-y divide-border overflow-hidden">
          {tasks.map((task) => {
            const company = companies.find((c) => c.id === task.companyId)
            const isRead = Boolean(read[task.id])
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => {
                    markRead(task.id)
                    navigate(`/platform/companies/${task.companyId}`)
                  }}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-accent-soft/50 ${
                    isRead ? 'opacity-70' : ''
                  }`}
                >
                  {!isRead && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-danger shrink-0" />}
                  {isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink truncate">{task.name}</p>
                      {company ? <StatusBadge company={company} t={t} /> : null}
                    </div>
                    <p className="text-[12px] text-ink-muted mt-0.5">
                      {task.type === 'paused' ? t('platform.taskPaused') : t('platform.taskPending')}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11px] text-ink-muted mt-3">
        {t('platform.unreadCount', { count: String(unreadCount) })}
      </p>
    </div>
  )
}
