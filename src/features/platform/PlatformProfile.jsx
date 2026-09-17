import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import ProfileSection from '../settings/ProfileSection'
import { operatorName } from './platformUi'

export default function PlatformProfile() {
  const { t } = useLocale()
  const { user } = useAuth()
  const name = operatorName(user)

  return (
    <div className="max-w-xl">
      <Link
        to="/platform"
        className="inline-flex items-center gap-1 text-[12px] text-ink-muted hover:text-ink mb-3"
      >
        <ArrowLeft size={14} />
        {t('platform.home')}
      </Link>
      <header className="mb-4 pl-3 border-l-[3px] border-[#b3413a]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {t('platform.eyebrow')}
        </p>
        <h1 className="mt-0.5 text-xl font-display font-bold text-ink tracking-tight">
          {t('platform.profile')}
        </h1>
        <p className="text-[13px] text-ink-muted mt-0.5">
          {name}
          {user?.email ? ` · ${user.email}` : ''}
        </p>
      </header>
      <ProfileSection />
    </div>
  )
}
