// Auth helpers — email/password, password reset, email link, and phone OTP.
// Phone/SMS needs Firebase Phone Auth (Blaze billing).

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
import { auth } from './config'

const EMAIL_LINK_KEY = 'st_email_for_sign_in'

/**
 * Continue URL for Firebase email actions. Always use the app origin root
 * (not the current deep path) so Authorized Domains checks stay reliable.
 * Prefer localhost over 127.0.0.1 — only "localhost" is whitelisted by default.
 */
function appContinueUrl(extraQuery = '') {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const q = String(extraQuery || '').replace(/^\?/, '')
  return q ? `${origin}/?${q}` : `${origin}/`
}

/** Shared ActionCodeSettings for verification / reset (web handler first). */
function emailActionSettings(mode) {
  return {
    url: appContinueUrl(mode ? `mode=${mode}` : ''),
    // false = Firebase hosted page applies the code, then returns here.
    // true is for mobile Universal Links and often breaks plain web apps.
    handleCodeInApp: false,
  }
}

/** Map Firebase Auth error codes → i18n keys under `auth.*`. */
export function authErrorLocaleKey(err) {
  const code = String(err?.code || '')
  if (code.includes('invalid-email') || code.includes('missing-email')) {
    return 'auth.errInvalidEmail'
  }
  if (code.includes('email-already-in-use')) return 'auth.errEmailInUse'
  if (code.includes('weak-password')) return 'auth.errWeakPassword'
  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found')
  ) {
    return 'auth.errBadCredentials'
  }
  if (code.includes('too-many-requests')) return 'auth.errTooMany'
  if (code.includes('network-request-failed')) return 'auth.errNetwork'
  if (code.includes('unauthorized-continue-uri') || code.includes('invalid-continue-uri')) {
    return 'auth.errContinueUri'
  }
  if (code.includes('unauthorized-domain')) return 'auth.errUnauthorizedDomain'
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
    return 'auth.errProviderDisabled'
  }
  if (code.includes('billing-not-enabled') || code.includes('captcha-check-failed')) {
    return 'auth.errSmsBilling'
  }
  if (code.includes('invalid-phone-number')) return 'auth.errInvalidPhone'
  if (
    code.includes('invalid-verification-code') ||
    code.includes('invalid-action-code') ||
    code.includes('expired-action-code')
  ) {
    return 'auth.errInvalidResetCode'
  }
  if (code.includes('account-exists-with-different-credential')) {
    return 'auth.errAccountExists'
  }
  return 'auth.errGeneric'
}

export async function signUp(email, password) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    String(email || '').trim(),
    password,
  )
  // Do not swallow — callers need to show why the inbox stayed empty.
  await sendEmailVerification(credential.user, emailActionSettings('verifyEmail'))
  return credential.user
}

export async function resendEmailVerification() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  if (user.emailVerified) return
  await sendEmailVerification(user, emailActionSettings('verifyEmail'))
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    String(email || '').trim(),
    password,
  )
  return credential.user
}

export async function logout() {
  await signOut(auth)
}

export async function changeAuthEmail(newEmail) {
  if (!auth.currentUser) throw new Error('Not signed in')
  await updateEmail(auth.currentUser, newEmail.trim())
  return auth.currentUser
}

export async function sendPasswordReset(email) {
  const trimmed = String(email || '').trim()
  await sendPasswordResetEmail(auth, trimmed, emailActionSettings('resetPassword'))
}

/** Returns the account email for a valid password-reset oobCode. */
export async function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, String(oobCode || '').trim())
}

export async function confirmResetPassword(oobCode, newPassword) {
  await confirmPasswordReset(auth, String(oobCode || '').trim(), newPassword)
}

/** Apply email-verification oobCode from the inbox link. */
export async function applyEmailVerificationCode(oobCode) {
  await applyActionCode(auth, String(oobCode || '').trim())
  if (auth.currentUser) {
    await auth.currentUser.reload()
  }
}

/** Read Firebase action params from the current URL (reset / verify / sign-in). */
export function getAuthActionFromUrl() {
  if (typeof window === 'undefined') return null
  try {
    const url = new URL(window.location.href)
    const mode = url.searchParams.get('mode') || ''
    const oobCode = url.searchParams.get('oobCode') || ''
    if (!mode && !oobCode) return null
    return { mode, oobCode }
  } catch {
    return null
  }
}

export function clearAuthActionFromUrl() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('mode')
    url.searchParams.delete('oobCode')
    url.searchParams.delete('apiKey')
    url.searchParams.delete('lang')
    url.searchParams.delete('continueUrl')
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash)
  } catch {
    /* ignore */
  }
}

export async function sendEmailSignInLink(email) {
  const trimmed = email.trim()
  // Email-link sign-in requires handleCodeInApp: true.
  const actionCodeSettings = {
    url: appContinueUrl(),
    handleCodeInApp: true,
  }
  await sendSignInLinkToEmail(auth, trimmed, actionCodeSettings)
  try {
    window.localStorage.setItem(EMAIL_LINK_KEY, trimmed)
  } catch {
    /* ignore */
  }
}

export function getStoredEmailForLink() {
  try {
    return window.localStorage.getItem(EMAIL_LINK_KEY) || ''
  } catch {
    return ''
  }
}

export function clearStoredEmailForLink() {
  try {
    window.localStorage.removeItem(EMAIL_LINK_KEY)
  } catch {
    /* ignore */
  }
}

export async function completeEmailLinkSignIn(emailFromUser) {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null
  const email = (emailFromUser || getStoredEmailForLink() || '').trim()
  if (!email) {
    const err = new Error('Email required to complete sign-in link')
    err.code = 'auth/missing-email'
    throw err
  }
  const credential = await signInWithEmailLink(auth, email, window.location.href)
  clearStoredEmailForLink()
  // Clean the oobCode from the URL without a full reload.
  try {
    window.history.replaceState({}, document.title, window.location.pathname)
  } catch {
    /* ignore */
  }
  return credential.user
}

export function isEmailLinkSignIn() {
  return typeof window !== 'undefined' && isSignInWithEmailLink(auth, window.location.href)
}

/** Invisible reCAPTCHA for phone auth — container must exist in the DOM. */
export function ensureRecaptcha(containerId = 'st-recaptcha') {
  if (typeof window === 'undefined') return null
  if (window.__stRecaptchaVerifier) return window.__stRecaptchaVerifier

  let el = document.getElementById(containerId)
  if (!el) {
    el = document.createElement('div')
    el.id = containerId
    el.style.display = 'none'
    document.body.appendChild(el)
  }

  window.__stRecaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
  })
  return window.__stRecaptchaVerifier
}

export function clearRecaptcha() {
  try {
    window.__stRecaptchaVerifier?.clear?.()
  } catch {
    /* ignore */
  }
  window.__stRecaptchaVerifier = null
}

/** Normalize Indian-style numbers to E.164 (+91…). */
export function normalizePhoneE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  if (String(raw).trim().startsWith('+')) return `+${digits}`
  return `+${digits}`
}

export async function sendSmsCode(phoneRaw) {
  const phone = normalizePhoneE164(phoneRaw)
  if (!phone || phone.length < 10) {
    const err = new Error('Invalid phone')
    err.code = 'auth/invalid-phone-number'
    throw err
  }
  clearRecaptcha()
  const verifier = ensureRecaptcha()
  const confirmation = await signInWithPhoneNumber(auth, phone, verifier)
  return confirmation
}

export async function confirmSmsCode(confirmation, code) {
  const credential = await confirmation.confirm(String(code || '').trim())
  return credential.user
}
