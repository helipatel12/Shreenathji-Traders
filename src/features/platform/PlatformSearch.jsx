import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { companyInitials, searchHaystack } from './platformUi'

export default function PlatformSearch({ companies, t }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const pages = useMemo(
    () => [
      { id: 'dash', label: t('platform.home'), to: '/platform' },
      { id: 'cal', label: t('platform.calendar'), to: '/platform/calendar' },
      { id: 'inbox', label: t('platform.inbox'), to: '/platform/inbox' },
      { id: 'add', label: t('platform.addCompany'), to: '/platform/companies/new' },
      { id: 'profile', label: t('platform.profile'), to: '/platform/profile' },
    ],
    [t],
  )

  const q = query.trim().toLowerCase()
  const companyHits = useMemo(() => {
    if (!q) return companies.slice(0, 5)
    return companies.filter((c) => searchHaystack(c).includes(q)).slice(0, 8)
  }, [companies, q])
  const pageHits = useMemo(() => {
    if (!q) return pages
    return pages.filter((p) => p.label.toLowerCase().includes(q))
  }, [pages, q])

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onPointer(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  function go(to) {
    setQuery('')
    setOpen(false)
    navigate(to)
  }

  return (
    <div className="relative flex-1 min-w-0 max-w-md" ref={rootRef}>
      <Search
        size={15}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('platform.search')}
        className="w-full min-h-9 pl-8 pr-10 rounded-lg border border-border bg-surface text-[13px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        aria-label={t('platform.search')}
      />
      <kbd className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-ink-muted border border-border rounded px-1 py-0.5">
        Ctrl K
      </kbd>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 rounded-xl border border-border bg-surface shadow-lg overflow-hidden max-h-[min(24rem,70vh)] overflow-y-auto">
          {pageHits.length > 0 && (
            <div className="py-1.5">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                {t('platform.searchPages')}
              </p>
              {pageHits.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-left text-[13px] text-ink hover:bg-accent-soft"
                  onClick={() => go(page.to)}
                >
                  {page.label}
                </button>
              ))}
            </div>
          )}
          <div className="py-1.5 border-t border-border">
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {t('platform.directory')}
            </p>
            {companyHits.length === 0 ? (
              <p className="px-3 py-2 text-[13px] text-ink-muted">{t('platform.searchNoResults')}</p>
            ) : (
              companyHits.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent-soft"
                  onClick={() => go(`/platform/companies/${company.id}`)}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[10px] font-semibold text-white">
                    {companyInitials(company.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink truncate">{company.name}</span>
                    <span className="block text-[11px] text-ink-muted truncate">
                      {company.adminEmail || company.id}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
