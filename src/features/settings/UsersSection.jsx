// Users & invites — Phase 8. This is the piece phases.md's own "done
// when" for this phase actually tests: "a second staff login can be
// created and used from a second device/location." See
// firebase/firestore.js's getOrCreateUserOnFirstLogin for the other
// half of this flow (what happens when the invited person actually
// signs up).

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUsers } from '../../hooks/useUsers'
import { useInvites } from '../../hooks/useInvites'
import { useLocale } from '../../context/LocaleContext'
import InviteForm from './InviteForm'

function RevokeInviteDialog({ inviteLabel, busy, error, onConfirm, onCancel }) {
  const { t } = useLocale()
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{t('settings.revokeInviteTitle')}</p>
        <p className="text-caption text-ink-muted mb-2">{t('settings.revokeInviteBody')}</p>
        <p className="text-body text-ink font-semibold mb-4">{inviteLabel}</p>
        {error && <p className="text-caption text-danger mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 min-h-12 rounded-xl bg-danger text-surface font-semibold text-body disabled:opacity-40"
          >
            {busy ? t('common.loading') : t('settings.confirmRevokeInvite')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted disabled:opacity-40"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersSection() {
  const { t } = useLocale()
  const { user } = useAuth()
  const { users, loading: usersLoading } = useUsers()
  const { invites, loading: invitesLoading, addInvite, revokeInvite } = useInvites()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [revokingInvite, setRevokingInvite] = useState(null)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  const pendingInvites = invites.filter((i) => i.status === 'pending')

  function roleLabel(role) {
    return t(`roles.${role}`) ?? role
  }

  async function handleInvite(values) {
    await addInvite({ ...values, invitedBy: user?.email })
    setShowInviteForm(false)
  }

  async function handleConfirmRevoke() {
    if (!revokingInvite || revokeBusy) return
    setRevokeBusy(true)
    setRevokeError('')
    try {
      await revokeInvite(revokingInvite)
      setRevokingInvite(null)
    } catch (err) {
      console.error('Revoke invite failed:', err)
      setRevokeError(t('settings.revokeInviteFailed'))
    } finally {
      setRevokeBusy(false)
    }
  }

  return (
    <div className="card px-5 py-5 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption text-accent font-semibold uppercase tracking-wide">
          {t('settings.usersTitle')}
        </p>
        {!showInviteForm && (
          <button
            type="button"
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center gap-1.5 min-h-12 px-3 rounded-lg text-caption font-semibold text-accent hover:bg-accent-soft"
          >
            <Plus size={16} strokeWidth={2} />
            {t('settings.inviteTitle')}
          </button>
        )}
      </div>

      {showInviteForm && (
        <div className="mb-5">
          <InviteForm onSubmit={handleInvite} onCancel={() => setShowInviteForm(false)} />
        </div>
      )}

      {usersLoading ? (
        <p className="text-caption text-ink-muted">{t('common.loading')}</p>
      ) : (
        <ul className="divide-y divide-border mb-4">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <p className="text-body text-ink">
                {u.name || u.email}
                <span className="text-ink-muted"> · {roleLabel(u.role)}</span>
              </p>
              {u.location && <p className="text-caption text-ink-muted">{u.location}</p>}
            </li>
          ))}
        </ul>
      )}

      {!invitesLoading && (
        <div>
          <p className="text-caption text-ink-muted uppercase tracking-wide mb-2">
            {t('settings.pendingInvitesLabel')}
          </p>
          {pendingInvites.length === 0 ? (
            <p className="text-body text-ink-muted">{t('settings.noPendingInvites')}</p>
          ) : (
            <ul className="space-y-1.5">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between text-caption gap-2">
                  <span className="text-ink">
                    {invite.email} · {roleLabel(invite.role)}
                    {invite.location && ` · ${invite.location}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeError('')
                      setRevokingInvite(invite)
                    }}
                    aria-label={`${t('settings.revoke')} ${invite.email}`}
                    className="min-h-12 min-w-12 inline-flex items-center justify-center text-ink-muted hover:text-danger shrink-0"
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {revokingInvite && (
        <RevokeInviteDialog
          inviteLabel={revokingInvite.email || revokingInvite.id}
          busy={revokeBusy}
          error={revokeError}
          onConfirm={handleConfirmRevoke}
          onCancel={() => {
            if (revokeBusy) return
            setRevokingInvite(null)
            setRevokeError('')
          }}
        />
      )}
    </div>
  )
}
