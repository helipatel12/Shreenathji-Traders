import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayKeyIST } from '../../utils/dates'
import {
  calendarCells,
  companiesByDate,
  currentYearMonth,
  monthTitle,
  shiftMonth,
  weekdayLabels,
} from './platformUi'

export default function PlatformCalendar({
  companies,
  year,
  month,
  onMonthChange,
  selectedKey,
  onSelectDay,
  lang,
  t,
  compact = false,
}) {
  const today = todayKeyIST()
  const byDate = companiesByDate(companies)
  const cells = calendarCells(year, month)
  const labels = weekdayLabels(lang)
  const title = monthTitle(year, month, lang)

  function go(delta) {
    const next = shiftMonth(year, month, delta)
    onMonthChange(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[13px] font-semibold text-ink capitalize truncate">{title}</p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="platform-icon-btn"
            onClick={() => go(-1)}
            aria-label={t('platform.prevMonth')}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="text-[11px] font-semibold text-accent px-1.5 min-h-7 rounded-md hover:bg-accent-soft"
            onClick={() => onMonthChange(currentYearMonth())}
          >
            {t('platform.today')}
          </button>
          <button
            type="button"
            className="platform-icon-btn"
            onClick={() => go(1)}
            aria-label={t('platform.nextMonth')}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px">
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="text-center text-[10px] font-semibold uppercase text-ink-muted py-1">
            {label}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`e-${i}`} className={compact ? 'h-8' : 'h-10'} />
          }
          const count = byDate[cell.key]?.length || 0
          const isToday = cell.key === today
          const isSelected = cell.key === selectedKey
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay?.(cell.key, byDate[cell.key] || [])}
              className={[
                'relative rounded-lg text-[12px] font-numeric leading-none',
                compact ? 'h-8' : 'h-10',
                isSelected ? 'bg-accent text-white' : isToday ? 'bg-accent-soft text-accent font-semibold' : 'text-ink hover:bg-surface-muted',
              ].join(' ')}
            >
              {cell.day}
              {count > 0 && (
                <span
                  className={[
                    'absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full',
                    isSelected ? 'bg-white' : 'bg-accent',
                  ].join(' ')}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
