// Bill entry form (કેશ મેમો). Accepts Gujarati digits for weight/rate.
// Goods: preset list (incl. ઘઉં) + free-text "other".

import { useEffect, useMemo } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { useVeparis } from '../../hooks/useVeparis'
import { computeLineAmount, computeBillTotal } from '../../utils/calc'
import { todayKeyIST } from '../../utils/dates'
import { findVepari, vepariStableId } from '../../utils/vepari'
import { useLocale } from '../../context/LocaleContext'
import { preprocessNumber, parseLocaleNumber, convertIndicDigits } from '../../utils/numbers'
import VepariSelect from '../../components/VepariSelect'
import guCatalog from '../../locales/gu.json'

const CUSTOM = guCatalog.bills.customOptionValue
const GOODS_VALUES = guCatalog.bills.goodsTypes

const inputClasses =
  'text-body text-ink bg-surface border border-border rounded-xl w-full py-3 px-3 outline-none min-h-12 focus:border-accent focus:ring-2 focus:ring-accent-soft'

function emptyLine() {
  return { type: '', customType: '', weightKg: '', ratePer20kg: '' }
}

export function billToFormValues(bill) {
  return {
    entryNumber: bill.entryNumber ?? '',
    farmerName: bill.farmerName,
    farmerVillage: bill.farmerVillage,
    vepariId: bill.vepariId,
    date: bill.date,
    items: bill.items.map((item) => ({
      type: GOODS_VALUES.includes(item.type) ? item.type : CUSTOM,
      customType: GOODS_VALUES.includes(item.type) ? '' : item.type,
      weightKg: item.weightKg,
      ratePer20kg: item.ratePer20kg,
    })),
  }
}

