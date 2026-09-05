import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useLocale } from './context/LocaleContext'
import LanguageToggle from './components/LanguageToggle'
import LoginScreen from './features/auth/LoginScreen'
import AppShell from './components/AppShell'
import DashboardScreen from './features/dashboard/DashboardScreen'
import BillsScreen from './features/bills/BillsScreen'
import DakhlaScreen from './features/vepariDakhla/DakhlaScreen'
import RojmerScreen from './features/rojmer/RojmerScreen'
import SilakScreen from './features/jansaSilak/SilakScreen'
import SettingsScreen from './features/settings/SettingsScreen'
import UserManagementScreen from './features/admin/UserManagementScreen'
import QueueMonitorScreen from './features/admin/QueueMonitorScreen'
import ReportsScreen from './features/reports/ReportsScreen'
import { SkeletonPage } from './components/Skeleton'

function UnauthorizedScreen() {
  const { logout } = useAuth()
  const { t } = useLocale()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-muted px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm card px-6 py-8 text-center">
        <p className="text-caption text-danger font-semibold uppercase tracking-wide mb-2">
          {t('auth.unauthorizedTitle')}
        </p>
        <p className="text-body text-ink">{t('auth.unauthorizedBody')}</p>
        <button
          type="button"
          onClick={logout}
          className="w-full mt-5 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body py-3 transition-colors"
        >
          {t('auth.tryDifferentAccount')}
        </button>
      </div>
    </div>
  )
}

function AuthErrorScreen() {
  const { logout, error } = useAuth()
  const { t } = useLocale()
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-muted px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
      <div className="w-full max-w-sm card px-6 py-8 text-center">
        <p className="text-caption text-danger font-semibold uppercase tracking-wide mb-2">
          {t('auth.errorTitle')}
        </p>
        <p className="text-body text-ink mb-2">{t('auth.errorBody')}</p>
        {error?.message && (
          <p className="text-caption text-ink-muted mb-4 break-words">{error.message}</p>
        )}
        <button
          type="button"
          onClick={logout}
          className="w-full mt-2 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body py-3 transition-colors"
        >
          {t('auth.tryDifferentAccount')}
        </button>
      </div>
    </div>
  )
}

function LoadingScreen() {
  const { t } = useLocale()
  return (
    <div className="min-h-svh bg-surface-muted">
      <div className="flex items-center justify-center pt-16 pb-8">
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin"
            aria-hidden
          />
          <p className="font-numeric text-caption text-ink-muted uppercase tracking-wide">
            {t('common.loading')}
          </p>
          <p className="text-body text-ink mt-2">{t('auth.loadingAccount')}</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <SkeletonPage />
      </div>
    </div>
  )
}

function App() {
  const { status } = useAuth()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unauthorized') return <UnauthorizedScreen />
  if (status === 'error') return <AuthErrorScreen />

  if (status === 'signed-in') {
    return (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardScreen />} />
          <Route path="bills" element={<BillsScreen />} />
          <Route path="dakhla" element={<DakhlaScreen />} />
          <Route path="rojmer" element={<RojmerScreen />} />
          <Route path="silak" element={<SilakScreen />} />
          <Route path="reports" element={<ReportsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="admin/users" element={<UserManagementScreen />} />
          <Route path="admin/queue" element={<QueueMonitorScreen />} />
        </Route>
      </Routes>
    )
  }

  return <LoginScreen />
}

export default App
