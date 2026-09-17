// Business profile + global default rates — Phase 8. Unlike
// veparis/bills/payments/silakEntries, this deliberately has NO local
// Dexie caching or offline-write queueing: it's a single admin-only
// document, edited occasionally by the owner from Settings, not
// something field staff need to create/edit while offline entering a
// bill. rules.md §5's offline-first requirement is about keeping
// day-to-day ledger work usable without network — it was never meant
// to force every single screen in the app through the same local-
// first machinery regardless of how it's actually used. If this ever
// needs to work offline too, the pattern from useVeparis.js is right
// there to copy.

import { useEffect, useState } from 'react'
import { onSnapshot, updateDoc } from 'firebase/firestore'
import { businessRef } from '../firebase/firestore'
import { useAuth } from './useAuth'

export function useBusiness() {
  const { companyId } = useAuth()
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!companyId) {
      setBusiness(null)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const unsubscribe = onSnapshot(
      businessRef(companyId),
      (snap) => {
        setBusiness(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error('Business snapshot failed:', err)
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [companyId])

  async function updateBusiness(changes) {
    if (!companyId) throw new Error('No company selected')
    await updateDoc(businessRef(companyId), changes)
  }

  return { business, loading, error, updateBusiness }
}
