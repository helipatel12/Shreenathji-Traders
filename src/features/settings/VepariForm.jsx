// Add/edit form for a single vepari (Phase 3). More than 2 fields
// (name, village, and 3 optional rate overrides), so this uses
// react-hook-form + zod per rules.md §7 rather than manual useState.

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    village: z.string().trim().min(1, 'Village is required'),
    useCustomRates: z.boolean(),
    tolai: z.coerce.number().min(0, 'Must be 0 or more').optional(),
    shes: z.coerce.number().min(0, 'Must be 0 or more').optional(),
    commission: z.coerce.number().min(0, 'Must be 0 or more').optional(),
  })
  .refine(
    (data) =>
      !data.useCustomRates ||
      (data.tolai !== undefined && data.shes !== undefined && data.commission !== undefined),
    {
      message: 'Fill in all three rates, or turn custom rates off',
      path: ['tolai'],
    }
  )

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function VepariForm({ initialValues, onSubmit, onCancel, submitLabel }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
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
      customRates: values.useCustomRates
        ? { tolai: values.tolai, shes: values.shes, commission: values.commission }
        : null,
    }
    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <div>
        <label htmlFor="vepari-name" className="block text-caption text-ink-muted mb-1.5">
          Name
        </label>
        <input id="vepari-name" className={inputClasses} {...register('name')} />
        {errors.name && (
          <p className="text-caption text-danger mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="vepari-village" className="block text-caption text-ink-muted mb-1.5">
          Village
        </label>
        <input id="vepari-village" className={inputClasses} {...register('village')} />
        {errors.village && (
          <p className="text-caption text-danger mt-1">{errors.village.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-body text-ink min-h-11">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#2B4238]"
          {...register('useCustomRates')}
        />
        Use custom rates for this vepari
      </label>

      {useCustomRates && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="vepari-tolai" className="block text-caption text-ink-muted mb-1.5">
              Tolai
            </label>
            <input
              id="vepari-tolai"
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClasses}
              {...register('tolai')}
            />
          </div>
          <div>
            <label htmlFor="vepari-shes" className="block text-caption text-ink-muted mb-1.5">
              Shes %
            </label>
            <input
              id="vepari-shes"
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClasses}
              {...register('shes')}
            />
          </div>
          <div>
            <label
              htmlFor="vepari-commission"
              className="block text-caption text-ink-muted mb-1.5"
            >
              Commission %
            </label>
            <input
              id="vepari-commission"
              type="number"
              step="any"
              inputMode="decimal"
              className={inputClasses}
              {...register('commission')}
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
