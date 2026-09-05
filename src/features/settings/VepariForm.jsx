import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect, useMemo } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { preprocessNumber, convertIndicDigits, parseLocaleNumber } from '../../utils/numbers'

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function VepariForm({ initialValues, onSubmit, onCancel, submitLabel }) {
  const { t } = useLocale()

  const schema = useMemo(
    () =>
      z
        .object({
          name: z.string().trim().min(1, t('bills.required')),
          village: z.string().trim().min(1, t('bills.required')),
          useCustomRates: z.boolean(),
          tolai: z.preprocess(preprocessNumber, z.number().min(0, t('common.mustBeZeroOrMore')).optional()),
          shes: z.preprocess(preprocessNumber, z.number().min(0, t('common.mustBeZeroOrMore')).optional()),
          commission: z.preprocess(
            preprocessNumber,
            z.number().min(0, t('common.mustBeZeroOrMore')).optional(),
          ),
        })
        .refine(
          (data) =>
            !data.useCustomRates ||
            (data.tolai !== undefined &&
              data.shes !== undefined &&
              data.commission !== undefined &&
              !Number.isNaN(data.tolai) &&
              !Number.isNaN(data.shes) &&
              !Number.isNaN(data.commission)),
          {
            message: t('common.fillAllRates'),
            path: ['tolai'],
          },
        ),
    [t],
  )

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? {
      name: '',
      village: '',
      useCustomRates: false,
      tolai: undefined,
      shes: undefined,
      commission: undefined,
    },
  })

  useEffect(() => {
    if (initialValues) reset(initialValues)
  }, [initialValues, reset])

  const useCustomRates = watch('useCustomRates')

  async function submit(values) {
    const payload = {
      name: values.name,
      village: values.village,
      // Canonical keys match business.defaultRates / DEFAULT_RATES / calc.js
      customRates: values.useCustomRates
        ? {
            tolaiPerKg: parseLocaleNumber(values.tolai),
            shesPercent: parseLocaleNumber(values.shes),
            commissionPercent: parseLocaleNumber(values.commission),
          }
        : null,
    }
    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label htmlFor="vepari-name" className="block text-caption text-ink-muted mb-1.5">
          {t('settings.vepariName')}
        </label>
        <input id="vepari-name" className={inputClasses} {...register('name')} />
        {errors.name && <p className="text-caption text-danger mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="vepari-village" className="block text-caption text-ink-muted mb-1.5">
          {t('settings.vepariVillage')}
        </label>
        <input id="vepari-village" className={inputClasses} {...register('village')} />
        {errors.village && (
          <p className="text-caption text-danger mt-1">{errors.village.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-body text-ink min-h-12">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#2B4238]"
          {...register('useCustomRates')}
        />
        {t('settings.useCustomRates')}
      </label>

      {useCustomRates && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="vepari-tolai" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.tolaiPerKgLabel')}
            </label>
            <input
              id="vepari-tolai"
              type="text"
              inputMode="decimal"
              lang="gu"
              className={inputClasses}
              {...register('tolai', {
                onChange: (e) =>
                  setValue('tolai', convertIndicDigits(e.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  }),
              })}
            />
          </div>
          <div>
            <label htmlFor="vepari-shes" className="block text-caption text-ink-muted mb-1.5">
              {t('settings.shesPercentLabel')}
            </label>
            <input
              id="vepari-shes"
              type="text"
              inputMode="decimal"
              lang="gu"
              className={inputClasses}
              {...register('shes', {
                onChange: (e) =>
                  setValue('shes', convertIndicDigits(e.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  }),
              })}
            />
          </div>
          <div>
            <label
              htmlFor="vepari-commission"
              className="block text-caption text-ink-muted mb-1.5"
            >
              {t('settings.commissionPercentLabel')}
            </label>
            <input
              id="vepari-commission"
              type="text"
              inputMode="decimal"
              lang="gu"
              className={inputClasses}
              {...register('commission', {
                onChange: (e) =>
                  setValue('commission', convertIndicDigits(e.target.value), {
                    shouldValidate: true,
                    shouldDirty: true,
                  }),
              })}
            />
          </div>
          {errors.tolai && (
            <p className="text-caption text-danger col-span-3 -mt-2">{errors.tolai.message}</p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 min-h-12 rounded-xl bg-accent hover:bg-accent-hover text-surface font-semibold text-body disabled:opacity-40"
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
