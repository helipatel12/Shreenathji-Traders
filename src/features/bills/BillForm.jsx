// Bill entry form (કેશ મેમો) — Phase 4. Many fields across a
// variable-length line-item list, so this uses react-hook-form +
// useFieldArray + zod per rules.md §7, not manual useState.

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useVeparis } from '../../hooks/useVeparis'
import { computeLineAmount, computeBillTotal, formatCurrency } from '../../utils/calc'
import { todayKeyIST } from '../../utils/dates'
import gu from '../../locales/gu.json'

const CUSTOM = gu.bills.customOptionValue

const lineItemSchema = z
  .object({
    type: z.string().min(1, 'Required'),
    customType: z.string().optional(),
    weightKg: z.coerce.number().positive('Must be more than 0'),
    ratePer20kg: z.coerce.number().positive('Must be more than 0'),
  })
  .refine((item) => item.type !== CUSTOM || Boolean(item.customType?.trim()), {
    message: 'Type the goods name',
    path: ['customType'],
  })

const schema = z.object({
  farmerName: z.string().trim().min(1, 'Required'),
  farmerVillage: z.string().trim().min(1, 'Required'),
  vepariId: z.string().min(1, 'Select a vepari'),
  date: z.string().min(1, 'Required'),
  items: z.array(lineItemSchema).min(1, 'Add at least one line'),
})

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-2.5 px-3 outline-none min-h-11 focus:border-accent focus:ring-2 focus:ring-accent-soft'

function emptyLine() {
  return { type: '', customType: '', weightKg: '', ratePer20kg: '' }
}

// Converts a saved bill (Firestore/Dexie shape) into the shape
// BillForm's own defaultValues expect. Shared by BillsScreen (Phase
// 4) and DakhlaScreen (Phase 5) — both let you edit the same
// underlying bill, so this mapping only lives once rather than
// drifting out of sync between two copies.
export function billToFormValues(bill) {
  return {
    farmerName: bill.farmerName,
    farmerVillage: bill.farmerVillage,
    vepariId: bill.vepariId,
    date: bill.date,
    items: bill.items.map((item) => ({
      type: gu.bills.goodsTypes.includes(item.type) ? item.type : CUSTOM,
      customType: gu.bills.goodsTypes.includes(item.type) ? '' : item.type,
      weightKg: item.weightKg,
      ratePer20kg: item.ratePer20kg,
    })),
  }
}

