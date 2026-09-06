import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

/**
 * Combobox: type to filter + pick from list.
 * options: [{ value, label, searchText? }]
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  id,
  className = '',
  placeholder = '—',
  allowEmpty = true,
  emptyLabel = '—',
  disabled = false,
  compact = false,
  searchPlaceholder,
  'aria-label': ariaLabel,
}) {
  const autoId = useId()
  const inputId = id || autoId
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [panelStyle, setPanelStyle] = useState(null)

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = allowEmpty
      ? [{ value: '', label: emptyLabel, searchText: emptyLabel }, ...options]
      : options
    if (!q) return list
    return list.filter((o) => {
      if (o.value === '') return emptyLabel.toLowerCase().includes(q) || q === '—'
      const hay = String(o.searchText || o.label || '').toLowerCase()
      return hay.includes(q)
    })
  }, [options, query, allowEmpty, emptyLabel])

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPanelStyle(null)
      return undefined
    }
    function place() {
      const rect = rootRef.current.getBoundingClientRect()
      const width = Math.max(rect.width, compact ? 192 : 224)
      const spaceBelow = window.innerHeight - rect.bottom
      const openUp = spaceBelow < 260 && rect.top > spaceBelow
      setPanelStyle({
        position: 'fixed',
        left: Math.min(rect.left, window.innerWidth - width - 8),
        width,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: 256,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, compact])

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        // Panel is portaled via fixed positioning but still under rootRef
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) {
      setHighlight(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  function pick(next) {
    onChange?.(next)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) pick(opt.value)
    }
  }

  const shellClass = [
    'searchable-select',
    compact ? 'is-compact' : '',
    open ? 'is-open' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={shellClass}>
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="searchable-select-trigger"
        onClick={() => {
          if (disabled) return
          setOpen((o) => !o)
        }}
        onKeyDown={onKeyDown}
      >
        <span className={`searchable-select-value ${selected ? '' : 'is-placeholder'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={compact ? 14 : 16} className="searchable-select-chevron" />
      </button>

      {open ? (
        <div className="searchable-select-panel" role="listbox" style={panelStyle || undefined}>
          <div className="searchable-select-search">
            <Search size={14} className="searchable-select-search-icon" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setHighlight(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder || placeholder}
              className="searchable-select-input"
              autoComplete="off"
            />
          </div>
          <ul className="searchable-select-list">
            {filtered.length === 0 ? (
              <li className="searchable-select-empty">—</li>
            ) : (
              filtered.map((opt, index) => {
                const active = String(opt.value) === String(value)
                const hi = index === highlight
                return (
                  <li key={`${opt.value}-${index}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={[
                        'searchable-select-option',
                        active ? 'is-active' : '',
                        hi ? 'is-highlight' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => pick(opt.value)}
                    >
                      {opt.label}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
