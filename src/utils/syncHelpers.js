// Shared Dexie ↔ Firestore reconcile helpers — prevents phone+laptop
// duplicate rows when the same firestoreId already exists locally.

import { isRecordVoided } from './calc'

/** Local edits waiting to push — never overwrite these with a remote snapshot. */
export function isPendingLocal(row) {
  return row?.syncStatus === 'pending' || row?.syncStatus === 'pendingDelete'
}

/** Bump local revision so flush/hooks only mark synced if nothing newer landed. */
export function nextSyncRevision(row) {
  return (Number(row?.syncRevision) || 0) + 1
}

export async function markSyncedIfUnchanged(table, rowId, flushedRevision) {
  const fresh = await table.get(rowId)
  if (!fresh) return
  if (fresh.syncStatus !== 'pending') return
  if ((Number(fresh.syncRevision) || 0) !== (Number(flushedRevision) || 0)) return
  await table.update(rowId, { syncStatus: 'synced' })
}

/** Pick the best local row for a firestoreId (pending → voided → lowest id). */
async function findPreferredLocal(table, firestoreId) {
  const matches = await table.where('firestoreId').equals(firestoreId).toArray()
  if (!matches.length) return null
  matches.sort((a, b) => {
    const ap = isPendingLocal(a) ? 0 : 1
    const bp = isPendingLocal(b) ? 0 : 1
    if (ap !== bp) return ap - bp
    const av = isRecordVoided(a) ? 0 : 1
    const bv = isRecordVoided(b) ? 0 : 1
    if (av !== bv) return av - bv
    return (a.id || 0) - (b.id || 0)
  })
  return matches[0]
}

function mergeVoidFlags(existing, remote, merged) {
  // Once voided, a stale snapshot must not resurrect the row into silak/totals.
  if (isRecordVoided(existing) || isRecordVoided(remote)) {
    merged.isVoided = true
    if (!merged.voidReason && (existing.voidReason || remote.voidReason)) {
      merged.voidReason = remote.voidReason || existing.voidReason || ''
    }
    if (!merged.voidedBy && (existing.voidedBy || remote.voidedBy)) {
      merged.voidedBy = remote.voidedBy || existing.voidedBy || ''
    }
    if (!merged.voidedAt && (existing.voidedAt || remote.voidedAt)) {
      merged.voidedAt = remote.voidedAt || existing.voidedAt || ''
    }
  }
}

export async function upsertByFirestoreId(table, firestoreId, remote) {
  if (!firestoreId) return
  const existing = await findPreferredLocal(table, firestoreId)
  if (existing) {
    if (isPendingLocal(existing)) {
      const dupes = await table.where('firestoreId').equals(firestoreId).toArray()
      for (const row of dupes) {
        if (row.id !== existing.id && !isPendingLocal(row)) await table.delete(row.id)
      }
      return
    }
    const merged = { ...remote, firestoreId, syncStatus: 'synced' }
    if (
      (merged.entryNumber == null || merged.entryNumber === '') &&
      existing.entryNumber != null &&
      existing.entryNumber !== ''
    ) {
      merged.entryNumber = existing.entryNumber
    }
    if (
      Array.isArray(existing.editHistory) &&
      existing.editHistory.length > (merged.editHistory?.length || 0)
    ) {
      merged.editHistory = existing.editHistory
    }
    mergeVoidFlags(existing, remote, merged)
    await table.update(existing.id, merged)
    const dupes = await table.where('firestoreId').equals(firestoreId).toArray()
    for (const row of dupes) {
      if (row.id !== existing.id) await table.delete(row.id)
    }
  } else {
    await table.add({ ...remote, firestoreId, syncStatus: 'synced' })
  }
}

export async function removeMissingSynced(table, remoteIds) {
  const syncedRows = await table.where('syncStatus').equals('synced').toArray()
  for (const row of syncedRows) {
    if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
      await table.delete(row.id)
    }
  }
  const pendingDeletes = await table.where('syncStatus').equals('pendingDelete').toArray()
  for (const row of pendingDeletes) {
    if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
      await table.delete(row.id)
    }
  }
}

/** Drop local duplicates that share firestoreId (keeps pending over synced, voided over active). */
export async function dedupeTableByFirestoreId(table) {
  const rows = await table.toArray()
  const seen = new Map()
  for (const row of rows) {
    if (!row.firestoreId) continue
    const prev = seen.get(row.firestoreId)
    if (!prev) {
      seen.set(row.firestoreId, row)
      continue
    }
    const prevPending = isPendingLocal(prev)
    const rowPending = isPendingLocal(row)
    let keep
    if (prevPending && !rowPending) keep = prev
    else if (rowPending && !prevPending) keep = row
    else if (isRecordVoided(prev) && !isRecordVoided(row)) keep = prev
    else if (isRecordVoided(row) && !isRecordVoided(prev)) keep = row
    else keep = prev.id <= row.id ? prev : row
    const drop = keep.id === prev.id ? row : prev
    seen.set(row.firestoreId, keep)
    await table.delete(drop.id)
  }
}

/**
 * Apply a Firestore collection snapshot with a generation token so a
 * stale in-flight handler cannot resurrect rows after a newer snapshot
 * or unmount.
 */
export async function applyCollectionSnapshot(table, snapshot, { generation, isCurrent, mapDoc }) {
  if (!isCurrent()) return
  for (const docSnap of snapshot.docs) {
    if (!isCurrent()) return
    const remote = mapDoc ? mapDoc(docSnap) : { firestoreId: docSnap.id, ...docSnap.data() }
    await upsertByFirestoreId(table, docSnap.id, remote)
  }
  if (!isCurrent()) return
  await removeMissingSynced(table, new Set(snapshot.docs.map((d) => d.id)))
  if (!isCurrent()) return
  await dedupeTableByFirestoreId(table)
  return generation
}

export function dedupeVeparisForDisplay(veparis, bills = []) {
  const referenced = new Set(bills.map((b) => String(b.vepariId)).filter(Boolean))
  const groups = new Map()
  for (const v of veparis) {
    if (v.syncStatus === 'pendingDelete') continue
    const key = `${(v.name || '').trim().toLowerCase()}|${(v.village || '').trim().toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(v)
  }
  const result = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }
    const preferred =
      group.find((v) => referenced.has(String(v.firestoreId)) || referenced.has(String(v.id))) ||
      group.slice().sort((a, b) => (a.createdAtLocal || 0) - (b.createdAtLocal || 0))[0]
    result.push(preferred)
  }
  return result
}
