// FollowUps.jsx (the "Repeats" tab)
// The repeat list. Every assessment where the doctor says the student needs a repeat (a follow-up consultation) is one row for one student, so
// repeats are always set individually. From here the nurse or doctor appoints the student again (a direct appointment):
//   - a custom time (any date and hour the doctor is free), or
//   - a slot inside one of the doctor's posted sessions.
// A student with no schedule to go to simply waits in the list until one is posted.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Search, RefreshCw, Undo2, EyeOff, CalendarPlus, Hourglass } from 'lucide-react';
import Modal from '../common/Modal';
import { ReasonModal } from '../doctor/AppointmentModals';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime, formatTime } from '../../utils/datetime';
import { visitLabel, fullName, localDateStr } from '../../utils/visitPurpose';
import { API, dayOfWeek, timeRange } from '../../utils/scheduling';
import { creatorBody } from './SessionModals';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const STATE_FILTERS = [
    ['needs_time', 'Waiting for a schedule'],
    ['scheduled', 'Scheduled'],
    ['done', 'Done'],
    ['dismissed', 'Taken off the list'],
    ['all', 'All']
];

const STATE_BADGE = {
    needs_time: ['badge-pending-ds', 'Waiting for a schedule'],
    scheduled: ['badge-open-ds', 'Scheduled'],
    done: ['badge-expired-ds', 'Done'],
    dismissed: ['badge-closed-ds', 'Taken off the list']
};

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

const occursOn = (s, date) => (s.recurrence === 'Once'
    ? String(s.schedule_date) === date
    : dayOfWeek(date) === Number(s.day_of_week) && String(s.valid_from) <= date && date <= String(s.valid_until));

