import { useState, useEffect } from 'react'
import { Eye, EyeOff, Receipt, BookOpen, Wallet } from 'lucide-react'
import {
  signIn,
  signUp,
  sendPasswordReset,
  sendEmailSignInLink,
  sendSmsCode,
  confirmSmsCode,
  signInWithGoogle,
  signInWithApple,
  verifyResetCode,
  confirmResetPassword,
  getAuthActionFromUrl,
  clearAuthActionFromUrl,
  applyEmailVerificationCode,
} from '../../firebase/auth'
import { stashPendingDisplayName } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import LanguageToggle from '../../components/LanguageToggle'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.5 6.6l6.2 5.2C38.4 37 44 32 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.4zM14.3 6.5c.6-.7 1-1.7.9-2.7-0.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 1.9-.4 2.5-1.2z" />
    </svg>
  )
}

export default function LoginScreen() {
  const { t } = useLocale()
  // signin | signup | forgot | alternate
  const [mode, setMode] = useState('signin')
  const [forgotStep, setForgotStep] = useState('email') // email | code
  const [altChannel, setAltChannel] = useState('email') // email | phone
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [smsConfirmation, setSmsConfirmation] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')

  const isValidName = name.trim().length >= 2
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const isValidPassword = password.length >= 6
  const isValidNewPassword = newPassword.length >= 6
  const isValidPhone = phone.replace(/\D/g, '').length >= 10
  const isValidResetCode = resetCode.trim().length >= 8

  // Handle inbox links: password reset + email verification.
  useEffect(() => {
    const action = getAuthActionFromUrl()
    if (!action?.oobCode) return

    if (action.mode === 'resetPassword') {
      setMode('forgot')
      setForgotStep('code')
      setResetCode(action.oobCode)
      setInfoMessage(t('auth.resetCodeReady'))
      clearAuthActionFromUrl()
      return
    }

    if (action.mode === 'verifyEmail') {
      let cancelled = false
      ;(async () => {
        try {
          await applyEmailVerificationCode(action.oobCode)
          if (cancelled) return
          clearAuthActionFromUrl()
          setMode('signin')
          setInfoMessage(t('auth.emailVerifiedOk'))
        } catch (err) {
          if (cancelled) return
          console.error('Email verification link failed:', err)
          setErrorMessage(friendlyAuthError(err))
          clearAuthActionFromUrl()
        }
      })()
      return () => {
        cancelled = true
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for URL actions
  }, [])

  function friendlyAuthError(err) {
    const code = err?.code || ''
    if (code.includes('invalid-email') || code.includes('missing-email')) {
      return t('auth.errInvalidEmail')
    }
    if (code.includes('email-already-in-use')) return t('auth.errEmailInUse')
    if (code.includes('weak-password')) return t('auth.errWeakPassword')
    if (
      code.includes('invalid-credential') ||
      code.includes('wrong-password') ||
      code.includes('user-not-found')
    ) {
      return t('auth.errBadCredentials')
    }
    if (code.includes('too-many-requests')) return t('auth.errTooMany')
    if (code.includes('network-request-failed')) return t('auth.errNetwork')
    if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
      return t('auth.errPopupClosed')
    }
    if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
      return t('auth.errProviderDisabled')
    }
    if (code.includes('billing-not-enabled') || code.includes('captcha-check-failed')) {
      return t('auth.errSmsBilling')
    }
    if (code.includes('invalid-phone-number')) return t('auth.errInvalidPhone')
    if (code.includes('invalid-verification-code') || code.includes('invalid-action-code') || code.includes('expired-action-code')) {
      return t('auth.errInvalidResetCode')
    }
    if (code.includes('account-exists-with-different-credential')) {
      return t('auth.errAccountExists')
    }
    return t('auth.errGeneric')
  }

  function switchMode(next) {
    setMode(next)
    setErrorMessage('')
    setInfoMessage('')
    setSmsConfirmation(null)
    setSmsCode('')
    if (next === 'forgot') {
      setForgotStep('email')
      setResetCode('')
      setNewPassword('')
      setConfirmNewPassword('')
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    if (submitting) return
    if (mode === 'signup' && !isValidName) {
      setErrorMessage(t('auth.errNameRequired'))
      return
    }
    if (!isValidEmail) {
      setErrorMessage(t('auth.errInvalidEmail'))
      return
    }
    if (!isValidPassword) {
      setErrorMessage(t('auth.errWeakPassword'))
      return
    }
    setSubmitting(true)
    setErrorMessage('')
    setInfoMessage('')
    if (mode === 'signup') stashPendingDisplayName(name)
    try {
      if (mode === 'signup') await signUp(email.trim(), password)
      else await signIn(email.trim(), password)
      // AuthContext takes over (loading → signed-in / unverified / unauthorized).
    } catch (err) {
      console.error(`${mode} failed:`, err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!isValidEmail || submitting) return
    setSubmitting(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      await sendPasswordReset(email.trim())
      setForgotStep('code')
      setInfoMessage(t('auth.resetSentEnterCode'))
    } catch (err) {
      console.error('Password reset failed:', err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmReset(e) {
    e.preventDefault()
    if (submitting) return
    if (!isValidResetCode) {
      setErrorMessage(t('auth.errInvalidResetCode'))
      return
    }
    if (!isValidNewPassword) {
      setErrorMessage(t('auth.errWeakPassword'))
      return
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage(t('auth.errPasswordMismatch'))
      return
    }
    setSubmitting(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      const accountEmail = await verifyResetCode(resetCode)
      await confirmResetPassword(resetCode, newPassword)
      if (accountEmail && !email.trim()) setEmail(accountEmail)
      setPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setResetCode('')
      setForgotStep('email')
      setMode('signin')
      setInfoMessage(t('auth.resetPasswordOk'))
    } catch (err) {
      console.error('Confirm reset failed:', err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendEmailLink(e) {
    e.preventDefault()
    if (!isValidEmail || submitting) return
    setSubmitting(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      await sendEmailSignInLink(email)
      setInfoMessage(t('auth.emailLinkSent'))
    } catch (err) {
      console.error('Email link failed:', err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendSms(e) {
    e.preventDefault()
    if (!isValidPhone || submitting) return
    setSubmitting(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      const confirmation = await sendSmsCode(phone)
      setSmsConfirmation(confirmation)
      setInfoMessage(t('auth.smsSent'))
    } catch (err) {
      console.error('SMS send failed:', err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmSms(e) {
    e.preventDefault()
    if (!smsConfirmation || smsCode.trim().length < 4 || submitting) return
    setSubmitting(true)
    setErrorMessage('')
    try {
      await confirmSmsCode(smsConfirmation, smsCode)
    } catch (err) {
      console.error('SMS confirm failed:', err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSocial(provider) {
    if (submitting) return
    setSubmitting(true)
    setErrorMessage('')
    setInfoMessage('')
    try {
      if (provider === 'google') await signInWithGoogle()
      else await signInWithApple()
    } catch (err) {
      console.error(`${provider} sign-in failed:`, err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full min-h-12 rounded-full border border-border/80 bg-white px-5 text-body text-ink outline-none shadow-sm focus:border-accent focus:ring-2 focus:ring-accent-soft'

  const socialBtnClass =
    'flex-1 inline-flex items-center justify-center gap-2 min-h-12 rounded-full border border-border bg-white text-body font-semibold text-ink hover:bg-surface-muted disabled:opacity-40'

  let headline = t('auth.loginHeadline')
  let subhead = t('auth.loginSubhead')
  if (mode === 'signup') {
    headline = t('auth.signupHeadline')
    subhead = t('auth.loginSubhead')
  } else if (mode === 'forgot') {
    headline = t('auth.forgotHeadline')
    subhead = forgotStep === 'code' ? t('auth.enterResetCodeHint') : t('auth.forgotSubhead')
  } else if (mode === 'alternate') {
    headline = t('auth.alternateHeadline')
    subhead = t('auth.alternateSubhead')
  }

  return (
    <div className="min-h-svh bg-[#f3f0e8] text-ink flex items-center justify-center p-3 sm:p-6">
      <div className="absolute top-4 right-4 z-30">
        <LanguageToggle />
      </div>

      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] bg-[#f7f4ec] shadow-xl border border-black/5 grid lg:grid-cols-[1.05fr_1fr] min-h-[min(640px,90svh)]">
        <div className="flex flex-col px-6 py-8 sm:px-10 sm:py-10">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-white/80 px-3 py-1.5 mb-8">
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 object-contain" />
            <span className="text-caption font-semibold text-ink truncate max-w-[10rem]">
              {t('common.businessNameEn')}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink">{headline}</h1>
          <p className="text-body text-ink-muted mt-2 mb-6">{subhead}</p>

          {(mode === 'signin' || mode === 'signup') && (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 flex-1">
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="displayName"
                    className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                  >
                    {t('auth.nameLabel')}
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    autoComplete="name"
                    placeholder={t('auth.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                >
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-[11px] uppercase tracking-wide text-ink-muted font-medium"
                  >
                    {t('auth.passwordLabel')}
                  </label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[11px] font-semibold text-accent hover:underline"
                    >
                      {t('auth.forgotPassword')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted min-h-10 min-w-10 flex items-center justify-center"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {errorMessage && (
                <p className="text-caption text-danger rounded-xl bg-red-50 px-3 py-2">{errorMessage}</p>
              )}

              <button
                type="submit"
                disabled={
                  submitting ||
                  !isValidEmail ||
                  !isValidPassword ||
                  (mode === 'signup' && !isValidName)
                }
                className="w-full mt-1 min-h-12 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold text-body py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {submitting
                  ? mode === 'signup'
                    ? t('auth.creatingAccount')
                    : t('auth.signingIn')
                  : mode === 'signup'
                    ? t('auth.signupButton')
                    : t('auth.loginButton')}
              </button>

              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#f7f4ec] px-3 text-[11px] uppercase tracking-wide text-ink-muted">
                    {t('auth.orContinue')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSocial('google')}
                  className={socialBtnClass}
                >
                  <GoogleIcon />
                  Google
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSocial('apple')}
                  className={socialBtnClass}
                >
                  <AppleIcon />
                  Apple
                </button>
              </div>

              <div className="mt-auto pt-4 flex flex-col gap-2 text-caption text-ink-muted">
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('alternate')}
                    className="text-left hover:text-ink font-semibold text-accent"
                  >
                    {t('auth.tryAnotherWay')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-left hover:text-ink"
                >
                  {mode === 'signup' ? (
                    <>
                      {t('auth.haveAccount')}{' '}
                      <span className="underline font-semibold text-ink">{t('auth.loginTitle')}</span>
                    </>
                  ) : (
                    <>
                      {t('auth.noAccount')}{' '}
                      <span className="underline font-semibold text-ink">{t('auth.signupTitle')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && forgotStep === 'email' && (
            <form onSubmit={handleForgot} className="flex flex-col gap-4 flex-1">
              <p className="text-caption text-ink-muted">{t('auth.forgotCodeHint')}</p>
              <div>
                <label
                  htmlFor="reset-email"
                  className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                >
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              {infoMessage && (
                <p className="text-caption text-success rounded-xl bg-green-50 px-3 py-2">
                  {infoMessage}
                </p>
              )}
              {errorMessage && (
                <p className="text-caption text-danger rounded-xl bg-red-50 px-3 py-2">{errorMessage}</p>
              )}
              <button
                type="submit"
                disabled={!isValidEmail || submitting}
                className="w-full min-h-12 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold disabled:opacity-40"
              >
                {submitting ? t('auth.sending') : t('auth.sendResetCode')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotStep('code')
                  setErrorMessage('')
                  setInfoMessage('')
                }}
                className="text-caption text-accent font-semibold text-left hover:underline"
              >
                {t('auth.haveResetCode')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="text-caption text-ink-muted hover:text-ink text-left"
              >
                ← {t('auth.backToLogin')}
              </button>
            </form>
          )}

          {mode === 'forgot' && forgotStep === 'code' && (
            <form onSubmit={handleConfirmReset} className="flex flex-col gap-4 flex-1">
              <p className="text-caption text-ink-muted">{t('auth.enterResetCodeHint')}</p>
              <div>
                <label
                  htmlFor="reset-code"
                  className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                >
                  {t('auth.resetCodeLabel')}
                </label>
                <input
                  id="reset-code"
                  type="text"
                  autoComplete="one-time-code"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.trim())}
                  className={inputClass}
                  placeholder={t('auth.resetCodePlaceholder')}
                />
              </div>
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                >
                  {t('auth.newPasswordLabel')}
                </label>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                >
                  {t('auth.confirmPasswordLabel')}
                </label>
                <input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {infoMessage && (
                <p className="text-caption text-success rounded-xl bg-green-50 px-3 py-2">
                  {infoMessage}
                </p>
              )}
              {errorMessage && (
                <p className="text-caption text-danger rounded-xl bg-red-50 px-3 py-2">{errorMessage}</p>
              )}
              <button
                type="submit"
                disabled={submitting || !isValidResetCode || !isValidNewPassword}
                className="w-full min-h-12 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold disabled:opacity-40"
              >
                {submitting ? t('auth.savingPassword') : t('auth.saveNewPassword')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotStep('email')
                  setErrorMessage('')
                  setInfoMessage('')
                }}
                className="text-caption text-ink-muted hover:text-ink text-left"
              >
                ← {t('auth.backToSendCode')}
              </button>
            </form>
          )}

          {mode === 'alternate' && (
            <div className="flex flex-col gap-4 flex-1">
              <div className="flex gap-1 rounded-full bg-white border border-border p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAltChannel('email')
                    setErrorMessage('')
                    setInfoMessage('')
                  }}
                  className={[
                    'flex-1 min-h-10 rounded-full text-caption font-semibold',
                    altChannel === 'email' ? 'bg-accent text-white' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {t('auth.channelEmail')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAltChannel('phone')
                    setErrorMessage('')
                    setInfoMessage('')
                    setSmsConfirmation(null)
                  }}
                  className={[
                    'flex-1 min-h-10 rounded-full text-caption font-semibold',
                    altChannel === 'phone' ? 'bg-accent text-white' : 'text-ink-muted',
                  ].join(' ')}
                >
                  {t('auth.channelSms')}
                </button>
              </div>

              {altChannel === 'email' ? (
                <form onSubmit={handleSendEmailLink} className="flex flex-col gap-4">
                  <p className="text-caption text-ink-muted">{t('auth.emailCodeHint')}</p>
                  <div>
                    <label
                      htmlFor="alt-email"
                      className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                    >
                      {t('auth.emailLabel')}
                    </label>
                    <input
                      id="alt-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {infoMessage && (
                    <p className="text-caption text-success rounded-xl bg-green-50 px-3 py-2">
                      {infoMessage}
                    </p>
                  )}
                  {errorMessage && (
                    <p className="text-caption text-danger rounded-xl bg-red-50 px-3 py-2">
                      {errorMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!isValidEmail || submitting}
                    className="w-full min-h-12 rounded-full bg-accent text-white font-semibold disabled:opacity-40"
                  >
                    {submitting ? t('auth.sending') : t('auth.sendEmailCode')}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={smsConfirmation ? handleConfirmSms : handleSendSms}
                  className="flex flex-col gap-4"
                >
                  <p className="text-caption text-ink-muted">{t('auth.smsHint')}</p>
                  <div>
                    <label
                      htmlFor="alt-phone"
                      className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                    >
                      {t('auth.phoneLabel')}
                    </label>
                    <input
                      id="alt-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder={t('auth.phonePlaceholder')}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={Boolean(smsConfirmation)}
                      className={inputClass}
                    />
                  </div>
                  {smsConfirmation && (
                    <div>
                      <label
                        htmlFor="sms-code"
                        className="block text-[11px] uppercase tracking-wide text-ink-muted mb-1.5 font-medium"
                      >
                        {t('auth.codeLabel')}
                      </label>
                      <input
                        id="sms-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  )}
                  {infoMessage && (
                    <p className="text-caption text-success rounded-xl bg-green-50 px-3 py-2">
                      {infoMessage}
                    </p>
                  )}
                  {errorMessage && (
                    <p className="text-caption text-danger rounded-xl bg-red-50 px-3 py-2">
                      {errorMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      (smsConfirmation ? smsCode.trim().length < 4 : !isValidPhone)
                    }
                    className="w-full min-h-12 rounded-full bg-accent text-white font-semibold disabled:opacity-40"
                  >
                    {submitting
                      ? t('auth.sending')
                      : smsConfirmation
                        ? t('auth.verifyCode')
                        : t('auth.sendSmsCode')}
                  </button>
                  {smsConfirmation && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmsConfirmation(null)
                        setSmsCode('')
                        setInfoMessage('')
                      }}
                      className="text-caption text-ink-muted text-left"
                    >
                      {t('auth.changePhone')}
                    </button>
                  )}
                </form>
              )}

              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="mt-auto text-caption text-ink-muted hover:text-ink text-left"
              >
                ← {t('auth.backToLogin')}
              </button>
            </div>
          )}
        </div>

        <div className="relative hidden lg:block bg-accent overflow-hidden m-3 rounded-[1.5rem]">
          <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10" />
          <div className="absolute bottom-10 -left-12 h-72 w-72 rounded-full bg-[#c4783a]/25" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />

          <div className="relative h-full p-8 flex flex-col justify-between text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-[#e8b84a] text-ink px-4 py-3 shadow-lg max-w-[14rem]">
                <p className="text-sm font-semibold leading-snug">{t('auth.panelBillCard')}</p>
                <p className="text-[11px] opacity-80 mt-1">{t('auth.panelBillTime')}</p>
              </div>
              <img
                src="/icons/logo_full_ink_transparent.png"
                alt=""
                className="h-14 w-auto object-contain brightness-0 invert opacity-90"
              />
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-3 py-2.5 flex justify-between gap-1 text-[11px] font-medium">
                {['બિલ', 'દાખલા', 'રોજમેળ', 'સિલક'].map((label) => (
                  <span key={label} className="px-2 py-1 rounded-lg bg-white/10">
                    {label}
                  </span>
                ))}
              </div>

              <div className="rounded-2xl bg-white text-ink px-4 py-3 shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-8 w-8 rounded-full bg-accent-soft text-accent inline-flex items-center justify-center">
                    <Wallet size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t('auth.panelRojmerCard')}</p>
                    <p className="text-[11px] text-ink-muted">{t('auth.panelRojmerTime')}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-7 w-7 rounded-full bg-accent text-white text-[10px] font-bold inline-flex items-center justify-center">
                    શ્રી
                  </span>
                  <span className="h-7 w-7 rounded-full bg-[#c4783a] text-white text-[10px] font-bold inline-flex items-center justify-center">
                    ક
                  </span>
                  <span className="h-7 w-7 rounded-full bg-success text-white text-[10px] font-bold inline-flex items-center justify-center">
                    વ
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
                  <Receipt size={16} className="mb-1 opacity-90" />
                  <p className="text-xs font-medium">{t('nav.bill')}</p>
                </div>
                <div className="flex-1 rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
                  <BookOpen size={16} className="mb-1 opacity-90" />
                  <p className="text-xs font-medium">{t('nav.dakhla')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
