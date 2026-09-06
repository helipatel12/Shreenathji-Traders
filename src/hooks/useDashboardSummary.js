// Live dashboard summary — reuses useBills / usePayments / useSilakEntries
// so offline merge + firestoreId matching stay consistent with the rest
// of the app.

import { useMemo, useState, useCallback } from 'react'
import { useBills } from './useBills'
import { usePayments } from './usePayments'
import { useSilakEntries } from './useSilakEntries'
import { useVeparis } from './useVeparis'
import {
  getBillBalance,
  roundCurrency,
  excludeVoided,
  computeSilakDay,
} from '../utils/calc'
import { todayKeyIST, eachDateKeyInRange } from '../utils/dates'
import { vepariDisplayName, findVepari } from '../utils/vepari'

export const DASHBOARD_PRESETS = [
  { id: '7d', bucket: 'day' },
  { id: '1m', bucket: 'week' },
  { id: '6m', bucket: 'month' },
  { id: '1y', bucket: 'month' },
]

function daysAgoKey(n) {
  const end = todayKeyIST()
  const [y, m, d] = end.split('-').map(Number)
  const startDate = new Date(Date.UTC(y, m - 1, d - (n - 1)))
  return startDate.toISOString().slice(0, 10)
}

function monthsAgoKey(months) {
  const end = todayKeyIST()
  const [y, m] = end.split('-').map(Number)
  // Anchor to day 1 so end-of-month overflow (Mar 31 − 1 month → Mar 3) never happens.
  const startDate = new Date(Date.UTC(y, m - 1 - months, 1))
  return startDate.toISOString().slice(0, 10)
}

