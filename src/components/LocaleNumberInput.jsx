import { convertIndicDigits } from '../utils/numbers'

/**
 * Text input that accepts Gujarati (and other Indic) digits and
 * converts them to ASCII as the user types so Zod / Number() work.
 */
export default function LocaleNumberInput({
  value,
  onChange,
  onBlur,
  name,
  id,
  className,
  placeholder,
  disabled,
  'aria-label': ariaLabel,
  inputMode = 'decimal',
}) {
  function handleChange(e) {
    const next = convertIndicDigits(e.target.value)
    if (onChange) {
      onChange({
        ...e,
        target: { ...e.target, name, value: next },
      })
    }
  }

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={inputMode}
      autoComplete="off"
      lang="gu"
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      value={value ?? ''}
      onChange={handleChange}
      onBlur={onBlur}
    />
  )
}

/** Wire LocaleNumberInput to react-hook-form register() */
export function localeNumberFieldProps(registerResult, setValue, name) {
  const { ref, name: fieldName, onBlur, onChange } = registerResult
  return {
    ref,
    name: fieldName,
    onBlur,
    onChange: (e) => {
      const next = convertIndicDigits(e.target.value)
      setValue(name, next, { shouldValidate: true, shouldDirty: true })
      onChange({
        ...e,
        target: { ...e.target, value: next },
      })
    },
  }
}
