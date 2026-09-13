// Vepari settlement payments — mirror of usePayments.js (farmer Rojmer).
// Linked by billId === bill.firestoreId; balance uses dakhla line total
// (see getDakhlaClearingInfo), not bill.totalAmount.

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { vepariPaymentCollectionRef, vepariPaymentDocRef } from '../firebase/firestore'
import { diffFields } from '../utils/editHistory'
import { onLocalDataChanged } from '../utils/localDataEvents'
import {
  applyCollectionSnapshot,
  dedupeTableByFirestoreId,
  markSyncedIfUnchanged,
  nextSyncRevision,
} from '../utils/syncHelpers'
import { parseLocaleNumber } from '../utils/numbers'
import { softVoidLocalRow } from '../utils/softVoid'

const EDITABLE_FIELDS = ['amount', 'type', 'date']

export function useVepariPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.vepariPayments)
    const rows = await localDb.vepariPayments.toArray()
    setPayments(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => onLocalDataChanged((table) => {
    if (table === 'vepariPayments' || table == null) refreshLocal()
  }), [refreshLocal])

  useEffect(() => {
    let cancelled = false
    let generation = 0
    const unsubscribe = onSnapshot(vepariPaymentCollectionRef(), async (snapshot) => {
      const gen = ++generation
      const isCurrent = () => !cancelled && gen === generation
      await applyCollectionSnapshot(localDb.vepariPayments, snapshot, {
        isCurrent,
        mapDoc: (docSnap) => {
          const data = docSnap.data()
          return {
            firestoreId: docSnap.id,
            ...data,
            createdAtLocal: data.createdAtLocal || Date.now(),
          }
        },
      })
      if (isCurrent()) await refreshLocal()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refreshLocal])

  async function addPayment({ billId, amount, type, date, createdBy, createdByName }) {
    const payload = {
      billId,
      amount: parseLocaleNumber(amount),
      type,
      date,
      createdBy,
      createdByName: String(createdByName || '').trim() || null,
      editHistory: [],
    }
    const ref = doc(vepariPaymentCollectionRef())
    const createdAtLocal = Date.now()
    const localId = await localDb.vepariPayments.add({
      ...payload,
      firestoreId: ref.id,
      createdAtLocal,
      syncStatus: 'pending',
      syncRevision: 1,
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp(), createdAtLocal })
      await markSyncedIfUnchanged(localDb.vepariPayments, localId, 1)
    } catch (err) {
      console.error('Vepari payment save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updatePayment(localId, changes, editedBy) {
    const existing = await localDb.vepariPayments.get(localId)
    if (!existing) return
    if (existing.isVoided || existing.syncStatus === 'pendingDelete') {
      throw new Error('PAYMENT_VOIDED')
    }
    const normalized = { ...changes }
    delete normalized.billId
    if (changes.amount != null) normalized.amount = parseLocaleNumber(changes.amount)
    const newValues = { ...existing, ...normalized }
    const newHistoryEntries = diffFields(existing, newValues, EDITABLE_FIELDS, editedBy)
    const editHistory = [...(existing.editHistory || []), ...newHistoryEntries]
    const syncRevision = nextSyncRevision(existing)
    const localUpdate = { ...normalized, editHistory }
    await localDb.vepariPayments.update(localId, {
      ...localUpdate,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(vepariPaymentDocRef(existing.firestoreId), localUpdate)
        await markSyncedIfUnchanged(localDb.vepariPayments, localId, syncRevision)
        await refreshLocal()
      } catch (err) {
        console.error('Vepari payment edit queued locally — Firestore sync failed:', err)
      }
    }
  }

  async function deletePayment(localId, voidedBy) {
    const existing = await localDb.vepariPayments.get(localId)
    if (!existing) return
    await softVoidLocalRow(
      localDb.vepariPayments,
      existing,
      vepariPaymentDocRef,
      voidedBy,
      'deleted',
    )
    await refreshLocal()
  }

  return { payments, loading, addPayment, updatePayment, deletePayment, voidPayment: deletePayment }
}
