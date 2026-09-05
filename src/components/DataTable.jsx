import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * Shared clickable data table (MixHub-style).
 * columns: [{
 *   key, header, align?, className?, render?,
 *   filter?: { value, onChange, options: [{value,label}], allLabel? }
 * }]
 */
export default function DataTable({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  getRowClassName,
  renderExpanded,
  footer,
  toolbar,
  meta,
}) {
  const colSpan = (onRowClick ? 1 : 0) + columns.length
  const hasHeaderFilters = columns.some((c) => c.filter)

  return (
    <div className="data-table-wrap">
      {toolbar ? <div className="data-table-toolbar">{toolbar}</div> : null}

      <div className="overflow-x-auto">
        {!rows?.length ? (
          <div className="px-5 py-10">{empty || <p className="text-body text-ink-muted">—</p>}</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {onRowClick ? <th className="w-8" aria-hidden /> : null}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={[
                      col.align === 'right' ? 'text-right' : '',
                      col.className,
                      col.filter ? 'th-filter' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="th-label">{col.header}</div>
                    {col.filter ? (
                      <select
                        value={col.filter.value}
                        onChange={(e) => col.filter.onChange(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="th-filter-select"
                        aria-label={col.filter.allLabel || col.header}
                      >
                        <option value="">{col.filter.allLabel || col.header}</option>
                        {col.filter.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : hasHeaderFilters ? (
                      <div className="th-filter-spacer" aria-hidden />
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = typeof rowKey === 'function' ? rowKey(row) : row[rowKey]
                const selected = selectedKey != null && String(selectedKey) === String(key)
                const extra = getRowClassName ? getRowClassName(row) : ''
                return (
                  <Fragment key={key}>
                    <tr
                      className={[
                        onRowClick ? 'data-row' : '',
                        selected ? 'is-selected' : '',
                        extra,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onRowClick?.(row)}
                      onKeyDown={(e) => {
                        if (!onRowClick) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick(row)
                        }
                      }}
                      tabIndex={onRowClick ? 0 : undefined}
                      role={onRowClick ? 'button' : undefined}
                    >
                      {onRowClick ? (
                        <td className="w-8 text-ink-muted">
                          <ChevronRight
                            size={16}
                            className={
                              selected
                                ? 'rotate-90 transition-transform'
                                : 'transition-transform'
                            }
                          />
                        </td>
                      ) : null}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={[
                            col.align === 'right' ? 'num' : '',
                            col.key === 'actions' ? 'actions-cell' : '',
                            col.className,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={
                            col.key === 'actions' ? (e) => e.stopPropagation() : undefined
                          }
                        >
                          {col.render ? col.render(row) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                    {selected && renderExpanded
                      ? (() => {
                          const expanded = renderExpanded(row)
                          if (expanded == null) return null
                          return (
                            <tr className="bg-surface-muted">
                              <td colSpan={colSpan} className="!p-0">
                                <div
                                  className="px-4 py-4 border-b border-border"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {expanded}
                                </div>
                              </td>
                            </tr>
                          )
                        })()
                      : null}
                  </Fragment>
                )
              })}
            </tbody>
            {footer ? <tfoot>{footer}</tfoot> : null}
          </table>
        )}
      </div>

      {meta ? (
        <div className="data-table-meta px-4 py-3 border-t border-border text-caption text-ink-muted">
          {meta}
        </div>
      ) : null}
    </div>
  )
}
