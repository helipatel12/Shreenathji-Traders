// Manual jansa silak entries (Phase 7) — e.g. a bank deposit or
// withdrawal that isn't derived from a bill or payment. Local-first,
// same pattern as useVeparis.js/useBills.js/usePayments.js.

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { silakEntryCollectionRef, silakEntryDocRef } from '../firebase/firestore'
import {
  applyCollectionSnapshot,
  dedupeTableByFirestoreId,
  markSyncedIfUnchanged,
  nextSyncRevision,
} from '../utils/syncHelpers'

export function useSilakEntries() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.silakEntries)
    const rows = await localDb.silakEntries
      .toArray()
      .then((list) => list.filter((e) => e.syncStatus !== 'pendingDelete'))
    setEntries(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    let cancelled = false
    let generation = 0
    const unsubscribe = onSnapshot(
      silakEntryCollectionRef(),
      async (snapshot) => {
        const gen = ++generation
        const isCurrent = () => !cancelled && gen === generation
        await applyCollectionSnapshot(localDb.silakEntries, snapshot, {
          isCurrent,
          abandonPendingIfMissing: true,
        })
        if (isCurrent()) await refreshLocal()
      },
      (err) => {
        console.error('Silak entries snapshot error:', err)
      },
    )
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refreshLocal])

  async function addEntry({ date, side, label, amount, createdBy }) {
    const payload = {
      date,
      side,
      label: label.trim(),
      amount: Number(amount),
      isManual: true,
      createdBy,
    }
    const ref = doc(silakEntryCollectionRef())
    const localId = await localDb.silakEntries.add({
      ...payload,
      firestoreId: ref.id,
      syncStatus: 'pending',
      syncRevision: 1,
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await markSyncedIfUnchanged(localDb.silakEntries, localId, 1)
    } catch (err) {
      console.error('Silak entry save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
  }

  async function updateEntry(localId, changes) {
    const existing = await localDb.silakEntries.get(localId)
    if (!existing) return
    const syncRevision = nextSyncRevision(existing)
    const next = { ...changes, isManual: true }
    await localDb.silakEntries.update(localId, {
      ...next,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(silakEntryDocRef(existing.firestoreId), next)
        await markSyncedIfUnchanged(localDb.silakEntries, localId, syncRevision)
        await refreshLocal()
      } catch (err) {
        console.error('Silak entry edit queued locally — Firestore sync failed:', err)
      }
    }
  }

  async function deleteEntry(localId) {
    const existing = await localDb.silakEntries.get(localId)
    if (!existing) return
    if (!existing.firestoreId) {
      await localDb.silakEntries.delete(localId)
      await refreshLocal()
      return
    }
    // Tombstone until removeMissingSynced sees remote gone (avoids C1 resurrection).
    await localDb.silakEntries.update(localId, { syncStatus: 'pendingDelete' })
    await refreshLocal()
    try {
      await deleteDoc(silakEntryDocRef(existing.firestoreId))
    } catch (err) {
      console.error('Silak entry delete queued locally — Firestore sync failed:', err)
    }
  }

  return { entries, loading, addEntry, updateEntry, deleteEntry }
}
