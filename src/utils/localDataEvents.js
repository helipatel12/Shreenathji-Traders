// Cross-hook refresh when one feature mutates another table in Dexie
// (e.g. bill void cascading payment voids).

const listeners = new Set()

export function notifyLocalDataChanged(table) {
  for (const fn of listeners) {
    try {
      fn(table)
    } catch (err) {
      console.error('localDataChanged listener failed:', err)
    }
  }
}

export function onLocalDataChanged(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
