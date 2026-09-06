import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { paymentCollectionRef, paymentDocRef } from '../firebase/firestore'
import { diffFields } from '../utils/editHistory'
import {
  applyCollectionSnapshot,
  dedupeTableByFirestoreId,
  markSyncedIfUnchanged,
  nextSyncRevision,
} from '../utils/syncHelpers'
import { parseLocaleNumber } from '../utils/numbers'

const EDITABLE_FIELDS = ['amount', 'type', 'date']

export function usePayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.payments)
    const rows = await localDb.payments.toArray()
    setPayments(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    let cancelled = false
    let generation = 0
    const unsubscribe = onSnapshot(paymentCollectionRef(), async (snapshot) => {
      const gen = ++generation
      const isCurrent = () => !cancelled && gen === generation
      await applyCollectionSnapshot(localDb.payments, snapshot, { isCurrent })
      if (isCurrent()) await refreshLocal()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refreshLocal])

  async function addPayment({ billId, amount, type, date, createdBy }) {
    const payload = {
      billId,
      amount: parseLocaleNumber(amount),
      type,
      date,
      createdBy,
      editHistory: [],
    }
    const ref = doc(paymentCollectionRef())
    const localId = await localDb.payments.add({
      ...payload,
      firestoreId: ref.id,
      syncStatus: 'pending',
      syncRevision: 1,
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await markSyncedIfUnchanged(localDb.payments, localId, 1)
    } catch (err) {
      console.error('Payment save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updatePayment(localId, changes, editedBy) {
    const existing = await localDb.payments.get(localId)
    if (!existing) return
    const normalized = { ...changes }
    if (changes.amount != null) normalized.amount = parseLocaleNumber(changes.amount)
    const newValues = { ...existing, ...normalized }
    const newHistoryEntries = diffFields(existing, newValues, EDITABLE_FIELDS, editedBy)
    const editHistory = [...(existing.editHistory || []), ...newHistoryEntries]
    const syncRevision = nextSyncRevision(existing)
    const localUpdate = { ...normalized, editHistory }
    await localDb.payments.update(localId, {
      ...localUpdate,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(paymentDocRef(existing.firestoreId), localUpdate)
        await markSyncedIfUnchanged(localDb.payments, localId, syncRevision)
        await refreshLocal()
      } catch (err) {
        console.error('Payment edit queued locally — Firestore sync failed:', err)
      }
    }
  }

  async function voidPayment(localId, reason, voidedBy) {
    const existing = await localDb.payments.get(localId)
    if (!existing || existing.isVoided) return
    const voidedAt = new Date().toISOString()
    const historyEntry = {
      field: 'isVoided',
      oldValue: false,
      newValue: true,
      editedBy: voidedBy,
      editedAt: voidedAt,
    }
    const syncRevision = nextSyncRevision(existing)
    const changes = {
      isVoided: true,
      voidReason: reason || '',
      voidedBy,
      voidedAt,
      editHistory: [...(existing.editHistory || []), historyEntry],
    }
    await localDb.payments.update(localId, {
      ...changes,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(paymentDocRef(existing.firestoreId), changes)
        await markSyncedIfUnchanged(localDb.payments, localId, syncRevision)
        await refreshLocal()
      } catch (err) {
        console.error('Payment void queued locally — Firestore sync failed:', err)
      }
    }
  }

  return { payments, loading, addPayment, updatePayment, voidPayment }
}
