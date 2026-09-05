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
import { useLocale } from '../../context/LocaleContext'
import { DEFAULT_RATES } from '../../utils/calc'
import { convertIndicDigits, parseLocaleNumber } from '../../utils/numbers'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function DefaultRatesSection() {
  const { t } = useLocale()
  const { business, loading, updateBusiness } = useBusiness()
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (business?.defaultRates) setRates(business.defaultRates)
  }, [business])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await updateBusiness({
        defaultRates: {
          tolaiPerKg: parseLocaleNumber(rates.tolaiPerKg),
          shesPercent: parseLocaleNumber(rates.shesPercent),
          commissionPercent: parseLocaleNumber(rates.commissionPercent),
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
      setSaveError(t('common.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card px-5 py-5 sm:px-6 sm:py-6">
        <p className="text-caption text-ink-muted">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="card px-4 py-4 sm:px-5 sm:py-5 h-full">
      <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-3">
        {t('settings.defaultRatesTitle')}
      </p>
      <form onSubmit={handleSave}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="tolai" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.tolaiPerKgLabel')}
            </label>
            <input
              id="tolai"
              type="text"
              inputMode="decimal"
              lang="gu"
              className={inputClasses}
              value={rates.tolaiPerKg}
              onChange={(e) =>
                setRates((r) => ({ ...r, tolaiPerKg: convertIndicDigits(e.target.value) }))
              }
            />
          </div>
          <div>
            <label htmlFor="shes" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.shesPercentLabel')}
            </label>
            <input
              id="shes"
              type="text"
              inputMode="decimal"
              lang="gu"
              className={inputClasses}
              value={rates.shesPercent}
              onChange={(e) =>
                setRates((r) => ({ ...r, shesPercent: convertIndicDigits(e.target.value) }))
              }
            />
          </div>
          <div>
            <label htmlFor="commission" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.commissionPercentLabel')}
            </label>
            <input
              id="commission"
              type="text"
              inputMode="decimal"
              lang="gu"
              className={inputClasses}
              value={rates.commissionPercent}
              onChange={(e) =>
                setRates((r) => ({
                  ...r,
                  commissionPercent: convertIndicDigits(e.target.value),
                }))
              }
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving}
            className="min-h-12 px-5 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
          >
            {t('settings.save')}
          </button>
          {saved && <span className="text-caption text-accent">{t('settings.saved')}</span>}
          {saveError && <span className="text-caption text-danger">{saveError}</span>}
        </div>
      </form>
    </div>
  )
}
