import { createContext, useContext } from 'react'
import { useCompanies } from '../../hooks/useCompanies'
import { usePlatformTasks } from './usePlatformTasks'

const PlatformDataContext = createContext(null)

export function PlatformDataProvider({ children }) {
  const companiesState = useCompanies()
  const tasksState = usePlatformTasks(companiesState.companies)
  return (
    <PlatformDataContext.Provider value={{ ...companiesState, ...tasksState }}>
      {children}
    </PlatformDataContext.Provider>
  )
}

export function usePlatformData() {
  const ctx = useContext(PlatformDataContext)
  if (!ctx) throw new Error('usePlatformData must be used inside PlatformDataProvider')
  return ctx
}
