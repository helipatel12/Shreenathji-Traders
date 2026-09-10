import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUsers } from '../../hooks/useUsers'
import { useInvites } from '../../hooks/useInvites'
import { useLocale } from '../../context/LocaleContext'
import InviteForm from '../settings/InviteForm'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'

function DeleteUserDialog({ userLabel, busy, error, onConfirm, onCancel }) {
  const { t } = useLocale()
  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
      <div className="card px-5 py-5 max-w-sm w-full">
        <p className="text-body text-ink font-semibold mb-1">{t('admin.deleteUserTitle')}</p>
        <p className="text-caption text-ink-muted mb-2">{t('admin.deleteUserBody')}</p>
        <p className="text-body text-ink font-semibold mb-4">{userLabel}</p>
        {error && <p className="text-caption text-danger mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 min-h-12 rounded-xl bg-danger text-surface font-semibold text-body disabled:opacity-40"
          >
            {busy ? t('common.loading') : t('admin.confirmDeleteUser')}
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

export default function UserManagementScreen() {
  const { isOwner, user } = useAuth()
  const { t } = useLocale()
  const { users, loading: usersLoading, updateUser, deleteUser } = useUsers()
  const { invites, loading: invitesLoading, addInvite, revokeInvite } = useInvites()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [revokingInvite, setRevokingInvite] = useState(null)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [revokeError, setRevokeError] = useState('')

  const pendingInvites = invites.filter((i) => i.status === 'pending')
  const ownerCount = useMemo(
    () => users.filter((u) => u.role === 'owner').length,
    [users],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (!q) return true
      return (
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.location || '').toLowerCase().includes(q)
      )
    })
  }, [users, search, roleFilter])

  if (!isOwner) return <Navigate to="/" replace />

  async function handleInvite(values) {
    await addInvite({ ...values, invitedBy: user?.email })
    setShowInviteForm(false)
  }

  function canDeleteUser(u) {
    if (!u) return false
    if (u.id === user?.id) return false
    if (u.role === 'owner' && ownerCount <= 1) return false
    return true
  }

  function deleteBlockedReason(u) {
    if (u.id === user?.id) return t('admin.cannotDeleteSelf')
    if (u.role === 'owner' && ownerCount <= 1) return t('admin.cannotDeleteLastOwner')
    return ''
  }

  async function handleConfirmDelete() {
    if (!deletingUser || deleteBusy) return
    if (!canDeleteUser(deletingUser)) {
      setDeleteError(deleteBlockedReason(deletingUser))
      return
    }
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await deleteUser(deletingUser.id, { email: deletingUser.email })
      setSelectedId((id) => (id === deletingUser.id ? null : id))
      setDeletingUser(null)
    } catch (err) {
      console.error('Delete user failed:', err)
      setDeleteError(t('admin.deleteUserFailed'))
    } finally {
      setDeleteBusy(false)
    }
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

  const columns = [
    {
      key: 'name',
      header: t('admin.name'),
      render: (u) => (
        <div>
          <p className="font-semibold">{u.name || '—'}</p>
          <p className="text-caption text-ink-muted">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('admin.role'),
      filter: {
        value: roleFilter,
        onChange: setRoleFilter,
        allLabel: t('admin.allRoles'),
        options: [
          { value: 'owner', label: t('roles.owner') },
          { value: 'staff', label: t('roles.staff') },
          { value: 'ca', label: t('roles.ca') },
        ],
      },
      render: (u) => (
        <span
          className={`badge ${
            u.role === 'owner' ? 'badge-blue' : u.role === 'staff' ? 'badge-green' : 'badge-gray'
          }`}
        >
          {t(`roles.${u.role}`)}
        </span>
      ),
    },
    {
      key: 'location',
      header: t('admin.location'),
      render: (u) => u.location || '—',
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right',
      render: (u) => {
        const allowed = canDeleteUser(u)
        return (
          <button
            type="button"
            disabled={!allowed}
            title={allowed ? t('admin.deleteUser') : deleteBlockedReason(u)}
            aria-label={t('admin.deleteUser')}
            onClick={(e) => {
              e.stopPropagation()
              if (!allowed) return
              setDeleteError('')
              setDeletingUser(u)
            }}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl text-ink-muted hover:text-danger hover:bg-danger/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        )
      },
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">{t('admin.usersTitle')}</h1>
          <p className="text-body text-ink-muted mt-1">{t('admin.usersSubtitle')}</p>
        </div>
        {!showInviteForm && (
          <button type="button" onClick={() => setShowInviteForm(true)} className="btn-primary">
            <Plus size={18} />
            {t('settings.inviteTitle')}
          </button>
        )}
      </div>

      {showInviteForm && (
        <div className="card px-5 py-5 mb-5 max-w-lg">
          <InviteForm onSubmit={handleInvite} onCancel={() => setShowInviteForm(false)} />
        </div>
      )}

      {usersLoading ? (
        <SkeletonTable rows={5} cols={3} />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey="id"
          selectedKey={selectedId}
          onRowClick={(u) => setSelectedId((id) => (id === u.id ? null : u.id))}
          empty={<p className="text-body text-ink-muted">{t('admin.noUsers')}</p>}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('admin.searchUsers')}
            />
          }
          renderExpanded={(u) => {
            const blocked = deleteBlockedReason(u)
            return (
              <div className="flex flex-wrap gap-3 items-end justify-between">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-caption text-ink-muted mb-1">{t('admin.role')}</label>
                    <select
                      value={u.role}
                      disabled={u.id === user?.id}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      className="min-h-11 rounded-xl border border-border px-3 bg-surface"
                    >
                      <option value="owner">{t('roles.owner')}</option>
                      <option value="staff">{t('roles.staff')}</option>
                      <option value="ca">{t('roles.ca')}</option>
                    </select>
                  </div>
                  <p className="text-caption text-ink-muted pb-2">
                    {u.id === user?.id ? t('admin.cannotChangeSelf') : t('admin.clickToChangeRole')}
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-1">
                  <button
                    type="button"
                    disabled={!canDeleteUser(u)}
                    onClick={() => {
                      setDeleteError('')
                      setDeletingUser(u)
                    }}
                    className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-danger/30 text-danger hover:bg-danger/5 font-semibold text-body disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Trash2 size={16} />
                    {t('admin.deleteUser')}
                  </button>
                  {blocked ? (
                    <p className="text-caption text-ink-muted max-w-[16rem]">{blocked}</p>
                  ) : null}
                </div>
              </div>
            )
          }}
        />
      )}

      {deletingUser && (
        <DeleteUserDialog
          userLabel={deletingUser.name || deletingUser.email || deletingUser.id}
          busy={deleteBusy}
          error={deleteError}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (deleteBusy) return
            setDeletingUser(null)
            setDeleteError('')
          }}
        />
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

      {!invitesLoading && (
        <div className="mt-8">
          <h2 className="text-heading font-semibold mb-3">{t('settings.pendingInvitesLabel')}</h2>
          {pendingInvites.length === 0 ? (
            <p className="text-body text-ink-muted">{t('settings.noPendingInvites')}</p>
          ) : (
            <ul className="card divide-y divide-border">
              {pendingInvites.map((invite) => (
                <li key={invite.id} className="flex items-center justify-between px-4 py-3 gap-2">
                  <span className="text-body">
                    {invite.email} · {t(`roles.${invite.role}`)}
                    {invite.location && ` · ${invite.location}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRevokeError('')
                      setRevokingInvite(invite)
                    }}
                    className="min-h-11 min-w-11 inline-flex items-center justify-center text-ink-muted hover:text-danger"
                    aria-label={t('settings.revoke')}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
