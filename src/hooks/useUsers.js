// Full team list (Phase 8, Settings → Users) — owner-only read, live
// Firestore, no offline queueing (same reasoning as useBusiness.js).
// Editing an existing user's role/location/name IS supported (the
// owner correcting a typo or reassigning someone), but there's no
// delete — removing a person's access is done by demoting their role
// or, if truly needed, from the Firebase console directly; this app
// doesn't build its own "revoke access" flow in Phase 8's scope.

import { useEffect, useState } from 'react'
import { onSnapshot, updateDoc } from 'firebase/firestore'
import { userCollectionRef, userRef } from '../firebase/firestore'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(userCollectionRef(), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function updateUser(uid, changes) {
    await updateDoc(userRef(uid), changes)
  }

  return { users, loading, updateUser }
}
