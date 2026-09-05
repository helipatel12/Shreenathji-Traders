// Add/edit a manual silak entry (e.g. bank deposit/withdrawal) —
// Phase 7. 4 fields, so react-hook-form + zod per rules.md §7.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useMemo } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { preprocessNumber, convertIndicDigits } from '../../utils/numbers'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function ManualEntryForm({ initialValues, defaultDate, onSubmit, onCancel }) {
  const { t } = useLocale()
  const schema = useMemo(
    () =>
      z.object({
        label: z.string().trim().min(1, t('bills.required')),
        amount: z.preprocess(
          preprocessNumber,
          z.number().positive(t('bills.mustBePositive')),
        ),
        side: z.enum(['jama', 'udhar']),
        date: z.string().min(1, t('bills.required')),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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
          {t('silak.labelField')}
        </label>
        <input id="label" className={inputClasses} {...register('label')} />
        {errors.label && <p className="text-caption text-danger mt-1">{errors.label.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="amount" className="block text-caption text-ink-muted mb-1.5">
            {t('silak.amountField')}
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
          <label htmlFor="side" className="block text-caption text-ink-muted mb-1.5">
            {t('silak.sideField')}
          </label>
          <select id="side" className={inputClasses} {...register('side')}>
            <option value="jama">{t('silak.jamaLabel')}</option>
            <option value="udhar">{t('silak.udharLabel')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-caption text-ink-muted mb-1.5">
            {t('silak.dateField')}
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
          {t('silak.save')}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
          >
            {t('silak.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
