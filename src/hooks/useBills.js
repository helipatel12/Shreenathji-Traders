import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { billCollectionRef, billDocRef, paymentDocRef } from '../firebase/firestore'
import { computeBillTotal } from '../utils/calc'
import { diffFields } from '../utils/editHistory'
import {
  applyCollectionSnapshot,
  dedupeTableByFirestoreId,
  markSyncedIfUnchanged,
  nextSyncRevision,
} from '../utils/syncHelpers'

const EDITABLE_FIELDS = ['entryNumber', 'farmerName', 'farmerVillage', 'vepariId', 'date', 'items']

/**
 * Next નોંધ નં. = max(all local numbers including voided) + 1.
 * Voided numbers stay reserved so offline devices are less likely to
 * collide by reusing a freed slot.
 */
async function nextEntryNumber() {
  const rows = await localDb.bills.toArray()
  let max = 0
  for (const row of rows) {
    const n = Number(row.entryNumber)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

/** True if any bill (including voided) already uses this note number. */
async function isEntryNumberTaken(entryNumber, exceptLocalId) {
  const n = Number(entryNumber)
  if (!Number.isFinite(n) || n <= 0) return true
  const rows = await localDb.bills.toArray()
  return rows.some((row) => row.id !== exceptLocalId && Number(row.entryNumber) === n)
}

/** After multi-device sync, renumber later duplicates so નોંધ નં. stays unique. */
async function resolveEntryNumberCollisions() {
  const rows = (await localDb.bills.toArray()).filter(
    (r) => r.syncStatus !== 'pendingDelete',
  )
  const byNum = new Map()
  for (const row of rows) {
    const n = Number(row.entryNumber)
    if (!Number.isFinite(n) || n <= 0) continue
    if (!byNum.has(n)) byNum.set(n, [])
    byNum.get(n).push(row)
  }
  for (const group of byNum.values()) {
    if (group.length < 2) continue
    group.sort((a, b) => (a.createdAtLocal || 0) - (b.createdAtLocal || 0))
    for (let i = 1; i < group.length; i++) {
      const row = group[i]
      const next = await nextEntryNumber()
      await localDb.bills.update(row.id, {
        entryNumber: next,
        syncStatus: row.firestoreId ? 'pending' : row.syncStatus,
        syncRevision: nextSyncRevision(row),
      })
    }
  }
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
    .filter(
      (row) =>
        row.syncStatus !== 'pendingDelete' &&
        (row.entryNumber == null || row.entryNumber === ''),
    )
    .sort((a, b) => (a.createdAtLocal || 0) - (b.createdAtLocal || 0))

  for (const row of missing) {
    let n = 1
    while (used.has(n)) n += 1
    used.add(n)
    await localDb.bills.update(row.id, {
      entryNumber: n,
      syncStatus: row.firestoreId ? 'pending' : row.syncStatus,
      syncRevision: nextSyncRevision(row),
    })
  }
}

export function useBills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.bills)
    await persistMissingEntryNumbers()
    await resolveEntryNumberCollisions()
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
    let generation = 0
    const unsubscribe = onSnapshot(billCollectionRef(), async (snapshot) => {
      const gen = ++generation
      const isCurrent = () => !cancelled && gen === generation
      await applyCollectionSnapshot(localDb.bills, snapshot, {
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

  async function addBill({
    farmerName,
    farmerVillage,
    vepariId,
    date,
    items,
    createdBy,
    locationId,
    entryNumber: requestedEntry,
  }) {
    let entryNumber = Number(requestedEntry)
    if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
      entryNumber = await nextEntryNumber()
    } else if (await isEntryNumberTaken(entryNumber)) {
      throw new Error('ENTRY_NUMBER_TAKEN')
    }
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
      syncRevision: 1,
    })
    await refreshLocal()
    try {
      await setDoc(ref, { ...payload, createdAt: serverTimestamp() })
      await markSyncedIfUnchanged(localDb.bills, localId, 1)
    } catch (err) {
      console.error('Bill save queued locally — Firestore sync failed:', err)
    }
    await refreshLocal()
    return localId
  }

  async function updateBill(localId, changes, editedBy) {
    const existing = await localDb.bills.get(localId)
    if (!existing) return

    const safeChanges = { ...(changes || {}) }
    if (safeChanges.entryNumber != null && safeChanges.entryNumber !== '') {
      const next = Number(safeChanges.entryNumber)
      if (!Number.isFinite(next) || next <= 0) {
        throw new Error('ENTRY_NUMBER_INVALID')
      }
      if (await isEntryNumberTaken(next, localId)) {
        throw new Error('ENTRY_NUMBER_TAKEN')
      }
      safeChanges.entryNumber = next
    } else {
      delete safeChanges.entryNumber
    }

    const newValues = { ...existing, ...safeChanges }
    if (safeChanges.items) {
      newValues.totalAmount = computeBillTotal(safeChanges.items)
    }
    const newHistoryEntries = diffFields(existing, newValues, EDITABLE_FIELDS, editedBy)
    const editHistory = [...(existing.editHistory || []), ...newHistoryEntries]
    const syncRevision = nextSyncRevision(existing)

    const localUpdate = {
      ...safeChanges,
      totalAmount: newValues.totalAmount,
      editHistory,
    }
    await localDb.bills.update(localId, {
      ...localUpdate,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })
    await refreshLocal()

    if (existing.firestoreId) {
      try {
        await updateDoc(billDocRef(existing.firestoreId), localUpdate)
        await markSyncedIfUnchanged(localDb.bills, localId, syncRevision)
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
    const syncRevision = nextSyncRevision(existing)
    const changes = {
      isVoided: true,
      voidReason: reason || '',
      voidedBy,
      voidedAt,
      editHistory: [...(existing.editHistory || []), historyEntry],
    }

    await localDb.bills.update(localId, {
      ...changes,
      syncRevision,
      syncStatus: existing.firestoreId ? 'pending' : existing.syncStatus,
    })

    // Cascade: payments on this bill must leave silak/rojmer/dashboard too.
    if (existing.firestoreId) {
      const related = await localDb.payments
        .where('billId')
        .equals(existing.firestoreId)
        .toArray()
      for (const payment of related) {
        if (payment.isVoided) continue
        const payRev = nextSyncRevision(payment)
        const payHistory = {
          field: 'isVoided',
          oldValue: false,
          newValue: true,
          editedBy: voidedBy,
          editedAt: voidedAt,
        }
        const payChanges = {
          isVoided: true,
          voidReason: reason || 'Bill voided',
          voidedBy,
          voidedAt,
          editHistory: [...(payment.editHistory || []), payHistory],
        }
        await localDb.payments.update(payment.id, {
          ...payChanges,
          syncRevision: payRev,
          syncStatus: payment.firestoreId ? 'pending' : payment.syncStatus,
        })
        if (payment.firestoreId) {
          try {
            await updateDoc(paymentDocRef(payment.firestoreId), payChanges)
            await markSyncedIfUnchanged(localDb.payments, payment.id, payRev)
          } catch (err) {
            console.error('Payment void (cascade from bill) queued locally:', err)
          }
        }
      }
    }

    await refreshLocal()

    if (existing.firestoreId) {
      try {
        await updateDoc(billDocRef(existing.firestoreId), changes)
        await markSyncedIfUnchanged(localDb.bills, localId, syncRevision)
        await refreshLocal()
      } catch (err) {
        console.error('Bill void queued locally — Firestore sync failed:', err)
      }
    }
  }

  return { bills, loading, addBill, updateBill, voidBill }
}
