// Vepari master list — Phase 3 ("Settings, partial" per phases.md).
// Add/edit/delete a vepari; this list is what Phase 4's bill entry
// dropdown will read from. "Done when: a vepari can be added and
// appears in a dropdown" — the dropdown itself is Phase 4, but this
// list is the data source it'll use.
//
// Owner-only for add/edit/delete, per prd.md §3 ("staff... cannot
// change settings or rates") and firestore.rules (`allow write: if
// isOwner`). Fixed in Phase 8 alongside the rest of role-gating
// Settings: staff previously saw fully-functional-looking edit/delete
// buttons here that would have silently failed against the security
// rules — now they see a plain read-only list instead.

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useVeparis } from '../../hooks/useVeparis'
import VepariForm from './VepariForm'

function rateSummary(vepari) {
  if (!vepari.customRates) return 'Default rates'
  const { tolai, shes, commission } = vepari.customRates
  return `Custom: tolai ₹${tolai}, shes ${shes}%, commission ${commission}%`
}

export default function VepariListSection() {
  const { role } = useAuth()
  const canManage = role === 'owner'
  const { veparis, loading, addVepari, updateVepari, deleteVepari } = useVeparis()
  const [mode, setMode] = useState('list') // 'list' | 'add' | { edit: localId }
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const editingVepari =
    typeof mode === 'object' && mode.edit != null
      ? veparis.find((v) => v.id === mode.edit)
      : null

  async function handleAdd(payload) {
    await addVepari(payload)
    setMode('list')
  }

  async function handleUpdate(payload) {
    await updateVepari(editingVepari.id, payload)
    setMode('list')
  }

  function handleDeleteClick(id) {
    setConfirmDeleteId(id)
  }

  async function confirmDelete() {
    await deleteVepari(confirmDeleteId)
    setConfirmDeleteId(null)
  }

  return (
    <div className="card px-5 py-5 max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption text-accent font-semibold uppercase tracking-wide">
          વેપારી યાદી · Vepari list
        </p>
        {mode === 'list' && canManage && (
          <button
            type="button"
            onClick={() => setMode('add')}
            className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-caption font-semibold text-accent hover:bg-accent-soft"
          >
            <Plus size={16} strokeWidth={2} />
            Add vepari
          </button>
        )}
      </div>

      {mode === 'add' && (
        <div className="mb-4">
          <VepariForm onSubmit={handleAdd} onCancel={() => setMode('list')} submitLabel="Add vepari" />
        </div>
      )}

      {editingVepari && (
        <div className="mb-4">
          <VepariForm
            initialValues={{
              name: editingVepari.name,
              village: editingVepari.village,
              useCustomRates: Boolean(editingVepari.customRates),
              tolai: editingVepari.customRates?.tolai,
              shes: editingVepari.customRates?.shes,
              commission: editingVepari.customRates?.commission,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setMode('list')}
            submitLabel="Save changes"
          />
        </div>
      )}

      {mode === 'list' && (
        <>
          {loading ? (
            <p className="text-caption text-ink-muted">Loading…</p>
          ) : veparis.length === 0 ? (
            <p className="text-body text-ink-muted">
              No veparis yet — add the first one to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {veparis.map((vepari) => (
                <li key={vepari.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body text-ink truncate">
                      {vepari.name}
                      <span className="text-ink-muted"> · {vepari.village}</span>
                      {vepari.syncStatus === 'pending' && (
                        <span className="text-caption text-accent"> · syncing…</span>
                      )}
                    </p>
                    <p className="text-caption text-ink-muted truncate">
                      {rateSummary(vepari)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMode({ edit: vepari.id })}
                          aria-label={`Edit ${vepari.name}`}
                          className="min-h-11 min-w-11 flex items-center justify-center text-ink-muted hover:text-accent"
                        >
                          <Pencil size={18} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(vepari.id)}
                          aria-label={`Delete ${vepari.name}`}
                          className="min-h-11 min-w-11 flex items-center justify-center text-ink-muted hover:text-danger"
                        >
                          <Trash2 size={18} strokeWidth={1.75} />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {confirmDeleteId != null && (
        <div className="fixed inset-0 bg-ink/30 flex items-center justify-center px-4 z-20">
          <div className="card px-5 py-5 max-w-sm w-full">
            <p className="text-body text-ink mb-4">
              Remove this vepari from the list? Bills already entered under
              their name won&rsquo;t be affected.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 min-h-11 rounded-xl bg-danger text-surface font-semibold text-body"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="min-h-11 px-5 rounded-xl border border-border text-body text-ink-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
