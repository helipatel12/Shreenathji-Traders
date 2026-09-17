import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'

export default function PlatformBell({ unread, unreadCount, t, markRead }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const navigate = useNavigate()
  const preview = unread.slice(0, 5)

  useEffect(() => {
    function onPointer(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function openTask(task) {
    markRead(task.id)
    setOpen(false)
    navigate(`/platform/companies/${task.companyId}`)
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="platform-icon-btn relative"
        aria-label={t('platform.notifications')}
        aria-expanded={open}
      >
        <Bell size={16} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold leading-4 text-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+0.45rem)] z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-surface shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <p className="text-[12px] font-semibold text-ink">{t('platform.notifications')}</p>
            <Link
              to="/platform/inbox"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold text-accent"
            >
              {t('platform.openInbox')}
            </Link>
          </div>
          {preview.length === 0 ? (
            <p className="px-3 py-6 text-caption text-ink-muted text-center">{t('platform.noNotifications')}</p>
          ) : (
            <ul>
              {preview.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => openTask(task)}
                    className="w-full text-left px-3 py-2.5 hover:bg-accent-soft border-b border-border last:border-0"
                  >
                    <p className="text-[13px] font-semibold text-ink truncate">{task.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {task.type === 'paused' ? t('platform.taskPaused') : t('platform.taskPending')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
