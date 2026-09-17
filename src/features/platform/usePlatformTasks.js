import { useCallback, useMemo, useState } from 'react'
import { COMPANY_STATUSES } from '../../utils/roles'
import { hasPendingAdmin } from './platformUi'

const STORAGE_KEY = 'stm-platform-task-read'

function loadRead() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveRead(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function buildPlatformTasks(companies) {
  const tasks = []
  companies.forEach((company) => {
    if (hasPendingAdmin(company)) {
      tasks.push({
        id: `pending-${company.id}`,
        type: 'pending',
        companyId: company.id,
        name: company.name,
      })
    }
    if (company.status === COMPANY_STATUSES.SUSPENDED) {
      tasks.push({
        id: `paused-${company.id}`,
        type: 'paused',
        companyId: company.id,
        name: company.name,
      })
    }
  })
  return tasks
}

export function usePlatformTasks(companies) {
  const [read, setRead] = useState(loadRead)
  const tasks = useMemo(() => buildPlatformTasks(companies || []), [companies])
  const unread = useMemo(() => tasks.filter((task) => !read[task.id]), [tasks, read])

  const markRead = useCallback((id) => {
    setRead((prev) => {
      if (prev[id]) return prev
      const next = { ...prev, [id]: true }
      saveRead(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setRead((prev) => {
      const next = { ...prev }
      tasks.forEach((task) => {
        next[task.id] = true
      })
      saveRead(next)
      return next
    })
  }, [tasks])

  return { tasks, unread, unreadCount: unread.length, read, markRead, markAllRead }
}
