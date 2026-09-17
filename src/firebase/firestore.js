// Firestore helpers — multi-tenant companies (stored as `businesses/{id}`
// so the live Shreenathji Traders documents keep working).

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './config'
import { getActiveCompanyId, requireCompanyId } from './tenant'
import { COMPANY_STATUSES, ROLES, isCompanyAdminRole } from '../utils/roles'

export const COMPANIES_COLLECTION = 'businesses'
export const PLATFORM_USERS_COLLECTION = 'users'
export const GLOBAL_INVITES_COLLECTION = 'invites'

/** Existing production tenant — local Dexie name + login lift still use this id. */
export const LEGACY_COMPANY_ID = import.meta.env.VITE_BUSINESS_ID || 'shreenath-traders'
export const BUSINESS_ID = LEGACY_COMPANY_ID

/** Permanent Master Admin login. Env can override; password stays in Firebase Auth only. */
export const MASTER_ADMIN_EMAIL = String(
  import.meta.env.VITE_MASTER_ADMIN_EMAIL || 'imhelipatel12@gmail.com',
)
  .trim()
  .toLowerCase()

export function isDesignatedMasterEmail(email) {
  return String(email || '').trim().toLowerCase() === MASTER_ADMIN_EMAIL
}

function cid(companyId) {
  return requireCompanyId(companyId)
}

export function stampCompany(data, companyId) {
  const id = cid(companyId)
  return { ...data, companyId: id }
}

export function platformStateRef() {
  return doc(db, 'platform', 'state')
}

export function platformUserRef(uid) {
  return doc(db, PLATFORM_USERS_COLLECTION, uid)
}

export function platformUsersCollectionRef() {
  return collection(db, PLATFORM_USERS_COLLECTION)
}

export function globalInviteRef(email) {
  return doc(db, GLOBAL_INVITES_COLLECTION, String(email || '').trim().toLowerCase())
}

export function companiesCollectionRef() {
  return collection(db, COMPANIES_COLLECTION)
}

export function companyRef(companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId))
}

export function businessRef(companyId) {
  return companyRef(companyId)
}

export function userRef(uid, companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'users', uid)
}

export function userCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'users')
}

export function inviteCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'invites')
}

export function inviteDocRef(email, companyId) {
  return doc(
    db,
    COMPANIES_COLLECTION,
    cid(companyId),
    'invites',
    String(email || '').trim().toLowerCase(),
  )
}

export function vepariCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'veparis')
}

export function vepariDocRef(vepariId, companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'veparis', vepariId)
}

export function billCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'bills')
}

export function billDocRef(billId, companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'bills', billId)
}

export function paymentCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'payments')
}

export function paymentDocRef(paymentId, companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'payments', paymentId)
}

export function vepariPaymentCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'vepariPayments')
}

export function vepariPaymentDocRef(paymentId, companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'vepariPayments', paymentId)
}

export function silakEntryCollectionRef(companyId) {
  return collection(db, COMPANIES_COLLECTION, cid(companyId), 'silakEntries')
}

export function silakEntryDocRef(entryId, companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'silakEntries', entryId)
}

export function entryNumberCounterRef(companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'counters', 'entryNumber')
}

export function dakhlaNumberCounterRef(companyId) {
  return doc(db, COMPANIES_COLLECTION, cid(companyId), 'counters', 'dakhlaNumber')
}

export async function allocateEntryNumberRemote(minNext = 1) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const floor = Math.max(1, Number(minNext) || 1)
  try {
    return await runTransaction(db, async (transaction) => {
      const ref = entryNumberCounterRef()
      const snap = await transaction.get(ref)
      const stored = snap.exists() ? Number(snap.data().next) || 1 : 1
      const next = Math.max(stored, floor)
      transaction.set(ref, stampCompany({ next: next + 1 }), { merge: true })
      return next
    })
  } catch (err) {
    console.error('Remote entryNumber allocate failed — using local:', err)
    return null
  }
}

export async function reclaimEntryNumberCounter(floor) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const nextFloor = Math.max(1, Number(floor) || 1)
  try {
    await runTransaction(db, async (transaction) => {
      const ref = entryNumberCounterRef()
      const snap = await transaction.get(ref)
      const stored = snap.exists() ? Number(snap.data().next) || 1 : 1
      if (stored > nextFloor) {
        transaction.set(ref, stampCompany({ next: nextFloor }), { merge: true })
      }
    })
  } catch (err) {
    console.error('Remote entryNumber counter reclaim failed:', err)
  }
}

