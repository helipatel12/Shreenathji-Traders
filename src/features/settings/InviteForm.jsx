// Invite a staff/CA member by email — Phase 8. 3 fields, so
// react-hook-form + zod per rules.md §7.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import gu from '../../locales/gu.json'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['staff', 'ca']),
  location: z.string().trim().optional(),
})

export default function InviteForm({ onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', role: 'staff', location: '' } })

  async function submit(values) {
    await onSubmit(values)
    reset()
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label htmlFor="invite-email" className="block text-caption text-ink-muted mb-1.5">
          {gu.settings.inviteEmailField}
        </label>
        <input id="invite-email" type="email" className={inputClasses} {...register('email')} />
        {errors.email && <p className="text-caption text-danger mt-1">{errors.email.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="invite-role" className="block text-caption text-ink-muted mb-1.5">
            {gu.settings.inviteRoleField}
          </label>
          <select id="invite-role" className={inputClasses} {...register('role')}>
            <option value="staff">{gu.settings.roleStaff}</option>
            <option value="ca">{gu.settings.roleCa}</option>
          </select>
        </div>
        <div>
          <label htmlFor="invite-location" className="block text-caption text-ink-muted mb-1.5">
            {gu.settings.inviteLocationField}
          </label>
          <input id="invite-location" className={inputClasses} {...register('location')} />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
        >
          {gu.settings.sendInvite}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {gu.silak.cancel}
          </button>
        )}
      </div>
    </form>
  )
}
