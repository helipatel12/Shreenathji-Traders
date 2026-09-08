import Dexie from 'dexie'
import { dedupeTableByFirestoreId } from '../utils/syncHelpers'

/** Active Dexie instance — switched per signed-in uid (C2). */
let currentDb = null
let currentUid = null

function applySchema(database) {
  database.version(1).stores({
    veparis: '++id, firestoreId, name, syncStatus',
    bills: '++id, firestoreId, vepariId, date, createdBy, locationId, syncStatus',
    payments: '++id, firestoreId, billId, date, syncStatus',
    silakEntries: '++id, firestoreId, date, side, isManual, syncStatus',
  })

  database
    .version(2)
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

  // Vepari settlement payments (mirror of farmer `payments` / Rojmer).
  database.version(3).stores({
    veparis: '++id, firestoreId, name, syncStatus',
    bills: '++id, firestoreId, vepariId, date, createdBy, locationId, syncStatus, entryNumber',
    payments: '++id, firestoreId, billId, date, syncStatus',
    vepariPayments: '++id, firestoreId, billId, date, syncStatus',
    silakEntries: '++id, firestoreId, date, side, isManual, syncStatus',
  })
}

function createDb(name) {
  const database = new Dexie(name)
  applySchema(database)
  return database
}

/**
 * Proxy so existing `import { db }` / `localDb.bills` keeps working once a
 * user DB is open. Throws if accessed before openLocalDbForUser().
 */
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'isOpen') return () => Boolean(currentDb?.isOpen?.())
      if (prop === 'currentUid') return currentUid
      if (!currentDb) {
        throw new Error('Local DB is not open — sign in first')
      }
      const value = currentDb[prop]
      return typeof value === 'function' ? value.bind(currentDb) : value
    },
  },
)

export function getLocalDbUid() {
  return currentUid
}

export async function openLocalDbForUser(uid) {
  const safeUid = String(uid || '').trim()
  if (!safeUid) throw new Error('openLocalDbForUser requires uid')
  if (currentUid === safeUid && currentDb?.isOpen()) return currentDb

  if (currentDb) {
    try {
      currentDb.close()
    } catch {
      /* ignore */
    }
    currentDb = null
    currentUid = null
  }

  currentUid = safeUid
  currentDb = createDb(`shreenath-traders-${safeUid}`)
  await currentDb.open()
  return currentDb
}

export async function closeLocalDb() {
  if (currentDb) {
    try {
      currentDb.close()
    } catch {
      /* ignore */
    }
  }
  currentDb = null
  currentUid = null
}

export default db
