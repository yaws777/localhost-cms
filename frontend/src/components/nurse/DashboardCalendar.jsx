import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileCheck, Pill, Activity, Stethoscope } from 'lucide-react';
import { formatTime } from '../../utils/datetime';

const EVENT_TYPES = {
  requirement: { label: 'Requirement deadline', color: '#0250A3', Icon: FileCheck, path: '/RequirementManagement' },
  expiration: { label: 'Medicine expiration', color: '#EF4444', Icon: Pill, path: '/ReportsAnalytics?tab=inventory' },
  screening: { label: 'Health screening', color: '#10B981', Icon: Activity, path: '/HealthScreening' },
  doctor: { label: 'Doctor consultation', color: '#8B5CF6', Icon: Stethoscope, path: '/DoctorVisit' }
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
};

const eventTime = (event) => {
  if (!event.start_time) return '';
  const start = formatTime(event.start_time);
  return event.end_time ? `${start} - ${formatTime(event.end_time)}` : start;
};

const DashboardCalendar = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(todayKey());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hidden, setHidden] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:3001/api/nurse/dashboard-calendar?month=${cursor.year}-${pad(cursor.month + 1)}`);
        const result = await res.json();
        if (!cancelled) setEvents(res.ok && Array.isArray(result.events) ? result.events : []);
      } catch (err) {
        console.error('Failed to fetch dashboard calendar:', err);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [cursor]);

  const visibleEvents = useMemo(() => events.filter((e) => !hidden[e.type]), [events, hidden]);

  const eventsByDay = useMemo(() => {
    const map = {};
    visibleEvents.forEach((e) => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }, [visibleEvents]);

  const counts = useMemo(() => {
    const c = {};
    events.forEach((e) => { c[e.type] = (c[e.type] || 0) + 1; });
    return c;
  }, [events]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    return list;
  }, [cursor]);

  const today = todayKey();
  const selectedEvents = eventsByDay[selected] || [];

  const shiftMonth = (delta) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(dateKey(next.getFullYear(), next.getMonth(), 1));
  };

  const goToday = () => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(todayKey());
  };

  const selectedLabel = (() => {
    const [y, m, d] = selected.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  })();

  return (
    <div className="mini-cal-nd">
      <div className="mini-cal-grid-side-nd">
        <div className="mini-cal-head-nd">
          <button type="button" className="mini-cal-nav-nd" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <strong className="mini-cal-month-nd">{MONTH_NAMES[cursor.month]} {cursor.year}</strong>
          <button type="button" className="mini-cal-nav-nd" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="mini-cal-today-nd" onClick={goToday}>Today</button>
        </div>

        <div className="mini-cal-weekdays-nd">
          {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
        </div>
        <div className="mini-cal-days-nd">
          {cells.map((day, i) => {
            if (day === null) return <span key={`blank-${i}`} className="mini-cal-blank-nd" />;
            const key = dateKey(cursor.year, cursor.month, day);
            const dayEvents = eventsByDay[key] || [];
            const types = [...new Set(dayEvents.map((e) => e.type))];
            const cls = ['mini-cal-day-nd'];
            if (key === today) cls.push('mini-cal-today-cell-nd');
            if (key === selected) cls.push('mini-cal-selected-nd');
            return (
              <button
                type="button"
                key={key}
                className={cls.join(' ')}
                onClick={() => setSelected(key)}
                title={dayEvents.length ? `${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}` : undefined}
              >
                <span>{day}</span>
                <span className="mini-cal-dots-nd">
                  {types.map((t) => <i key={t} style={{ backgroundColor: EVENT_TYPES[t].color }} />)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mini-cal-legend-nd">
          {Object.entries(EVENT_TYPES).map(([type, { label, color }]) => (
            <button
              type="button"
              key={type}
              className={`mini-cal-legend-item-nd${hidden[type] ? ' mini-cal-legend-off-nd' : ''}`}
              onClick={() => setHidden((prev) => ({ ...prev, [type]: !prev[type] }))}
              aria-pressed={!hidden[type]}
            >
              <i style={{ backgroundColor: color }} />
              {label}
              <strong>{counts[type] || 0}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="mini-cal-agenda-side-nd">
        <div className="mini-cal-agenda-title-nd">{selectedLabel}</div>
        {isLoading ? (
          <div className="mini-cal-empty-nd">Loading calendar...</div>
        ) : selectedEvents.length === 0 ? (
          <div className="mini-cal-empty-nd">Nothing scheduled on this day.</div>
        ) : (
          <ul className="mini-cal-agenda-list-nd">
            {selectedEvents.map((event) => {
              const { Icon, color, label, path } = EVENT_TYPES[event.type];
              const time = eventTime(event);
              return (
                <li key={event.id}>
                  <button type="button" className="mini-cal-event-nd" style={{ borderLeftColor: color }} onClick={() => navigate(path)}>
                    <Icon size={15} color={color} />
                    <span className="mini-cal-event-body-nd">
                      <strong>{event.title}</strong>
                      <small>{label}{time ? ` · ${time}` : ''}</small>
                      <small>{event.detail}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardCalendar;
