import Dexie from 'dexie'
import { dedupeTableByFirestoreId } from '../utils/syncHelpers'

const LEGACY_COMPANY_ID = import.meta.env.VITE_BUSINESS_ID || 'shreenath-traders'

/** Active Dexie instance — switched per signed-in uid + company (tenant isolation). */
let currentDb = null
let currentUid = null
let currentCompanyId = null

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

  database.version(3).stores({
    veparis: '++id, firestoreId, name, syncStatus',
    bills: '++id, firestoreId, vepariId, date, createdBy, locationId, syncStatus, entryNumber',
    payments: '++id, firestoreId, billId, date, syncStatus',
    vepariPayments: '++id, firestoreId, billId, date, syncStatus',
    silakEntries: '++id, firestoreId, date, side, isManual, syncStatus',
  })

  database.version(4).stores({
    veparis: '++id, firestoreId, name, companyId, syncStatus',
    bills: '++id, firestoreId, vepariId, date, createdBy, locationId, companyId, syncStatus, entryNumber',
    payments: '++id, firestoreId, billId, date, companyId, syncStatus',
    vepariPayments: '++id, firestoreId, billId, date, companyId, syncStatus',
    silakEntries: '++id, firestoreId, date, side, isManual, companyId, syncStatus',
  })
}

function createDb(name) {
  const database = new Dexie(name)
  applySchema(database)
  return database
}

export function localDbName(uid, companyId) {
  const safeUid = String(uid || '').trim()
  const safeCompany = String(companyId || '').trim()
  if (safeCompany && safeCompany !== LEGACY_COMPANY_ID) {
    return `st-${safeCompany}-${safeUid}`
  }
  return `shreenath-traders-${safeUid}`
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'isOpen') return () => Boolean(currentDb?.isOpen?.())
      if (prop === 'currentUid') return currentUid
      if (prop === 'currentCompanyId') return currentCompanyId
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

export function getLocalDbCompanyId() {
  return currentCompanyId
}

export async function openLocalDbForUser(uid, companyId) {
  const safeUid = String(uid || '').trim()
  const safeCompany = String(companyId || '').trim()
  if (!safeUid) throw new Error('openLocalDbForUser requires uid')
  if (!safeCompany) throw new Error('openLocalDbForUser requires companyId')
  if (currentUid === safeUid && currentCompanyId === safeCompany && currentDb?.isOpen()) {
    return currentDb
  }

  if (currentDb) {
    try {
      currentDb.close()
    } catch {
      /* ignore */
    }
    currentDb = null
    currentUid = null
    currentCompanyId = null
  }

  currentUid = safeUid
  currentCompanyId = safeCompany
  currentDb = createDb(localDbName(safeUid, safeCompany))
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
  currentCompanyId = null
}

export default db
