// Central offline flush — retries Dexie rows with syncStatus pending /
// pendingDelete when the browser is online. Feature hooks still do
// Dexie-first writes; this file drains the queue after failures.

import { setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db as localDb } from '../db/localDb'
import {
  billDocRef,
  paymentDocRef,
  vepariPaymentDocRef,
  vepariDocRef,
  silakEntryDocRef,
} from '../firebase/firestore'
import { markSyncedIfUnchanged } from '../utils/syncHelpers'
import { buildVoidPatch } from '../utils/softVoid'

let flushing = false
let flushAgain = false
let started = false

function stripLocalOnly(row) {
  const { id, firestoreId, syncStatus, syncRevision, createdAt, ...payload } = row
  return {
    payload,
    createdAtLocal: row.createdAtLocal,
    editHistory: row.editHistory,
  }
}

/**
 * @param {{ allowDelete?: boolean, softVoidDeletes?: boolean }} opts
 *   softVoidDeletes — financial rows: convert pendingDelete → isVoided update
 *   (works when production still blocks deleteDoc).
 */
async function flushTable(table, docRefFor, { allowDelete = false, softVoidDeletes = false } = {}) {
  const pending = await table.where('syncStatus').anyOf(['pending', 'pendingDelete']).toArray()
  for (const row of pending) {
    if (!row.firestoreId) continue
    const ref = docRefFor(row.firestoreId)
    try {
      if (row.syncStatus === 'pendingDelete') {
        if (softVoidDeletes) {
          const voidPatch = buildVoidPatch(row.voidedBy, row.voidReason || 'deleted')
          await updateDoc(ref, voidPatch)
          await table.update(row.id, {
            ...voidPatch,
            syncStatus: 'synced',
          })
          continue
        }
        if (!allowDelete) continue
        await deleteDoc(ref)
        // Leave tombstone; removeMissingSynced clears it when remote is gone.
        continue
      }
      const flushedRevision = Number(row.syncRevision) || 0
      const { payload, createdAtLocal, editHistory } = stripLocalOnly(row)
      const data = { ...payload }
      if (editHistory) data.editHistory = editHistory
      delete data.createdAt

      try {
        await updateDoc(ref, data)
      } catch (err) {
        if (err?.code === 'not-found' || /not.?found|No document/i.test(String(err?.message || ''))) {
          if (allowDelete && !softVoidDeletes) {
            // Remote was deleted — do not resurrect (C3). Drop local pending.
            await table.delete(row.id)
            continue
          }
          await setDoc(ref, {
            ...data,
            createdAt: serverTimestamp(),
            ...(createdAtLocal ? { createdAtLocal } : {}),
          })
        } else {
          throw err
        }
      }
      await markSyncedIfUnchanged(table, row.id, flushedRevision)
    } catch (err) {
      console.error('Offline flush failed for', table.name, row.firestoreId, err)
    }
  }
}

export async function flushPendingWrites() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { skipped: 'offline' }
  }
  if (!localDb.isOpen()) {
    return { skipped: 'db-closed' }
  }
  if (flushing) {
    flushAgain = true
    return { skipped: 'busy' }
  }
  flushing = true
  try {
    do {
      flushAgain = false
      await flushTable(localDb.bills, billDocRef, { softVoidDeletes: true })
      await flushTable(localDb.payments, paymentDocRef, { softVoidDeletes: true })
      await flushTable(localDb.vepariPayments, vepariPaymentDocRef, { softVoidDeletes: true })
      await flushTable(localDb.veparis, vepariDocRef, { allowDelete: true })
      await flushTable(localDb.silakEntries, silakEntryDocRef, { allowDelete: true })
    } while (flushAgain)
    return { ok: true }
  } finally {
    flushing = false
  }
}

/** Call once from the signed-in app shell. */
export function startOfflineFlushListeners() {
  if (started || typeof window === 'undefined') return () => {}
  started = true
  const onOnline = () => {
    flushPendingWrites()
  }
  window.addEventListener('online', onOnline)
  flushPendingWrites()
  return () => {
    window.removeEventListener('online', onOnline)
    started = false
  }
}
