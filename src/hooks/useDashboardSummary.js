// Live dashboard summary — bills entered today, rojmer pending
// count/amount, today's jansa silak position (phases.md Phase 2).
//
// Reads local (Dexie) first per rules.md §5, then subscribes to
// Firestore for live updates. Right now local will always come back
// empty — nothing writes to Dexie yet, since bill/payment/silak entry
// creation is Phase 4/6/7 — but the read-local-first shape is
// established now so those phases don't have to retrofit it later.
//
// Bills/payments are fetched in full (not date-scoped queries):
// rojmer's "who do I still owe money to" (prd.md §4.3) needs every
// bill regardless of date, and at this app's scale (prd.md §5: 1-5
// users, "load/scale testing is not a real concern" per phases.md)
// client-side filtering is simpler than maintaining composite
// Firestore indexes for a handful of documents.

import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db as firestoreDb } from '../firebase/config'
import { db as localDb } from '../db/localDb'
import { BUSINESS_ID } from '../firebase/firestore'
import { getBillBalance, roundCurrency, excludeVoided } from '../utils/calc'
import { todayKeyIST } from '../utils/dates'

export function useDashboardSummary() {
  const [bills, setBills] = useState([])
  const [payments, setPayments] = useState([])
  const [silakEntries, setSilakEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      localDb.bills.toArray(),
      localDb.payments.toArray(),
      localDb.silakEntries.toArray(),
    ]).then(([localBills, localPayments, localSilak]) => {
      if (cancelled) return
      if (localBills.length) setBills(localBills)
      if (localPayments.length) setPayments(localPayments)
      if (localSilak.length) setSilakEntries(localSilak)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const billsCol = collection(firestoreDb, 'businesses', BUSINESS_ID, 'bills')
    const paymentsCol = collection(firestoreDb, 'businesses', BUSINESS_ID, 'payments')
    const silakCol = collection(firestoreDb, 'businesses', BUSINESS_ID, 'silakEntries')

    let billsLoaded = false
    let paymentsLoaded = false
    let silakLoaded = false
    function checkAllLoaded() {
      if (billsLoaded && paymentsLoaded && silakLoaded) setLoading(false)
    }

    const unsubBills = onSnapshot(billsCol, (snap) => {
      setBills(snap.docs.map((d) => ({ id: d.id, firestoreId: d.id, ...d.data() })))
      billsLoaded = true
      checkAllLoaded()
    })
    const unsubPayments = onSnapshot(paymentsCol, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, firestoreId: d.id, ...d.data() })))
      paymentsLoaded = true
      checkAllLoaded()
    })
    const unsubSilak = onSnapshot(silakCol, (snap) => {
      setSilakEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      silakLoaded = true
      checkAllLoaded()
    })

    return () => {
      unsubBills()
      unsubPayments()
      unsubSilak()
    }
  }, [])

  const today = todayKeyIST()
  // Voided bills (owner-only action, useBills.js) never count toward
  // the dashboard — they stay visible only on the Bills screen itself
  // for audit purposes (calc.js's excludeVoided()).
  const activeBills = excludeVoided(bills)
  const billsToday = activeBills.filter((b) => b.date === today)

  const pendingBills = activeBills
    .map((bill) => ({ bill, balance: getBillBalance(bill, payments) }))
    .filter(({ balance }) => balance > 0)
  const rojmerPendingAmount = roundCurrency(
    pendingBills.reduce((sum, { balance }) => sum + balance, 0)
  )

  const silakToday = silakEntries.filter((e) => e.date === today)
  const silakJama = silakToday
    .filter((e) => e.side === 'jama')
    .reduce((sum, e) => sum + (e.amount || 0), 0)
  const silakUdhar = silakToday
    .filter((e) => e.side === 'udhar')
    .reduce((sum, e) => sum + (e.amount || 0), 0)

  return {
    loading,
    billsTodayCount: billsToday.length,
    rojmerPendingCount: pendingBills.length,
    rojmerPendingAmount,
    silakPosition: roundCurrency(silakJama - silakUdhar),
  }
}
