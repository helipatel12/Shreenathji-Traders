/** Resolve a display name for who created a record. */
export function resolveCreatedByName(record, currentUser) {
  const stored = String(record?.createdByName || '').trim()
  if (stored) return stored
  const email = String(record?.createdBy || '').trim()
  if (
    email &&
    currentUser?.email &&
    email.toLowerCase() === String(currentUser.email).toLowerCase()
  ) {
    const selfName = String(currentUser.name || '').trim()
    if (selfName) return selfName
  }
  return email || '—'
}
