// Payments (Rojmer) — Phase 6. Same local-first + edit-history
// pattern as useBills.js (Phase 4): saves to Dexie immediately, syncs
// to Firestore in the background, and edits append to editHistory
// rather than overwriting (architecture.md §5a: "Editing a payment
// works the same way [as a bill]").
//
// architecture.md §2 calls payments "append-only events" — that's
// about CONFLICT RESOLUTION (a new payment is a new record, so two
// devices recording payments for the same farmer never overwrite each
// other's payment), not a ban on ever correcting a typo. §5a is
// explicit that individual payments stay directly editable, same as
// bills. No delete either way, same as bills — a mistaken payment
// gets corrected via edit history, never removed (rules.md §3: the
// app never silently deletes financial data).
//
// billId always stores the bill's `firestoreId` — see calc.js's
// getBillClearingInfo() header comment for why that's the only safe
// identifier to match payments against bills with.

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { paymentCollectionRef, paymentDocRef } from '../firebase/firestore'
import { diffFields } from '../utils/editHistory'

const EDITABLE_FIELDS = ['amount', 'type', 'date']

export function usePayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    const rows = await localDb.payments.toArray()
    setPayments(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    const unsubscribe = onSnapshot(paymentCollectionRef(), async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        const remote = { firestoreId: docSnap.id, ...docSnap.data(), syncStatus: 'synced' }
        const existing = await localDb.payments.where('firestoreId').equals(docSnap.id).first()
        if (existing) {
          await localDb.payments.update(existing.id, remote)
        } else {
          await localDb.payments.add(remote)
        }
      }
      const remoteIds = new Set(snapshot.docs.map((d) => d.id))
      const syncedRows = await localDb.payments.where('syncStatus').equals('synced').toArray()
      for (const row of syncedRows) {
        if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
          await localDb.payments.delete(row.id)
        }
      }
      await refreshLocal()
    })
    return unsubscribe
  }, [refreshLocal])

  async function addPayment({ billId, amount, type, date, createdBy }) {
    const payload = { billId, amount: Number(amount), type, date, createdBy, editHistory: [] }
    // Same up-front-ID pattern as useBills.js/useVeparis.js, to avoid
    // the live listener's local-cache echo racing a manual "mark
    // synced" step and inserting a duplicate row.
    const ref = doc(paymentCollectionRef())
    const localId = await localDb.payments.add({
      ...payload,
      firestoreId: ref.id,
      syncStatus: 'pending',
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await localDb.payments.update(localId, { syncStatus: 'synced' })
    } catch (err) {
      // Payment stays saved locally either way (rules.md §4) — this
      // is exactly the offline-record case Phase 6's own "done when"
      // (two offline devices, same farmer) needs to survive.
      console.error('Payment save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updatePayment(localId, changes, editedBy) {
    const existing = await localDb.payments.get(localId)
    if (!existing) return

    const newValues = { ...existing, ...changes }
    const newHistoryEntries = diffFields(existing, newValues, EDITABLE_FIELDS, editedBy)
    const editHistory = [...(existing.editHistory || []), ...newHistoryEntries]

    const localUpdate = { ...changes, editHistory }
    await localDb.payments.update(localId, {
      ...localUpdate,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()

    if (existing.firestoreId) {
      try {
        await updateDoc(paymentDocRef(existing.firestoreId), localUpdate)
        await localDb.payments.update(localId, { syncStatus: 'synced' })
        await refreshLocal()
      } catch (err) {
        console.error('Payment edit queued locally — Firestore sync failed:', err)
      }
    }
  }

  // Voiding, not deleting — payments can never be deleted (rules.md
  // §3, firestore.rules' `allow delete: if false`). A payment entered
  // entirely by mistake is marked voided instead: it stays visible
  // with its full history, but is excluded from balance/clearing math
  // (calc.js's getBillClearingInfo filters out isVoided payments).
  // This is just a specialized update, so it uses the same Firestore
  // `update` permission editing already has — no new rule needed.
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
    const changes = {
      isVoided: true,
      voidReason: reason || '',
      voidedBy,
      voidedAt,
      editHistory: [...(existing.editHistory || []), historyEntry],
    }

    await localDb.payments.update(localId, {
      ...changes,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()

    if (existing.firestoreId) {
      try {
        await updateDoc(paymentDocRef(existing.firestoreId), changes)
        await localDb.payments.update(localId, { syncStatus: 'synced' })
        await refreshLocal()
      } catch (err) {
        console.error('Payment void queued locally — Firestore sync failed:', err)
      }
    }
  }

  return { payments, loading, addPayment, updatePayment, voidPayment }
}
