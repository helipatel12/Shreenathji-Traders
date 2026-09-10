import { useState, useEffect } from 'react'
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
import VepariPayScreen from './features/vepariPay/VepariPayScreen'
import SilakScreen from './features/jansaSilak/SilakScreen'
import SettingsScreen from './features/settings/SettingsScreen'
import UserManagementScreen from './features/admin/UserManagementScreen'
import QueueMonitorScreen from './features/admin/QueueMonitorScreen'
import ReportsScreen from './features/reports/ReportsScreen'
import { SkeletonPage } from './components/Skeleton'
import {
  resendEmailVerification,
  getAuthActionFromUrl,
  clearAuthActionFromUrl,
  applyEmailVerificationCode,
  authErrorLocaleKey,
} from './firebase/auth'

function UnauthorizedScreen({ reason = 'unauthorized' }) {
  const { logout, authReason, confirmEmailVerified } = useAuth()
  const { t } = useLocale()
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const title =
    reason === 'unverified' ? t('auth.unverifiedTitle') : t('auth.unauthorizedTitle')
  const body =
    reason === 'unverified'
      ? t('auth.unverifiedBody')
      : authReason === 'phone-needs-email'
        ? t('auth.phoneNeedsEmailInvite')
        : t('auth.unauthorizedBody')

  // If the inbox verification link opens while stuck on this screen, apply it.
  useEffect(() => {
    if (reason !== 'unverified') return
    const action = getAuthActionFromUrl()
    if (!action || action.mode !== 'verifyEmail') return

    // Hosted Firebase page already verified; just refresh Auth membership.
    if (!action.oobCode) {
      let cancelled = false
      ;(async () => {
        setBusy(true)
        try {
          clearAuthActionFromUrl()
          const result = await confirmEmailVerified()
          if (cancelled) return
          if (!result?.ok && result?.reason === 'still-unverified') {
            setInfo(t('auth.stillUnverified'))
          }
        } catch (err) {
          if (cancelled) return
          setInfo(t(authErrorLocaleKey(err)))
        } finally {
          if (!cancelled) setBusy(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        await applyEmailVerificationCode(action.oobCode)
        if (cancelled) return
        clearAuthActionFromUrl()
        const result = await confirmEmailVerified()
        if (!result?.ok && result?.reason === 'still-unverified') {
          setInfo(t('auth.stillUnverified'))
        }
      } catch (err) {
        if (cancelled) return
        console.error('Verify link on unauthorized screen failed:', err)
        setInfo(t(authErrorLocaleKey(err)))
        clearAuthActionFromUrl()
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reason, confirmEmailVerified, t])

  async function handleResend() {
    if (busy) return
    setBusy(true)
    setInfo('')
    try {
      await resendEmailVerification()
      setInfo(t('auth.verificationResent'))
    } catch (err) {
      console.error('Resend verification failed:', err)
      setInfo(t(authErrorLocaleKey(err)))
    } finally {
      setBusy(false)
    }
  }

  async function handleVerified() {
    if (busy) return
    setBusy(true)
    setInfo('')
    try {
      const result = await confirmEmailVerified()
      if (!result?.ok) {
        if (result?.reason === 'still-unverified') {
          setInfo(t('auth.stillUnverified'))
        } else if (result?.reason === 'unauthorized') {
          // App will switch to unauthorized screen via status.
        } else {
          setInfo(t('auth.errorBody'))
        }
      }
    } catch (err) {
      console.error('Verify check failed:', err)
      setInfo(err?.message || t('auth.errorBody'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-muted px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>
        <div className="w-full max-w-sm card px-6 py-8 text-center shadow-[var(--shadow-raised)]">
        <p className="section-label text-danger mb-2">
          {title}
        </p>
        <p className="text-body text-ink">{body}</p>
        {info && <p className="text-caption text-ink-muted mt-3">{info}</p>}
        {reason === 'unverified' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleVerified}
              className="btn-primary w-full mt-4 disabled:opacity-40"
            >
              {busy ? t('auth.checkingVerification') : t('auth.iVerified')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleResend}
              className="btn-secondary w-full mt-3 disabled:opacity-40"
            >
              {t('auth.resendVerification')}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={logout}
          className="btn-primary w-full mt-3"
        >
          {t('auth.tryDifferentAccount')}
        </button>
      </div>
    </div>
  )
}

function AuthErrorScreen() {
  const { logout, error, retryAuthLoad } = useAuth()
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
          onClick={retryAuthLoad}
          className="w-full mt-2 min-h-12 rounded-xl border border-border bg-surface hover:bg-surface-muted text-ink font-semibold text-body py-3 transition-colors"
        >
          {t('auth.retryLoad')}
        </button>
        <button
          type="button"
          onClick={logout}
          className="w-full mt-3 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body py-3 transition-colors"
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
  if (status === 'unauthorized') return <UnauthorizedScreen reason="unauthorized" />
  if (status === 'unverified') return <UnauthorizedScreen reason="unverified" />
  if (status === 'error') return <AuthErrorScreen />

  if (status === 'signed-in') {
    return (
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardScreen />} />
          <Route path="bills" element={<BillsScreen />} />
          <Route path="dakhla" element={<DakhlaScreen />} />
          <Route path="vepari-pay" element={<VepariPayScreen />} />
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
