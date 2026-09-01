// Manual jansa silak entries (Phase 7) — e.g. a bank deposit or
// withdrawal that isn't derived from a bill or payment. Local-first,
// same pattern as useVeparis.js/useBills.js/usePayments.js.
//
// Unlike bills/payments, manual silak entries CAN be truly deleted
// (firestore.rules: `allow ... delete: if isStaffOrOwner(...) &&
// resource.data.isManual == true`) — prd.md §4.4 says so explicitly
// ("Manual entries editable/deletable"), and architecture.md §5a
// draws the line specifically at auto-populated entries needing the
// no-delete/edit-history treatment. A manual entry isn't a financial
// record of money that changed hands between farmer/vepari/aadatiya
// (that's what bills/payments track, and what rules.md §3's
// never-delete rule is really protecting) — it's closer to a
// free-form note the owner is allowed to freely correct or remove.
//
// Auto (bill/payment-derived) entries are never written here at all
// — see useJansaSilak.js, which computes them live rather than
// storing them, per architecture.md §7.

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { silakEntryCollectionRef, silakEntryDocRef } from '../firebase/firestore'

export function useSilakEntries() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    const rows = await localDb.silakEntries.toArray()
    setEntries(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    const unsubscribe = onSnapshot(silakEntryCollectionRef(), async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        const remote = { firestoreId: docSnap.id, ...docSnap.data(), syncStatus: 'synced' }
        const existing = await localDb.silakEntries.where('firestoreId').equals(docSnap.id).first()
        if (existing) {
          await localDb.silakEntries.update(existing.id, remote)
        } else {
          await localDb.silakEntries.add(remote)
        }
      }
      const remoteIds = new Set(snapshot.docs.map((d) => d.id))
      const syncedRows = await localDb.silakEntries.where('syncStatus').equals('synced').toArray()
      for (const row of syncedRows) {
        if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
          await localDb.silakEntries.delete(row.id)
        }
      }
      await refreshLocal()
    })
    return unsubscribe
  }, [refreshLocal])

  async function addEntry({ date, side, label, amount, createdBy }) {
    const payload = { date, side, label: label.trim(), amount: Number(amount), isManual: true, createdBy }
    const ref = doc(silakEntryCollectionRef())
    const localId = await localDb.silakEntries.add({
      ...payload,
      firestoreId: ref.id,
      syncStatus: 'pending',
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await localDb.silakEntries.update(localId, { syncStatus: 'synced' })
    } catch (err) {
      console.error('Silak entry save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
  }

  async function updateEntry(localId, changes) {
    const existing = await localDb.silakEntries.get(localId)
    if (!existing) return
    await localDb.silakEntries.update(localId, {
      ...changes,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(silakEntryDocRef(existing.firestoreId), changes)
        await localDb.silakEntries.update(localId, { syncStatus: 'synced' })
        await refreshLocal()
      } catch (err) {
        console.error('Silak entry edit queued locally — Firestore sync failed:', err)
      }
    }
  }

  async function deleteEntry(localId) {
    const existing = await localDb.silakEntries.get(localId)
    if (!existing) return
    await localDb.silakEntries.delete(localId)
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await deleteDoc(silakEntryDocRef(existing.firestoreId))
      } catch (err) {
        console.error('Silak entry delete did not reach Firestore yet:', err)
      }
    }
  }

  return { entries, loading, addEntry, updateEntry, deleteEntry }
}