export default function BillForm({ initialValues, onSubmit, onCancel, submitLabel }) {
  const { veparis } = useVeparis()

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? {
      farmerName: '',
      farmerVillage: '',
      vepariId: '',
      date: todayKeyIST(),
      items: [emptyLine()],
    },
  })

  useEffect(() => {
    if (initialValues) reset(initialValues)
  }, [initialValues, reset])

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const watchedVepariId = watch('vepariId')
  const selectedVepari = veparis.find((v) => String(v.id) === String(watchedVepariId))

  const liveTotal = computeBillTotal(
    (watchedItems || []).map((item) => ({
      amount: computeLineAmount(Number(item.weightKg), Number(item.ratePer20kg)),
    }))
  )

  async function submit(values) {
    const items = values.items.map((item, index) => ({
      id: initialValues?.items?.[index]?.id ?? `${Date.now()}-${index}`,
      type: item.type === CUSTOM ? item.customType.trim() : item.type,
      weightKg: Number(item.weightKg),
      ratePer20kg: Number(item.ratePer20kg),
      amount: computeLineAmount(Number(item.weightKg), Number(item.ratePer20kg)),
    }))
    await onSubmit({
      farmerName: values.farmerName,
      farmerVillage: values.farmerVillage,
      vepariId: values.vepariId,
      date: values.date,
      items,
    })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="farmerName" className="block text-caption text-ink-muted mb-1.5">
            {gu.bills.farmerNameLabel}
          </label>
          <input id="farmerName" className={inputClasses} {...register('farmerName')} />
          {errors.farmerName && (
            <p className="text-caption text-danger mt-1">{errors.farmerName.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="farmerVillage" className="block text-caption text-ink-muted mb-1.5">
            {gu.bills.farmerVillageLabel}
          </label>
          <input id="farmerVillage" className={inputClasses} {...register('farmerVillage')} />
          {errors.farmerVillage && (
            <p className="text-caption text-danger mt-1">{errors.farmerVillage.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="date" className="block text-caption text-ink-muted mb-1.5">
            {gu.bills.dateLabel}
          </label>
          <input id="date" type="date" className={inputClasses} {...register('date')} />
          {errors.date && <p className="text-caption text-danger mt-1">{errors.date.message}</p>}
        </div>
        <div>
          <label htmlFor="vepariId" className="block text-caption text-ink-muted mb-1.5">
            {gu.bills.vepariLabel}
          </label>
          <select id="vepariId" className={inputClasses} {...register('vepariId')}>
            <option value="">—</option>
            {veparis.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {selectedVepari && (
            <p className="text-caption text-ink-muted mt-1">{selectedVepari.village}</p>
          )}
          {errors.vepariId && (
            <p className="text-caption text-danger mt-1">{errors.vepariId.message}</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-caption text-ink-muted uppercase tracking-wide">Goods lines</p>
          <button
            type="button"
            onClick={() => append(emptyLine())}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-caption font-semibold text-accent hover:bg-accent-soft"
          >
            <Plus size={16} strokeWidth={2} />
            {gu.bills.addLine}
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const item = watchedItems?.[index]
            const lineAmount = item
              ? computeLineAmount(Number(item.weightKg), Number(item.ratePer20kg))
              : 0
            return (
              <div key={field.id} className="card px-4 py-4">
                <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto] items-start">
                  <div>
                    <label className="block text-caption text-ink-muted mb-1.5">
                      {gu.bills.goodsTypeLabel}
                    </label>
                    <select className={inputClasses} {...register(`items.${index}.type`)}>
                      <option value="">—</option>
                      {gu.bills.goodsTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value={CUSTOM}>{gu.bills.customGoodsLabel}</option>
                    </select>
                    {item?.type === CUSTOM && (
                      <input
                        className={`${inputClasses} mt-2`}
                        placeholder={gu.bills.customGoodsLabel}
                        {...register(`items.${index}.customType`)}
                      />
                    )}
                    {errors.items?.[index]?.type && (
                      <p className="text-caption text-danger mt-1">
                        {errors.items[index].type.message}
                      </p>
                    )}
                    {errors.items?.[index]?.customType && (
                      <p className="text-caption text-danger mt-1">
                        {errors.items[index].customType.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-caption text-ink-muted mb-1.5">
                      {gu.bills.weightLabel}
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      className={inputClasses}
                      {...register(`items.${index}.weightKg`)}
                    />
                    {errors.items?.[index]?.weightKg && (
                      <p className="text-caption text-danger mt-1">
                        {errors.items[index].weightKg.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-caption text-ink-muted mb-1.5">
                      {gu.bills.rateLabel}
                    </label>
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      className={inputClasses}
                      {...register(`items.${index}.ratePer20kg`)}
                    />
                    {errors.items?.[index]?.ratePer20kg && (
                      <p className="text-caption text-danger mt-1">
                        {errors.items[index].ratePer20kg.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="block text-caption text-ink-muted mb-1.5">
                      {gu.bills.amountLabel}
                    </p>
                    <p className="font-numeric text-body text-ink py-2.5">
                      {formatCurrency(lineAmount)}
                    </p>
                  </div>
                  <div className="flex sm:justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        aria-label={gu.bills.removeLine}
                        className="min-h-11 min-w-11 flex items-center justify-center text-ink-muted hover:text-danger mt-6 sm:mt-0"
                      >
                        <Trash2 size={18} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {(errors.items?.root?.message || (typeof errors.items?.message === 'string' && errors.items.message)) && (
          <p className="text-caption text-danger mt-2">
            {errors.items?.root?.message || errors.items?.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between card px-4 py-3">
        <p className="text-body text-ink-muted">{gu.bills.totalLabel}</p>
        <p className="font-numeric text-heading text-ink font-semibold">
          {formatCurrency(liveTotal)}
        </p>
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
