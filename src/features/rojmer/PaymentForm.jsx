// Record/edit a payment (Phase 6). 3 fields, so react-hook-form + zod
// per rules.md §7. Amount can't exceed the bill's remaining balance —
// prevents accidentally overpaying past what's actually owed.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import { todayKeyIST } from '../../utils/dates'
import gu from '../../locales/gu.json'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

function buildSchema(maxAmount) {
  return z.object({
    amount: z.coerce
      .number()
      .positive('Must be more than 0')
      .max(maxAmount, `Can't exceed the balance due (${maxAmount})`),
    type: z.enum(['cash', 'cheque']),
    date: z.string().min(1, 'Required'),
  })
}

export default function PaymentForm({ maxAmount, initialValues, onSubmit, onCancel, submitLabel }) {
  const schema = buildSchema(initialValues ? initialValues.amount + maxAmount : maxAmount)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? { amount: '', type: 'cash', date: todayKeyIST() },
  })

  useEffect(() => {
    if (initialValues) reset(initialValues)
  }, [initialValues, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="amount" className="block text-caption text-ink-muted mb-1.5">
            {gu.rojmer.amountLabel}
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
          <label htmlFor="type" className="block text-caption text-ink-muted mb-1.5">
            {gu.rojmer.paymentTypeLabel}
          </label>
          <select id="type" className={inputClasses} {...register('type')}>
            <option value="cash">{gu.rojmer.cash}</option>
            <option value="cheque">{gu.rojmer.cheque}</option>
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-caption text-ink-muted mb-1.5">
            {gu.rojmer.dateLabel}
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
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
