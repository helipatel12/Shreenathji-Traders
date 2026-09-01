// Phase 1 — routes on auth status (context/AuthContext.jsx):
//   loading      -> minimal loading state (brief, first-paint only —
//                    this is the initial Firebase Auth check, not
//                    local ledger data, so it isn't covered by the
//                    "never block on network" offline rule)
//   signed-out   -> LoginScreen
//   unauthorized -> signed in, but no user record for this business
//                    (firebase/firestore.js) — explain and offer to
//                    try a different account
//   signed-in    -> AppShell (nav + header) wrapping the real routes
//
// Phase 2 adds the actual routes AppShell's nav links to — see
// components/AppShell.jsx for the nav itself, phases.md for what
// belongs on each screen and when.
// Login is email + password (Firebase phone/SMS auth now requires the
// paid Blaze plan — see src/firebase/auth.js's header comment).

import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginScreen from './features/auth/LoginScreen'
import AppShell from './components/AppShell'
import DashboardScreen from './features/dashboard/DashboardScreen'
import BillsScreen from './features/bills/BillsScreen'
import DakhlaScreen from './features/vepariDakhla/DakhlaScreen'
import RojmerScreen from './features/rojmer/RojmerScreen'
import SilakScreen from './features/jansaSilak/SilakScreen'
import SettingsScreen from './features/settings/SettingsScreen'

function UnauthorizedScreen() {
  const { logout } = useAuth()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm card px-6 py-8 text-center">
        <p className="text-caption text-danger font-semibold uppercase tracking-wide mb-2">
          Not set up yet
        </p>
        <p className="text-body text-ink">
          This account isn&rsquo;t registered for Shreenath Traders. Ask the
          owner to add you in Settings, or try a different account.
        </p>
        <button
          type="button"
          onClick={logout}
          className="w-full mt-5 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body py-3 transition-colors"
        >
          Try a different account
        </button>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-muted">
      <p className="font-numeric text-caption text-ink-muted uppercase tracking-wide">
        Loading…
      </p>
    </div>
  )
}

function App() {
  const { status } = useAuth()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unauthorized') return <UnauthorizedScreen />

  if (status === 'signed-in') {
    return (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardScreen />} />
          <Route path="bills" element={<BillsScreen />} />
          <Route path="dakhla" element={<DakhlaScreen />} />
          <Route path="rojmer" element={<RojmerScreen />} />
          <Route path="silak" element={<SilakScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
      </Routes>
    )
  }

  return <LoginScreen />
}

export default App
