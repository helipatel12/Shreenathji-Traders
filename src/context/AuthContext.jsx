// Auth/role context. status:
//   loading | signed-out | unauthorized | unverified | suspended | error | signed-in

import { createContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { updateDoc } from 'firebase/firestore'
import { auth } from '../firebase/config'
import {
  getCompany,
  getCompanyUser,
  getOrCreateUserOnFirstLogin,
  getPlatformUser,
  platformUserRef,
  userRef,
} from '../firebase/firestore'
import { clearActiveCompany, setActiveCompanyId } from '../firebase/tenant'
import {
  logout as logoutHelper,
  changeAuthEmail,
  completeEmailLinkSignIn,
  isEmailLinkSignIn,
} from '../firebase/auth'
import { closeLocalDb, openLocalDbForUser } from '../db/localDb'
import {
  canWriteLedger,
  isCaRole,
  isCompanyAdminRole,
  isMasterAdminRole,
} from '../utils/roles'

export const AuthContext = createContext(null)

const PENDING_NAME_KEY = 'st_pending_display_name'

function applySession(result) {
  const platformUser = result.platformUser || null
  const companyUser = result.companyUser || null
  const company = result.company || null
  const isMaster = isMasterAdminRole(platformUser?.role)
  const inCompany = Boolean(company?.id) && !isMaster
  if (inCompany) setActiveCompanyId(company.id)
  else if (isMaster) clearActiveCompany()
  else if (company?.id) setActiveCompanyId(company.id)
  else clearActiveCompany()
  return { platformUser, companyUser, company, isMaster }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userRecord, setUserRecord] = useState(null)
  const [platformUser, setPlatformUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [authReason, setAuthReason] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

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

  const applyOkSession = useCallback(async (fbUser, result) => {
    const session = applySession(result)
    const companyId = session.company?.id || null
    const isMaster = session.isMaster
    if (companyId && !isMaster) {
      await openLocalDbForUser(fbUser.uid, companyId)
    } else {
      await closeLocalDb()
    }
    setPlatformUser(session.platformUser)
    setCompany(isMaster ? null : session.company)
    setUserRecord(session.companyUser || session.platformUser)
    setStatus('signed-in')
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
        clearActiveCompany()
        if (myRequest !== requestId) return
        setUserRecord(null)
        setPlatformUser(null)
        setCompany(null)
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
          clearActiveCompany()
          setUserRecord(null)
          setPlatformUser(null)
          setCompany(null)
          setStatus('unverified')
          return
        }
        if (result.status === 'suspended') {
          await closeLocalDb()
          clearActiveCompany()
          setUserRecord(result.user || null)
          setPlatformUser(result.platformUser || null)
          setCompany(result.company || null)
          setStatus('suspended')
          return
        }
        if (result.status === 'unauthorized' || result.status !== 'ok') {
          await closeLocalDb()
          clearActiveCompany()
          setUserRecord(null)
          setPlatformUser(null)
          setCompany(null)
          setAuthReason(result.reason || null)
          setStatus('unauthorized')
          return
        }

        await applyOkSession(fbUser, result)
        if (myRequest !== requestId) return
      } catch (err) {
        if (myRequest !== requestId) return
        console.error('Failed to load user record:', err)
        setError(err)
        setUserRecord(null)
        setPlatformUser(null)
        setCompany(null)
        setStatus('error')
      }
    })
    return () => {
      requestId += 1
      unsubscribe()
    }
  }, [reloadToken, applyOkSession])

  const logout = useCallback(async () => {
    try {
      sessionStorage.removeItem(PENDING_NAME_KEY)
    } catch {
      /* ignore */
    }
    clearActiveCompany()
    await logoutHelper()
    await closeLocalDb()
  }, [])

  const retryAuthLoad = useCallback(() => {
    setError(null)
    setReloadToken((n) => n + 1)
  }, [])

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
      if (result.status === 'suspended') {
        setUserRecord(result.user || null)
        setPlatformUser(result.platformUser || null)
        setCompany(result.company || null)
        setStatus('suspended')
        return { ok: false, reason: 'suspended' }
      }
      if (result.status !== 'ok') {
        setUserRecord(null)
        setPlatformUser(null)
        setCompany(null)
        setAuthReason(result.reason || null)
        setStatus('unauthorized')
        return { ok: false, reason: 'unauthorized' }
      }
      await applyOkSession(fresh, result)
      setFirebaseUser(fresh)
      return { ok: true }
    } catch (err) {
      console.error('confirmEmailVerified failed:', err)
      setError(err)
      setStatus('error')
      return { ok: false, reason: 'error' }
    }
  }, [applyOkSession])

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return null
    const platform = await getPlatformUser(auth.currentUser.uid)
    setPlatformUser(platform)
    const companyId = company?.id || platform?.companyId
    if (companyId && !isMasterAdminRole(platform?.role)) {
      const member = await getCompanyUser(auth.currentUser.uid, companyId)
      if (member) setUserRecord(member)
      return member
    }
    if (platform) setUserRecord(platform)
    return platform
  }, [company?.id])

  const enterCompany = useCallback(async (nextCompanyId) => {
    const fb = auth.currentUser
    if (!fb) throw new Error('Not signed in')
    const next = await getCompany(nextCompanyId)
    if (!next || next.status === 'deleted') {
      const err = new Error('COMPANY_GONE')
      err.code = 'COMPANY_GONE'
      throw err
    }
    setActiveCompanyId(next.id)
    await openLocalDbForUser(fb.uid, next.id)
    const member = await getCompanyUser(fb.uid, next.id).catch(() => null)
    setCompany(next)
    if (member) setUserRecord((prev) => ({ ...prev, ...member }))
    return next
  }, [])

  const leaveCompany = useCallback(async () => {
    clearActiveCompany()
    await closeLocalDb()
    setCompany(null)
    setUserRecord(platformUser)
  }, [platformUser])

  const updateOwnProfile = useCallback(async ({ name, gender, birthday, email, location }) => {
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
      location: String(location || '').trim(),
    }
    await updateDoc(platformUserRef(fb.uid), patch)
    if (company?.id && !isMasterAdminRole(platformUser?.role)) {
      await updateDoc(userRef(fb.uid, company.id), patch)
    }
    setUserRecord((prev) => (prev ? { ...prev, ...patch } : prev))
    setPlatformUser((prev) => (prev ? { ...prev, ...patch } : prev))
    return patch
  }, [company?.id, platformUser?.role])

  const isMasterAdmin = isMasterAdminRole(platformUser?.role)
  const inCompany = Boolean(company?.id)
  const memberRole = userRecord?.role ?? platformUser?.role ?? null
  const role = isMasterAdmin ? 'master_admin' : memberRole
  const isOwner = (isMasterAdmin && inCompany) || (inCompany && isCompanyAdminRole(memberRole))
  const isCa = !isMasterAdmin && isCaRole(memberRole)
  const canWrite = canWriteLedger(memberRole, { isMasterAdmin, inCompany })
  const companyId = company?.id || null

  const value = {
    firebaseUser,
    user: userRecord,
    platformUser,
    company,
    companyId,
    role,
    canWrite,
    isOwner,
    isCa,
    isMasterAdmin,
    inCompany,
    status,
    error,
    authReason,
    logout,
    retryAuthLoad,
    confirmEmailVerified,
    refreshUser,
    updateOwnProfile,
    enterCompany,
    leaveCompany,
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
