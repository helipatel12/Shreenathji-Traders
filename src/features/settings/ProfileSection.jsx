// Personal profile — name, gender, birthday, email.

import { useEffect, useId, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'

export default function ProfileSection({ embedded = false, onSaved }) {
  const { user, updateOwnProfile } = useAuth()
  const { t } = useLocale()
  const uid = useId()
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [birthday, setBirthday] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setGender(user.gender || '')
    setBirthday(user.birthday || '')
    setEmail(user.email || '')
  }, [user])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateOwnProfile({ name, gender, birthday, email })
      setSaved(true)
      onSaved?.()
    } catch (err) {
      console.error('Profile save failed:', err)
      const code = err?.code || ''
      if (code.includes('requires-recent-login')) {
        setError(t('settings.profileNeedRelogin'))
      } else if (code.includes('email-already-in-use')) {
        setError(t('auth.errEmailInUse'))
      } else if (code.includes('invalid-email')) {
        setError(t('auth.errInvalidEmail'))
      } else {
        setError(t('common.saveFailed'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={embedded ? '' : 'card px-5 py-5 max-w-lg'}>
      {!embedded && (
        <>
          <p className="text-caption text-accent font-semibold uppercase tracking-wide mb-1">
            {t('settings.profileTitle')}
          </p>
          <p className="text-body text-ink-muted mb-4">{t('settings.profileSubtitle')}</p>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${uid}-name`} className="block text-caption text-ink-muted mb-1.5">
            {t('settings.profileName')}
          </label>
          <input
            id={`${uid}-name`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-11 rounded-full border border-border bg-surface px-4 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <div>
          <label htmlFor={`${uid}-gender`} className="block text-caption text-ink-muted mb-1.5">
            {t('settings.profileGender')}
          </label>
          <select
            id={`${uid}-gender`}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full min-h-11 rounded-full border border-border bg-surface px-4 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          >
            <option value="">{t('settings.profileGenderUnset')}</option>
            <option value="male">{t('settings.profileGenderMale')}</option>
            <option value="female">{t('settings.profileGenderFemale')}</option>
            <option value="other">{t('settings.profileGenderOther')}</option>
          </select>
        </div>

        <div>
          <label htmlFor={`${uid}-birthday`} className="block text-caption text-ink-muted mb-1.5">
            {t('settings.profileBirthday')}
          </label>
          <input
            id={`${uid}-birthday`}
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className="w-full min-h-11 rounded-full border border-border bg-surface px-4 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <div>
          <label htmlFor={`${uid}-email`} className="block text-caption text-ink-muted mb-1.5">
            {t('settings.profileEmail')}
          </label>
          <input
            id={`${uid}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-11 rounded-full border border-border bg-surface px-4 text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <p className="text-[11px] text-ink-muted mt-1.5">{t('settings.profileEmailNote')}</p>
        </div>

        {error && (
          <p className="text-caption text-danger rounded-lg bg-red-50 px-3 py-2">{error}</p>
        )}
        {saved && !error && (
          <p className="text-caption text-success">{t('common.saved')}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className={`btn-primary disabled:opacity-40 ${embedded ? 'w-full' : ''}`}
        >
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </form>
    </div>
  )
}