export function rangeForPreset(presetId) {
  const to = todayKeyIST()
  if (presetId === '7d') return { from: daysAgoKey(7), to, bucket: 'day' }
  if (presetId === '1m') return { from: daysAgoKey(30), to, bucket: 'week' }
  if (presetId === '6m') return { from: monthsAgoKey(6), to, bucket: 'month' }
  if (presetId === '1y') return { from: monthsAgoKey(12), to, bucket: 'month' }
  return { from: daysAgoKey(7), to, bucket: 'day' }
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function labelDay(dateKey) {
  const [, m, d] = dateKey.split('-')
  return `${d}-${m}`
}

function labelMonth(dateKey, { includeYear = false } = {}) {
  const [y, m] = dateKey.split('-')
  const name = MONTH_SHORT[Number(m) - 1] || m
  if (!includeYear) return name
  return `${name} ${y.slice(2)}`
}

function labelWeek(dates) {
  const first = dates[0]
  const last = dates[dates.length - 1]
  const [, m1, d1] = first.split('-')
  const [, m2, d2] = last.split('-')
  if (m1 === m2) {
    return `${d1}-${d2} ${MONTH_SHORT[Number(m1) - 1]}`
  }
  return `${d1}-${m1} → ${d2}-${m2}`
}

function inferBucket(from, to) {
  const days = eachDateKeyInRange(from, to).length
  if (days <= 10) return 'day'
  if (days <= 40) return 'week'
  return 'month'
}

/**
 * 7d → every day; 1m → weeks; 6m / 1y → month names.
 * Custom ranges infer the same rules from span length.
 */
function buildChartBuckets(from, to, bucketMode) {
  const days = eachDateKeyInRange(from, to)
  const mode = bucketMode || inferBucket(from, to)

  if (mode === 'day') {
    return days.map((date) => ({
      key: date,
      label: labelDay(date),
      dates: [date],
    }))
  }

  if (mode === 'week') {
    const buckets = []
    for (let i = 0; i < days.length; i += 7) {
      const slice = days.slice(i, i + 7)
      buckets.push({
        key: slice[0],
        label: labelWeek(slice),
        dates: slice,
      })
    }
    return buckets
  }

  const byMonth = new Map()
  // 1y (and similar ~12-month spans): month name only — year digits clutter the axis.
  // Longer custom ranges keep a short year so repeated months stay distinct.
  const includeYear = days.length > 400
  for (const date of days) {
    const key = date.slice(0, 7)
    if (!byMonth.has(key)) {
      byMonth.set(key, { key, label: labelMonth(date, { includeYear }), dates: [] })
    }
    byMonth.get(key).dates.push(date)
  }
  return [...byMonth.values()]
}

export function useDashboardSummary(fromDate, toDate, bucketMode) {
  const { bills, loading: billsLoading } = useBills()
  const { payments, loading: paymentsLoading } = usePayments()
  const { entries: silakEntries, loading: silakLoading } = useSilakEntries()
  const { veparis, loading: veparisLoading } = useVeparis()
  const loading = billsLoading || paymentsLoading || silakLoading || veparisLoading

  return useMemo(() => {
    const today = todayKeyIST()
    const from = fromDate && toDate && fromDate > toDate ? toDate : fromDate || today
    const to = fromDate && toDate && fromDate > toDate ? fromDate : toDate || today

    const activeBills = excludeVoided(bills)
    const activePayments = excludeVoided(payments).filter((p) =>
      activeBills.some((b) => b.firestoreId === p.billId),
    )
    const billsToday = activeBills.filter((b) => b.date === today)

    const pendingBills = activeBills
      .map((bill) => ({ bill, balance: getBillBalance(bill, payments) }))
      .filter(({ balance }) => balance > 0)
    const rojmerPendingAmount = roundCurrency(
      pendingBills.reduce((sum, { balance }) => sum + balance, 0),
    )

    const allSilakEntries = [
      ...activeBills.map((bill) => ({
        date: bill.date,
        side: 'jama',
        amount: bill.totalAmount,
      })),
      ...activePayments.map((payment) => ({
        date: payment.date,
        side: 'udhar',
        amount: payment.amount,
      })),
      ...silakEntries.filter((e) => e.isManual),
    ]

    const dates = allSilakEntries.map((e) => e.date).filter(Boolean)
    const earliest = dates.length ? dates.reduce((min, d) => (d < min ? d : min)) : today
    const startDate = earliest < today ? earliest : today
    let running = 0
    let silakPosition = 0
    for (const dateKey of eachDateKeyInRange(startDate, today)) {
      const dayEntries = allSilakEntries.filter((e) => e.date === dateKey)
      const { closingBalance } = computeSilakDay(dayEntries, running)
      if (dateKey === today) silakPosition = closingBalance
      running = closingBalance
    }

    const daySet = new Set(eachDateKeyInRange(from, to))
    const buckets = buildChartBuckets(from, to, bucketMode)

    const chartSeries = buckets.map((bucket) => {
      const set = new Set(bucket.dates)
      const income = roundCurrency(
        activeBills.filter((b) => set.has(b.date)).reduce((s, b) => s + (b.totalAmount || 0), 0),
      )
      const payout = roundCurrency(
        activePayments.filter((p) => set.has(p.date)).reduce((s, p) => s + (p.amount || 0), 0),
      )
      return {
        label: bucket.label,
        value: income,
        value2: payout,
        date: bucket.key,
        tip:
          bucket.dates.length === 1
            ? bucket.dates[0]
            : `${bucket.dates[0]} – ${bucket.dates[bucket.dates.length - 1]}`,
        profit: roundCurrency(income - payout),
      }
    })

    const incomeTotal = roundCurrency(
      activeBills
        .filter((b) => daySet.has(b.date))
        .reduce((s, b) => s + (b.totalAmount || 0), 0),
    )
    const expenseTotal = roundCurrency(
      activePayments
        .filter((p) => daySet.has(p.date))
        .reduce((s, p) => s + (p.amount || 0), 0),
    )
    const profitTotal = roundCurrency(incomeTotal - expenseTotal)

    const incomeSeries = chartSeries.map(({ label, value, date }) => ({ label, value, date }))
    const profitSeries = chartSeries.map(({ label, profit, date }) => ({
      label,
      value: profit,
      date,
    }))

    const byVepari = new Map()
    for (const bill of activeBills) {
      if (!daySet.has(bill.date)) continue
      const key = String(bill.vepariId || '')
      byVepari.set(key, (byVepari.get(key) || 0) + (bill.totalAmount || 0))
    }
    const ranking = [...byVepari.entries()]
      .map(([vepariId, total]) => ({
        vepariId,
        name: vepariDisplayName(veparis, vepariId) || '—',
        village: findVepari(veparis, vepariId)?.village || '',
        total: roundCurrency(total),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7)

    return {
      loading,
      billsTodayCount: billsToday.length,
      rojmerPendingCount: pendingBills.length,
      rojmerPendingAmount,
      silakPosition: roundCurrency(silakPosition),
      incomeSeries,
      profitSeries,
      chartSeries,
      ranking,
      incomeTotal,
      profitTotal,
      expenseTotal,
      rangeStart: from,
      rangeEnd: to,
    }
  }, [bills, payments, silakEntries, veparis, loading, fromDate, toDate, bucketMode])
}

export function useDashboardRange(defaultPreset = '7d') {
  const initial = rangeForPreset(defaultPreset)
  const [fromDate, setFromDate] = useState(initial.from)
  const [toDate, setToDate] = useState(initial.to)
  const [preset, setPreset] = useState(defaultPreset)
  const [bucketMode, setBucketMode] = useState(initial.bucket)

  const summary = useDashboardSummary(fromDate, toDate, bucketMode)

  const applyPreset = useCallback((presetId) => {
    const next = rangeForPreset(presetId)
    setFromDate(next.from)
    setToDate(next.to)
    setBucketMode(next.bucket)
    setPreset(presetId)
  }, [])

  const setCustomFrom = useCallback((value) => {
    setFromDate(value)
    setPreset(null)
    setBucketMode(null) // infer from span
  }, [])

  const setCustomTo = useCallback((value) => {
    setToDate(value)
    setPreset(null)
    setBucketMode(null)
  }, [])

  return {
    ...summary,
    fromDate,
    toDate,
    preset,
    setPreset: applyPreset,
    setFromDate: setCustomFrom,
    setToDate: setCustomTo,
  }
}
