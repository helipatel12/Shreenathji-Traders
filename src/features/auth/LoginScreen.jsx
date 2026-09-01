// Email + password login (phases.md Phase 1). One or two fields per
// mode, so plain useState is appropriate here per rules.md §7's own
// exception ("no manual useState per field for anything beyond 2
// fields") — react-hook-form/zod are used from Phase 3 onward, where
// forms have more fields (e.g. bill entry).
//
// Visual identity: card + decorative side panel, per design.md's
// 2026-07-24 switch to a modern SaaS look (see design.md §1 and
// memory.md's decisions log) — no more ledger-paper styling.
//
// Two auth modes, not one combined flow: Firebase's email-enumeration
// protection makes "wrong password" and "no such account" return the
// same error code, so there's no reliable way to silently fall back
// from sign-in to sign-up. A small "Create account" link covers both
// this app's one real bootstrap moment (the very first login ever)
// AND accepting a staff/CA invite (Phase 8, Settings → Users) — both
// go through the same signUp() call; firestore.js's
// getOrCreateUserOnFirstLogin decides which one actually happened
// (and rejects anyone who's neither) once the account exists.

import { useState } from 'react'
import { signIn, signUp } from '../../firebase/auth'
import gu from '../../locales/gu.json'

function friendlyAuthError(err) {
  const code = err?.code || ''
  if (code.includes('invalid-email')) {
    return 'That email doesn\u2019t look right — check it and try again.'
  }
  if (code.includes('email-already-in-use')) {
    return 'An account already exists for that email — try signing in instead.'
  }
  if (code.includes('weak-password')) {
    return 'Password needs to be at least 6 characters.'
  }
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Email or password didn\u2019t match — check them and try again.'
  }
  if (code.includes('too-many-requests')) {
    return 'Too many tries — wait a bit before trying again.'
  }
  if (code.includes('network-request-failed')) {
    return 'Couldn\u2019t reach the internet — check your connection and try again.'
  }
  return 'Something didn\u2019t go through — please try again.'
}

// Original abstract artwork for the decorative panel — simple layered
// organic shapes in the app's own palette, not stock photography
// (design.md §1's explicit "avoid photographic templates" note).
function DecorativePanel() {
  return (
    <svg
      viewBox="0 0 480 640"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="480" height="640" fill="#2B4238" />
      <circle cx="360" cy="120" r="180" fill="#345043" />
      <circle cx="420" cy="520" r="220" fill="#233631" />
      <path
        d="M -20 340 Q 140 260 240 360 T 500 320"
        stroke="#3F6B4A"
        strokeWidth="3"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M -20 420 Q 160 500 300 420 T 500 460"
        stroke="#E7ECE8"
        strokeWidth="2"
        fill="none"
        opacity="0.35"
      />
      <circle cx="120" cy="480" r="6" fill="#E7ECE8" opacity="0.6" />
      <circle cx="200" cy="220" r="4" fill="#E7ECE8" opacity="0.5" />
      <circle cx="340" cy="380" r="5" fill="#E7ECE8" opacity="0.4" />
    </svg>
  )
}

export default function LoginScreen() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isValidPassword = password.length >= 6
  const canSubmit = isValidEmail && isValidPassword && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setErrorMessage('')
    try {
      if (mode === 'signup') {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
      // AuthContext's onAuthStateChanged listener picks up the
      // signed-in user from here — no further action needed on this
      // screen.
    } catch (err) {
      console.error(`${mode} failed:`, err)
      setErrorMessage(friendlyAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setErrorMessage('')
  }

  return (
    <div className="min-h-svh bg-surface-muted flex items-center justify-center p-4">
      <div className="card w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 px-6 py-10 sm:px-10 sm:py-12">
          <p className="font-numeric text-caption text-ink-muted tracking-wide uppercase">
            {gu.common.businessNameGu}
          </p>
          <h1 className="font-display text-display text-ink font-semibold mt-1 mb-8">
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </h1>

          <form onSubmit={handleSubmit}>
            <label
              htmlFor="email"
              className="block text-caption text-ink-muted mb-2"
            >
              {gu.auth.emailLabel}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="text-body text-ink bg-surface border border-border rounded-xl w-full py-3 px-4 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />

            <label
              htmlFor="password"
              className="block text-caption text-ink-muted mb-2 mt-5"
            >
              {gu.auth.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-body text-ink bg-surface border border-border rounded-xl w-full py-3 pl-4 pr-11 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-caption min-h-11 min-w-11 flex items-center justify-center"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>

            {errorMessage && (
              <p className="text-caption text-danger mt-3">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full mt-6 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting
                ? mode === 'signup'
                  ? 'Creating account…'
                  : 'Signing in…'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Log in'}
            </button>

            <button
              type="button"
              onClick={toggleMode}
              className="w-full mt-4 min-h-11 text-caption text-ink-muted underline"
            >
              {mode === 'signup'
                ? 'Already have an account? Sign in'
                : 'New here, or invited by the owner? Create your account'}
            </button>
          </form>
        </div>

        <div className="hidden md:block md:w-1/2 relative">
          <DecorativePanel />
        </div>
      </div>
    </div>
  )
}
