// Settings — vepari master list (Phase 3), business profile + default
// rates + staff/CA users (Phase 8). Logout is available to everyone;
// business profile, rates, and user management are owner-only per
// prd.md §3, gated here (role === 'owner') to match what
// firestore.rules already enforces server-side — staff/ca see a note
// instead of controls that would silently fail.
//
// Card styling per design.md's 2026-07-24 modern-SaaS switch (§1/§4).

import { useAuth } from '../../hooks/useAuth'
import gu from '../../locales/gu.json'
import VepariListSection from './VepariListSection'
import BusinessProfileSection from './BusinessProfileSection'
import DefaultRatesSection from './DefaultRatesSection'
import UsersSection from './UsersSection'
import YearEndArchiveSection from './YearEndArchiveSection'

export default function SettingsScreen() {
  const { user, role, logout } = useAuth()
  const isOwner = role === 'owner'

  return (
    <div>
      <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
        {gu.nav.settingsGu}
      </p>
      <h1 className="font-display text-heading text-ink font-semibold mt-1 mb-6">
        Settings
      </h1>

      <div className="card px-5 py-5 max-w-md mb-4">
        <p className="text-caption text-ink-muted uppercase tracking-wide">
          Signed in as
        </p>
        <p className="text-body text-ink mt-1">
          {user?.name ? user.name : user?.email}
          {role && (
            <span className="text-ink-muted"> · {gu.roles[role] ?? role}</span>
          )}
        </p>
        <button
          type="button"
          onClick={logout}
          className="w-full mt-4 min-h-11 rounded-xl border border-border text-body text-ink hover:border-danger hover:text-danger transition-colors"
        >
          {gu.dashboard.logout}
        </button>
      </div>

      <div className="mb-4">
        <VepariListSection />
      </div>

      {isOwner ? (
        <div className="space-y-4">
          <BusinessProfileSection />
          <DefaultRatesSection />
          <UsersSection />
          <YearEndArchiveSection />
        </div>
      ) : (
        <div className="card px-5 py-5 max-w-md">
          <p className="text-body text-ink-muted">{gu.settings.ownerOnlyNote}</p>
        </div>
      )}
    </div>
  )
}
