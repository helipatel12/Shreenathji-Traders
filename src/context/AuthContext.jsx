// Auth/role context. status:
//   loading | signed-out | unauthorized | error | signed-in

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

export const AuthContext = createContext(null)

const PENDING_NAME_KEY = 'st_pending_display_name'

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userRecord, setUserRecord] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser)
      setError(null)

      if (!fbUser) {
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

        const result = await getOrCreateUserOnFirstLogin({
          uid: fbUser.uid,
          email: fbUser.email || '',
          phone: fbUser.phoneNumber || '',
          name: pendingName || fbUser.displayName || '',
        })
        if (result.status === 'unauthorized') {
          setUserRecord(null)
          setStatus('unauthorized')
        } else {
          setUserRecord(result.user)
          setStatus('signed-in')
        }
      } catch (err) {
        console.error('Failed to load user record:', err)
        setError(err)
        setUserRecord(null)
        setStatus('error')
        try {
          await logoutHelper()
        } catch (logoutErr) {
          console.error('Logout after auth error failed:', logoutErr)
        }
      }
    })
    return unsubscribe
  }, [])

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem(PENDING_NAME_KEY)
    } catch {
      /* ignore */
    }
    await logoutHelper()
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
    logout,
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
