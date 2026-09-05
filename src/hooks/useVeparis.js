import { useCallback, useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { vepariCollectionRef, vepariDocRef } from '../firebase/firestore'
import {
  upsertByFirestoreId,
  removeMissingSynced,
  dedupeTableByFirestoreId,
  dedupeVeparisForDisplay,
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
    const unsubscribe = onSnapshot(vepariCollectionRef(), async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        if (cancelled) return
        await upsertByFirestoreId(localDb.veparis, docSnap.id, {
          firestoreId: docSnap.id,
          ...docSnap.data(),
        })
      }
      if (cancelled) return
      await removeMissingSynced(
        localDb.veparis,
        new Set(snapshot.docs.map((d) => d.id)),
      )
      await refreshLocal()
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
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await localDb.veparis.update(localId, { syncStatus: 'synced' })
    } catch (err) {
      console.error('Vepari save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updateVepari(localId, { name, village, customRates }) {
    const existing = await localDb.veparis.get(localId)
    if (!existing) return
    const payload = {
      name: name.trim(),
      village: village.trim(),
      customRates: customRates || null,
    }
    await localDb.veparis.update(localId, {
      ...payload,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await updateDoc(vepariDocRef(existing.firestoreId), payload)
        await localDb.veparis.update(localId, { syncStatus: 'synced' })
        await refreshLocal()
      } catch (err) {
        console.error('Vepari update queued locally — Firestore sync failed:', err)
      }
    }
  }

  async function deleteVepari(localId) {
    const existing = await localDb.veparis.get(localId)
    if (!existing) return
    await localDb.veparis.delete(localId)
    await refreshLocal()
    if (existing.firestoreId) {
      try {
        await deleteDoc(vepariDocRef(existing.firestoreId))
      } catch (err) {
        console.error('Vepari delete did not reach Firestore yet:', err)
      }
    }
  }

  // Collapse same name+village created on phone and laptop separately.
  const displayVeparis = useMemo(() => dedupeVeparisForDisplay(veparis, []), [veparis])

  return {
    veparis: displayVeparis,
    allVeparis: veparis,
    loading,
    addVepari,
    updateVepari,
    deleteVepari,
  }
}
