// ScheduleCalendar.jsx
// The schedule as a calendar. The nurse sees every doctor, the doctor sees their own; both read the same data
// (GET /api/schedule-calendar), so what one posts shows up for the other right away.
// A day's sessions follow the visit rules:
//   upcoming : the doctor adds / edits / reschedules (the whole session moves with its students) / deletes the schedule (the nurse sends a schedule request), staff appoint students from the waiting list
//              (each gets a queue number); timed appointments can be rescheduled or cancelled
//   ongoing  : the doctor runs the queue (call next, skip, accommodate), staff appoint into what is left, register walk-ins, extend the session
//   past     : closed, nothing can be appointed or changed any more
// Every session lists its participants and its queue.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, UserPlus, TimerReset, CalendarX, Edit, Trash2, CalendarClock, Ban, Users, ListPlus, Megaphone, Send, BellRing } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { visitLabel, statusClass } from '../../utils/visitPurpose';
import {
    API, SCHEDULING_WAYS, SCHEDULING_WAY_KEYS, wayOf, MONTHS, WEEKDAYS, dateKey, todayKey, parseDay, dayLabel, to12h, timeRange, hasWalkIn, coverageLabel
} from '../../utils/scheduling';
import { AppointModal, ExtendSessionModal, ExtendAppointmentModal, ParticipantsModal } from './SessionModals';
import ScheduleFormModal from './ScheduleFormModal';
import { ScheduleRequestModal } from './ScheduleRequests';
import QueuePanel from './QueuePanel';
import SessionEndPrompt from './SessionEndPrompt';
import Modal from '../common/Modal';
import UnavailableDates from '../doctor/UnavailableDates';
import { ReasonModal, RescheduleModal } from '../doctor/AppointmentModals';
import '../../styles/scheduling/Scheduling.css';

const CHIP_LIMIT = 2;
const STATE_LABEL = { upcoming: 'Upcoming', ongoing: 'In session now', past: 'Past - closed' };

