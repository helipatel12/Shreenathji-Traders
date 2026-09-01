// Persistent layout for every signed-in screen — header/nav live here
// once instead of being duplicated per screen. Phases 3–10 route
// their screens through the same shell via <Outlet />.
//
// Nav structure follows design.md §4: 5 tabs (Home/Bill/Dakhla/Rojmer/
// Silak) as a bottom tab bar on mobile, a left sidebar on desktop —
// same links, just repositioned by breakpoint. Settings is tucked
// under the profile icon, not a 6th tab. Visual styling follows the
// 2026-07-24 modern-SaaS switch (design.md §1/§4): white surfaces,
// a single dark-green accent, no more red margin rule or paper tone.

import { NavLink, Outlet } from 'react-router-dom'
import {
  Home,
  Receipt,
  BookOpen,
  Wallet,
  Landmark,
  Settings,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import gu from '../locales/gu.json'
import YearEndArchivePrompt from './YearEndArchivePrompt'

const TABS = [
  { to: '/', label: gu.nav.home, Icon: Home, end: true },
  { to: '/bills', label: gu.nav.bill, Icon: Receipt },
  { to: '/dakhla', label: gu.nav.dakhla, Icon: BookOpen },
  { to: '/rojmer', label: gu.nav.rojmer, Icon: Wallet },
  { to: '/silak', label: gu.nav.silak, Icon: Landmark },
]

function mobileTabClasses({ isActive }) {
  return [
    'flex flex-col items-center justify-center gap-1 min-h-11 min-w-11 px-2',
    isActive ? 'text-accent' : 'text-ink-muted',
  ].join(' ')
}

function sidebarLinkClasses({ isActive }) {
  return [
    'flex items-center gap-3 min-h-11 px-3 rounded-lg text-body',
    isActive
      ? 'bg-accent-soft text-accent font-semibold'
      : 'text-ink hover:bg-accent-soft/60',
  ].join(' ')
}

export default function AppShell() {
  const { role } = useAuth()

  return (
    <div className="min-h-svh bg-surface-muted text-ink md:flex">
      {/* Desktop sidebar (design.md §4: "left sidebar nav instead of
          bottom tabs" on desktop). */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-surface border-r border-border">
        <div className="px-6 pt-8 pb-6">
          <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
            {gu.common.businessNameGu}
          </p>
          <h1 className="font-display text-heading text-ink font-semibold mt-1">
            {gu.common.businessNameEn}
          </h1>
        </div>
        <nav className="flex flex-col gap-1 px-4">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={sidebarLinkClasses}>
              <Icon size={20} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-4 pb-6">
          <SettingsLink role={role} variant="sidebar" />
        </div>
      </aside>

      {/* Main content column */}
      <div className="flex-1 md:min-w-0">
        {/* Mobile header (desktop shows the business name in the
            sidebar instead, so this is mobile-only). */}
        <header className="flex items-center justify-between bg-surface border-b border-border px-4 py-4 md:hidden">
          <div>
            <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
              {gu.common.businessNameGu}
            </p>
            <h1 className="font-display text-heading text-ink font-semibold">
              {gu.common.businessNameEn}
            </h1>
          </div>
          <SettingsLink role={role} variant="icon" />
        </header>

        <main className="px-4 pt-6 pb-24 sm:px-6 md:px-10 md:pt-8 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around items-stretch z-10">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={mobileTabClasses}>
            <Icon size={20} strokeWidth={1.75} />
            <span className="text-[0.6875rem] leading-none">{label}</span>
          </NavLink>
        ))}
      </nav>

      <YearEndArchivePrompt />
    </div>
  )
}

function SettingsLink({ role, variant }) {
  if (variant === 'sidebar') {
    return (
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          [
            'flex items-center gap-3 min-h-11 px-3 rounded-lg text-body',
            isActive
              ? 'bg-accent-soft text-accent font-semibold'
              : 'text-ink-muted hover:bg-accent-soft/60',
          ].join(' ')
        }
      >
        <Settings size={20} strokeWidth={1.75} />
        <span>{role ? gu.roles[role] ?? role : 'Settings'}</span>
      </NavLink>
    )
  }
  return (
    <NavLink
      to="/settings"
      className="min-h-11 min-w-11 flex items-center justify-center text-ink-muted hover:text-accent"
      aria-label="Settings"
    >
      <Settings size={22} strokeWidth={1.75} />
    </NavLink>
  )
}
