import { useMemo } from 'react'
import { vepariStableId } from '../utils/vepari'
import { useLocale } from '../context/LocaleContext'
import SearchableSelect from './SearchableSelect'

/** Searchable vepari / buyer picker used across bills, dakhla, filters. */
export default function VepariSelect({
  veparis = [],
  value = '',
  onChange,
  id,
  className,
  disabled = false,
  compact = false,
  allowEmpty = true,
  emptyLabel,
  placeholder,
  'aria-label': ariaLabel,
}) {
  const { t } = useLocale()

  const options = useMemo(
    () =>
      veparis.map((v) => {
        const name = v.name || '—'
        const village = v.village || ''
        return {
          value: vepariStableId(v),
          label: village ? `${name} · ${village}` : name,
          searchText: `${name} ${village}`,
        }
      }),
    [veparis],
  )

  return (
    <SearchableSelect
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      className={className}
      disabled={disabled}
      compact={compact}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel ?? '—'}
      placeholder={placeholder ?? t('bills.selectVepari')}
      searchPlaceholder={t('bills.searchVepari')}
      aria-label={ariaLabel ?? t('bills.vepariLabel')}
    />
  )
}
