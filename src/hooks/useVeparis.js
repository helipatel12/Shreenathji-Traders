import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { vepariCollectionRef, vepariDocRef } from '../firebase/firestore'
import {
  applyCollectionSnapshot,
  dedupeTableByFirestoreId,
  dedupeVeparisForDisplay,
  markSyncedIfUnchanged,
  nextSyncRevision,
} from '../utils/syncHelpers'

export function useVeparis() {
  const [veparis, setVeparis] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.veparis)
    const rows = await localDb.veparis.toArray()
    rows.sort((a, b) => a.name.localeCompare(b.name, 'gu'))
    setVeparis(rows)
  }, [])

  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  useEffect(() => {
    let cancelled = false
    let generation = 0
    const unsubscribe = onSnapshot(vepariCollectionRef(), async (snapshot) => {
      const gen = ++generation
      const isCurrent = () => !cancelled && gen === generation
      await applyCollectionSnapshot(localDb.veparis, snapshot, {
        isCurrent,
        abandonPendingIfMissing: true,
      })
      if (isCurrent()) await refreshLocal()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [refreshLocal])

  async function addVepari({ name, village, customRates }) {
    const trimmedName = name.trim()
    const trimmedVillage = village.trim()
    const existingSame = (await localDb.veparis.toArray()).find(
      (v) =>
        v.syncStatus !== 'pendingDelete' &&
        v.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (v.village || '').trim().toLowerCase() === trimmedVillage.toLowerCase(),
    )
    if (existingSame) {
      await refreshLocal()
      return existingSame.id
    }

    const payload = {
      name: trimmedName,
      village: trimmedVillage,
      customRates: customRates || null,
    }
    const ref = doc(vepariCollectionRef())
    const localId = await localDb.veparis.add({
      ...payload,
      firestoreId: ref.id,
      createdAtLocal: Date.now(),
      syncStatus: 'pending',
      syncRevision: 1,
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await markSyncedIfUnchanged(localDb.veparis, localId, 1)
    } catch (err) {
      console.error('Vepari save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updateVepari(localId, { name, village, customRates }) {
    const existing = await localDb.veparis.get(localId)
    if (!existing) return
    const syncRevision = nextSyncRevision(existing)
    const payload = {
      name: name.trim(),
      village: village.trim(),
      customRates: customRates || null,
    }
    await localDb.veparis.update(localId, {
      ...payload,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(vepariDocRef(existing.firestoreId), payload)
        await markSyncedIfUnchanged(localDb.veparis, localId, syncRevision)
        await refreshLocal()
      } catch (err) {
        console.error('Vepari update queued locally — Firestore sync failed:', err)
      }
    }
  }

  async function deleteVepari(localId) {
    const existing = await localDb.veparis.get(localId)
    if (!existing) return
    if (!existing.firestoreId) {
      await localDb.veparis.delete(localId)
      await refreshLocal()
      return
    }
    // Tombstone until removeMissingSynced sees the remote id gone (avoids C1 resurrection).
    await localDb.veparis.update(localId, { syncStatus: 'pendingDelete' })
    await refreshLocal()
    try {
      await deleteDoc(vepariDocRef(existing.firestoreId))
    } catch (err) {
      console.error('Vepari delete queued locally — Firestore sync failed:', err)
    }
  }

  const [billVepariIds, setBillVepariIds] = useState([])
  useEffect(() => {
    let cancelled = false
    localDb.bills.toArray().then((bills) => {
      if (!cancelled) setBillVepariIds(bills.map((b) => ({ vepariId: b.vepariId })))
    })
    return () => {
      cancelled = true
    }
  }, [veparis])

  const displayVeparis = useMemo(
    () =>
      dedupeVeparisForDisplay(
        veparis.filter((v) => v.syncStatus !== 'pendingDelete'),
        billVepariIds,
      ),
    [veparis, billVepariIds],
  )

  return {
    veparis: displayVeparis,
    allVeparis: veparis,
    loading,
    addVepari,
    updateVepari,
    deleteVepari,
  }
}
