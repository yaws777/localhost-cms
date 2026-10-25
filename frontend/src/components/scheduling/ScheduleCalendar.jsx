// ScheduleCalendar.jsx
// The schedule as a calendar. The nurse sees every doctor, the doctor sees their own; both read the same data
// (GET /api/schedule-calendar), so what one posts shows up for the other right away.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, UserPlus, TimerReset, Bell, Inbox, CalendarX } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { visitLabel, statusClass } from '../../utils/visitPurpose';
import {
    API, SCHEDULE_TYPES, SCHEDULE_TYPE_KEYS, MONTHS, WEEKDAYS, dateKey, todayKey, parseDay, dayLabel, to12h, timeRange, typeLabel
} from '../../utils/scheduling';
import { AppointModal, ExtendSessionModal, ExtendAppointmentModal } from './SessionModals';
import '../../styles/scheduling/Scheduling.css';

const CHIP_LIMIT = 2;
const TYPE_CHIP = { 'Appointment': 'type-appointment-sc', 'Open Slot': 'type-open-sc', 'Walk-in': 'type-walkin-sc' };
const TYPE_SHORT = { 'Appointment': 'Appt', 'Open Slot': 'Open', 'Walk-in': 'Walk-in' };

const ScheduleCalendar = ({ doctors, fixedDoctorId, creator, userId, refreshKey, onChanged, onRemind, onGoTab }) => {
    const { showAlert } = useAlert();
    const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [selected, setSelected] = useState(todayKey());
    const [doctorFilter, setDoctorFilter] = useState(fixedDoctorId || '');
    const [typeFilter, setTypeFilter] = useState('');
    const [data, setData] = useState({ sessions: [], appointments: [], absences: [] });
    const [loading, setLoading] = useState(true);

    const [appointFor, setAppointFor] = useState(null);
    const [extendSession, setExtendSession] = useState(null);
    const [extendAppt, setExtendAppt] = useState(null);

    // the month grid always starts on a Sunday and shows six weeks
    const gridDays = useMemo(() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = new Date(first);
        start.setDate(first.getDate() - first.getDay());
        return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return dateKey(d); });
    }, [cursor]);

    const load = useCallback(async () => {
        try {
            const qs = new URLSearchParams({ from: gridDays[0], to: gridDays[41] });
            const doctor = fixedDoctorId || doctorFilter;
            if (doctor) qs.set('doctor_id', doctor);
            const res = await fetch(`${API}/api/schedule-calendar?${qs.toString()}`);
            const json = await res.json();
            if (json.success) setData({ sessions: json.sessions, appointments: json.appointments, absences: json.absences });
            else showAlert(json.message || 'Could not load the schedule.', 'error');
        } catch (e) {
            showAlert('Could not load the schedule.', 'error');
        } finally {
            setLoading(false);
        }
    }, [gridDays, fixedDoctorId, doctorFilter, showAlert]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const sessionsByDay = useMemo(() => {
        const map = {};
        data.sessions.filter((s) => !typeFilter || s.schedule_type === typeFilter).forEach((s) => { (map[s.date] = map[s.date] || []).push(s); });
        return map;
    }, [data.sessions, typeFilter]);

    const apptsByDay = useMemo(() => {
        const map = {};
        data.appointments.forEach((a) => { (map[a.date] = map[a.date] || []).push(a); });
        return map;
    }, [data.appointments]);

    const absentOn = (day) => data.absences.filter((u) => u.start_date <= day && u.end_date >= day);

    const changed = () => { load(); if (onChanged) onChanged(); };
    const today = todayKey();
    const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const goMonth = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
    const jumpToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(todayKey()); };

    const daySessions = sessionsByDay[selected] || [];
    const dayAppts = apptsByDay[selected] || [];
    const dayAbsences = absentOn(selected).filter((u) => !fixedDoctorId || u.doctor_id === fixedDoctorId);
    const isPast = selected < today;

    const sessionStatus = (s) => {
        if (s.schedule_type === 'Walk-in') return null;
        const used = s.booked + s.waiting_for_approval;
        return { used, pct: s.capacity ? Math.min(100, Math.round((used / s.capacity) * 100)) : 0, full: s.capacity ? used >= s.capacity : false };
    };

    return (
        <div className="cal-layout-sc">
            <section className="cal-card-sc" aria-label="Schedule calendar">
                <div className="cal-head-sc">
                    <h3>{monthLabel}</h3>
                    {!fixedDoctorId && (
                        <select className="dp-select" style={{ maxWidth: 200 }} value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} aria-label="Doctor">
                            <option value="">All doctors</option>
                            {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}</option>)}
                        </select>
                    )}
                    <select className="dp-select" style={{ maxWidth: 190 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Schedule type">
                        <option value="">All schedule types</option>
                        {SCHEDULE_TYPE_KEYS.map((k) => <option key={k} value={k}>{SCHEDULE_TYPES[k].label}</option>)}
                    </select>
                    <div className="cal-nav-sc">
                        <button type="button" className="icon-btn-ds" onClick={() => goMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
                        <button type="button" className="sti-btn-dv sti-btn-light-dv" onClick={jumpToday}>Today</button>
                        <button type="button" className="icon-btn-ds" onClick={() => goMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
                    </div>
                </div>

                <div className="cal-grid-sc">
                    {WEEKDAYS.map((w) => <div key={w} className="cal-dow-sc">{w.slice(0, 3)}</div>)}
                    {gridDays.map((day) => {
                        const list = sessionsByDay[day] || [];
                        const apptCount = (apptsByDay[day] || []).length;
                        const classes = ['cal-day-sc'];
                        if (parseDay(day).getMonth() !== cursor.getMonth()) classes.push('outside-sc');
                        if (day === today) classes.push('today-sc');
                        if (day === selected) classes.push('selected-sc');
                        if (absentOn(day).some((u) => !u.start_time && (!fixedDoctorId || u.doctor_id === fixedDoctorId))) classes.push('absent-sc');
                        return (
                            <button key={day} type="button" className={classes.join(' ')} onClick={() => setSelected(day)} aria-label={dayLabel(day, { weekday: 'long', month: 'long', day: 'numeric' })}>
                                <span className="cal-num-sc">{parseDay(day).getDate()}</span>
                                {list.slice(0, CHIP_LIMIT).map((s) => (
                                    <span key={`${s.schedule_id}`} className={`cal-chip-sc ${TYPE_CHIP[s.schedule_type]}`}>{to12h(s.start_time).replace(':00', '')} {TYPE_SHORT[s.schedule_type]}</span>
                                ))}
                                {list.length > CHIP_LIMIT && <span className="cal-chip-sc" style={{ color: 'var(--sti-text-muted)' }}>+{list.length - CHIP_LIMIT} more</span>}
                                {apptCount > 0 && <span className="cal-chip-sc" style={{ color: 'var(--sti-text-muted)' }}>{apptCount} appt{apptCount > 1 ? 's' : ''}</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="cal-legend-sc">
                    {SCHEDULE_TYPE_KEYS.map((k) => <span key={k}><i className={`type-badge-sc ${SCHEDULE_TYPES[k].cls}`}>{SCHEDULE_TYPES[k].label}</i></span>)}
                    <span><CalendarX size={14} /> Doctor unavailable</span>
                </div>
            </section>

            <aside className="cal-card-sc day-panel-sc" aria-label="Selected day">
                <h3>{dayLabel(selected, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{selected === today ? ' (today)' : ''}</h3>

                {loading && <div className="empty-sc">Loading...</div>}

                {dayAbsences.map((u) => (
                    <div key={u.unavailable_id} className="absence-sc">
                        <strong>{u.doctor_name} is unavailable</strong> {u.start_time ? timeRange(u.start_time, u.end_time) : 'all day'}{u.reason ? ` - ${u.reason}` : ''}
                    </div>
                ))}

                {!loading && daySessions.length === 0 && dayAppts.length === 0 && dayAbsences.length === 0 && (
                    <div className="empty-sc">Nothing scheduled this day.</div>
                )}

                {daySessions.map((s) => {
                    const st = sessionStatus(s);
                    return (
                        <div key={s.schedule_id} className={`session-card-sc ${s.schedule_type === 'Appointment' ? 'appointment-sc' : s.schedule_type === 'Open Slot' ? 'open-sc' : 'walkin-sc'}`}>
                            <div className="session-top-sc">
                                <strong>{timeRange(s.start_time, s.end_time)}</strong>
                                <span className={`type-badge-sc ${TYPE_CHIP[s.schedule_type]}`}>{typeLabel(s.schedule_type)}</span>
                            </div>
                            <div className="session-meta-sc">
                                {!fixedDoctorId && <span>{s.doctor_name}</span>}
                                <span>{s.visit_type === 'Any' ? 'Any visit' : s.visit_type}</span>
                                {s.location && <span>{s.location}</span>}
                                {s.extended_minutes > 0 && <span>Extended +{s.extended_minutes} min</span>}
                            </div>
                            {s.schedule_type === 'Walk-in' && <div className="session-meta-sc">{s.announcement || 'Students walk in, no booking needed.'}</div>}
                            {s.schedule_type === 'Open Slot' && <div className="session-meta-sc">{s.auto_confirm ? 'Bookings are confirmed automatically' : 'Bookings wait for approval'}</div>}
                            {st && (
                                <>
                                    <div className={`load-bar-sc ${st.full ? 'full-sc' : ''}`}><div style={{ width: `${st.pct}%` }} /></div>
                                    <div className="session-meta-sc">
                                        <span>{s.booked} booked of {s.capacity} places</span>
                                        {s.waiting_for_approval > 0 && <span>{s.waiting_for_approval} waiting for approval</span>}
                                    </div>
                                </>
                            )}
                            {!isPast && (
                                <div className="session-actions-sc">
                                    {s.schedule_type !== 'Walk-in' && (
                                        <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => setAppointFor(s)}><UserPlus size={14} /> Appoint</button>
                                    )}
                                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv btn-sm-sc" onClick={() => onRemind && onRemind(s.schedule_id, s.date)}><Bell size={14} /> Remind waiting list</button>
                                    <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => setExtendSession(s)}><TimerReset size={14} /> Extend</button>
                                </div>
                            )}
                        </div>
                    );
                })}

                {dayAppts.length > 0 && (
                    <>
                        <h3 style={{ fontSize: '0.92rem' }}>Appointments ({dayAppts.length})</h3>
                        {dayAppts.map((a) => (
                            <div key={a.appointment_id} className={`appt-row-sc ${a.status === 'Waiting for Approval' ? 'waiting-sc' : ''}`}>
                                <div>
                                    <strong>{to12h(a.start_time)} - {to12h(a.end_time)}</strong> {a.student_name}
                                    <small>
                                        {!fixedDoctorId ? `${a.doctor_name} - ` : ''}{visitLabel(a.visit_type, a.purpose_other)}
                                        {a.booking_source === 'Walk-in' ? ' - walk-in' : a.booking_source === 'Student' ? ' - booked by the student' : ''}
                                        {a.extended_minutes > 0 ? ` - extended +${a.extended_minutes} min` : ''}
                                    </small>
                                    {a.booking_reason && <small>Reason: {a.booking_reason}</small>}
                                </div>
                                <div className="row-actions-sc">
                                    <span className={`dp-chip ${statusClass(a.status)}`}>{a.status}</span>
                                    {a.status === 'Waiting for Approval' && onGoTab && (
                                        <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => onGoTab('approvals')}><Inbox size={13} /> Review</button>
                                    )}
                                    {a.status === 'Scheduled' && !isPast && (
                                        <button type="button" className="icon-btn-ds" title="Extend this appointment" onClick={() => setExtendAppt(a)}><TimerReset size={15} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </aside>

            <AppointModal
                isOpen={!!appointFor} schedule={appointFor} fixedDate={appointFor ? appointFor.date : null} creator={creator} userId={userId}
                onClose={() => setAppointFor(null)} onDone={changed}
            />
            <ExtendSessionModal schedule={extendSession} creator={creator} userId={userId} onClose={() => setExtendSession(null)} onDone={changed} />
            <ExtendAppointmentModal appt={extendAppt} creator={creator} userId={userId} onClose={() => setExtendAppt(null)} onDone={changed} />
        </div>
    );
};

export default ScheduleCalendar;
