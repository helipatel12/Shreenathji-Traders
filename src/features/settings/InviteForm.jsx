import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo } from 'react'
import { useLocale } from '../../context/LocaleContext'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function InviteForm({ onSubmit, onCancel }) {
  const { t } = useLocale()
  const schema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email(t('settings.validEmail')),
        role: z.enum(['staff', 'ca']),
        location: z.string().trim().optional(),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'staff', location: '' },
  })

  async function submit(values) {
    await onSubmit(values)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label htmlFor="invite-email" className="block text-caption text-ink-muted mb-1.5">
          {t('settings.inviteEmailField')}
        </label>
        <input id="invite-email" type="email" className={inputClasses} {...register('email')} />
        {errors.email && <p className="text-caption text-danger mt-1">{errors.email.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-role" className="block text-caption text-ink-muted mb-1.5">
            {t('settings.inviteRoleField')}
          </label>
          <select id="invite-role" className={inputClasses} {...register('role')}>
            <option value="staff">{t('settings.roleStaff')}</option>
            <option value="ca">{t('settings.roleCa')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="invite-location" className="block text-caption text-ink-muted mb-1.5">
            {t('settings.inviteLocationField')}
          </label>
          <input id="invite-location" className={inputClasses} {...register('location')} />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
        >
          {t('settings.sendInvite')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
