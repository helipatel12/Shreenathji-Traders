import { CheckCircle2, Clock, PauseCircle } from 'lucide-react'
import { COMPANY_STATUSES } from '../../utils/roles'
import { hasPendingAdmin } from './platformUi'

export default function StatusBadge({ company, status, t }) {
  const resolved = status || company?.status
  if (resolved === COMPANY_STATUSES.SUSPENDED) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[11px] font-semibold">
        <PauseCircle size={12} />
        {t('platform.statusSuspended')}
      </span>
    )
  }
  if (company && hasPendingAdmin(company)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-ink-muted px-2 py-0.5 text-[11px] font-semibold">
        <Clock size={12} />
        {t('platform.noAdminYet')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[11px] font-semibold">
      <CheckCircle2 size={12} />
      {t('platform.statusActive')}
    </span>
  )
}
