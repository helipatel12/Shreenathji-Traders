// Business profile — Phase 8, extended for print (owner-requested):
// name, plus the identity details that appear on the printed કેશ
// મેમો/દાખલો (proprietor name, address/area, mobile, license number —
// see features/bills/billPrint.js and features/vepariDakhla/
// dakhlaPrint.js). All optional: the print templates fall back to
// sensible defaults if left blank, so this doesn't block printing
// before the owner gets around to filling it in.
//
// Financial-year boundary is shown as a fixed, confirmable fact
// rather than an editable field (phases.md: "financial year boundary
// — fixed 01/04–30/03 but confirmable") — the whole app's date math
// (utils/dates.js's financialYearBounds()) is hardcoded to April–
// March, so actually changing this would be a real code change, not
// a settings toggle.

import { useEffect, useState } from 'react'
import { useBusiness } from '../../hooks/useBusiness'
import { useLocale } from '../../context/LocaleContext'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

const emptyProfile = { name: '', ownerName: '', address: '', mobile: '', licenseNumber: '' }

export default function BusinessProfileSection() {
  const { t } = useLocale()
  const { business, loading, updateBusiness } = useBusiness()
  const [profile, setProfile] = useState(emptyProfile)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (business) {
      setProfile({
        name: business.name || '',
        ownerName: business.ownerName || '',
        address: business.address || '',
        mobile: business.mobile || '',
        licenseNumber: business.licenseNumber || '',
      })
    }
  }, [business])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await updateBusiness({
        name: profile.name.trim(),
        ownerName: profile.ownerName.trim(),
        address: profile.address.trim(),
        mobile: profile.mobile.trim(),
        licenseNumber: profile.licenseNumber.trim(),
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

  function field(key) {
    return {
      value: profile[key],
      onChange: (e) => setProfile((p) => ({ ...p, [key]: e.target.value })),
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
      <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-1">
        {t('settings.businessProfileTitle')}
      </p>
      <p className="text-[11px] text-ink-muted mb-3">{t('settings.printIdentityNote')}</p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label htmlFor="business-name" className="block text-caption text-ink-muted mb-1.5">
            {t('settings.businessNameField')}
          </label>
          <input id="business-name" className={inputClasses} {...field('name')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner-name" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.ownerNameField')}
            </label>
            <input id="owner-name" className={inputClasses} {...field('ownerName')} />
          </div>
          <div>
            <label htmlFor="business-address" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.addressField')}
            </label>
            <input id="business-address" className={inputClasses} {...field('address')} />
          </div>
          <div>
            <label htmlFor="business-mobile" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.mobileField')}
            </label>
            <input id="business-mobile" type="tel" className={inputClasses} {...field('mobile')} />
          </div>
          <div>
            <label htmlFor="license-number" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.licenseNumberField')}
            </label>
            <input id="license-number" className={inputClasses} {...field('licenseNumber')} />
          </div>
        </div>

        <div>
          <p className="block text-caption text-ink-muted mb-1.5">{t('settings.fyBoundaryLabel')}</p>
          <p className="text-body text-ink">{t('settings.fyBoundaryValue')}</p>
        </div>
        <div className="flex items-center gap-3">
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
