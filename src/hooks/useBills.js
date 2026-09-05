import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { billCollectionRef, billDocRef } from '../firebase/firestore'
import { computeBillTotal } from '../utils/calc'
import { diffFields } from '../utils/editHistory'
import {
  upsertByFirestoreId,
  removeMissingSynced,
  dedupeTableByFirestoreId,
} from '../utils/syncHelpers'

const EDITABLE_FIELDS = ['farmerName', 'farmerVillage', 'vepariId', 'date', 'items']

/**
 * Next નોંધ નં. = lowest free positive integer among active (non-voided) bills.
 * Gaps are filled; existing numbers are never renumbered.
 * Voided numbers are free to reuse (they do not hold the slot).
 */
async function nextEntryNumber() {
  const rows = await localDb.bills.toArray()
  const used = new Set()
  for (const row of rows) {
    if (row.isVoided) continue
    const n = Number(row.entryNumber)
    if (Number.isFinite(n) && n > 0) used.add(n)
  }
  let n = 1
  while (used.has(n)) n += 1
  return n
}

/**
 * One-time backfill for legacy rows missing entryNumber.
 * Writes permanently to Dexie — never reshuffles numbers that already exist.
 */
async function persistMissingEntryNumbers() {
  const rows = await localDb.bills.toArray()
  const used = new Set()
  for (const row of rows) {
    const n = Number(row.entryNumber)
    if (Number.isFinite(n) && n > 0) used.add(n)
  }

  const missing = rows
    .filter((row) => row.entryNumber == null || row.entryNumber === '')
    .sort((a, b) => (a.createdAtLocal || 0) - (b.createdAtLocal || 0))

  for (const row of missing) {
    let n = 1
    while (used.has(n)) n += 1
    used.add(n)
    await localDb.bills.update(row.id, { entryNumber: n, syncStatus: 'pending' })
    if (row.firestoreId) {
      try {
        await updateDoc(billDocRef(row.firestoreId), { entryNumber: n })
        await localDb.bills.update(row.id, { syncStatus: 'synced' })
      } catch (err) {
        console.error('entryNumber backfill sync failed:', err)
      }
    }
  }
}

export function useBills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.bills)
    await persistMissingEntryNumbers()
    const rows = await localDb.bills.toArray()
    rows.sort((a, b) => {
      const na = Number(a.entryNumber) || 0
      const nb = Number(b.entryNumber) || 0
      if (na !== nb) return na - nb
      return (a.createdAtLocal || 0) - (b.createdAtLocal || 0)
    })
    setBills(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onSnapshot(billCollectionRef(), async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        if (cancelled) return
        const data = docSnap.data()
        await upsertByFirestoreId(localDb.bills, docSnap.id, {
          firestoreId: docSnap.id,
          ...data,
          createdAtLocal: data.createdAtLocal || Date.now(),
        })
      }
      if (cancelled) return
      await removeMissingSynced(
        localDb.bills,
        new Set(snapshot.docs.map((d) => d.id)),
      )
      await refreshLocal()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refreshLocal])

  async function addBill({ farmerName, farmerVillage, vepariId, date, items, createdBy, locationId }) {
    const entryNumber = await nextEntryNumber()
    const payload = {
      farmerName: farmerName.trim(),
      farmerVillage: farmerVillage.trim(),
      vepariId,
      date,
      items,
      totalAmount: computeBillTotal(items),
      createdBy,
      locationId: locationId || null,
      entryNumber,
      editHistory: [],
    }
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
      console.error('Bill save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updateBill(localId, changes, editedBy) {
    const existing = await localDb.bills.get(localId)
    if (!existing) return

    // નોંધ નં. is immutable after create — strip any accidental change.
    const { entryNumber: _ignoreEntry, ...safeChanges } = changes || {}

    const newValues = { ...existing, ...safeChanges }
    if (safeChanges.items) {
      newValues.totalAmount = computeBillTotal(safeChanges.items)
    }
    const newHistoryEntries = diffFields(existing, newValues, EDITABLE_FIELDS, editedBy)
    const editHistory = [...(existing.editHistory || []), ...newHistoryEntries]

    const localUpdate = {
      ...safeChanges,
      totalAmount: newValues.totalAmount,
      editHistory,
    }
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
