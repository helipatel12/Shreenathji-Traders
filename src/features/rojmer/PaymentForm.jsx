import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useMemo } from 'react'
import { todayKeyIST } from '../../utils/dates'
import { useLocale } from '../../context/LocaleContext'
import { preprocessNumber, parseLocaleNumber, convertIndicDigits } from '../../utils/numbers'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function PaymentForm({ maxAmount, initialValues, onSubmit, onCancel, submitLabel }) {
  const { t } = useLocale()
  const ceiling = initialValues
    ? parseLocaleNumber(initialValues.amount) + Number(maxAmount)
    : Number(maxAmount)

  const schema = useMemo(
    () =>
      z.object({
        amount: z.preprocess(
          preprocessNumber,
          z
            .number()
            .positive(t('bills.mustBePositive'))
            .max(ceiling, t('rojmer.amountExceedsBalance', { max: ceiling })),
        ),
        type: z.enum(['cash', 'cheque']),
        date: z.string().min(1, t('bills.required')),
      }),
    [t, ceiling],
  )

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? { amount: '', type: 'cash', date: todayKeyIST() },
  })

  useEffect(() => {
    if (initialValues) reset(initialValues)
  }, [initialValues, reset])

  async function submit(values) {
    await onSubmit({
      ...values,
      amount: parseLocaleNumber(values.amount),
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="amount" className="block text-caption text-ink-muted mb-1.5">
            {t('rojmer.amountLabel')}
          </label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            lang="gu"
            placeholder="૫૦૦ / 500"
            className={inputClasses}
            {...register('amount', {
              onChange: (e) => {
                setValue('amount', convertIndicDigits(e.target.value), {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              },
            })}
          />
          {errors.amount && <p className="text-caption text-danger mt-1">{errors.amount.message}</p>}
        </div>
        <div>
          <label htmlFor="type" className="block text-caption text-ink-muted mb-1.5">
            {t('rojmer.paymentTypeLabel')}
          </label>
          <select id="type" className={inputClasses} {...register('type')}>
            <option value="cash">{t('rojmer.cash')}</option>
            <option value="cheque">{t('rojmer.cheque')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-caption text-ink-muted mb-1.5">
            {t('rojmer.dateLabel')}
          </label>
          <input id="date" type="date" className={inputClasses} {...register('date')} />
          {errors.date && <p className="text-caption text-danger mt-1">{errors.date.message}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-body disabled:opacity-40"
        >
          {submitLabel}
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
