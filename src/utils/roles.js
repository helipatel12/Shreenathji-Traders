// Platform + company roles. `owner` is the legacy company-admin value
// still present on existing Shreenathji Traders user docs.

export const ROLES = {
  MASTER_ADMIN: 'master_admin',
  COMPANY_ADMIN: 'company_admin',
  OWNER: 'owner',
  STAFF: 'staff',
  CA: 'ca',
}

export const COMPANY_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
}

export function isMasterAdminRole(role) {
  return role === ROLES.MASTER_ADMIN
}

export function isCompanyAdminRole(role) {
  return role === ROLES.COMPANY_ADMIN || role === ROLES.OWNER
}

export function isStaffRole(role) {
  return role === ROLES.STAFF
}

export function isCaRole(role) {
  return role === ROLES.CA
}

export function canWriteLedger(role, { isMasterAdmin = false, inCompany = false } = {}) {
  if (isMasterAdmin && inCompany) return true
  return isCompanyAdminRole(role) || isStaffRole(role)
}

export function displayRoleKey(role) {
  if (role === ROLES.OWNER) return ROLES.COMPANY_ADMIN
  return role || ''
}

export function isAdminRole(role) {
  return isMasterAdminRole(role) || isCompanyAdminRole(role)
}
