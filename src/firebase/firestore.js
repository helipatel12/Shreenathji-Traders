// Typed collection helpers for the Firestore data model in
// architecture.md §4. Implemented incrementally as each phase needs
// its collection(s) — see phases.md. Phase 1 adds the business/user
// helpers needed for login; later phases add bills/payments/etc.

import { collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { db } from './config'

// This app is single-business per deployment — prd.md and
// architecture.md describe one aadatiya's business per install, not a
// multi-tenant product. businessId is therefore a fixed deployment
// constant (set via VITE_BUSINESS_ID), not something chosen at
// runtime or discovered from the URL. Flagged in memory.md's
// decisions log — see there if this assumption ever needs revisiting.
export const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID || 'shreenath-traders'

export function businessRef() {
  return doc(db, 'businesses', BUSINESS_ID)
}

export function userRef(uid) {
  return doc(db, 'businesses', BUSINESS_ID, 'users', uid)
}

// Full user list (Phase 8 — Settings → users) — owner-only per
// firestore.rules (isMember can read a single user, but listing the
// whole team is scoped tighter, see rules.md §6).
export function userCollectionRef() {
  return collection(db, 'businesses', BUSINESS_ID, 'users')
}

// Staff/CA invites (Phase 8) — architecture.md has no Admin SDK/Cloud
// Functions (rules.md §2), so there's no way for the owner to create
// someone else's Firebase Auth account directly. Instead: the owner
// pre-authorizes an EMAIL with a role/location here; the invited
// person creates their own account (email + password, same as the
// bootstrap flow) and getOrCreateUserOnFirstLogin() below promotes
// them using this record. The doc ID is always the invitee's
// lowercased email — not an auto ID — specifically so firestore.rules
// can let a not-yet-a-member user check "was I invited?" via a
// targeted `get` on their own doc ID, without needing `list` access
// to every pending invite (which would leak who else is invited).
export function inviteCollectionRef() {
  return collection(db, 'businesses', BUSINESS_ID, 'invites')
}

export function inviteDocRef(email) {
  return doc(db, 'businesses', BUSINESS_ID, 'invites', email.trim().toLowerCase())
}

// Vepari master list (Phase 3) — architecture.md §4:
// businesses/{businessId}/veparis/{vepariId}
export function vepariCollectionRef() {
  return collection(db, 'businesses', BUSINESS_ID, 'veparis')
}

export function vepariDocRef(vepariId) {
  return doc(db, 'businesses', BUSINESS_ID, 'veparis', vepariId)
}

// Bills (Phase 4) — architecture.md §4: businesses/{businessId}/bills/{billId}
export function billCollectionRef() {
  return collection(db, 'businesses', BUSINESS_ID, 'bills')
}

export function billDocRef(billId) {
  return doc(db, 'businesses', BUSINESS_ID, 'bills', billId)
}

// Payments (Phase 6) — architecture.md §4:
// businesses/{businessId}/payments/{paymentId}
export function paymentCollectionRef() {
  return collection(db, 'businesses', BUSINESS_ID, 'payments')
}

export function paymentDocRef(paymentId) {
  return doc(db, 'businesses', BUSINESS_ID, 'payments', paymentId)
}

// Manual silak entries only (Phase 7) — architecture.md §4:
// businesses/{businessId}/silakEntries/{entryId}. Auto (bill/payment
// -derived) entries are never stored here — see useJansaSilak.js.
export function silakEntryCollectionRef() {
  return collection(db, 'businesses', BUSINESS_ID, 'silakEntries')
}

export function silakEntryDocRef(entryId) {
  return doc(db, 'businesses', BUSINESS_ID, 'silakEntries', entryId)
}

export async function getBusiness() {
  const snap = await getDoc(businessRef())
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getUserRecord(uid) {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Phase 1's "first login" flow (phases.md), extended in Phase 8 for
// staff/CA provisioning:
//
// - If a user record already exists for this uid, just return it.
// - If the business itself has never been set up, this is the very
//   first person to ever sign in to this deployment — they become the
//   owner, and the business doc is created alongside their user
//   record in a single batch (architecture.md §4's businesses/{id}
//   and businesses/{id}/users/{uid}).
// - If the business already exists but this uid has no user record,
//   check for a pending invite at invites/{their email}. If the owner
//   invited this exact email (Settings → Users, Phase 8), promote
//   them to a real user record with the invited role/location, and
//   mark the invite accepted. This is the ONLY way to get staff/ca
//   access — there's no Admin SDK to let the owner create someone
//   else's Firebase Auth account directly (rules.md §2), so the
//   invited person creates their own account and this function
//   "claims" it against the pre-authorization the owner set up.
// - If neither — this is genuinely uninvited. Auto-granting access to
//   any email that happens to sign up would be a real security hole
//   for a money app (rules.md §3, §6). The caller gets status:
//   'unauthorized' and should sign the user back out with a clear
//   explanation.
//
// Identifier note: originally keyed on phone number (Firebase phone
// auth) — switched to email since Firebase now requires the Blaze
// (paid) plan for phone/SMS auth, which conflicts with prd.md §5's
// free-tier requirement. See memory.md decisions log.
export async function getOrCreateUserOnFirstLogin({ uid, email, name = '', phone = '' }) {
  const displayName = String(name || '').trim()
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const existingUser = await getUserRecord(uid)
  if (existingUser) {
    if (displayName && displayName !== existingUser.name) {
      await setDoc(userRef(uid), { name: displayName }, { merge: true })
      return { user: { ...existingUser, name: displayName }, status: 'existing' }
    }
    return { user: existingUser, status: 'existing' }
  }

  // Business get is member/invite/bootstrap-only (firestore.rules). A
  // signed-in stranger gets permission-denied when the business already
  // exists — treat that the same as "business exists, you are not a
  // member yet" and fall through to the invite check.
  let business = null
  let businessDefinitelyExists = false
  try {
    business = await getBusiness()
  } catch (err) {
    if (err?.code === 'permission-denied') {
      businessDefinitelyExists = true
    } else {
      throw err
    }
  }

  if (!business && !businessDefinitelyExists) {
    const batch = writeBatch(db)
    batch.set(businessRef(), {
      name: 'Shreenath Traders',
      financialYearStart: '04-01',
      createdAt: serverTimestamp(),
    })
    const newUser = {
      email: normalizedEmail,
      phone: phone || '',
      role: 'owner',
      name: displayName,
      location: '',
      createdAt: serverTimestamp(),
    }
    batch.set(userRef(uid), newUser)
    await batch.commit()
    return { user: { id: uid, ...newUser }, status: 'created-owner' }
  }

  if (normalizedEmail) {
    const inviteSnap = await getDoc(inviteDocRef(normalizedEmail))
    if (inviteSnap.exists() && inviteSnap.data().status === 'pending') {
      const invite = inviteSnap.data()
      const batch = writeBatch(db)
      const newUser = {
        email: normalizedEmail,
        phone: phone || '',
        role: invite.role,
        name: displayName || invite.name || '',
        location: invite.location || '',
        createdAt: serverTimestamp(),
      }
      batch.set(userRef(uid), newUser)
      batch.update(inviteDocRef(normalizedEmail), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      })
      await batch.commit()
      return { user: { id: uid, ...newUser }, status: 'created-staff' }
    }
  }

  return { user: null, status: 'unauthorized' }
}
