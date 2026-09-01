// Bill entry (કેશ મેમો) — Phase 4. Local-first per rules.md §5: every
// mutation writes to Dexie immediately, then syncs to Firestore in
// the background — this is the phase phases.md's build-order note
// calls out as the real test of the offline-first bet, so the
// pattern here matters more than in Phase 3's simpler vepari CRUD.
//
// Unlike veparis (Phase 3, freely editable) or payments (Phase 6,
// strictly append-only per architecture.md §2), bills sit in between:
// directly editable, but every edit appends to `editHistory` instead
// of silently overwriting (architecture.md §5a). Item-level fields are
// diffed as a whole array, not line-by-line — see memory.md's
// decisions log for that scope call.
//
// Entry numbers (નોંધ નં., design.md §4) are derived from creation
// order at read time, not stored as an incrementing counter — a
// stored counter is exactly the kind of "running total two offline
// devices could collide on" architecture.md §7 warns against; a
// derived position has no shared state to conflict over.

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { billCollectionRef, billDocRef } from '../firebase/firestore'
import { computeBillTotal } from '../utils/calc'
import { diffFields } from '../utils/editHistory'

const EDITABLE_FIELDS = ['farmerName', 'farmerVillage', 'vepariId', 'date', 'items']

export function useBills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    const rows = await localDb.bills.toArray()
    // Oldest first, so index+1 gives a stable-once-synced entry number.
    rows.sort((a, b) => {
      const ta = a.createdAtLocal || 0
      const tb = b.createdAtLocal || 0
      return ta - tb
    })
    setBills(rows.map((row, index) => ({ ...row, entryNumber: index + 1 })))
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    const unsubscribe = onSnapshot(billCollectionRef(), async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        const remote = { firestoreId: docSnap.id, ...docSnap.data(), syncStatus: 'synced' }
        const existing = await localDb.bills.where('firestoreId').equals(docSnap.id).first()
        if (existing) {
          await localDb.bills.update(existing.id, remote)
        } else {
          await localDb.bills.add(remote)
        }
      }
      const remoteIds = new Set(snapshot.docs.map((d) => d.id))
      const syncedRows = await localDb.bills.where('syncStatus').equals('synced').toArray()
      for (const row of syncedRows) {
        if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
          await localDb.bills.delete(row.id)
        }
      }
      await refreshLocal()
    })
    return unsubscribe
  }, [refreshLocal])

  async function addBill({ farmerName, farmerVillage, vepariId, date, items, createdBy, locationId }) {
    const payload = {
      farmerName: farmerName.trim(),
      farmerVillage: farmerVillage.trim(),
      vepariId,
      date,
      items,
      totalAmount: computeBillTotal(items),
      createdBy,
      locationId: locationId || null,
      editHistory: [],
    }
    // Same up-front-ID pattern as useVeparis.js, to avoid the live
    // listener's local-cache echo racing a manual "mark synced" step
    // and inserting a duplicate row.
    const ref = doc(billCollectionRef())
    const localId = await localDb.bills.add({
      ...payload,
      firestoreId: ref.id,
      createdAtLocal: Date.now(),
      syncStatus: 'pending',
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await localDb.bills.update(localId, { syncStatus: 'synced' })
    } catch (err) {
      // Bill stays saved locally either way (rules.md §4) — this is
      // exactly the offline-save case Phase 4 needs to survive.
      console.error('Bill save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updateBill(localId, changes, editedBy) {
    const existing = await localDb.bills.get(localId)
    if (!existing) return

    const newValues = { ...existing, ...changes }
    if (changes.items) {
      newValues.totalAmount = computeBillTotal(changes.items)
    }
    const newHistoryEntries = diffFields(existing, newValues, EDITABLE_FIELDS, editedBy)
    const editHistory = [...(existing.editHistory || []), ...newHistoryEntries]

    const localUpdate = { ...changes, totalAmount: newValues.totalAmount, editHistory }
    await localDb.bills.update(localId, {
      ...localUpdate,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()

    if (existing.firestoreId) {
      try {
        await updateDoc(billDocRef(existing.firestoreId), localUpdate)
        await localDb.bills.update(localId, { syncStatus: 'synced' })
        await refreshLocal()
      } catch (err) {
        console.error('Bill edit queued locally — Firestore sync failed:', err)
      }
    }
  }

  // Voiding, not deleting — bills can never be deleted
  // (firestore.rules' `allow delete: if false`, rules.md §3's "never
  // auto-delete financial data"), same reasoning as payments'
  // voidPayment() in usePayments.js. A bill entered entirely by
  // mistake (wrong farmer, duplicate) is marked voided instead: it
  // stays visible in the Bills list (struck through) with its entry
  // number and full history intact, but is excluded from every
  // downstream calculation — dashboard summary, dakhla, rojmer,
  // silak, and the year-end archive all filter through calc.js's
  // excludeVoided() before using bills for anything but display.
  // Owner-only at the firestore.rules level (staff can still create/
  // edit bills, but not void them) — see firestore.rules' comment on
  // the bills match block.
  async function voidBill(localId, reason, voidedBy) {
    const existing = await localDb.bills.get(localId)
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

    await localDb.bills.update(localId, {
      ...changes,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()

    if (existing.firestoreId) {
      try {
        await updateDoc(billDocRef(existing.firestoreId), changes)
        await localDb.bills.update(localId, { syncStatus: 'synced' })
        await refreshLocal()
      } catch (err) {
        console.error('Bill void queued locally — Firestore sync failed:', err)
      }
    }
  }

  return { bills, loading, addBill, updateBill, voidBill }
}
