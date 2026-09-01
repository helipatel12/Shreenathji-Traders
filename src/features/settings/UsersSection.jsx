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
import gu from '../../locales/gu.json'
import InviteForm from './InviteForm'

function roleLabel(role) {
  return gu.roles[role] ?? role
}

export default function UsersSection() {
  const { user } = useAuth()
  const { users, loading: usersLoading } = useUsers()
  const { invites, loading: invitesLoading, addInvite, revokeInvite } = useInvites()
  const [showInviteForm, setShowInviteForm] = useState(false)

  const pendingInvites = invites.filter((i) => i.status === 'pending')

  async function handleInvite(values) {
    await addInvite({ ...values, invitedBy: user?.email })
    setShowInviteForm(false)
  }

  return (
    <div className="card px-5 py-5 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption text-accent font-semibold uppercase tracking-wide">
          {gu.settings.usersTitle}
        </p>
        {!showInviteForm && (
          <button
            type="button"
            onClick={() => setShowInviteForm(true)}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-caption font-semibold text-accent hover:bg-accent-soft"
          >
            <Plus size={16} strokeWidth={2} />
            {gu.settings.inviteTitle}
          </button>
        )}
      </div>

      {showInviteForm && (
        <div className="mb-5">
          <InviteForm onSubmit={handleInvite} onCancel={() => setShowInviteForm(false)} />
        </div>
      )}

      {usersLoading ? (
        <p className="text-caption text-ink-muted">Loading…</p>
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

      {!invitesLoading && pendingInvites.length > 0 && (
        <div>
          <p className="text-caption text-ink-muted uppercase tracking-wide mb-2">
            {gu.settings.pendingInvitesLabel}
          </p>
          <ul className="space-y-1.5">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between text-caption gap-2">
                <span className="text-ink">
                  {invite.email} · {roleLabel(invite.role)}
                  {invite.location && ` · ${invite.location}`}
                </span>
                <button
                  type="button"
                  onClick={() => revokeInvite(invite.email)}
                  aria-label={`Revoke invite for ${invite.email}`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-danger shrink-0"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
