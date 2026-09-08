// Auth helpers — email/password, password reset, email link, phone OTP,
// Google, and Apple. Phone/SMS needs Firebase Phone Auth (Blaze billing);
// Google/Apple need those providers enabled in the Firebase console.

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
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
import { auth } from './config'

const EMAIL_LINK_KEY = 'st_email_for_sign_in'

function appContinueUrl(extraQuery = '') {
  const path = typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const q = extraQuery ? (extraQuery.startsWith('?') ? extraQuery : `?${extraQuery}`) : ''
  return `${origin}${path}${q}`
}

export async function signUp(email, password) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    String(email || '').trim(),
    password,
  )
  try {
    await sendEmailVerification(credential.user, {
      url: appContinueUrl('mode=verifyEmail'),
      handleCodeInApp: true,
    })
  } catch (err) {
    console.error('Failed to send verification email:', err)
  }
  return credential.user
}

export async function resendEmailVerification() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  if (user.emailVerified) return
  await sendEmailVerification(user, {
    url: appContinueUrl('mode=verifyEmail'),
    handleCodeInApp: true,
  })
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
  const actionCodeSettings = {
    url: appContinueUrl('mode=resetPassword'),
    handleCodeInApp: true,
  }
  await sendPasswordResetEmail(auth, trimmed, actionCodeSettings)
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

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const credential = await signInWithPopup(auth, provider)
  return credential.user
}

export async function signInWithApple() {
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  const credential = await signInWithPopup(auth, provider)
  return credential.user
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
