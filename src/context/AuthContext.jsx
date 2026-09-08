// Auth/role context. status:
//   loading | signed-out | unauthorized | unverified | error | signed-in

import { createContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { updateDoc } from 'firebase/firestore'
import { auth } from '../firebase/config'
import { getOrCreateUserOnFirstLogin, getUserRecord, userRef } from '../firebase/firestore'
import {
  logout as logoutHelper,
  changeAuthEmail,
  completeEmailLinkSignIn,
  isEmailLinkSignIn,
} from '../firebase/auth'
import { closeLocalDb, openLocalDbForUser } from '../db/localDb'

export const AuthContext = createContext(null)

const PENDING_NAME_KEY = 'st_pending_display_name'

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userRecord, setUserRecord] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [authReason, setAuthReason] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Finish passwordless email-link sign-in when user opens the mail link.
  useEffect(() => {
    if (!isEmailLinkSignIn()) return
    let cancelled = false
    ;(async () => {
      try {
        await completeEmailLinkSignIn()
      } catch (err) {
        if (!cancelled) {
          console.error('Email link sign-in failed:', err)
          setError(err)
          setStatus('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let requestId = 0
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      const myRequest = ++requestId
      setFirebaseUser(fbUser)
      setError(null)
      setAuthReason(null)

      if (!fbUser) {
        await closeLocalDb()
        if (myRequest !== requestId) return
        setUserRecord(null)
        setStatus('signed-out')
        return
      }

      setStatus('loading')
      try {
        let pendingName = ''
        try {
          pendingName = sessionStorage.getItem(PENDING_NAME_KEY) || ''
          sessionStorage.removeItem(PENDING_NAME_KEY)
        } catch {
          /* ignore */
        }

        let result
        try {
          result = await getOrCreateUserOnFirstLogin({
            uid: fbUser.uid,
            email: fbUser.email || '',
            phone: fbUser.phoneNumber || '',
            name: pendingName || fbUser.displayName || '',
            emailVerified: Boolean(fbUser.emailVerified),
          })
        } catch (firstErr) {
          console.warn('getOrCreate retry after:', firstErr)
          result = await getOrCreateUserOnFirstLogin({
            uid: fbUser.uid,
            email: fbUser.email || '',
            phone: fbUser.phoneNumber || '',
            name: pendingName || fbUser.displayName || '',
            emailVerified: Boolean(fbUser.emailVerified),
          })
        }
        if (myRequest !== requestId) return

        if (result.status === 'unverified') {
          await closeLocalDb()
          setUserRecord(null)
          setStatus('unverified')
          return
        }
        if (result.status === 'unauthorized') {
          await closeLocalDb()
          setUserRecord(null)
          setAuthReason(result.reason || null)
          setStatus('unauthorized')
          return
        }

        // Only open Dexie after membership succeeds — a DB failure must not
        // block the login/verify screens.
        await openLocalDbForUser(fbUser.uid)
        if (myRequest !== requestId) return

        setUserRecord(result.user)
        setStatus('signed-in')
      } catch (err) {
        if (myRequest !== requestId) return
        console.error('Failed to load user record:', err)
        setError(err)
        setUserRecord(null)
        setStatus('error')
      }
    })
    return () => {
      requestId += 1
      unsubscribe()
    }
  }, [reloadToken])

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem(PENDING_NAME_KEY)
    } catch {
      /* ignore */
    }
    await logoutHelper()
    await closeLocalDb()
  }, [])

  const retryAuthLoad = useCallback(() => {
    setError(null)
    setReloadToken((n) => n + 1)
  }, [])

  /** After user clicks the email verification link, refresh Auth + membership. */
  const confirmEmailVerified = useCallback(async () => {
    const fb = auth.currentUser
    if (!fb) return { ok: false, reason: 'signed-out' }
    setStatus('loading')
    setError(null)
    try {
      await fb.reload()
      const fresh = auth.currentUser
      if (!fresh?.emailVerified) {
        setStatus('unverified')
        return { ok: false, reason: 'still-unverified' }
      }
      const result = await getOrCreateUserOnFirstLogin({
        uid: fresh.uid,
        email: fresh.email || '',
        phone: fresh.phoneNumber || '',
        name: fresh.displayName || '',
        emailVerified: true,
      })
      if (result.status === 'unverified') {
        setStatus('unverified')
        return { ok: false, reason: 'still-unverified' }
      }
      if (result.status === 'unauthorized') {
        setUserRecord(null)
        setAuthReason(result.reason || null)
        setStatus('unauthorized')
        return { ok: false, reason: 'unauthorized' }
      }
      await openLocalDbForUser(fresh.uid)
      setUserRecord(result.user)
      setFirebaseUser(fresh)
      setStatus('signed-in')
      return { ok: true }
    } catch (err) {
      console.error('confirmEmailVerified failed:', err)
      setError(err)
      setStatus('error')
      return { ok: false, reason: 'error' }
    }
  }, [])

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return null
    const record = await getUserRecord(auth.currentUser.uid)
    if (record) setUserRecord(record)
    return record
  }, [])

  const updateOwnProfile = useCallback(async ({ name, gender, birthday, email }) => {
    const fb = auth.currentUser
    if (!fb) throw new Error('Not signed in')

    const nextEmail = String(email || '').trim().toLowerCase()
    const currentEmail = String(fb.email || '').toLowerCase()
    if (nextEmail && nextEmail !== currentEmail) {
      await changeAuthEmail(nextEmail)
    }

    const patch = {
      name: String(name || '').trim(),
      gender: String(gender || '').trim(),
      birthday: String(birthday || '').trim(),
      email: nextEmail || currentEmail,
    }
    await updateDoc(userRef(fb.uid), patch)
    setUserRecord((prev) => (prev ? { ...prev, ...patch } : prev))
    return patch
  }, [])

  const role = userRecord?.role ?? null
  const canWrite = role === 'owner' || role === 'staff'
  const isOwner = role === 'owner'
  const isCa = role === 'ca'

  const value = {
    firebaseUser,
    user: userRecord,
    role,
    canWrite,
    isOwner,
    isCa,
    status,
    error,
    authReason,
    logout,
    retryAuthLoad,
    confirmEmailVerified,
    refreshUser,
    updateOwnProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function stashPendingDisplayName(name) {
  try {
    const trimmed = String(name || '').trim()
    if (trimmed) sessionStorage.setItem(PENDING_NAME_KEY, trimmed)
    else sessionStorage.removeItem(PENDING_NAME_KEY)
  } catch {
    /* ignore */
  }
}
