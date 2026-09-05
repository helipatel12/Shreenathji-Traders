import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUsers } from '../../hooks/useUsers'
import { useInvites } from '../../hooks/useInvites'
import { useLocale } from '../../context/LocaleContext'
import InviteForm from '../settings/InviteForm'
import DataTable from '../../components/DataTable'
import TableToolbar from '../../components/TableToolbar'
import { SkeletonTable } from '../../components/Skeleton'

export default function UserManagementScreen() {
  const { isOwner, user } = useAuth()
  const { t } = useLocale()
  const { users, loading: usersLoading, updateUser } = useUsers()
  const { invites, loading: invitesLoading, addInvite, revokeInvite } = useInvites()
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const pendingInvites = invites.filter((i) => i.status === 'pending')

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
          renderExpanded={(u) => (
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
          )}
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
                    onClick={() => revokeInvite(invite.email)}
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
