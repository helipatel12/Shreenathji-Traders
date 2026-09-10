// Full team list (Phase 8, Settings → Users / Admin → Users) — owner-only
// read, live Firestore, no offline queueing (same reasoning as useBusiness.js).
// Owner can fully remove a member from the business DB (user doc + invite).
// Firebase Auth login accounts cannot be deleted from the client on Spark
// (needs Admin SDK / Cloud Functions) — after delete they hit “not set up.”

import { useEffect, useState } from 'react'
import { onSnapshot, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { userCollectionRef, userRef, inviteDocRef } from '../firebase/firestore'

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

  /**
   * Hard-remove from business Firestore: users/{uid} + invites/{email}.
   * Does not delete the Firebase Auth account (client SDK cannot delete others).
   */
  async function deleteUser(uid, { email } = {}) {
    const batch = writeBatch(db)
    batch.delete(userRef(uid))
    const emailKey = String(email || '').trim().toLowerCase()
    if (emailKey) {
      batch.delete(inviteDocRef(emailKey))
    }
    await batch.commit()
  }

  return { users, loading, updateUser, deleteUser }
}
