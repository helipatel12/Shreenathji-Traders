import { Search } from 'lucide-react'

/** Search + action buttons above a data table (filters live in column headers). */
export default function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  actions,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {onSearchChange != null ? (
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full min-h-10 pl-9 pr-3 rounded-lg border border-border bg-surface text-body text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </div>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-2 ml-auto">{actions}</div> : null}
    </div>
  )
}
