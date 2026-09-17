// Six separate digit boxes. Paste of a 6-digit code fills them;
// paste of a longer inbox link is handed to onPasteLink instead.

export default function OtpInput({
  id = 'otp',
  value,
  onChange,
  onPasteLink,
  disabled = false,
  autoFocus = false,
}) {
  const digits = String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6)
    .split('')

  function setDigit(index, char) {
    const next = Array.from({ length: 6 }, (_, i) => digits[i] || '')
    next[index] = char
    onChange(next.join(''))
  }

  function focusBox(index) {
    const el = document.getElementById(`${id}-${index}`)
    el?.focus?.()
    el?.select?.()
  }

  function handlePaste(event) {
    const pasted = event.clipboardData?.getData('text') || ''
    const compact = pasted.replace(/\s+/g, '').trim()
    if (!compact) return

    if (compact.includes('://') || /oobCode=/i.test(compact)) {
      event.preventDefault()
      onPasteLink?.(compact)
      return
    }

    const nums = compact.replace(/\D/g, '').slice(0, 6)
    if (nums.length >= 4) {
      event.preventDefault()
      onChange(nums)
      focusBox(Math.min(nums.length, 5))
    }
  }

  return (
    <div className="flex gap-2 justify-between" onPaste={handlePaste}>
      {Array.from({ length: 6 }, (_, index) => (
        <input
          key={index}
          id={`${id}-${index}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          maxLength={1}
          value={digits[index] || ''}
          aria-label={`${index + 1} of 6`}
          className="field-input w-11 min-h-12 text-center font-numeric text-heading px-0"
          onChange={(event) => {
            const char = event.target.value.replace(/\D/g, '').slice(-1)
            setDigit(index, char)
            if (char && index < 5) focusBox(index + 1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) {
              setDigit(index - 1, '')
              focusBox(index - 1)
            }
            if (event.key === 'ArrowLeft' && index > 0) focusBox(index - 1)
            if (event.key === 'ArrowRight' && index < 5) focusBox(index + 1)
          }}
        />
      ))}
    </div>
  )
}
