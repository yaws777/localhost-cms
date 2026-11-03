// ScreeningCalendar.jsx
// Month calendar of the health screenings, built like the Doctor Visit schedule calendar (ScheduleCalendar):
// month grid on the left, selected day on the right. "Schedule screening" on a day that is not over opens the
// schedule form with that date already filled in.
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarPlus, Users, Edit3, Ban } from 'lucide-react';
import { MONTHS, WEEKDAYS, dateKey, todayKey, dayLabel, timeRange, to12h, parseDay } from '../../utils/scheduling';
import { dayKey } from '../common/RecordFolders';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/scheduling/Scheduling.css';

const CHIP_LIMIT = 2;

// upcoming | ongoing | past | cancelled. Past needs the end confirmed or the date over; after the end time
// an unconfirmed screening is still on going (same rule as the Screenings tabs).
const stateOf = (sch, nowKey, nowTime) => {
  if (sch.status === 'Cancelled') return 'cancelled';
  const day = dayKey(sch.scheduled_date);
  const start = String(sch.start_time || '').slice(0, 5);
  if (sch.end_confirmed_at || day < nowKey) return 'past';
  if (day === nowKey && nowTime >= start) return 'ongoing';
  return 'upcoming';
};

const STATE_LABEL = { upcoming: 'Upcoming', ongoing: 'In session now', past: 'Past - closed', cancelled: 'Cancelled' };
// upcoming is yellow, in session now stays green
const BADGE_CLASS = { upcoming: 'type-upcoming-sc', ongoing: 'type-open-sc', past: 'type-closed-sc', cancelled: 'type-cancelled-sc' };
const CARD_CLASS = { upcoming: 'upcoming-sc', ongoing: 'open-sc', past: 'closed-sc', cancelled: 'cancelled-sc' };

// the day panel lists what is happening now or next first, then what is over; only the first few show until "View all"
const STATE_ORDER = { ongoing: 0, upcoming: 1, past: 2, cancelled: 3 };
const PANEL_LIMIT = 3;

