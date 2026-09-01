// Auth/role context — Phase 1 (phases.md: "Role read (owner/staff/ca)
// and stored in auth context"). Wraps the app in main.jsx so role is
// available everywhere via the useAuth() hook (src/hooks/useAuth.js).

import { createContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase/config'
import { getOrCreateUserOnFirstLogin } from '../firebase/firestore'
import { logout as logoutHelper } from '../firebase/auth'

export const AuthContext = createContext(null)

// status:
//   'loading'      — checking auth state / fetching the user record
//   'signed-out'    — no one is logged in
//   'unauthorized'  — signed in with Firebase, but this email has no
//                      user record for this business (see
//                      firestore.js's getOrCreateUserOnFirstLogin)
//   'signed-in'     — a real, recognized user
export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userRecord, setUserRecord] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

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
        const result = await getOrCreateUserOnFirstLogin({
          uid: fbUser.uid,
          email: fbUser.email,
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
        setStatus('signed-out')
      }
    })
    return unsubscribe
  }, [])

  const logout = useCallback(async () => {
    await logoutHelper()
  }, [])

  const value = {
    firebaseUser,
    user: userRecord,
    role: userRecord?.role ?? null,
    status,
    error,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}