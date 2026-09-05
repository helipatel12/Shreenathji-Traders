// Shapes the vepari master list into flat rows for export — used by
// the year-end archive (Phase 9, prd.md §4.5: "the vepari master
// list" is one of the files bundled into the backup zip). Not date-
// filtered like bills/dakhla/rojmer/silak — a vepari record doesn't
// have its own date, this is just "the list as it stands today."

export function buildVepariListRows(veparis) {
  return veparis.map((vepari) => {
    const rates = vepari.customRates || null
    return {
      Name: vepari.name,
      Village: vepari.village,
      'Custom tolai (per kg)': rates?.tolaiPerKg ?? rates?.tolai ?? '',
      'Custom shes %': rates?.shesPercent ?? rates?.shes ?? '',
      'Custom commission %': rates?.commissionPercent ?? rates?.commission ?? '',
    }
  })
}