export default function BillForm({ initialValues, onSubmit, onCancel, submitLabel, readOnly = false }) {
  const { t, formatCurrency } = useLocale()
  const { veparis } = useVeparis()
  const goodsLabels = t('bills.goodsTypes')
  const isEdit = initialValues?.entryNumber != null && initialValues.entryNumber !== ''

  const schema = useMemo(
    () =>
      z.object({
        entryNumber: z.preprocess(
          preprocessNumber,
          isEdit
            ? z.number().int().positive(t('bills.mustBePositive'))
            : z.number().int().positive(t('bills.mustBePositive')).optional(),
        ),
        farmerName: z.string().trim().min(1, t('bills.required')),
        farmerVillage: z.string().trim().min(1, t('bills.required')),
        vepariId: z.string().min(1, t('bills.selectVepari')),
        date: z.string().min(1, t('bills.required')),
        items: z
          .array(
            z
              .object({
                type: z.string().min(1, t('bills.required')),
                customType: z.string().optional(),
                weightKg: z.preprocess(
                  preprocessNumber,
                  z.number().positive(t('bills.mustBePositive')),
                ),
                ratePer20kg: z.preprocess(
                  preprocessNumber,
                  z.number().positive(t('bills.mustBePositive')),
                ),
              })
              .refine(
                (item) => item.type !== CUSTOM || Boolean(String(item.customType || '').trim()),
                { message: t('bills.typeGoodsName'), path: ['customType'] },
              ),
          )
          .min(1, t('bills.addAtLeastOne')),
      }),
    [t, isEdit],
  )

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialValues ?? {
      entryNumber: '',
      farmerName: '',
      farmerVillage: '',
      vepariId: '',
      date: todayKeyIST(),
      items: [emptyLine()],
    },
  })

  useEffect(() => {
    if (initialValues) {
      const matched = findVepari(veparis, initialValues.vepariId)
      reset({
        ...initialValues,
        vepariId: matched ? vepariStableId(matched) : initialValues.vepariId,
      })
    }
  }, [initialValues, reset, veparis])

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const watchedVepariId = watch('vepariId')
  const selectedVepari = findVepari(veparis, watchedVepariId)

  const liveTotal = computeBillTotal(
    (watchedItems || []).map((item) => ({
      amount: computeLineAmount(
        parseLocaleNumber(item.weightKg),
        parseLocaleNumber(item.ratePer20kg),
      ),
    })),
  )

  async function submit(values) {
    if (readOnly) return
    const vepari = findVepari(veparis, values.vepariId)
    const items = values.items.map((item, index) => {
      const weightKg = parseLocaleNumber(item.weightKg)
      const ratePer20kg = parseLocaleNumber(item.ratePer20kg)
      const rawType =
        item.type === CUSTOM ? String(item.customType || '').trim() : String(item.type || '').trim()
      return {
        id: initialValues?.items?.[index]?.id ?? `${Date.now()}-${index}`,
        type: rawType,
        weightKg,
        ratePer20kg,
        amount: computeLineAmount(weightKg, ratePer20kg),
      }
    })
    if (items.some((i) => !i.type)) return
    const entryNumber = Number.isFinite(values.entryNumber) ? values.entryNumber : undefined
    try {
      await onSubmit({
        entryNumber,
        farmerName: values.farmerName,
        farmerVillage: values.farmerVillage,
        vepariId: vepari ? vepariStableId(vepari) : values.vepariId,
        date: values.date,
        items,
      })
    } catch (err) {
      if (err?.message === 'ENTRY_NUMBER_TAKEN') {
        setError('entryNumber', { message: t('bills.entryNumberTaken') })
        return
      }
      throw err
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      <fieldset disabled={readOnly} className="space-y-5 border-0 p-0 m-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="entryNumber" className="block text-body text-ink font-medium mb-1.5">
              {t('bills.entryNumberLabel')}
            </label>
            <input
              id="entryNumber"
              inputMode="numeric"
              className={inputClasses}
              placeholder={isEdit ? undefined : t('bills.entryNumberAuto')}
              {...register('entryNumber', {
                onChange: (e) => {
                  setValue('entryNumber', convertIndicDigits(e.target.value), {
                    shouldValidate: true,
                  })
                },
              })}
            />
            {errors.entryNumber && (
              <p className="text-caption text-danger mt-1">{errors.entryNumber.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="date" className="block text-body text-ink font-medium mb-1.5">
              {t('bills.dateLabel')}
            </label>
            <input id="date" type="date" className={inputClasses} {...register('date')} />
            {errors.date && <p className="text-caption text-danger mt-1">{errors.date.message}</p>}
          </div>
          <div>
            <label htmlFor="farmerName" className="block text-body text-ink font-medium mb-1.5">
              {t('bills.farmerNameLabel')}
            </label>
            <input id="farmerName" className={inputClasses} {...register('farmerName')} />
            {errors.farmerName && (
              <p className="text-caption text-danger mt-1">{errors.farmerName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="farmerVillage" className="block text-body text-ink font-medium mb-1.5">
              {t('bills.farmerVillageLabel')}
            </label>
            <input id="farmerVillage" className={inputClasses} {...register('farmerVillage')} />
            {errors.farmerVillage && (
              <p className="text-caption text-danger mt-1">{errors.farmerVillage.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="vepariId" className="block text-body text-ink font-medium mb-1.5">
              {t('bills.vepariLabel')}
            </label>
            <Controller
              name="vepariId"
              control={control}
              render={({ field }) => (
                <VepariSelect
                  id="vepariId"
                  veparis={veparis}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={readOnly}
                />
              )}
            />
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
            <p className="text-body text-ink font-medium">{t('bills.goodsLinesHeading')}</p>
            {!readOnly && (
              <button
                type="button"
                onClick={() => append(emptyLine())}
                className="inline-flex items-center gap-1.5 min-h-12 px-3 rounded-xl text-body font-semibold text-accent hover:bg-accent-soft"
              >
                <Plus size={18} strokeWidth={2} />
                {t('bills.addLine')}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const item = watchedItems?.[index]
              const lineAmount = item
                ? computeLineAmount(
                    parseLocaleNumber(item.weightKg),
                    parseLocaleNumber(item.ratePer20kg),
                  )
                : 0
              return (
                <div key={field.id} className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto] items-start">
                    <div>
                      <label className="block text-caption text-ink-muted mb-1.5">
                        {t('bills.goodsTypeLabel')}
                      </label>
                      <select
                        className={inputClasses}
                        {...register(`items.${index}.type`)}
                        onChange={(e) => {
                          setValue(`items.${index}.type`, e.target.value, { shouldValidate: true })
                          if (e.target.value !== CUSTOM) {
                            setValue(`items.${index}.customType`, '')
                          }
                        }}
                      >
                        <option value="">—</option>
                        {GOODS_VALUES.map((value, i) => (
                          <option key={value} value={value}>
                            {goodsLabels[i] || value}
                          </option>
                        ))}
                        <option value={CUSTOM}>{t('bills.customGoodsLabel')}</option>
                      </select>
                      {(item?.type === CUSTOM || !GOODS_VALUES.includes(item?.type)) &&
                        item?.type === CUSTOM && (
                          <input
                            className={`${inputClasses} mt-2`}
                            placeholder="ઘઉં / બાજરી / …"
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
                        {t('bills.weightLabel')}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        lang="gu"
                        className={inputClasses}
                        placeholder="૧૦૦ / 100"
                        {...register(`items.${index}.weightKg`, {
                          onChange: (e) => {
                            setValue(
                              `items.${index}.weightKg`,
                              convertIndicDigits(e.target.value),
                              { shouldValidate: true, shouldDirty: true },
                            )
                          },
                        })}
                      />
                      {errors.items?.[index]?.weightKg && (
                        <p className="text-caption text-danger mt-1">
                          {errors.items[index].weightKg.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-caption text-ink-muted mb-1.5">
                        {t('bills.rateLabel')}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        lang="gu"
                        className={inputClasses}
                        placeholder="૫૬૫ / 565"
                        {...register(`items.${index}.ratePer20kg`, {
                          onChange: (e) => {
                            setValue(
                              `items.${index}.ratePer20kg`,
                              convertIndicDigits(e.target.value),
                              { shouldValidate: true, shouldDirty: true },
                            )
                          },
                        })}
                      />
                      {errors.items?.[index]?.ratePer20kg && (
                        <p className="text-caption text-danger mt-1">
                          {errors.items[index].ratePer20kg.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="block text-caption text-ink-muted mb-1.5">
                        {t('bills.amountLabel')}
                      </p>
                      <p className="font-numeric text-body text-ink py-3 font-semibold">
                        {formatCurrency(lineAmount)}
                      </p>
                    </div>
                    <div className="flex sm:justify-end">
                      {!readOnly && fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          aria-label={t('bills.removeLine')}
                          className="min-h-12 min-w-12 flex items-center justify-center text-ink-muted hover:text-danger mt-6 sm:mt-0"
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
          {(errors.items?.root?.message ||
            (typeof errors.items?.message === 'string' && errors.items.message)) && (
            <p className="text-caption text-danger mt-2">
              {errors.items?.root?.message || errors.items?.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4">
          <p className="text-body text-ink-muted font-medium">{t('bills.totalLabel')}</p>
          <p className="font-numeric text-heading text-ink font-semibold">
            {formatCurrency(liveTotal)}
          </p>
        </div>
      </fieldset>

      {!readOnly && (
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
      )}
    </form>
  )
}
