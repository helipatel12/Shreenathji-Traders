// Staff/CA invites (Phase 8) — owner-only, live Firestore, no offline
// queueing (same reasoning as useBusiness.js: this is desk-side admin
// work, not field data entry).
//
// The person on the OTHER end of an invite — the not-yet-a-member
// invitee checking "was I invited?" — is handled separately in
// firebase/firestore.js's getOrCreateUserOnFirstLogin, not here; this
// hook is purely the owner's side of managing the invite list.

import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { inviteCollectionRef, inviteDocRef } from '../firebase/firestore'

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

  async function revokeInvite(email) {
    await deleteDoc(inviteDocRef(email))
  }

  return { invites, loading, addInvite, revokeInvite }
}
