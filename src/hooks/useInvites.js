// Staff/CA invites (Phase 8) — owner-only, live Firestore, no offline
// queueing (same reasoning as useBusiness.js: this is desk-side admin
// work, not field data entry).
//
// The person on the OTHER end of an invite — the not-yet-a-member
// invitee checking "was I invited?" — is handled separately in
// firebase/firestore.js's getOrCreateUserOnFirstLogin, not here; this
// hook is purely the owner's side of managing the invite list.

import { useEffect, useState } from 'react'
import { onSnapshot, setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { BUSINESS_ID, inviteCollectionRef, inviteDocRef } from '../firebase/firestore'

export function useInvites() {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(inviteCollectionRef(), (snap) => {
      setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function addInvite({ email, role, location, invitedBy }) {
    const ref = inviteDocRef(email)
    await setDoc(ref, {
      email: email.trim().toLowerCase(),
      role,
      location: location || '',
      status: 'pending',
      invitedBy,
      invitedAt: serverTimestamp(),
    })
  }

  /**
   * Hard-delete invite from Firestore (pending list + DB).
   * Uses the exact doc id from the snapshot, and also the lowercased
   * email path so older/mismatched ids cannot linger.
   */
  async function revokeInvite(inviteOrEmail) {
    const rawId =
      typeof inviteOrEmail === 'string'
        ? String(inviteOrEmail || '').trim()
        : String(inviteOrEmail?.id || inviteOrEmail?.email || '').trim()
    if (!rawId) throw new Error('INVITE_REQUIRED')

    const lower = rawId.toLowerCase()
    const emailField = String(
      typeof inviteOrEmail === 'object' ? inviteOrEmail?.email || '' : '',
    )
      .trim()
      .toLowerCase()

    // Optimistic UI — drop from pending list immediately.
    setInvites((prev) =>
      prev.filter((i) => {
        const id = String(i.id || '')
        const email = String(i.email || '').toLowerCase()
        if (id === rawId || id === lower) return false
        if (email && (email === lower || email === emailField)) return false
        return true
      }),
    )

    // Exact snapshot id (may already be lowercased).
    await deleteDoc(doc(db, 'businesses', BUSINESS_ID, 'invites', rawId))
    // Canonical lowercased path — no-op if same id or already gone.
    if (lower !== rawId) {
      try {
        await deleteDoc(inviteDocRef(lower))
      } catch {
        /* ignore */
      }
    }
    if (emailField && emailField !== lower && emailField !== rawId) {
      try {
        await deleteDoc(inviteDocRef(emailField))
      } catch {
        /* ignore */
      }
    }
  }

  return { invites, loading, addInvite, revokeInvite }
}
