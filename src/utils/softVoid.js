// Soft-void for financial rows (bills/payments). Hard delete is unreliable
// when production rules still block deleteDoc; void via update always works
// for owners (firestore.rules isVoidingUnchanged / isOwner).

import { updateDoc } from 'firebase/firestore'
import { markSyncedIfUnchanged, nextSyncRevision } from './syncHelpers'

export function buildVoidPatch(voidedBy, reason = 'deleted') {
  return {
    isVoided: true,
    voidReason: reason,
    voidedBy: voidedBy || null,
    voidedAt: new Date().toISOString(),
  }
}

/**
 * Soft-void a Dexie row and push to Firestore. Converts stuck pendingDelete
 * tombstones into voids so they leave working lists.
 */
export async function softVoidLocalRow(table, row, docRefFn, voidedBy, reason = 'deleted') {
  if (!row) return
  if (row.isVoided && row.syncStatus !== 'pendingDelete') return

  if (!row.firestoreId) {
    await table.delete(row.id)
    return
  }

  const voidPatch = buildVoidPatch(voidedBy, reason)
  const syncRevision = nextSyncRevision(row)
  await table.update(row.id, {
    ...voidPatch,
    syncRevision,
    syncStatus: 'pending',
  })
  try {
    await updateDoc(docRefFn(row.firestoreId), voidPatch)
    await markSyncedIfUnchanged(table, row.id, syncRevision)
  } catch (err) {
    console.error('Soft-void queued locally — Firestore sync failed:', err)
  }
}
