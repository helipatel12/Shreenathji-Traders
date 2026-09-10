// Full team list (Phase 8, Settings → Users / Admin → Users) — owner-only
// read, live Firestore, no offline queueing (same reasoning as useBusiness.js).
// Owner can update role/location/name and delete a member's business access
// (Firestore user doc). Firebase Auth accounts are not deleted from the client.

import { useEffect, useState } from 'react'
import { onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
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

  async function deleteUser(uid) {
    await deleteDoc(userRef(uid))
  }

  return { users, loading, updateUser, deleteUser }
}
