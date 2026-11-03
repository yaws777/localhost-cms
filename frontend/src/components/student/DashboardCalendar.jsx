// DashboardCalendar.jsx
// One month calendar for the student dashboard: health screenings, check-ups (queue numbers and doctor appointments) and requirement deadlines.
// Each event is { id, date: 'YYYY-MM-DD', kind: 'screening' | 'checkup' | 'listing' | 'deadline', title, time, detail, badges: [{ text, tone }], to }.
// A kind is told apart by its marker shape and its text label, never by color alone.
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileCheck, Stethoscope, ClipboardList, Clock, ArrowRight, CalendarCheck, Megaphone, ListChecks } from 'lucide-react';
import '../../styles/student/DashboardCalendar.css';

export const KINDS = {
    screening: { label: 'Health screening', Icon: FileCheck },
    checkup: { label: 'Check-up', Icon: Stethoscope },
    listing: { label: 'Session listing', Icon: Megaphone },
    advance: { label: 'Advance listing', Icon: ListChecks },
    deadline: { label: 'Requirement deadline', Icon: ClipboardList }
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// today in Philippine time, whatever the device clock says
export const todayKey = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });

const longDate = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
};

const DashboardCalendar = ({ events = [] }) => {
    const today = todayKey();
    const [ty, tm] = today.split('-').map(Number);
    const [view, setView] = useState({ year: ty, month: tm - 1 });
    const [selected, setSelected] = useState(today);

    const byDay = useMemo(() => {
        const map = {};
        events.forEach((e) => { (map[e.date] = map[e.date] || []).push(e); });
        return map;
    }, [events]);

    // 6 rows x 7 days, starting on the Sunday on or before the 1st
    const cells = useMemo(() => {
        const first = new Date(Date.UTC(view.year, view.month, 1));
        const start = new Date(first);
        start.setUTCDate(1 - first.getUTCDay());
        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date(start);
            d.setUTCDate(start.getUTCDate() + i);
            const y = d.getUTCFullYear(); const m = d.getUTCMonth(); const day = d.getUTCDate();
            return { key: keyOf(y, m, day), day, inMonth: m === view.month && y === view.year };
        });
    }, [view]);

    const shift = (delta) => {
        const d = new Date(Date.UTC(view.year, view.month + delta, 1));
        setView({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    };
    const goToday = () => { setView({ year: ty, month: tm - 1 }); setSelected(today); };

    const monthPrefix = `${view.year}-${pad(view.month + 1)}`;
    const selectedVisible = cells.some((c) => c.key === selected);
    const monthCounts = useMemo(() => {
        const c = { screening: 0, checkup: 0, listing: 0, advance: 0, deadline: 0 };
        events.forEach((e) => { if (e.date.startsWith(monthPrefix)) c[e.kind] += 1; });
        return c;
    }, [events, monthPrefix]);

    const dayEvents = (byDay[selected] || []).slice().sort((a, b) => String(a.sort || '').localeCompare(String(b.sort || '')));
    const upcoming = useMemo(
        () => events.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.sort || '')).localeCompare(b.date + (b.sort || ''))).slice(0, 4),
        [events, today]
    );

    const onGridKey = (e, key) => {
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
        if (!step) return;
        e.preventDefault();
        const [y, m, d] = key.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + step));
        const nk = keyOf(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
        setSelected(nk);
        setView({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
        requestAnimationFrame(() => document.getElementById(`cal-day-${nk}`)?.focus());
    };

    return (
        <div className="cal-wrap-dc">
        <div className="cal-dc">
            <div className="cal-main-dc">
                <div className="cal-toolbar-dc">
                    <h3 id="cal-title-dc" aria-live="polite">{MONTH_NAMES[view.month]} {view.year}</h3>
                    <div className="cal-nav-dc">
                        <button type="button" className="cal-btn-dc" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} aria-hidden="true" /></button>
                        <button type="button" className="cal-btn-dc cal-today-dc" onClick={goToday}>Today</button>
                        <button type="button" className="cal-btn-dc" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} aria-hidden="true" /></button>
                    </div>
                </div>

                <ul className="cal-legend-dc" aria-label="Calendar key">
                    {Object.entries(KINDS).map(([kind, { label, Icon }]) => (
                        <li key={kind}>
                            <span className={`cal-mark-dc mark-${kind}-dc`} aria-hidden="true" />
                            <Icon size={14} aria-hidden="true" /> {label}
                            <span className="cal-count-dc">{monthCounts[kind]}</span>
                        </li>
                    ))}
                </ul>

                <div className="cal-grid-dc" role="grid" aria-labelledby="cal-title-dc">
                    <div className="cal-row-dc" role="row">
                        {WEEKDAYS.map((w) => <div key={w} className="cal-head-dc" role="columnheader" aria-label={w}>{w.slice(0, 3)}</div>)}
                    </div>
                    {Array.from({ length: 6 }, (_, r) => (
                        <div key={r} className="cal-row-dc" role="row">
                            {cells.slice(r * 7, r * 7 + 7).map((c) => {
                                const list = byDay[c.key] || [];
                                const kinds = [...new Set(list.map((e) => e.kind))];
                                const isSel = c.key === selected;
                                return (
                                    <div key={c.key} role="gridcell" aria-selected={isSel} className="cal-cell-dc">
                                        <button
                                            type="button"
                                            id={`cal-day-${c.key}`}
                                            tabIndex={isSel || (!selectedVisible && c.key === `${monthPrefix}-01`) ? 0 : -1}
                                            className={`cal-day-dc${c.inMonth ? '' : ' out-dc'}${c.key === today ? ' today-dc' : ''}${isSel ? ' sel-dc' : ''}`}
                                            aria-label={`${longDate(c.key)}${c.key === today ? ', today' : ''}, ${list.length ? `${list.length} ${list.length === 1 ? 'event' : 'events'}` : 'no events'}`}
                                            onClick={() => { setSelected(c.key); if (!c.inMonth) setView({ year: Number(c.key.slice(0, 4)), month: Number(c.key.slice(5, 7)) - 1 }); }}
                                            onKeyDown={(e) => onGridKey(e, c.key)}
                                        >
                                            <span className="cal-num-dc">{c.day}</span>
                                            {kinds.length > 0 && (
                                                <span className="cal-marks-dc" aria-hidden="true">
                                                    {kinds.map((k) => <span key={k} className={`cal-mark-dc mark-${k}-dc`} />)}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="cal-side-dc">
                <section aria-labelledby="cal-day-title-dc" className="cal-panel-dc">
                    <h4 id="cal-day-title-dc">{longDate(selected)}{selected === today && <span className="cal-now-dc">Today</span>}</h4>
                    {dayEvents.length === 0 ? (
                        <p className="cal-empty-dc">Nothing scheduled on this day.</p>
                    ) : (
                        <ul className="cal-events-dc">
                            {dayEvents.map((e) => {
                                const { label, Icon } = KINDS[e.kind];
                                const body = (
                                    <>
                                        <span className={`cal-kind-dc kind-${e.kind}-dc`}><span className={`cal-mark-dc mark-${e.kind}-dc`} aria-hidden="true" /><Icon size={13} aria-hidden="true" /> {label}</span>
                                        <strong className="cal-ev-title-dc">{e.title}</strong>
                                        {e.time && <span className="cal-ev-meta-dc"><Clock size={13} aria-hidden="true" /> {e.time}</span>}
                                        {e.detail && <span className="cal-ev-meta-dc">{e.detail}</span>}
                                        {e.badges?.length > 0 && (
                                            <span className="cal-badges-dc">
                                                {e.badges.map((b) => <span key={b.text} className={`cal-badge-dc tone-${b.tone || 'default'}-dc`}>{b.text}</span>)}
                                            </span>
                                        )}
                                    </>
                                );
                                return (
                                    <li key={e.id} className={`cal-event-dc ev-${e.kind}-dc`}>
                                        {e.to ? <Link to={e.to} className="cal-event-link-dc">{body}<ArrowRight size={14} className="cal-go-dc" aria-hidden="true" /></Link> : <div className="cal-event-link-dc">{body}</div>}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section aria-labelledby="cal-next-title-dc" className="cal-panel-dc">
                    <h4 id="cal-next-title-dc"><CalendarCheck size={15} aria-hidden="true" /> Coming up</h4>
                    {upcoming.length === 0 ? (
                        <p className="cal-empty-dc">No upcoming schedules or deadlines.</p>
                    ) : (
                        <ul className="cal-next-dc">
                            {upcoming.map((e) => {
                                const { label } = KINDS[e.kind];
                                return (
                                    <li key={e.id}>
                                        <button type="button" className="cal-next-btn-dc" onClick={() => { setSelected(e.date); setView({ year: Number(e.date.slice(0, 4)), month: Number(e.date.slice(5, 7)) - 1 }); }}>
                                            <span className={`cal-mark-dc mark-${e.kind}-dc`} aria-hidden="true" />
                                            <span className="cal-next-text-dc">
                                                <strong>{e.title}</strong>
                                                <small>{label}, {e.date === today ? 'today' : longDate(e.date).split(', ').slice(1).join(', ')}</small>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
        </div>
    );
};

export default DashboardCalendar;
