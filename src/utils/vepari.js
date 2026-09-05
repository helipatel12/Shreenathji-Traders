// Stable vepari identity across devices.
// Dexie `id` is a local auto-increment — never store it on bills.
// Always prefer Firestore document id (`firestoreId`).

export function vepariStableId(vepari) {
  if (!vepari) return ''
  if (vepari.firestoreId) return String(vepari.firestoreId)
  if (vepari.id != null) return String(vepari.id)
  return ''
}

export function findVepari(veparis, vepariId) {
  if (vepariId == null || vepariId === '') return null
  const id = String(vepariId)
  return (
    veparis.find(
      (v) =>
        (v.firestoreId && String(v.firestoreId) === id) || String(v.id) === id,
    ) ?? null
  )
}

export function vepariDisplayName(veparis, vepariId) {
  return findVepari(veparis, vepariId)?.name ?? '—'
}
