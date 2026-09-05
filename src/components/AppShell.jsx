import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Home,
  Receipt,
  BookOpen,
  Wallet,
  Landmark,
  Settings,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ListTodo,
  UserCog,
  FileBarChart2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../context/LocaleContext'
import LanguageToggle from './LanguageToggle'
import ProfileMenu from './ProfileMenu'
import YearEndArchivePrompt from './YearEndArchivePrompt'

const SIDEBAR_KEY = 'st_sidebar_collapsed'

function navClass({ isActive }, collapsed) {
  return [
    'flex items-center gap-3 min-h-11 rounded-xl text-sm font-medium transition-colors',
    collapsed ? 'justify-center px-2' : 'px-3',
    isActive
      ? 'bg-accent-soft text-accent font-semibold'
      : 'text-ink-muted hover:bg-sidebar-hover hover:text-ink',
  ].join(' ')
}

function mobileTabClass({ isActive }) {
  return [
    'flex flex-col items-center justify-center gap-1 min-h-14 min-w-12 px-2 py-1',
    isActive ? 'text-accent' : 'text-ink-muted',
  ].join(' ')
}

export default function AppShell() {
  const { isOwner, isCa, logout } = useAuth()
  const { t, lang } = useLocale()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const brandPrimary = lang === 'gu' ? t('common.businessNameGu') : t('common.businessNameEn')

  const mainTabs = [
    { to: '/', label: t('nav.home'), Icon: Home, end: true },
    { to: '/bills', label: t('nav.bill'), Icon: Receipt },
    { to: '/dakhla', label: t('nav.dakhla'), Icon: BookOpen },
    { to: '/rojmer', label: t('nav.rojmer'), Icon: Wallet },
    { to: '/silak', label: t('nav.silak'), Icon: Landmark },
  ]

  const reportTab = { to: '/reports', label: t('nav.reports'), Icon: FileBarChart2 }

  const adminTabs = isOwner
    ? [
        { to: '/admin/users', label: t('nav.userManagement'), Icon: UserCog },
        { to: '/admin/queue', label: t('nav.queueMonitor'), Icon: ListTodo },
      ]
    : []

  const panelLabel = isOwner
    ? t('nav.adminPanel')
    : isCa
      ? t('nav.caPanel')
      : t('nav.staffPanel')

  const allNav = [
    ...mainTabs,
    reportTab,
    ...adminTabs,
    { to: '/settings', label: t('nav.settings'), Icon: Settings },
  ]
  const crumb =
    allNav.find((tab) =>
      tab.end ? location.pathname === '/' : location.pathname.startsWith(tab.to),
    )?.label || brandPrimary

  return (
    <div className="min-h-svh bg-surface-muted text-ink md:flex">
      <aside
        className={[
          'hidden md:flex md:flex-col md:shrink-0 bg-surface border-r border-border',
          'h-svh sticky top-0 overflow-hidden',
          collapsed ? 'md:w-[4.5rem]' : 'md:w-60',
        ].join(' ')}
      >
        <div className={`px-3 pt-5 pb-4 border-b border-border ${collapsed ? 'px-2' : 'px-4'}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <img
              src={collapsed ? '/icons/icon-192.png' : '/icons/logo_full_ink_transparent.png'}
              alt={brandPrimary}
              className={
                collapsed
                  ? 'h-9 w-9 shrink-0 rounded-xl object-contain'
                  : 'h-11 w-auto max-w-[10rem] object-contain object-left'
              }
            />
          </div>
          {!collapsed && (
            <p className="text-[11px] text-ink-muted mt-2 truncate">{panelLabel}</p>
          )}
        </div>

        <nav className="flex flex-col gap-1 px-2 py-4 flex-1 overflow-hidden">
          {!collapsed && (
            <p className="px-3 mb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
              {t('nav.main')}
            </p>
          )}
          {mainTabs.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={(args) => navClass(args, collapsed)}
            >
              <Icon size={18} strokeWidth={1.75} />
              {!collapsed && label}
            </NavLink>
          ))}

          <NavLink
            to={reportTab.to}
            title={reportTab.label}
            className={(args) => navClass(args, collapsed)}
          >
            <FileBarChart2 size={18} strokeWidth={1.75} />
            {!collapsed && reportTab.label}
          </NavLink>

          {isOwner && (
            <>
              {!collapsed && (
                <p className="px-3 mt-4 mb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                  {t('nav.admin')}
                </p>
              )}
              {adminTabs.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={label}
                  className={(args) => navClass(args, collapsed)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {!collapsed && label}
                </NavLink>
              ))}
            </>
          )}

          {!collapsed && (
            <p className="px-3 mt-4 mb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
              {t('nav.account')}
            </p>
          )}
          <NavLink
            to="/settings"
            title={t('nav.settings')}
            className={(args) => navClass(args, collapsed)}
          >
            <Settings size={18} strokeWidth={1.75} />
            {!collapsed && t('nav.settings')}
          </NavLink>
        </nav>

        <div className="px-2 pb-4 pt-2 border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="w-full min-h-11 rounded-xl border border-border text-ink-muted hover:text-ink hover:bg-sidebar-hover inline-flex items-center justify-center gap-2"
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && (
              <span className="text-caption font-medium">{t('nav.collapseSidebar')}</span>
            )}
          </button>
        </div>
      </aside>

      <div className="flex-1 md:min-w-0 flex flex-col min-h-svh">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-surface border-b border-border px-4 py-3 md:px-8">
          <div className="min-w-0 flex items-center gap-2.5">
            <img
              src="/icons/icon-192.png"
              alt=""
              className="h-8 w-8 rounded-lg object-contain md:hidden shrink-0"
            />
            <div className="min-w-0">
              <p className="text-caption text-ink-muted truncate md:hidden">{brandPrimary}</p>
              <p className="hidden md:flex items-center gap-2 text-caption text-ink-muted">
                <Shield size={14} className="text-accent" />
                {panelLabel}
                <span className="text-border">/</span>
                <span className="text-ink font-medium">{crumb}</span>
              </p>
              <h1 className="page-title md:hidden truncate text-lg">{crumb}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle />
            <ProfileMenu />
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-border text-caption font-semibold text-ink-muted hover:text-danger hover:border-danger/40"
            >
              <LogOut size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">{t('dashboard.logout')}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pt-5 pb-28 sm:px-6 md:px-8 md:pt-7 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around items-stretch z-10 safe-bottom">
        {mainTabs.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={mobileTabClass}>
            <Icon size={22} strokeWidth={1.75} />
            <span className="text-[0.7rem] leading-none font-medium">{label}</span>
          </NavLink>
        ))}
        <NavLink to="/settings" className={mobileTabClass}>
          <Settings size={22} strokeWidth={1.75} />
          <span className="text-[0.7rem] leading-none font-medium">{t('nav.settings')}</span>
        </NavLink>
      </nav>

      <YearEndArchivePrompt />
    </div>
  )
}
