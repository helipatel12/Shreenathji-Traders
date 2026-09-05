// Auth helpers — email/password, password reset, email link, phone OTP,
// Google, and Apple. Phone/SMS needs Firebase Phone Auth (Blaze billing);
// Google/Apple need those providers enabled in the Firebase console.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateEmail,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
import { auth } from './config'

const EMAIL_LINK_KEY = 'st_email_for_sign_in'

export async function signUp(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
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
  await sendPasswordResetEmail(auth, email.trim())
}

export async function sendEmailSignInLink(email) {
  const trimmed = email.trim()
  const actionCodeSettings = {
    url: `${window.location.origin}${window.location.pathname}`,
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