export async function allocateDakhlaNumberRemote(minNext = 1) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const floor = Math.max(1, Number(minNext) || 1)
  try {
    return await runTransaction(db, async (transaction) => {
      const ref = dakhlaNumberCounterRef()
      const snap = await transaction.get(ref)
      const stored = snap.exists() ? Number(snap.data().next) || 1 : 1
      const next = Math.max(stored, floor)
      transaction.set(ref, stampCompany({ next: next + 1 }), { merge: true })
      return next
    })
  } catch (err) {
    console.error('Remote dakhlaNumber allocate failed — using local:', err)
    return null
  }
}

export async function reclaimDakhlaNumberCounter(floor) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const nextFloor = Math.max(1, Number(floor) || 1)
  try {
    await runTransaction(db, async (transaction) => {
      const ref = dakhlaNumberCounterRef()
      const snap = await transaction.get(ref)
      const stored = snap.exists() ? Number(snap.data().next) || 1 : 1
      if (stored > nextFloor) {
        transaction.set(ref, stampCompany({ next: nextFloor }), { merge: true })
      }
    })
  } catch (err) {
    console.error('Remote dakhlaNumber counter reclaim failed:', err)
  }
}

export async function getCompany(companyId) {
  const snap = await getDoc(companyRef(companyId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getBusiness(companyId) {
  return getCompany(companyId)
}

export async function getPlatformUser(uid) {
  const snap = await getDoc(platformUserRef(uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getCompanyUser(uid, companyId) {
  const snap = await getDoc(userRef(uid, companyId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getUserRecord(uid, companyId = getActiveCompanyId()) {
  if (companyId) {
    const member = await getCompanyUser(uid, companyId)
    if (member) return member
  }
  return getPlatformUser(uid)
}

export async function getPlatformState() {
  const snap = await getDoc(platformStateRef())
  return snap.exists() ? snap.data() : null
}

export function slugifyCompanyId(name) {
  const ascii = String(name || '')
    .normalize('NFKD')
    .replace(/[^\u0000-\u007F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return ascii || 'company'
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6)
}

export async function allocateCompanyId(name) {
  const base = slugifyCompanyId(name)
  let id = base
  for (let i = 0; i < 8; i += 1) {
    const snap = await getDoc(doc(db, COMPANIES_COLLECTION, id))
    if (!snap.exists()) return id
    id = `${base}-${randomSuffix()}`
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`
}

function invitePayload({ email, companyId, role, name = '', location = '', invitedBy }) {
  return {
    email: String(email || '').trim().toLowerCase(),
    companyId,
    role,
    name: String(name || '').trim(),
    location: String(location || '').trim(),
    status: 'pending',
    invitedBy: invitedBy || '',
    invitedAt: serverTimestamp(),
  }
}

export async function createCompany({ name, adminEmail, adminName = '', createdByUid }) {
  const trimmedName = String(name || '').trim()
  const email = String(adminEmail || '').trim().toLowerCase()
  if (!trimmedName) throw new Error('COMPANY_NAME_REQUIRED')
  if (!email) throw new Error('ADMIN_EMAIL_REQUIRED')

  const existingInvite = await getDoc(globalInviteRef(email))
  if (existingInvite.exists() && existingInvite.data().status === 'pending') {
    const err = new Error('INVITE_EMAIL_BUSY')
    err.code = 'INVITE_EMAIL_BUSY'
    throw err
  }

  const id = await allocateCompanyId(trimmedName)
  const invite = invitePayload({
    email,
    companyId: id,
    role: ROLES.COMPANY_ADMIN,
    name: adminName,
    invitedBy: createdByUid,
  })
  const batch = writeBatch(db)
  batch.set(doc(db, COMPANIES_COLLECTION, id), {
    name: trimmedName,
    companyId: id,
    status: COMPANY_STATUSES.ACTIVE,
    financialYearStart: '04-01',
    createdByUid,
    ownerUid: null,
    adminUid: null,
    adminEmail: email,
    createdAt: serverTimestamp(),
  })
  batch.set(globalInviteRef(email), invite)
  batch.set(inviteDocRef(email, id), invite)
  await batch.commit()
  return id
}

export async function updateCompany(companyId, changes) {
  await updateDoc(companyRef(companyId), changes)
}

export async function setCompanyStatus(companyId, status) {
  const patch = { status }
  if (status === COMPANY_STATUSES.SUSPENDED) patch.suspendedAt = serverTimestamp()
  if (status === COMPANY_STATUSES.DELETED) patch.deletedAt = serverTimestamp()
  if (status === COMPANY_STATUSES.ACTIVE) {
    patch.suspendedAt = null
    patch.deletedAt = null
  }
  await updateDoc(companyRef(companyId), patch)
}

export async function inviteCompanyAdmin({ companyId, email, name = '', invitedBy }) {
  const id = cid(companyId)
  const invite = invitePayload({
    email,
    companyId: id,
    role: ROLES.COMPANY_ADMIN,
    name,
    invitedBy,
  })
  const existing = await getDoc(globalInviteRef(invite.email))
  if (
    existing.exists() &&
    existing.data().status === 'pending' &&
    existing.data().companyId !== id
  ) {
    const err = new Error('INVITE_EMAIL_BUSY')
    err.code = 'INVITE_EMAIL_BUSY'
    throw err
  }
  const batch = writeBatch(db)
  batch.set(globalInviteRef(invite.email), invite)
  batch.set(inviteDocRef(invite.email, id), invite)
  batch.set(companyRef(id), { adminEmail: invite.email }, { merge: true })
  await batch.commit()
}

function memberRoleFromInvite(role) {
  if (isCompanyAdminRole(role) || role === ROLES.COMPANY_ADMIN) return ROLES.COMPANY_ADMIN
  if (role === ROLES.CA) return ROLES.CA
  return ROLES.STAFF
}

function platformRoleFromCompanyRole(role) {
  if (isCompanyAdminRole(role)) return ROLES.COMPANY_ADMIN
  if (role === ROLES.CA) return ROLES.CA
  if (role === ROLES.MASTER_ADMIN) return ROLES.MASTER_ADMIN
  return ROLES.STAFF
}

async function acceptPendingInvite({
  uid,
  email,
  name,
  phone,
  invite,
  inviteCompanyId,
}) {
  const companyId = invite.companyId || inviteCompanyId
  const memberRole = memberRoleFromInvite(invite.role)
  const platformRole = memberRole
  const displayName = String(name || invite.name || '').trim()
  const newMember = {
    email,
    phone: phone || '',
    role: memberRole,
    name: displayName,
    location: invite.location || '',
    companyId,
    status: 'active',
    createdAt: serverTimestamp(),
  }
  const newPlatform = {
    email,
    phone: phone || '',
    role: platformRole,
    name: displayName,
    location: invite.location || '',
    companyId,
    status: 'active',
    createdAt: serverTimestamp(),
  }
  const batch = writeBatch(db)
  batch.set(platformUserRef(uid), newPlatform)
  batch.set(userRef(uid, companyId), newMember)
  const acceptedPatch = {
    status: 'accepted',
    acceptedAt: serverTimestamp(),
    acceptedByUid: uid,
  }
  try {
    const globalSnap = await getDoc(globalInviteRef(email))
    if (globalSnap.exists()) {
      batch.update(globalInviteRef(email), acceptedPatch)
    }
  } catch {
    /* invitee can only get their own global invite */
  }
  batch.set(inviteDocRef(email, companyId), acceptedPatch, { merge: true })
  if (isCompanyAdminRole(memberRole)) {
    batch.set(
      companyRef(companyId),
      { adminUid: uid, ownerUid: uid, adminEmail: email, status: COMPANY_STATUSES.ACTIVE },
      { merge: true },
    )
  }
  await batch.commit()
  const company = await getCompany(companyId)
  return {
    platformUser: { id: uid, ...newPlatform },
    companyUser: { id: uid, ...newMember },
    company,
  }
}

async function liftLegacyMembership({ uid, email, name, phone, legacyUser, companyId }) {
  const displayName = String(name || legacyUser.name || '').trim()
  const platformRole = platformRoleFromCompanyRole(legacyUser.role)
  const platformUser = {
    email: email || String(legacyUser.email || '').toLowerCase(),
    phone: phone || legacyUser.phone || '',
    role: platformRole,
    name: displayName,
    location: legacyUser.location || '',
    companyId,
    status: 'active',
    createdAt: serverTimestamp(),
  }
  await setDoc(platformUserRef(uid), platformUser)
  try {
    await setDoc(
      companyRef(companyId),
      {
        companyId,
        status: COMPANY_STATUSES.ACTIVE,
      },
      { merge: true },
    )
  } catch {
    /* membership may be enough; master can stamp later */
  }
  const company = await getCompany(companyId)
  return {
    platformUser: { id: uid, ...platformUser },
    companyUser: { id: uid, ...legacyUser },
    company,
  }
}

async function bootstrapMasterAdmin({ uid, email, name, phone }) {
  const platformUser = {
    email,
    phone: phone || '',
    role: ROLES.MASTER_ADMIN,
    name: String(name || '').trim(),
    location: '',
    companyId: null,
    status: 'active',
    createdAt: serverTimestamp(),
  }
  const batch = writeBatch(db)
  batch.set(
    platformStateRef(),
    {
      masterAdminUid: uid,
      masterAdminEmail: email,
      bootstrappedAt: serverTimestamp(),
    },
    { merge: true },
  )
  batch.set(platformUserRef(uid), platformUser, { merge: true })
  await batch.commit()
  try {
    const legacy = await getDoc(doc(db, COMPANIES_COLLECTION, LEGACY_COMPANY_ID))
    if (legacy.exists()) {
      await setDoc(
        companyRef(LEGACY_COMPANY_ID),
        {
          companyId: LEGACY_COMPANY_ID,
          status: COMPANY_STATUSES.ACTIVE,
        },
        { merge: true },
      )
    }
  } catch {
    /* ignore — company stamp is best-effort */
  }
  return { platformUser: { id: uid, ...platformUser }, company: null, companyUser: null }
}

function sessionFromParts({ platformUser, companyUser, company }) {
  if (platformUser?.status === 'disabled') {
    return { status: 'unauthorized', reason: 'disabled', user: null }
  }
  if (platformUser?.role === ROLES.MASTER_ADMIN) {
    return {
      status: 'ok',
      user: platformUser,
      platformUser,
      companyUser: null,
      company: null,
    }
  }
  if (!company || company.status === COMPANY_STATUSES.DELETED) {
    return { status: 'unauthorized', reason: 'company-gone', user: null }
  }
  if (company.status === COMPANY_STATUSES.SUSPENDED) {
    return {
      status: 'suspended',
      user: companyUser || platformUser,
      platformUser,
      companyUser,
      company,
    }
  }
  return {
    status: 'ok',
    user: companyUser || platformUser,
    platformUser,
    companyUser,
    company,
  }
}

async function tryBootstrapMasterAdmin(args) {
  try {
    return await bootstrapMasterAdmin(args)
  } catch (err) {
    console.warn('Master Admin bootstrap failed:', err)
    return null
  }
}

async function readLegacyCompanyUser(uid) {
  try {
    const snap = await getDoc(doc(db, COMPANIES_COLLECTION, LEGACY_COMPANY_ID, 'users', uid))
    return snap.exists() ? { id: uid, ...snap.data() } : null
  } catch (err) {
    if (err?.code === 'permission-denied') return null
    throw err
  }
}

async function sessionFromLegacyMember({ uid, email, name, phone, legacyUser }) {
  try {
    const lifted = await liftLegacyMembership({
      uid,
      email,
      name,
      phone,
      legacyUser,
      companyId: LEGACY_COMPANY_ID,
    })
    return sessionFromParts(lifted)
  } catch (err) {
    console.warn('Platform user lift failed — opening existing company books:', err)
  }
  let company = null
  try {
    company = await getCompany(LEGACY_COMPANY_ID)
  } catch {
    company = {
      id: LEGACY_COMPANY_ID,
      name: 'Shreenathji Traders',
      status: COMPANY_STATUSES.ACTIVE,
    }
  }
  if (!company) {
    company = {
      id: LEGACY_COMPANY_ID,
      name: 'Shreenathji Traders',
      status: COMPANY_STATUSES.ACTIVE,
    }
  }
  const platformUser = {
    id: uid,
    email,
    phone: phone || legacyUser.phone || '',
    role: platformRoleFromCompanyRole(legacyUser.role),
    name: String(name || legacyUser.name || '').trim(),
    location: legacyUser.location || '',
    companyId: LEGACY_COMPANY_ID,
    status: 'active',
  }
  return sessionFromParts({
    platformUser,
    companyUser: { id: uid, ...legacyUser },
    company,
  })
}

/**
 * Resolve platform identity + company membership after Firebase Auth.
 * Existing company members must always be able to open their books, even
 * if the new multi-tenant collections are not writable yet.
 */
export async function getOrCreateUserOnFirstLogin({
  uid,
  email,
  name = '',
  phone = '',
  emailVerified = false,
}) {
  const displayName = String(name || '').trim()
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const designatedMaster = isDesignatedMasterEmail(normalizedEmail)

  let existingPlatform = null
  try {
    existingPlatform = await getPlatformUser(uid)
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err
  }

  if (designatedMaster) {
    const boot = await tryBootstrapMasterAdmin({
      uid,
      email: normalizedEmail,
      name: displayName || existingPlatform?.name || '',
      phone,
    })
    if (boot) return sessionFromParts(boot)
    if (existingPlatform?.role === ROLES.MASTER_ADMIN) {
      return sessionFromParts({ platformUser: existingPlatform })
    }
    return { user: null, status: 'unauthorized', reason: 'master-bootstrap-blocked' }
  }

  if (existingPlatform) {
    if (displayName && displayName !== existingPlatform.name) {
      try {
        await setDoc(platformUserRef(uid), { name: displayName }, { merge: true })
        existingPlatform.name = displayName
      } catch {
        /* ignore */
      }
    }
    if (existingPlatform.role === ROLES.MASTER_ADMIN) {
      return sessionFromParts({ platformUser: existingPlatform })
    }
    const companyId = existingPlatform.companyId
    if (!companyId) {
      const legacyUser = await readLegacyCompanyUser(uid)
      if (legacyUser) {
        return sessionFromLegacyMember({
          uid,
          email: normalizedEmail,
          name: displayName,
          phone,
          legacyUser,
        })
      }
      return { status: 'unauthorized', reason: 'no-company', user: null }
    }
    let company = null
    let companyUser = null
    try {
      company = await getCompany(companyId)
      companyUser = await getCompanyUser(uid, companyId)
    } catch (err) {
      if (err?.code === 'permission-denied') {
        const legacyUser = await readLegacyCompanyUser(uid)
        if (legacyUser) {
          return sessionFromLegacyMember({
            uid,
            email: normalizedEmail,
            name: displayName,
            phone,
            legacyUser,
          })
        }
        return { status: 'unauthorized', reason: 'no-company', user: null }
      }
      throw err
    }
    if (companyUser && displayName && displayName !== companyUser.name) {
      try {
        await setDoc(userRef(uid, companyId), { name: displayName }, { merge: true })
        companyUser = { ...companyUser, name: displayName }
      } catch {
        /* ignore */
      }
    }
    return sessionFromParts({
      platformUser: existingPlatform,
      companyUser,
      company,
    })
  }

  // Existing Shreenathji members (including Master Admin) — before email-verify gate.
  const legacyUser = await readLegacyCompanyUser(uid)
  if (legacyUser) {
    return sessionFromLegacyMember({
      uid,
      email: normalizedEmail,
      name: displayName,
      phone,
      legacyUser,
    })
  }

  if (!emailVerified) {
    if (phone && !normalizedEmail) {
      return { user: null, status: 'unauthorized', reason: 'phone-needs-email' }
    }
    return { user: null, status: 'unverified' }
  }

  try {
    const globalInviteSnap = await getDoc(globalInviteRef(normalizedEmail))
    if (globalInviteSnap.exists() && globalInviteSnap.data().status === 'pending') {
      const accepted = await acceptPendingInvite({
        uid,
        email: normalizedEmail,
        name: displayName,
        phone,
        invite: globalInviteSnap.data(),
        inviteCompanyId: globalInviteSnap.data().companyId,
      })
      return sessionFromParts({ ...accepted, statusHint: 'created-staff' })
    }
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err
  }

  try {
    const legacyInviteSnap = await getDoc(
      doc(db, COMPANIES_COLLECTION, LEGACY_COMPANY_ID, 'invites', normalizedEmail),
    )
    if (legacyInviteSnap.exists() && legacyInviteSnap.data().status === 'pending') {
      const accepted = await acceptPendingInvite({
        uid,
        email: normalizedEmail,
        name: displayName,
        phone,
        invite: { ...legacyInviteSnap.data(), companyId: LEGACY_COMPANY_ID },
        inviteCompanyId: LEGACY_COMPANY_ID,
      })
      return sessionFromParts(accepted)
    }
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err
  }

  return { user: null, status: 'unauthorized' }
}
