import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, PauseCircle, Play, Trash2 } from 'lucide-react'
import { onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import {
  companyRef,
  inviteCompanyAdmin,
  setCompanyStatus,
  userCollectionRef,
} from '../../firebase/firestore'
import { sendPasswordReset } from '../../firebase/auth'
import { COMPANY_STATUSES } from '../../utils/roles'
import { SkeletonCard } from '../../components/Skeleton'
import StatusBadge from './StatusBadge'
import { companyInitials, timestampToDateKey } from './platformUi'

export default function CompanyDetail() {
  const { companyId } = useParams()
  const { t, formatDate, formatDigits } = useLocale()
  const { enterCompany, firebaseUser } = useAuth()
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    if (!companyId) return undefined
    const unsubCompany = onSnapshot(
      companyRef(companyId),
      (snap) => {
        setCompany(snap.exists() ? { id: snap.id, ...snap.data() } : null)
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError(t('platform.loadFailed'))
        setLoading(false)
      },
    )
    const unsubUsers = onSnapshot(
      userCollectionRef(companyId),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    )
    return () => {
      unsubCompany()
      unsubUsers()
    }
  }, [companyId, t])

  async function handleOpen() {
    setBusy(true)
    setError('')
    try {
      await enterCompany(companyId)
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError(t('platform.errOpen'))
    } finally {
      setBusy(false)
    }
  }

  async function handleStatus(status) {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await setCompanyStatus(companyId, status)
      setInfo(t('common.saved'))
    } catch (err) {
      console.error(err)
      setError(t('platform.errUpdate'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('platform.confirmDelete'))) return
    await handleStatus(COMPANY_STATUSES.DELETED)
    navigate('/platform', { replace: true })
  }

  async function handleResetPassword() {
    const email = String(company?.adminEmail || '').trim()
    if (!email) return
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await sendPasswordReset(email)
      setInfo(t('platform.resetSent'))
    } catch (err) {
      console.error(err)
      setError(t('platform.errReset'))
    } finally {
      setBusy(false)
    }
  }

  async function handleAssignAdmin(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await inviteCompanyAdmin({
        companyId,
        email: adminEmail,
        name: adminName,
        invitedBy: firebaseUser?.uid,
      })
      setInfo(t('platform.adminInvited'))
      setAdminEmail('')
      setAdminName('')
    } catch (err) {
      console.error(err)
      if (err?.code === 'INVITE_EMAIL_BUSY' || err?.message === 'INVITE_EMAIL_BUSY') {
        setError(t('platform.errInviteBusy'))
      } else {
        setError(t('platform.errUpdate'))
      }
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }
  if (!company || company.status === COMPANY_STATUSES.DELETED) {
    return (
      <div className="max-w-lg card px-6 py-8">
        <p className="text-body text-ink">{t('platform.companyGone')}</p>
        <Link to="/platform" className="text-caption text-accent font-semibold mt-3 inline-block">
          ← {t('platform.back')}
        </Link>
      </div>
    )
  }

  const suspended = company.status === COMPANY_STATUSES.SUSPENDED
  const createdKey = timestampToDateKey(company.createdAt)

  return (
    <div className="max-w-3xl">
      <Link
        to="/platform"
        className="inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        {t('platform.back')}
      </Link>

      <section className="card px-5 py-5 sm:px-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-white tracking-wide">
              {companyInitials(company.name)}
            </span>
            <div className="min-w-0">
              <StatusBadge company={company} t={t} />
              <h1 className="mt-1.5 page-title text-[1.45rem] leading-tight truncate">{company.name}</h1>
              {(company.adminEmail || company.adminName) && (
                <p className="text-caption text-ink-muted mt-1 truncate">
                  {company.adminEmail || company.adminName}
                </p>
              )}
            </div>
          </div>
          <button type="button" disabled={busy} onClick={handleOpen} className="btn-primary shrink-0">
            <BookOpen size={16} />
            {t('platform.openBooks')}
          </button>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3 border-t border-border pt-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {t('platform.colCreated')}
            </dt>
            <dd className="mt-1 text-body text-ink font-numeric">{createdKey ? formatDate(createdKey) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {t('platform.peopleShort')}
            </dt>
            <dd className="mt-1 text-body text-ink font-numeric">{formatDigits(users.length)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {t('platform.companyStatus')}
            </dt>
            <dd className="mt-1 text-body text-ink">
              {suspended ? t('platform.statusSuspended') : t('platform.statusActive')}
            </dd>
          </div>
        </dl>
      </section>

      {error && (
        <p className="mb-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-caption text-danger">
          {error}
        </p>
      )}
      {info && (
        <p className="mb-3 rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-caption text-success">
          {info}
        </p>
      )}

      <section className="card px-5 py-5 mb-4">
        <h2 className="section-label mb-3">{t('platform.companyStatus')}</h2>
        <p className="text-caption text-ink-muted mb-4">{t('platform.statusHint')}</p>
        <div className="flex flex-wrap gap-2">
          {suspended ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatus(COMPANY_STATUSES.ACTIVE)}
              className="btn-secondary"
            >
              <Play size={16} />
              {t('platform.reactivate')}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => handleStatus(COMPANY_STATUSES.SUSPENDED)}
              className="btn-secondary"
            >
              <PauseCircle size={16} />
              {t('platform.suspend')}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-danger/30 text-danger text-caption font-semibold hover:bg-danger/5"
          >
            <Trash2 size={16} />
            {t('platform.removeCompany')}
          </button>
        </div>
      </section>

      <section className="card px-5 py-5 mb-4">
        <h2 className="section-label mb-3">{t('platform.companyAdmin')}</h2>
        <p className="text-caption text-ink-muted mb-3">{t('platform.adminResetHint')}</p>
        <button
          type="button"
          disabled={busy || !company.adminEmail}
          onClick={handleResetPassword}
          className="btn-secondary mb-5 disabled:opacity-40"
        >
          {t('platform.sendPasswordReset')}
        </button>
        <form onSubmit={handleAssignAdmin} className="space-y-3 pt-4 border-t border-border">
          <p className="text-caption text-ink">{t('platform.replaceAdminHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="field-input"
              placeholder={t('platform.adminName')}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
            <input
              type="email"
              className="field-input"
              placeholder={t('platform.adminEmail')}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || !adminEmail.trim()}
            className="btn-primary disabled:opacity-40"
          >
            {t('platform.inviteAdmin')}
          </button>
        </form>
      </section>

      {users.length > 0 && (
        <section className="card px-5 py-4">
          <h2 className="section-label mb-3">{t('platform.people')}</h2>
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="py-2.5 flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body text-ink truncate">{u.name || u.email}</p>
                  {u.name && u.email ? (
                    <p className="text-[11px] text-ink-muted truncate">{u.email}</p>
                  ) : null}
                </div>
                <span className="text-caption text-ink-muted shrink-0">
                  {t(`roles.${u.role === 'owner' ? 'company_admin' : u.role}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
