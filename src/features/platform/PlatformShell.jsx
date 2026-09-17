import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  User,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import LanguageToggle from '../../components/LanguageToggle'
import PlatformSearch from './PlatformSearch'
import PlatformBell from './PlatformBell'
import { PlatformDataProvider, usePlatformData } from './PlatformDataContext'

function navClass({ isActive }) {
  return ['sidebar-link group', isActive ? 'is-active' : ''].filter(Boolean).join(' ')
}

export default function PlatformShell() {
  return (
    <PlatformDataProvider>
      <PlatformShellInner />
    </PlatformDataProvider>
  )
}

function PlatformShellInner() {
  const { logout, user } = useAuth()
  const { t } = useLocale()
  const location = useLocation()
  const { companies, unread, unreadCount, markRead } = usePlatformData()

  const crumb = location.pathname.includes('/companies/new')
    ? t('platform.addCompany')
    : location.pathname.includes('/companies/')
      ? t('platform.companyDetail')
      : location.pathname.includes('/profile')
        ? t('platform.profile')
        : location.pathname.includes('/inbox')
          ? t('platform.inbox')
          : location.pathname.includes('/calendar')
            ? t('platform.calendar')
            : t('platform.home')

  const tabs = [
    { to: '/platform', end: true, icon: LayoutDashboard, label: t('platform.home') },
    { to: '/platform/calendar', icon: CalendarDays, label: t('platform.calendar') },
    { to: '/platform/inbox', icon: Bell, label: t('platform.inbox'), badge: unreadCount },
    { to: '/platform/profile', icon: User, label: t('platform.profile') },
  ]

  return (
    <div className="h-svh text-ink md:flex overflow-hidden">
      <aside className="sidebar-rail hidden md:flex md:flex-col md:shrink-0 h-svh sticky top-0 overflow-hidden is-expanded">
        <div className="sidebar-brand shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/icons/logo-mark-transparent.png"
              alt=""
              className="h-8 w-8 shrink-0 object-contain brightness-0 invert"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white leading-tight truncate tracking-tight">
                {t('common.businessNameEn')}
              </p>
              <p className="text-[10px] text-[var(--color-sidebar-muted)] mt-0.5 truncate tracking-wide uppercase">
                {t('platform.controlPlane')}
              </p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2.5">
          <p className="sidebar-section">{t('platform.nav')}</p>
          <NavLink to="/platform" end className={navClass}>
            <LayoutDashboard size={17} strokeWidth={1.75} className="sidebar-icon" />
            <span className="sidebar-label">{t('platform.home')}</span>
          </NavLink>
          <NavLink to="/platform/calendar" className={navClass}>
            <CalendarDays size={17} strokeWidth={1.75} className="sidebar-icon" />
            <span className="sidebar-label">{t('platform.calendar')}</span>
          </NavLink>
          <NavLink to="/platform/inbox" className={navClass}>
            <Bell size={17} strokeWidth={1.75} className="sidebar-icon" />
            <span className="sidebar-label">{t('platform.inbox')}</span>
            {unreadCount > 0 && (
              <span className="ml-auto mr-1 min-w-5 h-5 px-1 rounded-full bg-white/15 text-[10px] font-bold text-white text-center leading-5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/platform/companies/new" className={navClass}>
            <Building2 size={17} strokeWidth={1.75} className="sidebar-icon" />
            <span className="sidebar-label">{t('platform.addCompany')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer shrink-0">
          <p className="sidebar-section">{t('nav.account')}</p>
          <NavLink to="/platform/profile" className={navClass}>
            <User size={17} strokeWidth={1.75} className="sidebar-icon" />
            <span className="sidebar-label">{t('platform.profile')}</span>
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 md:min-w-0 flex flex-col min-h-0 h-svh">
        <header className="app-topbar sticky top-0 z-20 flex items-center gap-2 px-3 py-2 md:px-6">
          <img
            src="/icons/logo-mark-transparent.png"
            alt=""
            className="h-7 w-7 object-contain md:hidden shrink-0"
          />
          <p className="hidden lg:block text-[12px] font-semibold text-ink truncate shrink-0">
            {crumb}
          </p>
          <PlatformSearch companies={companies} t={t} />
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <LanguageToggle />
            <PlatformBell unread={unread} unreadCount={unreadCount} t={t} markRead={markRead} />
            <NavLink
              to="/platform/profile"
              title={user?.email || t('platform.profile')}
              className="platform-icon-btn"
              aria-label={t('platform.profile')}
            >
              <User size={16} strokeWidth={1.75} />
            </NavLink>
            <button
              type="button"
              onClick={logout}
              className="platform-icon-btn hover:text-danger"
              aria-label={t('dashboard.logout')}
            >
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto platform-scroll px-3 pt-4 pb-24 sm:px-5 md:px-6 md:pt-5 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="mobile-tabbar md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-stretch z-10 safe-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  'relative flex flex-col items-center justify-center gap-0.5 min-h-12 min-w-12 px-2 py-1 rounded-xl',
                  isActive ? 'text-accent font-bold' : 'text-ink-muted',
                ].join(' ')
              }
            >
              <Icon size={18} strokeWidth={1.75} />
              {tab.badge > 0 && (
                <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-danger" />
              )}
              <span className="text-[0.6rem] leading-none font-semibold">{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
