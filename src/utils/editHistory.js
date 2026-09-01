// Shared "diff and append" helper for architecture.md §5a's edit
// history pattern: bills and payments are directly editable, but
// every edit appends to the record's editHistory array (field,
// oldValue, newValue, who, when) instead of silently overwriting.
// First used by Phase 4 (bills); Phase 6 reuses this same function
// for payments rather than reimplementing the diff logic — "works the
// same way" per architecture.md §5a.

// Compares oldValues to newValues field-by-field for the given field
// list and returns editHistory entries for anything that changed.
// Values are compared with JSON.stringify so this works for both
// scalars (a farmer's name) and structured fields (a bill's items
// array, compared as a whole rather than line-by-line — see
// memory.md's decisions log for why item-level diffing was out of
// scope for Phase 4).
export function diffFields(oldValues, newValues, fields, editedBy) {
  const entries = []
  const editedAt = new Date().toISOString()
  for (const field of fields) {
    const oldValue = oldValues[field]
    const newValue = newValues[field]
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      entries.push({ field, oldValue: oldValue ?? null, newValue: newValue ?? null, editedBy, editedAt })
    }
  }
  return entries
}
