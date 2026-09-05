import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import gu from '../locales/gu.json'
import en from '../locales/en.json'
import { formatCurrency as formatCurrencyRaw } from '../utils/calc'
import { localizeDigits } from '../utils/numbers'

const STORAGE_KEY = 'stm-lang'
const catalogs = { gu, en }

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function interpolate(str, vars, lang) {
  if (!vars || typeof str !== 'string') return str
  return str.replace(/\{(\w+)\}/g, (_, key) => {
    if (vars[key] == null) return `{${key}}`
    return localizeDigits(vars[key], lang)
  })
}

export const LocaleContext = createContext(null)

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'gu') return saved
    } catch {
      /* ignore */
    }
    return 'gu'
  })

  const setLang = useCallback((next) => {
    const value = next === 'en' ? 'en' : 'gu'
    setLangState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'gu' ? 'en' : 'gu')
  }, [lang, setLang])

  useEffect(() => {
    document.documentElement.lang = lang === 'gu' ? 'gu' : 'en'
  }, [lang])

  const catalog = catalogs[lang] || gu

  const t = useCallback(
    (path, vars) => {
      const value = getByPath(catalog, path)
      if (value == null) {
        const fallback = getByPath(gu, path)
        return interpolate(fallback ?? path, vars, lang)
      }
      if (typeof value === 'string') return interpolate(value, vars, lang)
      return value
    },
    [catalog, lang],
  )

  // Print templates always stay Gujarati — matching the paper books.
  const printT = useCallback((path, vars) => {
    const value = getByPath(gu, path)
    if (typeof value === 'string') return interpolate(value, vars, 'gu')
    return value
  }, [])

  /** Currency with locale digits (Gujarati ૦-૯ when lang is gu). */
  const formatCurrency = useCallback(
    (amount) => localizeDigits(formatCurrencyRaw(amount), lang),
    [lang],
  )

  /** Any number/date/string — ASCII digits → Gujarati when lang is gu. */
  const formatDigits = useCallback((value) => localizeDigits(value, lang), [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang,
      t,
      printT,
      catalog,
      formatCurrency,
      formatDigits,
    }),
    [lang, setLang, toggleLang, t, printT, catalog, formatCurrency, formatDigits],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
