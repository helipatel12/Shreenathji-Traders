import Dexie from 'dexie'
import { dedupeTableByFirestoreId } from '../utils/syncHelpers'

export const db = new Dexie('shreenath-traders')

db.version(1).stores({
  veparis: '++id, firestoreId, name, syncStatus',
  bills: '++id, firestoreId, vepariId, date, createdBy, locationId, syncStatus',
  payments: '++id, firestoreId, billId, date, syncStatus',
  silakEntries: '++id, firestoreId, date, side, isManual, syncStatus',
})

db.version(2)
  .stores({
    veparis: '++id, firestoreId, name, syncStatus',
    bills: '++id, firestoreId, vepariId, date, createdBy, locationId, syncStatus, entryNumber',
    payments: '++id, firestoreId, billId, date, syncStatus',
    silakEntries: '++id, firestoreId, date, side, isManual, syncStatus',
  })
  .upgrade(async (tx) => {
    await dedupeTableByFirestoreId(tx.table('veparis'))
    await dedupeTableByFirestoreId(tx.table('bills'))
    await dedupeTableByFirestoreId(tx.table('payments'))
    await dedupeTableByFirestoreId(tx.table('silakEntries'))
  })

export default db
