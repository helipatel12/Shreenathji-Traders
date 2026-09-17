import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useLocale } from '../../context/LocaleContext'
import { createCompany } from '../../firebase/firestore'

export default function CompanyForm() {
  const { t } = useLocale()
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState('')

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t('platform.errCompanyName')),
        adminName: z.string().trim().min(2, t('platform.errAdminName')),
        adminEmail: z.string().trim().email(t('settings.validEmail')),
      }),
    [t],
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', adminName: '', adminEmail: '' },
  })

  async function onSubmit(values) {
    setFormError('')
    try {
      const id = await createCompany({
        name: values.name,
        adminName: values.adminName,
        adminEmail: values.adminEmail,
        createdByUid: firebaseUser.uid,
      })
      navigate(`/platform/companies/${id}`, { replace: true })
    } catch (err) {
      console.error('Create company failed:', err)
      if (err?.code === 'INVITE_EMAIL_BUSY' || err?.message === 'INVITE_EMAIL_BUSY') {
        setFormError(t('platform.errInviteBusy'))
      } else {
        setFormError(t('platform.errCreate'))
      }
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        to="/platform"
        className="inline-flex items-center gap-1 text-caption text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} />
        {t('platform.back')}
      </Link>

      <header className="mb-6 pl-3 border-l-[3px] border-[#b3413a]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          {t('platform.eyebrow')}
        </p>
        <h1 className="mt-1 page-title">{t('platform.addCompany')}</h1>
        <p className="page-subtitle max-w-xl">{t('platform.addCompanyHint')}</p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="card px-5 py-6 sm:px-6 space-y-6">
        <section>
          <h2 className="section-label mb-3">{t('platform.formSectionCompany')}</h2>
          <label htmlFor="company-name" className="field-label">
            {t('platform.companyName')}
          </label>
          <input id="company-name" className="field-input" autoComplete="organization" {...register('name')} />
          {errors.name && <p className="text-caption text-danger mt-1">{errors.name.message}</p>}
        </section>

        <section className="pt-1 border-t border-border">
          <h2 className="section-label mb-1">{t('platform.formSectionAdmin')}</h2>
          <p className="text-caption text-ink-muted mb-4">{t('platform.formSectionAdminHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="admin-name" className="field-label">
                {t('platform.adminName')}
              </label>
              <input id="admin-name" className="field-input" autoComplete="name" {...register('adminName')} />
              {errors.adminName && (
                <p className="text-caption text-danger mt-1">{errors.adminName.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="admin-email" className="field-label">
                {t('platform.adminEmail')}
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                className="field-input"
                {...register('adminEmail')}
              />
              {errors.adminEmail && (
                <p className="text-caption text-danger mt-1">{errors.adminEmail.message}</p>
              )}
            </div>
          </div>
        </section>

        {formError && (
          <p className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-caption text-danger">
            {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-40">
            {isSubmitting ? t('common.loading') : t('platform.createCompany')}
          </button>
          <Link to="/platform" className="btn-secondary">
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}
