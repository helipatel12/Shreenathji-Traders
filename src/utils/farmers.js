/** Unique khedut names and villages from saved bills, for bill-form dropdowns. */

function isSkippedBill(bill) {
  return Boolean(bill?.isVoided || bill?.syncStatus === 'pendingDelete')
}

export function farmerDirectory(bills = []) {
  const names = new Map()
  const villages = new Map()

  for (const bill of bills) {
    if (isSkippedBill(bill)) continue
    const name = String(bill.farmerName || '').trim()
    const village = String(bill.farmerVillage || '').trim()
    const at = Number(bill.createdAtLocal) || 0

    if (name) {
      const key = name.toLowerCase()
      const prev = names.get(key)
      if (!prev || at >= prev.at) names.set(key, { name, village, at })
    }
    if (village) {
      const key = village.toLowerCase()
      const prev = villages.get(key)
      if (!prev || at >= prev.at) villages.set(key, { village, at })
    }
  }

  const nameList = [...names.values()].sort((a, b) => a.name.localeCompare(b.name, 'gu'))
  const villageList = [...villages.values()].sort((a, b) => a.village.localeCompare(b.village, 'gu'))

  return {
    names: nameList.map((row) => row.name),
    villages: villageList.map((row) => row.village),
    villageByName: new Map(nameList.map((row) => [row.name.toLowerCase(), row.village])),
  }
}

export function lastVillageForName(directory, name) {
  const key = String(name || '')
    .trim()
    .toLowerCase()
  if (!key) return ''
  return directory.villageByName.get(key) || ''
}