export default function ScreeningCalendar({ schedules, loading, onSchedule, onOpen, onEdit, onCancel, typeLabel }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(todayKey());
  const [showAll, setShowAll] = useState(false);

  const now = new Date();
  const nowKey = dateKey(now);
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // the month grid always starts on a Sunday and shows six weeks
  const gridDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return dateKey(d); });
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = {};
    (schedules || []).forEach((s) => {
      const k = dayKey(s.scheduled_date);
      if (k) (map[k] = map[k] || []).push(s);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time))));
    return map;
  }, [schedules]);

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const goMonth = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const jumpToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayKey()); setShowAll(false); };

  const dayList = useMemo(() => (byDay[selected] || [])
    .map((s) => ({ s, state: stateOf(s, nowKey, nowTime) }))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || String(a.s.start_time).localeCompare(String(b.s.start_time))),
  [byDay, selected, nowKey, nowTime]);
  const shownList = showAll ? dayList : dayList.slice(0, PANEL_LIMIT);
  const isPast = selected < nowKey;

  return (
    <div className="cal-layout-sc cal-wrap-hs">
      <section className="cal-card-sc" aria-label="Screening calendar">
        <div className="cal-head-sc">
          <h3 aria-live="polite">{monthLabel}</h3>
          <div className="cal-nav-sc">
            <button type="button" className="icon-btn-ds" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={jumpToday}>Today</button>
            <button type="button" className="icon-btn-ds" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
        </div>

        {loading && <p className="empty-sc" role="status">Loading screenings...</p>}

        <div className="cal-grid-sc">
          {WEEKDAYS.map((w) => <div key={w} className="cal-dow-sc">{w.slice(0, 3)}</div>)}
          {gridDays.map((day) => {
            const list = byDay[day] || [];
            const classes = ['cal-day-sc'];
            if (parseDay(day).getMonth() !== cursor.getMonth()) classes.push('outside-sc');
            if (day === nowKey) classes.push('today-sc');
            if (day === selected) classes.push('selected-sc');
            const summary = list.length === 0
              ? 'no screenings'
              : `${list.length} screening${list.length === 1 ? '' : 's'}: ${list.map((s) => `${s.title} (${STATE_LABEL[stateOf(s, nowKey, nowTime)]})`).join(', ')}`;
            return (
              <button
                key={day}
                type="button"
                className={classes.join(' ')}
                aria-pressed={day === selected}
                aria-label={`${dayLabel(day, { weekday: 'long', month: 'long', day: 'numeric' })}, ${summary}`}
                onClick={() => { setSelected(day); setShowAll(false); }}
              >
                <span className="cal-num-sc">{parseDay(day).getDate()}</span>
                {list
                  .map((s) => ({ s, state: stateOf(s, nowKey, nowTime) }))
                  .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])
                  .slice(0, CHIP_LIMIT)
                  .map(({ s, state }) => (
                    <span key={s.screening_schedule_id} className={`cal-chip-sc ${BADGE_CLASS[state]} ${state === 'past' ? 'past-sc' : ''}`} title={`${s.title} (${STATE_LABEL[state]})`}>
                      {to12h(s.start_time).replace(':00', '')} {s.title}
                    </span>
                  ))}
                {list.length > CHIP_LIMIT && <span className="cal-chip-sc" style={{ color: 'var(--sti-text-muted)' }}>+{list.length - CHIP_LIMIT} more</span>}
              </button>
            );
          })}
        </div>

        <div className="cal-legend-sc">
          {['upcoming', 'ongoing', 'past', 'cancelled'].map((k) => (
            <span key={k}><i className={`type-badge-sc ${BADGE_CLASS[k]}`}>{STATE_LABEL[k]}</i></span>
          ))}
        </div>
      </section>

      <aside className="cal-card-sc day-panel-sc" aria-label="Selected day">
        <div className="day-head-sc">
          <h3>{dayLabel(selected, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{selected === nowKey ? ' (today)' : ''}</h3>
          {!isPast && (
            <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" onClick={() => onSchedule(selected)} title="Schedule screening on this day" aria-label="Schedule screening on this day">
              <CalendarPlus size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {!loading && dayList.length === 0 && (
          <div className="empty-sc">{isPast ? 'Nothing was scheduled this day.' : 'Nothing scheduled this day.'}</div>
        )}

        {shownList.map(({ s, state }) => {
          return (
            <div key={s.screening_schedule_id} className={`session-card-sc ${CARD_CLASS[state]}`}>
              <div className="session-top-sc">
                <strong>{timeRange(s.start_time, s.end_time)}</strong>
                <span className={`type-badge-sc ${BADGE_CLASS[state]}`}>{STATE_LABEL[state]}</span>
              </div>
              <div className="session-meta-sc">
                <span>{s.title}</span>
                <span>{typeLabel ? typeLabel(s.screening_type) : s.screening_type}</span>
              </div>
              <div className="session-meta-sc">
                <span>{s.present_count ?? 0} present of {s.total_students || 0} students</span>
              </div>
              {state === 'cancelled' && s.cancelled_reason && <div className="session-meta-sc"><span>Reason: {s.cancelled_reason}</span></div>}
              <div className="session-actions-sc">
                <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => onOpen(s)} title="Participants" aria-label={`Participants of ${s.title}`}>
                  <Users size={16} aria-hidden="true" />
                </button>
                {state === 'upcoming' && (
                  <>
                    <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={() => onEdit(s)} title="Edit screening" aria-label={`Edit ${s.title}`}>
                      <Edit3 size={16} aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-hs btn-icon-hs btn-danger-hs" onClick={() => onCancel(s)} title="Cancel screening" aria-label={`Cancel ${s.title}`}>
                      <Ban size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {dayList.length > PANEL_LIMIT && (
          <button type="button" className="sti-btn-dv sti-btn-light-dv view-all-sc" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show less' : `View all (${dayList.length})`}
          </button>
        )}
      </aside>
    </div>
  );
}
