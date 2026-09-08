import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import { allocateEntryNumberRemote, allocateDakhlaNumberRemote, billCollectionRef, billDocRef, paymentDocRef, vepariPaymentDocRef } from '../firebase/firestore'
import { useAuth } from './useAuth'
import { computeBillTotal } from '../utils/calc'
import { diffFields } from '../utils/editHistory'
import { notifyLocalDataChanged } from '../utils/localDataEvents'
import {
  applyCollectionSnapshot,
  dedupeTableByFirestoreId,
  markSyncedIfUnchanged,
  nextSyncRevision,
} from '../utils/syncHelpers'

/** Fields staff/owner may edit freely. Note/dakhla numbers are owner-only. */
const EDITABLE_FIELDS = ['farmerName', 'farmerVillage', 'vepariId', 'date', 'items']
const OWNER_ENTRY_FIELDS = ['entryNumber', 'dakhlaNumber']

/** Serialize rapid addBill calls so they don't mint the same local number (L4). */
let entryNumberChain = Promise.resolve()

function withEntryNumberLock(fn) {
  const run = entryNumberChain.then(fn, fn)
  entryNumberChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function isValidEntryNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

/**
 * Next નોંધ નં. = one past the highest number ever used (including
 * voided). Never fills gaps — sequence stays 1, 2, 3… ascending.
 */
async function nextEntryNumberLocal() {
  return (await maxEntryNumberSeen()) + 1
}

async function maxEntryNumberSeen() {
  const rows = await localDb.bills.toArray()
  let max = 0
  for (const row of rows) {
    if (row.syncStatus === 'pendingDelete') continue
    const n = Number(row.entryNumber)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

async function nextDakhlaNumberLocal() {
  return (await maxDakhlaNumberSeen()) + 1
}

async function maxDakhlaNumberSeen() {
  const rows = await localDb.bills.toArray()
  let max = 0
  for (const row of rows) {
    if (row.syncStatus === 'pendingDelete') continue
    const n = Number(row.dakhlaNumber)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

/**
 * Prefer Firestore counter when online; always ascending (max+1).
 * Never touches numbers already stored on existing bills.
 */
async function allocateEntryNumber() {
  const floor = (await maxEntryNumberSeen()) + 1
  const remote = await allocateEntryNumberRemote(floor)
  let candidate =
    remote != null && Number.isFinite(remote) && remote > 0 ? Math.max(remote, floor) : floor
  while (await isEntryNumberTaken(candidate)) candidate += 1
  return candidate
}

async function allocateDakhlaNumber() {
  const floor = (await maxDakhlaNumberSeen()) + 1
  const remote = await allocateDakhlaNumberRemote(floor)
  let candidate =
    remote != null && Number.isFinite(remote) && remote > 0 ? Math.max(remote, floor) : floor
  while (await isDakhlaNumberTaken(candidate)) candidate += 1
  return candidate
}

/**
 * True if another active bill already uses this note number.
 * Ignores voided and pendingDelete (not shown in the bills list).
 */
async function isEntryNumberTaken(entryNumber, exceptLocalId) {
  const n = Number(entryNumber)
  if (!Number.isFinite(n) || n <= 0) return true
  const exceptId =
    exceptLocalId == null || exceptLocalId === '' ? null : Number(exceptLocalId)
  const rows = await localDb.bills.toArray()
  return rows.some((row) => {
    if (exceptId != null && Number(row.id) === exceptId) return false
    if (row.isVoided || row.syncStatus === 'pendingDelete') return false
    return Number(row.entryNumber) === n
  })
}

/**
 * Fill blank entryNumber only — never reshuffles a number that already exists.
 * Assigns ascending max+1 in creation order (not gap-fill).
 */
async function persistMissingEntryNumbers() {
  const rows = await localDb.bills.toArray()
  let max = 0
  for (const row of rows) {
    if (row.syncStatus === 'pendingDelete') continue
    const n = Number(row.entryNumber)
    if (Number.isFinite(n) && n > 0 && n > max) max = n
  }

  const missing = rows
    .filter(
      (row) =>
        row.syncStatus !== 'pendingDelete' &&
        !isValidEntryNumber(row.entryNumber),
    )
    .sort((a, b) => (a.createdAtLocal || 0) - (b.createdAtLocal || 0))

  for (const row of missing) {
    max += 1
    await localDb.bills.update(row.id, {
      entryNumber: max,
      syncStatus: row.firestoreId ? 'pending' : row.syncStatus,
      syncRevision: nextSyncRevision(row),
    })
  }
}

async function isDakhlaNumberTaken(dakhlaNumber, exceptLocalIds = []) {
  const n = Number(dakhlaNumber)
  if (!Number.isFinite(n) || n <= 0) return true
  const except = new Set(
    (Array.isArray(exceptLocalIds) ? exceptLocalIds : [exceptLocalIds])
      .filter((id) => id != null && id !== '')
      .map((id) => Number(id)),
  )
  const rows = await localDb.bills.toArray()
  return rows.some((row) => {
    if (except.has(Number(row.id))) return false
    if (row.isVoided || row.syncStatus === 'pendingDelete') return false
    return Number(row.dakhlaNumber) === n
  })
}

/** Reuse દાખલા નં. already used for this vepari on this date. */
async function findDakhlaNumberForDay(vepariId, date) {
  if (!vepariId || !date) return null
  const want = String(vepariId)
  const rows = await localDb.bills.toArray()
  for (const row of rows) {
    if (row.isVoided || row.syncStatus === 'pendingDelete') continue
    if (row.date !== date) continue
    if (String(row.vepariId) !== want) continue
    const n = Number(row.dakhlaNumber)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

/**
 * One દાખલા નં. per vepari per day.
 * - Sibling bills on the same day share one number (unify only within day).
 * - New day-groups get max+1 in date order (ascending 1, 2, 3…).
 * Never renumbers a day that already has a number to fill gaps.
 */
async function persistMissingDakhlaNumbers() {
  const rows = await localDb.bills.toArray()
  const active = rows.filter((row) => row.syncStatus !== 'pendingDelete' && !row.isVoided)

  const groups = new Map()
  for (const row of active) {
    if (!row.date || row.vepariId == null || row.vepariId === '') continue
    const key = `${row.date}|${String(row.vepariId)}`
    const list = groups.get(key)
    if (list) list.push(row)
    else groups.set(key, [row])
  }

  const orderedGroups = [...groups.values()].sort((a, b) => {
    if (a[0].date !== b[0].date) return a[0].date < b[0].date ? -1 : 1
    const ta = Math.min(...a.map((r) => r.createdAtLocal || 0))
    const tb = Math.min(...b.map((r) => r.createdAtLocal || 0))
    return ta - tb
  })

  let max = 0
  for (const row of rows) {
    if (row.syncStatus === 'pendingDelete') continue
    const n = Number(row.dakhlaNumber)
    if (Number.isFinite(n) && n > 0 && n > max) max = n
  }

  for (const group of orderedGroups) {
    const numbers = group
      .map((r) => Number(r.dakhlaNumber))
      .filter((n) => Number.isFinite(n) && n > 0)
    let shared = numbers.length ? Math.min(...numbers) : null
    if (shared == null) {
      max += 1
      shared = max
    } else if (shared > max) {
      max = shared
    }
    for (const row of group) {
      if (Number(row.dakhlaNumber) === shared) continue
      await localDb.bills.update(row.id, {
        dakhlaNumber: shared,
        syncStatus: row.firestoreId ? 'pending' : row.syncStatus,
        syncRevision: nextSyncRevision(row),
      })
    }
  }
}

export function useBills() {
  const { isOwner } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const refreshLocal = useCallback(async () => {
    await dedupeTableByFirestoreId(localDb.bills)
    await persistMissingEntryNumbers()
    await persistMissingDakhlaNumbers()
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
    dakhlaNumber: requestedDakhla,
  }) {
    return withEntryNumberLock(async () => {
      let entryNumber = Number(requestedEntry)
      if (!Number.isFinite(entryNumber) || entryNumber <= 0) {
        entryNumber = await allocateEntryNumber()
      } else if (await isEntryNumberTaken(entryNumber)) {
        throw new Error('ENTRY_NUMBER_TAKEN')
      }
      let dakhlaNumber = Number(requestedDakhla)
      if (!Number.isFinite(dakhlaNumber) || dakhlaNumber <= 0) {
        const sameDay = await findDakhlaNumberForDay(vepariId, date)
        dakhlaNumber = sameDay != null ? sameDay : await allocateDakhlaNumber()
      } else if (await isDakhlaNumberTaken(dakhlaNumber)) {
        throw new Error('DAKHLA_NUMBER_TAKEN')
      }
      const createdAtLocal = Date.now()
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
        dakhlaNumber,
        editHistory: [],
      }
      const ref = doc(billCollectionRef())
      const localId = await localDb.bills.add({
        ...payload,
        firestoreId: ref.id,
        createdAtLocal,
        syncStatus: 'pending',
        syncRevision: 1,
      })
      await refreshLocal()
      try {
        await setDoc(ref, { ...payload, createdAt: serverTimestamp(), createdAtLocal })
        await markSyncedIfUnchanged(localDb.bills, localId, 1)
      } catch (err) {
        console.error('Bill save queued locally — Firestore sync failed:', err)
      }
      await refreshLocal()
      return localId
    })
  }

  async function updateBill(localId, changes, editedBy) {
    const existing = await localDb.bills.get(localId)
    if (!existing) return
    if (existing.isVoided) throw new Error('BILL_VOIDED')

    // Default: never touch નોંધ / દાખલા નં. on ordinary bill updates.
    // Owner/admin may change them explicitly (manual only — never automatic).
    const safeChanges = { ...(changes || {}) }
    const requestedEntry = safeChanges.entryNumber
    const requestedDakhla = safeChanges.dakhlaNumber
    delete safeChanges.entryNumber
    delete safeChanges.dakhlaNumber

    let numberPatch = false
    if (isOwner && requestedEntry != null && requestedEntry !== '') {
      const next = Number(requestedEntry)
      if (!Number.isFinite(next) || next <= 0) {
        throw new Error('ENTRY_NUMBER_INVALID')
      }
      if (Number(existing.entryNumber) !== next) {
        if (await isEntryNumberTaken(next, localId)) {
          throw new Error('ENTRY_NUMBER_TAKEN')
        }
        safeChanges.entryNumber = next
        numberPatch = true
      }
    }
    if (isOwner && requestedDakhla != null && requestedDakhla !== '') {
      const next = Number(requestedDakhla)
      if (!Number.isFinite(next) || next <= 0) {
        throw new Error('DAKHLA_NUMBER_INVALID')
      }
      if (Number(existing.dakhlaNumber) !== next) {
        // One dakhla number per vepari per day — update every bill in the group.
        const siblings = (await localDb.bills.toArray()).filter(
          (row) =>
            !row.isVoided &&
            row.syncStatus !== 'pendingDelete' &&
            row.date === existing.date &&
            String(row.vepariId) === String(existing.vepariId),
        )
        const siblingIds = siblings.map((r) => r.id)
        if (await isDakhlaNumberTaken(next, siblingIds)) {
          throw new Error('DAKHLA_NUMBER_TAKEN')
        }
        for (const sibling of siblings) {
          if (Number(sibling.dakhlaNumber) === next) continue
          const historyEntry = {
            field: 'dakhlaNumber',
            oldValue: sibling.dakhlaNumber ?? null,
            newValue: next,
            editedBy,
            editedAt: new Date().toISOString(),
          }
          const syncRevision = nextSyncRevision(sibling)
          const patch = {
            dakhlaNumber: next,
            editHistory: [...(sibling.editHistory || []), historyEntry],
          }
          await localDb.bills.update(sibling.id, {
            ...patch,
            syncRevision,
            syncStatus: sibling.firestoreId ? 'pending' : sibling.syncStatus,
          })
          if (sibling.firestoreId) {
            try {
              await updateDoc(billDocRef(sibling.firestoreId), patch)
              await markSyncedIfUnchanged(localDb.bills, sibling.id, syncRevision)
            } catch (err) {
              console.error('Dakhla number day-sync queued locally:', err)
            }
          }
        }
        await refreshLocal()
        // Already applied to this bill via the sibling loop; skip normal path for dakhla.
        if (Object.keys(safeChanges).length === 0) return
        // Continue for any other non-number field changes still in safeChanges
      }
    }

    const historyFields = numberPatch
      ? [...EDITABLE_FIELDS, ...OWNER_ENTRY_FIELDS]
      : EDITABLE_FIELDS

    const newValues = { ...existing, ...safeChanges }
    if (safeChanges.items) {
      newValues.totalAmount = computeBillTotal(safeChanges.items)
    }
    const newHistoryEntries = diffFields(existing, newValues, historyFields, editedBy)
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
      notifyLocalDataChanged('payments')

      const relatedVepari = await localDb.vepariPayments
        .where('billId')
        .equals(existing.firestoreId)
        .toArray()
      for (const payment of relatedVepari) {
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
        await localDb.vepariPayments.update(payment.id, {
          ...payChanges,
          syncRevision: payRev,
          syncStatus: payment.firestoreId ? 'pending' : payment.syncStatus,
        })
        if (payment.firestoreId) {
          try {
            await updateDoc(vepariPaymentDocRef(payment.firestoreId), payChanges)
            await markSyncedIfUnchanged(localDb.vepariPayments, payment.id, payRev)
          } catch (err) {
            console.error('Vepari payment void (cascade from bill) queued locally:', err)
          }
        }
      }
      notifyLocalDataChanged('vepariPayments')
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
