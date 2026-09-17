// Staff/CA invites — company-admin only. Also writes a top-level
// invites/{email} doc so the invitee can find their company without
// knowing the company id (Spark plan, no Admin SDK).

import { useEffect, useState } from 'react'
import { onSnapshot, deleteDoc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  globalInviteRef,
  inviteCollectionRef,
  inviteDocRef,
} from '../firebase/firestore'
import { useAuth } from './useAuth'

export function useInvites() {
  const { companyId } = useAuth()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!companyId) {
      setInvites([])
      setLoading(false)
      return undefined
    }
    const unsubscribe = onSnapshot(inviteCollectionRef(companyId), (snap) => {
      setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsubscribe
  }, [companyId])

  async function addInvite({ email, role, location, invitedBy }) {
    if (!companyId) throw new Error('No company selected')
    if (role !== 'staff' && role !== 'ca') throw new Error('INVALID_INVITE_ROLE')
    const emailKey = String(email || '').trim().toLowerCase()
    const payload = {
      email: emailKey,
      companyId,
      role,
      location: location || '',
      status: 'pending',
      invitedBy,
      invitedAt: serverTimestamp(),
    }
    let existing = null
    try {
      existing = await getDoc(globalInviteRef(emailKey))
    } catch {
      existing = null
    }
    if (existing?.exists() && existing.data().status === 'pending' && existing.data().companyId !== companyId) {
      const err = new Error('INVITE_EMAIL_BUSY')
      err.code = 'INVITE_EMAIL_BUSY'
      throw err
    }
    const batch = writeBatch(db)
    batch.set(inviteDocRef(emailKey, companyId), payload)
    batch.set(globalInviteRef(emailKey), payload)
    await batch.commit()
  }

  async function revokeInvite(inviteOrEmail) {
    if (!companyId) throw new Error('No company selected')
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

    setInvites((prev) =>
      prev.filter((i) => {
        const id = String(i.id || '')
        const email = String(i.email || '').toLowerCase()
        if (id === rawId || id === lower) return false
        if (email && (email === lower || email === emailField)) return false
        return true
      }),
    )

    const keys = [...new Set([rawId, lower, emailField].filter(Boolean))]
    await Promise.all(
      keys.map(async (key) => {
        try {
          await deleteDoc(inviteDocRef(key, companyId))
        } catch {
          /* ignore */
        }
        try {
          await deleteDoc(globalInviteRef(key))
        } catch {
          /* ignore */
        }
      }),
    )
  }

  return { invites, loading, addInvite, revokeInvite }
}