const putJson = async (path, body) => {
    const res = await fetch(`${API}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return data;
};

const ScheduleCalendar = ({ doctors, fixedDoctorId, creator, userId, refreshKey, onChanged, onAppointFromWaiting, hidePast = false }) => {
    const { showAlert, showConfirm } = useAlert();
    const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [selected, setSelected] = useState(todayKey());
    const [doctorFilter, setDoctorFilter] = useState(fixedDoctorId || '');
    const isNurse = !creator.doctorId;
    const [requestPreset, setRequestPreset] = useState(null);
    const [queueFor, setQueueFor] = useState(null);
    const [data, setData] = useState({ sessions: [], appointments: [], absences: [] });
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState(null); // { schedule, preset }
    const [appointFor, setAppointFor] = useState(null);
    const [extendSession, setExtendSession] = useState(null);
    const [endFor, setEndFor] = useState(null);
    const [extendAppt, setExtendAppt] = useState(null);
    const [moveAppt, setMoveAppt] = useState(null);
    const [cancelAppt, setCancelAppt] = useState(null);
    const [participantsFor, setParticipantsFor] = useState(null);

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
        // hidePast (nurse and doctor): closed sessions leave the calendar
        data.sessions.filter((s) => !(hidePast && s.state === 'past')).forEach((s) => { (map[s.date] = map[s.date] || []).push(s); });
        return map;
    }, [data.sessions, hidePast]);

    const apptsByDay = useMemo(() => {
        const map = {};
        // places in a session queue belong to their session card; only timed appointments (direct, follow-up, referral) are listed here
        data.appointments.filter((a) => !a.queue_state && !(hidePast && a.state === 'past')).forEach((a) => { (map[a.date] = map[a.date] || []).push(a); });
        return map;
    }, [data.appointments, hidePast]);

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
        const used = s.by_appointment;
        return { used, pct: s.capacity ? Math.min(100, Math.round((used / s.capacity) * 100)) : 0, full: s.capacity ? used >= s.capacity : false };
    };

    // ---- schedule CRUD from the calendar ----
    const addSchedule = () => {
        const doctorId = fixedDoctorId || doctorFilter || '';
        // the doctor sets the schedule; the nurse asks the doctor for it (not on a day the doctor is away: the server refuses it too)
        if (isNurse && doctorId && absentOn(selected).some((u) => !u.start_time && u.doctor_id === doctorId)) {
            showAlert('The doctor is unavailable all day on this date, so a schedule cannot be requested for it. Pick another date.', 'warning');
            return;
        }
        if (isNurse) setRequestPreset({ doctor_id: doctorId, preferred_date: selected });
    };

    // the form needs the whole schedule (dates, slots, booking counts), which the calendar day does not carry
    const editSchedule = async (s) => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules?doctor_id=${encodeURIComponent(s.doctor_id)}`);
            const json = await res.json();
            const full = json.success ? json.schedules.find((x) => x.schedule_id === s.schedule_id) : null;
            if (full) setForm({ schedule: full, preset: null });
            else showAlert('Could not load this schedule.', 'error');
        } catch (e) {
            showAlert('Could not load this schedule.', 'error');
        }
    };

    const cancelSchedule = async (s) => {
        const series = s.recurrence === 'Weekly';
        const ok = await showConfirm(
            `Cancel the ${series ? 'weekly schedule this session belongs to (every day of it)' : 'schedule'} of ${s.doctor_name} on ${dayLabel(s.date)}? The schedule and its session listing are removed and the students are told. Students of the advance listing go back to waiting for a schedule, and the advance listing opens again.`,
            { danger: true, confirmLabel: 'Cancel schedule', title: 'Cancel schedule' }
        );
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${s.schedule_id}`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sender_id: userId })
            });
            const json = await res.json();
            if (json.success) { showAlert(json.message, 'success'); changed(); }
            else showAlert(json.message || 'Could not cancel the schedule.', 'error');
        } catch (e) {
            showAlert('Server error cancelling the schedule.', 'error');
        }
    };

    // the doctor takes an unavailable period off the calendar (the nurse only sees it)
    const removeAbsence = async (u) => {
        const ok = await showConfirm('Remove these unavailable dates? The nurse can ask for a schedule on them again and students can book the doctor again.', { confirmLabel: 'Remove', title: 'Remove unavailable dates' });
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/doctor-unavailable-dates/${u.unavailable_id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) { showAlert(json.message, 'success'); changed(); }
            else showAlert(json.message || 'Could not remove.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        }
    };

    // ---- appointment actions ----
    const rescheduleAppt = async ({ start_time, end_time, reason }) => {
        const json = await putJson(`/api/doctor-visits/reschedule/${moveAppt.appointment_id}`, { sender_id: userId, start_time, end_time, reason });
        if (json.success) { setMoveAppt(null); showAlert('Appointment rescheduled. The student and parents were notified.', 'success'); changed(); return ''; }
        return json.message || 'Could not reschedule the appointment.';
    };

    const cancelAppointment = async (reason) => {
        const json = await putJson(`/api/doctor-visits/cancel/${cancelAppt.appointment_id}`, { sender_id: userId, reason });
        if (json.success) { setCancelAppt(null); showAlert('Appointment cancelled. The student and parents were notified.', 'success'); changed(); }
        else showAlert(json.message || 'Could not cancel the appointment.', 'error');
    };

    const apptName = (a) => (a ? a.student_name : '');
    const forModal = (a) => (a ? { ...a, student_first_name: a.student_name, student_last_name: '' } : null);

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
                    {!isNurse && <UnavailableDates fixedDoctorId={fixedDoctorId} userId={userId} defaultDate={selected} onChanged={changed} />}
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
                                    <span key={`${s.schedule_id}`} className={`cal-chip-sc type-open-sc ${s.state === 'past' ? 'past-sc' : ''}`}>{to12h(s.start_time).replace(':00', '')} Session{s.booked > 0 ? ` (${s.booked})` : ''}</span>
                                ))}
                                {list.length > CHIP_LIMIT && <span className="cal-chip-sc" style={{ color: 'var(--sti-text-muted)' }}>+{list.length - CHIP_LIMIT} more</span>}
                                {apptCount > 0 && <span className="cal-chip-sc" style={{ color: 'var(--sti-text-muted)' }}>{apptCount} appt{apptCount > 1 ? 's' : ''}</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="cal-legend-sc">
                    {SCHEDULING_WAY_KEYS.map((k) => <span key={k}><i className={`type-badge-sc ${SCHEDULING_WAYS[k].cls}`}>{SCHEDULING_WAYS[k].label}</i></span>)}
                    <span><CalendarX size={14} /> Doctor unavailable</span>
                </div>
            </section>

            <aside className="cal-card-sc day-panel-sc" aria-label="Selected day">
                <div className="day-head-sc">
                    <h3>{dayLabel(selected, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{selected === today ? ' (today)' : ''}</h3>
                    {!isPast && isNurse && (
                        <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={addSchedule}>
                            <Send size={14} /> Request schedule
                        </button>
                    )}
                </div>

                {loading && <div className="empty-sc">Loading...</div>}

                {dayAbsences.map((u) => (
                    <div key={u.unavailable_id} className="absence-sc">
                        <strong>{u.doctor_name} is unavailable</strong> {u.start_time ? timeRange(u.start_time, u.end_time) : 'all day'}{u.reason ? ` - ${u.reason}` : ''}
                        {u.start_date !== u.end_date && <span> ({dayLabel(u.start_date)} to {dayLabel(u.end_date)})</span>}
                        {!isNurse && (
                            <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" style={{ marginLeft: 8 }} onClick={() => removeAbsence(u)}><Trash2 size={14} /> Remove</button>
                        )}
                    </div>
                ))}

                {!loading && daySessions.length === 0 && dayAppts.length === 0 && dayAbsences.length === 0 && (
                    <div className="empty-sc">{isPast ? 'Nothing was scheduled this day.' : 'Nothing scheduled this day.'}</div>
                )}

                {daySessions.map((s) => {
                    const st = sessionStatus(s);
                    const doctor = doctors.find((d) => d.doctor_id === s.doctor_id);
                    return (
                        <div key={s.schedule_id} className={`session-card-sc ${s.state === 'past' ? 'closed-sc' : 'open-sc'}`}>
                            <div className="session-top-sc">
                                <strong>{timeRange(s.start_time, s.end_time)}</strong>
                                <span className={`type-badge-sc ${s.state === 'past' ? 'type-closed-sc' : 'type-open-sc'}`}>{STATE_LABEL[s.state]}</span>
                            </div>
                            <div className="session-meta-sc">
                                {!fixedDoctorId && <span>{s.doctor_name}</span>}
                                <span>{s.visit_type === 'Any' ? 'Any purpose' : s.visit_type}</span>
                                {s.location && <span>{s.location}</span>}
                                {s.extended_minutes > 0 && <span>Extended +{s.extended_minutes} min</span>}
                            </div>
                            {doctor && <div className="session-meta-sc"><span>Covers: {coverageLabel(doctor)}</span></div>}
                            <div className="session-meta-sc">
                                <span>{hasWalkIn(s) ? 'Walk-ins allowed' : 'No walk-ins'}</span>
                            </div>
                            <div className="session-meta-sc">
                                {SCHEDULING_WAY_KEYS.map((k) => {
                                    const n = s[`by_${k}`];
                                    return <span key={k} className={`type-badge-sc ${SCHEDULING_WAYS[k].cls}`}>{n || 0} {SCHEDULING_WAYS[k].short.toLowerCase()}</span>;
                                })}
                            </div>
                            {(s.queue_waiting > 0 || s.queue_serving || s.queue_void > 0 || s.queue_done > 0) && (
                                <div className="session-queue-sc">
                                    <span><Megaphone size={13} /> Serving <b>{s.queue_serving || '-'}</b></span>
                                    <span><b>{s.queue_waiting}</b> waiting</span>
                                    {s.queue_void > 0 && <span><b>{s.queue_void}</b> void</span>}
                                    {s.queue_done > 0 && <span><b>{s.queue_done}</b> done</span>}
                                </div>
                            )}
                            {(s.notes || s.announcement) && <div className="session-meta-sc">{s.notes || s.announcement}</div>}
                            {st && (
                                <>
                                    <div className={`load-bar-sc ${st.full ? 'full-sc' : ''}`}><div style={{ width: `${st.pct}%` }} /></div>
                                    <div className="session-meta-sc">
                                        <span>{s.by_appointment} appointed of {s.capacity} places</span>
                                        {s.by_advance > 0 && <span>Advance listing <b>{s.by_advance}</b>, then session listing <b>{Math.max(s.by_session, 0)}</b></span>}
                                    </div>
                                </>
                            )}
                            <div className="session-actions-sc">
                                {s.state !== 'past' && isNurse && (
                                    <button type="button" className="icon-btn-ds btn-icon-sc" aria-label="Appoint" title="Appoint" onClick={() => setAppointFor(s)}><UserPlus size={18} aria-hidden="true" /></button>
                                )}
                                {s.state !== 'past' && (
                                    <button type="button" className="icon-btn-ds btn-icon-sc" aria-label="Listing requests" title="Listing requests" onClick={() => onAppointFromWaiting && onAppointFromWaiting(s.schedule_id, s.date)}><ListPlus size={18} aria-hidden="true" /></button>
                                )}
                                {s.state !== 'upcoming' && (
                                    <button type="button" className="icon-btn-ds btn-icon-sc" aria-label={s.state === 'ongoing' ? 'Open queue' : 'View queue'} title={s.state === 'ongoing' ? 'Open queue' : 'View queue'} onClick={() => setQueueFor(s)}><Megaphone size={18} aria-hidden="true" /></button>
                                )}
                                {s.state === 'ongoing' && (
                                    <>
                                        {s.awaiting_end && (
                                            <button type="button" className="icon-btn-ds btn-icon-sc" aria-label="Confirm end time" title="Confirm end time" onClick={() => setEndFor(s)}><BellRing size={18} aria-hidden="true" /></button>
                                        )}
                                        {!isNurse && <button type="button" className="icon-btn-ds btn-icon-sc" aria-label="Extend" title="Extend" onClick={() => setExtendSession(s)}><TimerReset size={18} aria-hidden="true" /></button>}
                                    </>
                                )}
                                <button type="button" className="icon-btn-ds btn-icon-sc" aria-label="Participants" title="Participants" onClick={() => setParticipantsFor(s)}><Users size={18} aria-hidden="true" /></button>
                                {s.state !== 'past' && !isNurse && (
                                    <button type="button" className="icon-btn-ds btn-icon-sc" aria-label={s.recurrence === 'Weekly' ? 'Edit series' : 'Edit'} title={s.recurrence === 'Weekly' ? 'Edit series' : 'Edit'} onClick={() => editSchedule(s)}><Edit size={18} aria-hidden="true" /></button>
                                )}
                                {s.state === 'upcoming' && !isNurse && (
                                    <button type="button" className="icon-btn-ds btn-icon-sc" aria-label="Cancel schedule" title="Cancel schedule" onClick={() => cancelSchedule(s)}><Trash2 size={18} aria-hidden="true" /></button>
                                )}
                            </div>
                        </div>
                    );
                })}

                {dayAppts.length > 0 && (
                    <>
                        <h3 style={{ fontSize: '0.92rem' }}>Appointments ({dayAppts.length})</h3>
                        {dayAppts.map((a) => (
                            <div key={`${a.appointment_id}-${a.student_id}`} className="appt-row-sc">
                                <div>
                                    <strong>{to12h(a.start_time)} - {to12h(a.end_time)}</strong> {a.student_name}
                                    <small>
                                        {!fixedDoctorId ? `${a.doctor_name} - ` : ''}{visitLabel(a.visit_type, a.purpose_other)}
                                        {a.extended_minutes > 0 ? ` - extended +${a.extended_minutes} min` : ''}
                                    </small>
                                    {a.booking_reason && <small>Reason: {a.booking_reason}</small>}
                                </div>
                                <div className="row-actions-sc">
                                    <span className={`type-badge-sc ${SCHEDULING_WAYS[wayOf(a.booking_source, a.how)].cls}`}>{SCHEDULING_WAYS[wayOf(a.booking_source, a.how)].label}</span>
                                    <span className={`dp-chip ${statusClass(a.status)}`}>{a.status}</span>
                                    {a.status === 'Scheduled' && a.state === 'upcoming' && (
                                        <>
                                            <button type="button" className="icon-btn-ds" title="Reschedule this appointment" onClick={() => setMoveAppt(forModal(a))}><CalendarClock size={15} /></button>
                                            <button type="button" className="icon-btn-ds" title="Cancel this appointment" onClick={() => setCancelAppt(a)}><Ban size={15} /></button>
                                        </>
                                    )}
                                    {!isNurse && a.status === 'Scheduled' && a.state === 'ongoing' && (
                                        <button type="button" className="icon-btn-ds" title="Extend this appointment (it is happening now)" onClick={() => setExtendAppt(a)}><TimerReset size={15} /></button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </aside>

            <ScheduleFormModal
                isOpen={!!form} schedule={form ? form.schedule : null} preset={form ? form.preset : null} doctors={doctors}
                creator={creator} userId={userId} onClose={() => setForm(null)} onSaved={changed}
            />
            <ScheduleRequestModal
                isOpen={!!requestPreset} preset={requestPreset} doctors={doctors} nurseId={creator.nurseId} userId={userId}
                onClose={() => setRequestPreset(null)} onSent={changed}
            />
            <Modal isOpen={!!queueFor} onClose={() => setQueueFor(null)} title="Session queue" icon={<Megaphone size={20} />} size="lg">
                {queueFor && (
                    <>
                        <div className="dp-notice" style={{ marginBottom: 12 }}>
                            {queueFor.doctor_name} - {dayLabel(queueFor.date, { weekday: 'long', month: 'long', day: 'numeric' })}, {timeRange(queueFor.start_time, queueFor.end_time)}
                        </div>
                        <QueuePanel scheduleId={queueFor.schedule_id} date={queueFor.date} creator={creator} userId={userId} onChanged={changed} />
                    </>
                )}
            </Modal>
            <AppointModal
                isOpen={!!appointFor} schedule={appointFor} fixedDate={appointFor ? appointFor.date : null} creator={creator} userId={userId}
                onClose={() => setAppointFor(null)} onDone={changed}
            />
            <ParticipantsModal schedule={participantsFor} userId={userId} onClose={() => setParticipantsFor(null)} onChanged={changed} />
            <ExtendSessionModal schedule={extendSession} creator={creator} userId={userId} onClose={() => setExtendSession(null)} onDone={changed} />
            {endFor && (
                <SessionEndPrompt
                    item={{ key: `${endFor.schedule_id}|${endFor.date}|${endFor.end_time}`, kind: 'check-up', endTime: endFor.end_time, title: `${endFor.doctor_name}'s session on ${dayLabel(endFor.date)}` }}
                    onConfirm={async () => {
                        const res = await putJson(`/api/doctor-schedules/${endFor.schedule_id}/end-session`, { sender_id: userId, created_by_doctor_id: creator.doctorId || undefined });
                        if (!res.success) return res.message || 'Could not end the session.';
                        showAlert(res.message, 'success'); setEndFor(null); changed(); return '';
                    }}
                    onExtend={isNurse ? undefined : async (minutes) => {
                        const res = await putJson(`/api/doctor-schedules/${endFor.schedule_id}/extend`, { extra_minutes: minutes, sender_id: userId, created_by_doctor_id: creator.doctorId || undefined });
                        if (!res.success) return res.message || 'Could not extend the session.';
                        showAlert(res.message, 'success'); setEndFor(null); changed(); return '';
                    }}
                    onLater={() => setEndFor(null)}
                />
            )}
            <ExtendAppointmentModal appt={extendAppt} creator={creator} userId={userId} onClose={() => setExtendAppt(null)} onDone={changed} />
            {moveAppt && <RescheduleModal key={moveAppt.appointment_id} appt={moveAppt} onSubmit={rescheduleAppt} onClose={() => setMoveAppt(null)} />}
            <ReasonModal
                isOpen={!!cancelAppt}
                title="Cancel appointment"
                message={cancelAppt && `${apptName(cancelAppt)} - ${dayLabel(cancelAppt.date)}, ${to12h(cancelAppt.start_time)}. The student and parents are notified.`}
                label="Reason (shown to the student)"
                placeholder="e.g. The doctor is unavailable, please rebook"
                confirmLabel="Cancel appointment"
                danger
                onSubmit={cancelAppointment}
                onClose={() => setCancelAppt(null)}
            />
        </div>
    );
};

export default ScheduleCalendar;
