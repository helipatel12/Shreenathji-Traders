import { useEffect, useId, useRef, useState } from 'react'
import { User, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import ProfileSection from '../features/settings/ProfileSection'

export default function ProfileMenu() {
  const { user } = useAuth()
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const panelId = useId()

  const displayName = user?.name || user?.email || t('settings.profileTitle')

  useEffect(() => {
    if (!open) return

    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('settings.profileTitle')}
        title={displayName}
        className={[
          'inline-flex items-center justify-center h-10 w-10 rounded-full border border-border bg-surface',
          'text-accent hover:bg-accent-soft transition-colors',
          open ? 'ring-2 ring-accent/30 border-accent' : '',
        ].join(' ')}
      >
        <User size={18} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('settings.profileTitle')}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(22rem,calc(100vw-1.5rem))] max-h-[min(36rem,calc(100svh-5rem))] overflow-y-auto rounded-2xl border border-border bg-surface shadow-lg"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="text-caption font-semibold text-ink truncate">{displayName}</p>
              <p className="text-[11px] text-ink-muted">{t('settings.profileTitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
              aria-label={t('common.close')}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="p-3">
            <ProfileSection embedded />
          </div>
        </div>
      )}
    </div>
  )
}
