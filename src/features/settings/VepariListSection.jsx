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
import { useLocale } from '../../context/LocaleContext'
import VepariForm from './VepariForm'

function rateSummary(vepari, t) {
  if (!vepari.customRates) return t('settings.defaultRatesTitle')
  const r = vepari.customRates
  const tolai = r.tolaiPerKg ?? r.tolai
  const shes = r.shesPercent ?? r.shes
  const commission = r.commissionPercent ?? r.commission
  return `${t('settings.tolaiPerKgLabel')} ₹${tolai} · ${t('settings.shesPercentLabel')} ${shes} · ${t('settings.commissionPercentLabel')} ${commission}`
}

export default function VepariListSection() {
  const { isOwner } = useAuth()
  const { t } = useLocale()
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
    <div className="card px-4 py-4 sm:px-5 sm:py-5 h-full">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className="text-caption text-accent font-semibold uppercase tracking-wide">
            {t('settings.vepariTitle')}
          </p>
          <p className="text-[11px] text-ink-muted mt-0.5">{t('settings.vepariSubtitle')}</p>
        </div>
        {mode === 'list' && isOwner && (
          <button
            type="button"
            onClick={() => setMode('add')}
            className="inline-flex items-center gap-1 min-h-9 px-2.5 rounded-lg text-[11px] font-semibold text-accent hover:bg-accent-soft shrink-0"
          >
            <Plus size={16} strokeWidth={2} />
            {t('settings.addVepari')}
          </button>
        )}
      </div>

      {mode === 'add' && isOwner && (
        <div className="mb-4">
          <VepariForm
            onSubmit={handleAdd}
            onCancel={() => setMode('list')}
            submitLabel={t('settings.addVepari')}
          />
        </div>
      )}

      {editingVepari && isOwner && (
        <div className="mb-4">
          <VepariForm
            initialValues={{
              name: editingVepari.name,
              village: editingVepari.village,
              useCustomRates: Boolean(editingVepari.customRates),
              tolai:
                editingVepari.customRates?.tolaiPerKg ?? editingVepari.customRates?.tolai,
              shes:
                editingVepari.customRates?.shesPercent ?? editingVepari.customRates?.shes,
              commission:
                editingVepari.customRates?.commissionPercent ??
                editingVepari.customRates?.commission,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setMode('list')}
            submitLabel={t('common.save')}
          />
        </div>
      )}

      {mode === 'list' && (
        <>
          {loading ? (
            <p className="text-caption text-ink-muted">{t('common.loading')}</p>
          ) : veparis.length === 0 ? (
            <p className="text-body text-ink-muted">{t('settings.noVeparis')}</p>
          ) : (
            <ul className="divide-y divide-border -mx-1">
              {veparis.map((vepari) => (
                <li
                  key={vepari.id}
                  className="py-3.5 px-1 flex items-center justify-between gap-3 rounded-lg hover:bg-surface-muted/80"
                >
                  <div className="min-w-0">
                    <p className="text-body text-ink truncate">
                      {vepari.name}
                      <span className="text-ink-muted"> · {vepari.village}</span>
                      {vepari.syncStatus === 'pending' && (
                        <span className="text-caption text-accent"> · {t('common.syncing')}</span>
                      )}
                    </p>
                    <p className="text-caption text-ink-muted truncate">
                      {rateSummary(vepari, t)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isOwner && (
                      <>
                        <button
                          type="button"
                          onClick={() => setMode({ edit: vepari.id })}
                          aria-label={`${t('common.edit')} ${vepari.name}`}
                          className="min-h-12 min-w-12 flex items-center justify-center text-ink-muted hover:text-accent"
                        >
                          <Pencil size={18} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(vepari.id)}
                          aria-label={`${t('common.delete')} ${vepari.name}`}
                          className="min-h-12 min-w-12 flex items-center justify-center text-ink-muted hover:text-danger"
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
            <p className="text-body text-ink mb-4">{t('settings.deleteVepariConfirm')}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 min-h-12 rounded-xl bg-danger text-surface font-semibold text-body"
              >
                {t('common.delete')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="min-h-12 px-5 rounded-xl border border-border text-body text-ink-muted"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
