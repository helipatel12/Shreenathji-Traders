// Shared Dexie ↔ Firestore reconcile helpers — prevents phone+laptop
// duplicate rows when the same firestoreId already exists locally.

export async function upsertByFirestoreId(table, firestoreId, remote) {
  if (!firestoreId) return
  const existing = await table.where('firestoreId').equals(firestoreId).first()
  if (existing) {
    const merged = { ...remote, firestoreId, syncStatus: 'synced' }
    // Never wipe a permanent note number when remote omits it.
    if (
      (merged.entryNumber == null || merged.entryNumber === '') &&
      existing.entryNumber != null &&
      existing.entryNumber !== ''
    ) {
      merged.entryNumber = existing.entryNumber
    }
    await table.update(existing.id, merged)
    // Collapse any accidental duplicate rows with the same firestoreId.
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
}

/** Drop local duplicates that share firestoreId (keeps lowest local id). */
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
    // Prefer synced over pending; else keep earlier id.
    const keep =
      prev.syncStatus === 'synced' && row.syncStatus !== 'synced'
        ? prev
        : row.syncStatus === 'synced' && prev.syncStatus !== 'synced'
          ? row
          : prev.id <= row.id
            ? prev
            : row
    const drop = keep.id === prev.id ? row : prev
    seen.set(row.firestoreId, keep)
    await table.delete(drop.id)
  }
}

/**
 * Veparis created separately on phone + laptop with the same name/village
 * become two Firestore docs. Collapse locally for display by preferring
 * the row that bills already reference, else the oldest.
 */
export function dedupeVeparisForDisplay(veparis, bills = []) {
  const referenced = new Set(bills.map((b) => String(b.vepariId)).filter(Boolean))
  const groups = new Map()
  for (const v of veparis) {
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
