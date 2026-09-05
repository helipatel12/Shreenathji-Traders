// Normalize Indic / Gujarati digits and common separators so form
// fields accept what brokers actually type on phone keyboards.

const DIGIT_MAP = {
  '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4',
  '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
}

const ASCII_TO_GUJARATI = {
  '0': '૦', '1': '૧', '2': '૨', '3': '૩', '4': '૪',
  '5': '૫', '6': '૬', '7': '૭', '8': '૮', '9': '૯',
}

/** Convert Indic/Arabic/fullwidth digits → ASCII, keep other chars. */
export function convertIndicDigits(value) {
  if (value == null) return ''
  return String(value).replace(
    /[૦-૯०-९٠-٩۰-۹０-９]/g,
    (ch) => DIGIT_MAP[ch] ?? ch,
  )
}

/** ASCII digits → Gujarati digits (for display when UI lang is gu). */
export function toGujaratiDigits(value) {
  if (value == null) return ''
  return String(value).replace(/[0-9]/g, (d) => ASCII_TO_GUJARATI[d] ?? d)
}

/** Localize digit glyphs for display; keeps ₹, commas, decimals, etc. */
export function localizeDigits(value, lang) {
  const s = value == null ? '' : String(value)
  return lang === 'gu' ? toGujaratiDigits(s) : s
}

export function normalizeIndicDigits(value) {
  if (value == null) return ''
  return convertIndicDigits(value)
    .replace(/[,\u066B\u066C\s]/g, '')
    .replace(/[٫。]/g, '.')
    .trim()
}

export function parseLocaleNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  const normalized = normalizeIndicDigits(value)
  if (!normalized || normalized === '.' || normalized === '-' || normalized === '-.') return NaN
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

/** Zod-friendly preprocessor: Gujarati/Arabic digits → number */
export function preprocessNumber(val) {
  if (val === '' || val == null) return undefined
  if (typeof val === 'number') return Number.isFinite(val) ? val : undefined
  const n = parseLocaleNumber(val)
  return Number.isFinite(n) ? n : undefined
}
