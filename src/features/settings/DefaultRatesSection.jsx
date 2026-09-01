// Global default rates (tolai/shes/commission) — Phase 8. Writing
// these to the business doc's `defaultRates` field makes
// calc.js's resolveRates() use them instead of the hardcoded
// DEFAULT_RATES fallback (vepari override → business default → this
// hardcoded constant, per rules.md §3's stated resolution order —
// see calc.js). Until now, "business default" was never actually
// reachable since nothing wrote to it; this section is what makes
// that middle tier of the resolution order real.

import { useEffect, useState } from 'react'
import { useBusiness } from '../../hooks/useBusiness'
import { DEFAULT_RATES } from '../../utils/calc'
import gu from '../../locales/gu.json'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function DefaultRatesSection() {
  const { business, loading, updateBusiness } = useBusiness()
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (business?.defaultRates) setRates(business.defaultRates)
  }, [business])

  async function handleSave(e) {
    e.preventDefault()
    await updateBusiness({
      defaultRates: {
        tolaiPerKg: Number(rates.tolaiPerKg),
        shesPercent: Number(rates.shesPercent),
        commissionPercent: Number(rates.commissionPercent),
      },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return null

  return (
    <div className="card px-5 py-5 max-w-lg">
      <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-4">
        {gu.settings.defaultRatesTitle}
      </p>
      <form onSubmit={handleSave}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tolai" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.tolaiPerKgLabel}
            </label>
            <input
              id="tolai"
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClasses}
              value={rates.tolaiPerKg}
              onChange={(e) => setRates((r) => ({ ...r, tolaiPerKg: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="shes" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.shesPercentLabel}
            </label>
            <input
              id="shes"
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClasses}
              value={rates.shesPercent}
              onChange={(e) => setRates((r) => ({ ...r, shesPercent: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="commission" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.commissionPercentLabel}
            </label>
            <input
              id="commission"
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClasses}
              value={rates.commissionPercent}
              onChange={(e) => setRates((r) => ({ ...r, commissionPercent: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            className="min-h-11 px-5 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body"
          >
            {gu.settings.save}
          </button>
          {saved && <span className="text-caption text-accent">{gu.settings.saved}</span>}
        </div>
      </form>
    </div>
  )
}
