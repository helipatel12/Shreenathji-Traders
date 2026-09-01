// Add/edit a manual silak entry (e.g. bank deposit/withdrawal) —
// Phase 7. 4 fields, so react-hook-form + zod per rules.md §7.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import gu from '../../locales/gu.json'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

const schema = z.object({
  label: z.string().trim().min(1, 'Required'),
  amount: z.coerce.number().positive('Must be more than 0'),
  side: z.enum(['jama', 'udhar']),
  date: z.string().min(1, 'Required'),
})

export default function ManualEntryForm({ initialValues, defaultDate, onSubmit, onCancel }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? { label: '', amount: '', side: 'jama', date: defaultDate },
  })

  useEffect(() => {
    if (initialValues) reset(initialValues)
  }, [initialValues, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="label" className="block text-caption text-ink-muted mb-1.5">
          {gu.silak.labelField}
        </label>
        <input id="label" className={inputClasses} placeholder="e.g. Bank deposit" {...register('label')} />
        {errors.label && <p className="text-caption text-danger mt-1">{errors.label.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="amount" className="block text-caption text-ink-muted mb-1.5">
            {gu.silak.amountField}
          </label>
          <input
            id="amount"
            type="number"
            step="any"
            inputMode="decimal"
            className={inputClasses}
            {...register('amount')}
          />
          {errors.amount && <p className="text-caption text-danger mt-1">{errors.amount.message}</p>}
        </div>
        <div>
          <label htmlFor="side" className="block text-caption text-ink-muted mb-1.5">
            {gu.silak.sideField}
          </label>
          <select id="side" className={inputClasses} {...register('side')}>
            <option value="jama">{gu.silak.jamaLabel}</option>
            <option value="udhar">{gu.silak.udharLabel}</option>
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-caption text-ink-muted mb-1.5">
            {gu.silak.dateField}
          </label>
          <input id="date" type="date" className={inputClasses} {...register('date')} />
          {errors.date && <p className="text-caption text-danger mt-1">{errors.date.message}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 min-h-11 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
        >
          {gu.silak.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
        >
          {gu.silak.cancel}
        </button>
      </div>
    </form>
  )
}
