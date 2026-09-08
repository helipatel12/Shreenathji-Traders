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
    const ar = Number(a.syncRevision) || 0
    const br = Number(b.syncRevision) || 0
    if (ar !== br) return br - ar
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
      // Remote void always wins over a pending edit (H2) — keep other
      // pending field changes, but never ignore a void from another device.
      if (isRecordVoided(remote) && !isRecordVoided(existing)) {
        await table.update(existing.id, {
          isVoided: true,
          voidReason: remote.voidReason || existing.voidReason || '',
          voidedBy: remote.voidedBy || existing.voidedBy || '',
          voidedAt: remote.voidedAt || existing.voidedAt || '',
        })
      }
      const dupes = await table.where('firestoreId').equals(firestoreId).toArray()
      for (const row of dupes) {
        if (row.id !== existing.id && !isPendingLocal(row)) await table.delete(row.id)
      }
      return
    }
    const merged = { ...remote, firestoreId, syncStatus: 'synced' }
    // નોંધ નં. is never auto-renumbered. Prefer cloud when set (includes
    // intentional owner edits). Keep local only when cloud has none.
    // Never clear a set number.
    const localN = Number(existing.entryNumber)
    const remoteN = Number(remote.entryNumber)
    const localOk = Number.isFinite(localN) && localN > 0
    const remoteOk = Number.isFinite(remoteN) && remoteN > 0
    if (remoteOk) {
      merged.entryNumber = remoteN
    } else if (localOk) {
      merged.entryNumber = localN
    }
    // Preserve first-seen local timestamp (M6); remote snapshot wins other fields.
    if (existing.createdAtLocal) {
      merged.createdAtLocal = existing.createdAtLocal
    }
    mergeVoidFlags(existing, remote, merged)
    await table.update(existing.id, merged)
    const dupes = await table.where('firestoreId').equals(firestoreId).toArray()
    for (const row of dupes) {
      if (row.id !== existing.id) await table.delete(row.id)
    }
  } else {
    await table.add({
      ...remote,
      firestoreId,
      syncStatus: 'synced',
      createdAtLocal: remote.createdAtLocal || Date.now(),
    })
  }
}

/**
 * Drop local rows whose remote doc is gone.
 * @param {{ abandonPending?: boolean }} opts
 *   abandonPending — for deletable collections (vepari/silak): drop pending
 *   edits too so flush cannot resurrect a remote delete (C3).
 */
export async function removeMissingSynced(table, remoteIds, { abandonPending = false } = {}) {
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
  if (abandonPending) {
    const pending = await table.where('syncStatus').equals('pending').toArray()
    for (const row of pending) {
      if (row.firestoreId && !remoteIds.has(row.firestoreId)) {
        await table.delete(row.id)
      }
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
    else if (prevPending && rowPending) {
      // Prefer higher revision so a newer pending edit is not dropped (L3).
      const pr = Number(prev.syncRevision) || 0
      const rr = Number(row.syncRevision) || 0
      keep = rr > pr ? row : prev.id <= row.id ? prev : row
    } else if (isRecordVoided(prev) && !isRecordVoided(row)) keep = prev
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
export async function applyCollectionSnapshot(
  table,
  snapshot,
  { generation, isCurrent, mapDoc, abandonPendingIfMissing = false } = {},
) {
  if (!isCurrent()) return
  for (const docSnap of snapshot.docs) {
    if (!isCurrent()) return
    const remote = mapDoc ? mapDoc(docSnap) : { firestoreId: docSnap.id, ...docSnap.data() }
    await upsertByFirestoreId(table, docSnap.id, remote)
  }
  if (!isCurrent()) return
  await removeMissingSynced(table, new Set(snapshot.docs.map((d) => d.id)), {
    abandonPending: abandonPendingIfMissing,
  })
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