// ---------------------------------------------------------------------------
// Appoint one repeat
// ---------------------------------------------------------------------------
const AppointFollowUpModal = ({ item, creator, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const [mode, setMode] = useState('time');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('09:00');
    const [duration, setDuration] = useState(15);
    const [notes, setNotes] = useState('');
    const [sessions, setSessions] = useState([]);
    const [sessionId, setSessionId] = useState('');
    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slot, setSlot] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const today = localDateStr();

    useEffect(() => {
        if (!item) return;
        const wanted = item.follow_up_date ? String(item.follow_up_date).slice(0, 10) : '';
        setMode('time');
        setDate(wanted && wanted >= today ? wanted : today);
        setTime('09:00');
        setDuration(15);
        setNotes(item.follow_up_notes || '');
        setSessionId('');
        setSlot('');
        setSlots([]);
        setError('');
        setBusy(false);
        let live = true;
        fetch(`${API}/api/doctor-schedules?status=Open&doctor_id=${encodeURIComponent(item.doctor_id)}`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setSessions(d.schedules.filter((s) => !s.is_expired)); })
            .catch(() => { if (live) setSessions([]); });
        return () => { live = false; };
    }, [item, today]);

    // sessions of the doctor that run on the picked date
    const sessionsOnDate = useMemo(() => (date ? sessions.filter((s) => occursOn(s, date)) : []), [sessions, date]);
    useEffect(() => {
        if (mode !== 'schedule') return;
        if (!sessionsOnDate.some((s) => s.schedule_id === sessionId)) setSessionId(sessionsOnDate[0] ? sessionsOnDate[0].schedule_id : '');
    }, [mode, sessionsOnDate, sessionId]);

    useEffect(() => {
        setSlot('');
        if (mode !== 'schedule' || !sessionId || !date || !item) { setSlots([]); return undefined; }
        let live = true;
        setSlotsLoading(true);
        fetch(`${API}/api/doctor-schedules/${sessionId}/slots?date=${date}&student_id=${encodeURIComponent(item.student_id)}`)
            .then((r) => r.json())
            .then((d) => { if (live) setSlots(d.success ? d.slots : []); })
            .catch(() => { if (live) setSlots([]); })
            .finally(() => { if (live) setSlotsLoading(false); });
        return () => { live = false; };
    }, [mode, sessionId, date, item]);

    if (!item) return null;
    const session = sessions.find((s) => s.schedule_id === sessionId) || null;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!date) { setError('Pick the date of the repeat.'); return; }
        let start; let minutes; let scheduleId;
        if (mode === 'schedule') {
            if (!session || !slot) { setError('Pick a session and one of its time slots.'); return; }
            start = `${date} ${slot}:00`;
            minutes = session.slot_duration_min;
            scheduleId = session.schedule_id;
        } else {
            if (!time) { setError('Pick the time of the repeat.'); return; }
            start = `${date} ${time}:00`;
            minutes = parseInt(duration, 10);
        }
        setBusy(true);
        try {
            const data = await send(`/api/doctor-visits/${item.appointment_id}/follow-up`, 'POST', {
                ...creatorBody(creator), sender_id: userId, student_id: item.student_id, start_time: start, duration_min: minutes, schedule_id: scheduleId, notes
            });
            if (data.success) { showAlert(data.message, 'success'); onDone?.(); onClose(); }
            else setError(data.message || 'Could not schedule the repeat.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={!!item} onClose={onClose} title="Appoint the repeat" icon={<CalendarPlus size={20} />} size="lg">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    <strong>{fullName(item.student_first_name, item.student_last_name)}</strong> - repeat of {visitLabel(item.visit_type, item.purpose_other)} on {formatDate(item.visit_start)}<br />
                    Dr. {item.doc_first_name} {item.doc_last_name}
                    {item.follow_up_date ? ` - the doctor asked for ${formatDate(item.follow_up_date)}` : ''}
                    {item.follow_up_notes ? ` - ${item.follow_up_notes}` : ''}
                </div>
                {error && <div className="dp-error">{error}</div>}

                <div className="status-chips-sc" role="group" aria-label="How to appoint">
                    <button type="button" className={`status-chip-sc ${mode === 'time' ? 'active-sc' : ''}`} onClick={() => setMode('time')}>Pick a time</button>
                    <button type="button" className={`status-chip-sc ${mode === 'schedule' ? 'active-sc' : ''}`} onClick={() => setMode('schedule')}>Put in a schedule</button>
                </div>

                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="fu-date">Date</label>
                        <input id="fu-date" className="dp-input" type="date" min={today} required value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    {mode === 'time' && (
                        <>
                            <div className="dp-field">
                                <label htmlFor="fu-time">Start time</label>
                                <input id="fu-time" className="dp-input" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
                            </div>
                            <div className="dp-field">
                                <label htmlFor="fu-min">Minutes</label>
                                <input id="fu-min" className="dp-input" type="number" min={5} max={240} step={5} required value={duration} onChange={(e) => setDuration(e.target.value)} />
                            </div>
                        </>
                    )}
                </div>

                {mode === 'schedule' && (
                    <>
                        <div className="dp-field">
                            <label htmlFor="fu-session">Session on that day</label>
                            <select id="fu-session" className="dp-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                                {sessionsOnDate.length === 0 && <option value="">No session of this doctor on that date</option>}
                                {sessionsOnDate.map((s) => (
                                    <option key={s.schedule_id} value={s.schedule_id}>{timeRange(s.start_time, s.end_time)}{s.location ? ` - ${s.location}` : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div className="dp-field">
                            <label>Time slot</label>
                            {slotsLoading ? <p className="dp-hint">Loading times...</p> : slots.length === 0 ? <p className="dp-hint">No schedule on this date yet: the student waits in the list until one is posted. Pick a date with a session to see its time slots.</p> : (
                                <div className="slot-grid-sc">
                                    {slots.map((s) => {
                                        const t = s.start_time.slice(11, 16);
                                        return (
                                            <button
                                                key={s.start_time} type="button" disabled={!s.available} className={`slot-sc ${slot === t ? 'selected-sc' : ''}`} onClick={() => setSlot(t)}
                                                title={s.mine ? 'This student already has an appointment then' : s.blocked ? 'The doctor is unavailable' : s.past ? 'Already passed' : !s.available ? 'Fully booked' : 'Free'}
                                            >
                                                {formatTime(s.start_time)}
                                                <small>{s.mine ? 'Has one' : s.blocked ? 'Absent' : s.past ? 'Passed' : s.available ? `${s.capacity - s.booked} free` : 'Full'}</small>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                <div className="dp-field">
                    <label htmlFor="fu-notes">Note for the student (optional)</label>
                    <input id="fu-notes" className="dp-input" type="text" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring the lab results" />
                </div>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || (mode === 'schedule' && !slot)}>{busy ? 'Saving...' : 'Appoint repeat'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Repeat from a past consultation: a direct appointment right now, or wait for a schedule (the student joins the Repeats list)
// ---------------------------------------------------------------------------
export const RepeatModal = ({ appt, creator, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const [wantedDate, setWantedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [appointing, setAppointing] = useState(null);

    useEffect(() => {
        if (!appt) return;
        setWantedDate(appt.follow_up_date ? String(appt.follow_up_date).slice(0, 10) : '');
        setNotes(appt.follow_up_notes || '');
        setBusy(false);
        setError('');
        setAppointing(null);
    }, [appt]);

    if (!appt) return null;

    // the repeat list only holds consultations flagged "repeat needed": flag this one first
    const flag = async () => {
        const data = await send(`/api/follow-ups/${appt.appointment_id}/flag`, 'PUT', { student_id: appt.student_id, follow_up_date: wantedDate || undefined, notes: notes.trim() || undefined });
        if (!data.success) setError(data.message || 'Could not set the repeat.');
        return !!data.success;
    };

    const choose = async (how) => {
        setError('');
        setBusy(true);
        try {
            if (!(await flag())) return;
            if (how === 'wait') {
                showAlert('The student waits in the Repeats list until a schedule is posted.', 'success');
                onDone?.();
                onClose();
            } else {
                setAppointing({ ...appt, visit_start: appt.start_time, follow_up_date: wantedDate || null, follow_up_notes: notes.trim() });
            }
        } catch (e) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    if (appointing) {
        return <AppointFollowUpModal item={appointing} creator={creator} userId={userId} onClose={() => { onDone?.(); onClose(); }} onDone={onDone} />;
    }

    return (
        <Modal isOpen onClose={onClose} title="Repeat consultation" icon={<CalendarClock size={20} />} size="md">
            <div className="dp-form">
                <div className="dp-notice">
                    <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> - repeat of {visitLabel(appt.visit_type, appt.purpose_other)} on {formatDate(appt.start_time)}.
                    Appoint the student now, or let the student wait for a schedule.
                </div>
                {error && <div className="dp-error">{error}</div>}
                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="rp-date">Repeat around (optional)</label>
                        <input id="rp-date" className="dp-input" type="date" min={localDateStr()} value={wantedDate} onChange={(e) => setWantedDate(e.target.value)} />
                    </div>
                    <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                        <label htmlFor="rp-notes">Note for the student (optional)</label>
                        <input id="rp-notes" className="dp-input" type="text" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring the lab results" />
                    </div>
                </div>
                <div className="dp-choice-grid">
                    <button type="button" className="dp-choice" disabled={busy} onClick={() => choose('direct')}>
                        <CalendarPlus size={20} />
                        <strong>Direct appointment</strong>
                        <span>Pick a date and time, or a slot in one of the doctor's schedules, now.</span>
                    </button>
                    <button type="button" className="dp-choice" disabled={busy} onClick={() => choose('wait')}>
                        <Hourglass size={20} />
                        <strong>Wait for a schedule</strong>
                        <span>The student joins the Repeats list and is appointed when a schedule is posted.</span>
                    </button>
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------
const FollowUps = ({ fixedDoctorId, doctors, creator, userId, refreshKey, onChanged }) => {
    const { showAlert } = useAlert();
    const [items, setItems] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState('needs_time');
    const [search, setSearch] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');
    const [appointTarget, setAppointTarget] = useState(null);
    const [dismissTarget, setDismissTarget] = useState(null);

    const load = useCallback(async () => {
        try {
            const doctor = fixedDoctorId || doctorFilter;
            const res = await fetch(`${API}/api/follow-ups${doctor ? `?doctor_id=${encodeURIComponent(doctor)}` : ''}`);
            const data = await res.json();
            if (data.success) { setItems(data.follow_ups); setCounts(data.counts || {}); }
        } catch (e) {
            showAlert('Could not load the repeat list.', 'error');
        } finally {
            setLoading(false);
        }
    }, [fixedDoctorId, doctorFilter, showAlert]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const changed = () => { load(); if (onChanged) onChanged(); };

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((r) => (state === 'all' || r.state === state)
            && (!q || `${r.student_first_name} ${r.student_last_name} ${r.student_id}`.toLowerCase().includes(q)));
    }, [items, state, search]);

    const dismiss = async (reason) => {
        const r = dismissTarget;
        const data = await send(`/api/follow-ups/${r.appointment_id}/dismiss`, 'PUT', { student_id: r.student_id, dismissed: true, reason });
        setDismissTarget(null);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not update the repeat.', 'error');
    };

    const restore = async (r) => {
        const data = await send(`/api/follow-ups/${r.appointment_id}/dismiss`, 'PUT', { student_id: r.student_id, dismissed: false });
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not update the repeat.', 'error');
    };

    return (
        <>
            <p className="summary-ds">
                Each row is one student whose assessment says a repeat consultation is needed. Appoint every repeat on its own, as a direct appointment: pick a time, or put the student in one of the doctor's schedules. A student with no schedule yet waits here until the doctor posts one.
            </p>

            <div className="toolbar-sc">
                <div className="search-box-dv" style={{ width: 260 }}>
                    <Search size={16} />
                    <input type="text" placeholder="Search student or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {!fixedDoctorId && (
                    <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} aria-label="Doctor">
                        <option value="">All doctors</option>
                        {doctors.map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}</option>)}
                    </select>
                )}
                <button type="button" className="icon-btn-ds" title="Refresh" onClick={load}><RefreshCw size={15} /></button>
            </div>

            <div className="status-chips-sc" style={{ marginBottom: 14 }}>
                {STATE_FILTERS.map(([key, label]) => (
                    <button key={key} type="button" className={`status-chip-sc ${state === key ? 'active-sc' : ''}`} onClick={() => setState(key)}>
                        {label} <em>{key === 'all' ? items.length : (counts[key] || 0)}</em>
                    </button>
                ))}
            </div>

            {loading ? <div className="loading-dv">Loading the repeat list...</div> : rows.length === 0 ? (
                <div className="group-empty-ds"><CalendarClock size={16} /> {state === 'needs_time' ? 'No student is waiting for a repeat.' : 'Nothing in this list.'}</div>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead>
                            <tr><th>Student</th><th>Repeat of</th><th>Asked for</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const [badgeClass, badgeText] = STATE_BADGE[r.state];
                                return (
                                    <tr key={`${r.appointment_id}-${r.student_id}`}>
                                        <td>
                                            {fullName(r.student_first_name, r.student_last_name)}
                                            <div className="muted-ds">{r.student_id}{r.program_name ? ` - ${r.program_name} ${r.year_level || ''}${r.section || ''}` : ''}</div>
                                        </td>
                                        <td>
                                            <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                            <div className="muted-ds">{formatDate(r.visit_start)} - Dr. {r.doc_first_name} {r.doc_last_name}</div>
                                            {r.diagnosis && <div className="muted-ds">{r.diagnosis}</div>}
                                        </td>
                                        <td>
                                            {r.follow_up_date ? formatDate(r.follow_up_date) : <span className="muted-ds">No date given</span>}
                                            {r.is_overdue && <div className="muted-ds"><strong className="warn-text-ds">Overdue</strong></div>}
                                            {r.follow_up_notes && <div className="muted-ds">{r.follow_up_notes}</div>}
                                        </td>
                                        <td>
                                            <span className={`badge-ds ${badgeClass}`}>{badgeText}</span>
                                            {r.follow_up && <div className="muted-ds">{formatDateTime(r.follow_up.start_time)} - Dr. {r.follow_up.doc_first_name} {r.follow_up.doc_last_name}{r.follow_up.status === 'Completed' ? ' (seen)' : ''}</div>}
                                            {r.state === 'dismissed' && r.follow_up_closed_reason && <div className="muted-ds">{r.follow_up_closed_reason}</div>}
                                        </td>
                                        <td>
                                            <div className="row-actions-sc">
                                                {r.state === 'needs_time' && (
                                                    <>
                                                        <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => setAppointTarget(r)}><CalendarPlus size={13} /> Appoint</button>
                                                        <button type="button" className="icon-btn-ds" title="Take off the list" onClick={() => setDismissTarget(r)}><EyeOff size={15} /></button>
                                                    </>
                                                )}
                                                {r.state === 'dismissed' && (
                                                    <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => restore(r)}><Undo2 size={13} /> Put back</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <AppointFollowUpModal item={appointTarget} creator={creator} userId={userId} onClose={() => setAppointTarget(null)} onDone={changed} />
            <ReasonModal
                isOpen={!!dismissTarget} title="Take the repeat off the list" confirmLabel="Take off the list" label="Reason"
                message={dismissTarget ? `${fullName(dismissTarget.student_first_name, dismissTarget.student_last_name)} - repeat of ${visitLabel(dismissTarget.visit_type, dismissTarget.purpose_other)}` : ''}
                placeholder="e.g. The student recovered, or was seen elsewhere" onSubmit={dismiss} onClose={() => setDismissTarget(null)}
            />
        </>
    );
};

export default FollowUps;
