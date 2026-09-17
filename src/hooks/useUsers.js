// Full team list — company-admin only. Removing a member deletes the
// company user doc, matching invite, and (for staff/ca) the platform user.

import { useEffect, useState } from 'react'
import { onSnapshot, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  globalInviteRef,
  inviteDocRef,
  platformUserRef,
  userCollectionRef,
  userRef,
} from '../firebase/firestore'
import { useAuth } from './useAuth'
import { isCompanyAdminRole } from '../utils/roles'

export function useUsers() {
  const { companyId } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) {
      setUsers([])
      setLoading(false)
      return undefined
    }
    const unsubscribe = onSnapshot(userCollectionRef(companyId), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [companyId])

  async function updateUser(uid, changes) {
    if (!companyId) throw new Error('No company selected')
    await updateDoc(userRef(uid, companyId), changes)
  }

  async function deleteUser(uid, { email, role } = {}) {
    if (!companyId) throw new Error('No company selected')
    const batch = writeBatch(db)
    batch.delete(userRef(uid, companyId))
    const emailKey = String(email || '').trim().toLowerCase()
    if (emailKey) {
      batch.delete(inviteDocRef(emailKey, companyId))
      batch.delete(globalInviteRef(emailKey))
    }
    if (!isCompanyAdminRole(role)) {
      batch.delete(platformUserRef(uid))
    }
    await batch.commit()
  }

  return { users, loading, updateUser, deleteUser }
}
