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
import gu from '../../locales/gu.json'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

const emptyProfile = { name: '', ownerName: '', address: '', mobile: '', licenseNumber: '' }

export default function BusinessProfileSection() {
  const { business, loading, updateBusiness } = useBusiness()
  const [profile, setProfile] = useState(emptyProfile)
  const [saved, setSaved] = useState(false)

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
    await updateBusiness({
      name: profile.name.trim(),
      ownerName: profile.ownerName.trim(),
      address: profile.address.trim(),
      mobile: profile.mobile.trim(),
      licenseNumber: profile.licenseNumber.trim(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function field(key) {
    return {
      value: profile[key],
      onChange: (e) => setProfile((p) => ({ ...p, [key]: e.target.value })),
    }
  }

  if (loading) return null

  return (
    <div className="card px-5 py-5 max-w-lg">
      <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-4">
        {gu.settings.businessProfileTitle}
      </p>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label htmlFor="business-name" className="block text-caption text-ink-muted mb-1.5">
            {gu.settings.businessNameField}
          </label>
          <input id="business-name" className={inputClasses} {...field('name')} />
        </div>

        <p className="text-caption text-ink-muted">{gu.settings.printIdentityNote}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="owner-name" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.ownerNameField}
            </label>
            <input id="owner-name" className={inputClasses} {...field('ownerName')} />
          </div>
          <div>
            <label htmlFor="business-address" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.addressField}
            </label>
            <input id="business-address" className={inputClasses} {...field('address')} />
          </div>
          <div>
            <label htmlFor="business-mobile" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.mobileField}
            </label>
            <input id="business-mobile" type="tel" className={inputClasses} {...field('mobile')} />
          </div>
          <div>
            <label htmlFor="license-number" className="block text-caption text-ink-muted mb-1.5">
              {gu.settings.licenseNumberField}
            </label>
            <input id="license-number" className={inputClasses} {...field('licenseNumber')} />
          </div>
        </div>

        <div>
          <p className="block text-caption text-ink-muted mb-1.5">{gu.settings.fyBoundaryLabel}</p>
          <p className="text-body text-ink">{gu.settings.fyBoundaryValue}</p>
        </div>
        <div className="flex items-center gap-3">
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
