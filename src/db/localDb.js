// Local-first store (IndexedDB via Dexie) — architecture.md §1, §2.
//
// Mirrors the Firestore collections in architecture.md §4 so every
// screen can read/write locally first (rules.md §5) and the sync
// engine (src/sync/syncEngine.js) reconciles with Firestore in the
// background. Table shapes intentionally match the Firestore documents
// field-for-field to keep the sync layer a straight mapping, not a
// translation layer.
//
// Do not add a table/field here without also updating architecture.md
// §4 (rules.md §6 — the data model is the contract).

import Dexie from 'dexie'

export const db = new Dexie('shreenath-traders')

db.version(1).stores({
  // '++id' = local auto-increment key used only inside IndexedDB;
  // 'firestoreId' is the canonical id once synced, 'syncStatus' drives
  // the outbound queue ('pending' | 'synced' | 'error').
  veparis: '++id, firestoreId, name, syncStatus',
  bills: '++id, firestoreId, vepariId, date, createdBy, locationId, syncStatus',
  payments: '++id, firestoreId, billId, date, syncStatus',
  silakEntries: '++id, firestoreId, date, side, isManual, syncStatus',
})

export default db
