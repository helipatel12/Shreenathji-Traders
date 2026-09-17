import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { companiesCollectionRef } from '../firebase/firestore'
import { COMPANY_STATUSES } from '../utils/roles'

export function useCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      companiesCollectionRef(),
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en'))
        setCompanies(rows)
        setError(null)
        setLoading(false)
      },
      (err) => {
        console.error('Companies list failed:', err)
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  const visible = companies.filter((c) => c.status !== COMPANY_STATUSES.DELETED)
  const activeCount = visible.filter((c) => c.status === COMPANY_STATUSES.ACTIVE).length
  const suspendedCount = visible.filter((c) => c.status === COMPANY_STATUSES.SUSPENDED).length

  return { companies: visible, allCompanies: companies, loading, error, activeCount, suspendedCount }
}
