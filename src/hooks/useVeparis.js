// Vepari master list (Phase 3) — add/edit/delete, with the list read
// live via a dropdown-ready hook. Needed before bill entry (Phase 4),
// since bill entry references this list (phases.md).
//
// Local-first per rules.md §5: every mutation writes to Dexie
// immediately (so the screen works with zero network calls), then
// attempts the matching Firestore write in the background. A vepari's
// name/village/rates aren't append-only financial events the way
// bills/payments are (architecture.md §7) — there's no running
// balance to protect — so simple last-write-wins sync is fine here;
// this doesn't need the same append-only/derived-totals treatment
// Phase 4+ will require for money records.
//
// Scope note: this hook contains its own small sync logic rather than
// routing through src/sync/syncEngine.js, which stays a stub for now.
// The real, harder version of offline sync — conflict-safe, queued,
// retried in the background — is proven out in Phase 4 (bill entry)
// per phases.md's build-order note. If similar patterns repeat across
// phases, worth revisiting whether this belongs in the shared engine.

import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { vepariCollectionRef, vepariDocRef } from '../firebase/firestore'

export function useVeparis() {
  const [veparis, setVeparis] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    const rows = await localDb.veparis.toArray()
    rows.sort((a, b) => a.name.localeCompare(b.name))
    setVeparis(rows)
  }, [])

  // Read local first (rules.md §5) — works with zero network calls.
  useEffect(() => {
    refreshLocal().then(() => setLoading(false))
  }, [refreshLocal])

  // Reconcile with Firestore in the background.
  useEffect(() => {
    const unsubscribe = onSnapshot(vepariCollectionRef(), async (snapshot) => {
      for (const docSnap of snapshot.docs) {
        const remote = { firestoreId: docSnap.id, ...docSnap.data(), syncStatus: 'synced' }
        const existing = await localDb.veparis.where('firestoreId').equals(docSnap.id).first()
        if (existing) {
          await localDb.veparis.update(existing.id, remote)
        } else {
          await localDb.veparis.add(remote)
        }
      }
      // Drop local rows that were synced but no longer exist remotely
      // (deleted from another device). Rows still 'pending' (created
      // offline, not yet pushed) are left alone regardless.
      const remoteIds = new Set(snapshot.docs.map((d) => d.id))
      const syncedRows = await localDb.veparis.where('syncStatus').equals('synced').toArray()
      for (const row of syncedRows) {
        if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
          await localDb.veparis.delete(row.id)
        }
      }
      await refreshLocal()
    })
    return unsubscribe
  }, [refreshLocal])

  async function addVepari({ name, village, customRates }) {
    const payload = {
      name: name.trim(),
      village: village.trim(),
      customRates: customRates || null,
    }
    // Generate the Firestore doc ID up front and store it on the local
    // row immediately (before the write even starts) — not after
    // success. Firestore's local cache echoes writes back through
    // onSnapshot almost instantly, sometimes before this function's
    // own success handler runs; if the local row didn't have
    // firestoreId set yet at that moment, the listener's lookup would
    // miss it and insert a duplicate row instead of matching this one.
    const ref = doc(vepariCollectionRef())
    const localId = await localDb.veparis.add({
      ...payload,
      firestoreId: ref.id,
      syncStatus: 'pending',
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await localDb.veparis.update(localId, { syncStatus: 'synced' })
    } catch (err) {
      // Never throw the user's entry away on a failed write (rules.md
      // §4) — it stays in Dexie as 'pending' and will reconcile once
      // the onSnapshot listener above is reachable again.
      console.error('Vepari save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
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
        // The local copy is already gone (rules.md §5 favors an
        // immediately-usable UI); if this Firestore delete fails
        // offline, the next onSnapshot pull will simply re-add it
        // locally, which is an acceptable, visible edge case here —
        // unlike money records, a reappearing vepari is easy to spot
        // and just delete again, not a silent financial error.
        console.error('Vepari delete did not reach Firestore yet:', err)
      }
    }
  }

  return { veparis, loading, addVepari, updateVepari, deleteVepari }
}
