// Active company (tenant) for this tab. Collection helpers in
// firestore.js read this so existing hooks stay path-scoped without
// threading companyId through every call.

let activeCompanyId = null

export function getActiveCompanyId() {
  return activeCompanyId
}

export function setActiveCompanyId(id) {
  const next = String(id || '').trim()
  activeCompanyId = next || null
  return activeCompanyId
}

export function clearActiveCompany() {
  activeCompanyId = null
}

export function requireCompanyId(companyId) {
  const id = String(companyId || activeCompanyId || '').trim()
  if (!id) {
    const err = new Error('No company selected')
    err.code = 'no-company'
    throw err
  }
  return id
}
