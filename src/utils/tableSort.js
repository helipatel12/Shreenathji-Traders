/** Shared table sort for note no. + date columns. */

export function sortByNoteOrDate(list, { sortKey = 'entryNumber', sortDir = 'asc', getNote, getDate }) {
  const dir = sortDir === 'desc' ? -1 : 1
  return list.slice().sort((a, b) => {
    if (sortKey === 'date') {
      const da = getDate(a) || ''
      const db = getDate(b) || ''
      if (da < db) return -1 * dir
      if (da > db) return 1 * dir
      return (Number(getNote(a)) || 0) - (Number(getNote(b)) || 0)
    }
    const na = Number(getNote(a)) || 0
    const nb = Number(getNote(b)) || 0
    if (na !== nb) return (na - nb) * dir
    const da = getDate(a) || ''
    const db = getDate(b) || ''
    if (da < db) return -1
    if (da > db) return 1
    return 0
  })
}

export function noteSortFilter(t, sortKey, sortDir, setNoteSort) {
  return {
    value: sortKey === 'entryNumber' ? sortDir : '',
    onChange: setNoteSort,
    allLabel: t('bills.sortNote'),
    options: [
      { value: 'asc', label: t('bills.sortNoteAsc') },
      { value: 'desc', label: t('bills.sortNoteDesc') },
    ],
  }
}

export function dateSortFilter(t, sortKey, sortDir, setDateSort) {
  return {
    value: sortKey === 'date' ? sortDir : '',
    onChange: setDateSort,
    allLabel: t('bills.sortDate'),
    options: [
      { value: 'asc', label: t('bills.sortDateOlder') },
      { value: 'desc', label: t('bills.sortDateNewer') },
    ],
  }
}
