// SessionModals.jsx
// Dialogs for a check-up session that both the nurse and the doctor use:
// appoint a student into a session, extend a session, extend one appointment.
import React, { useState, useEffect, useCallback } from 'react';
import { CalendarPlus, CalendarClock, Ban, TimerReset, Users } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { visitLabel, fullName } from '../../utils/visitPurpose';
import { API, SCHEDULING_WAYS, wayOf, dayLabel, to12h, upcomingDates, sessionEnded } from '../../utils/scheduling';
import { useSpecializations } from '../../hooks/useSpecializations';
import { StudentPicker, ReasonModal, RescheduleModal } from '../doctor/AppointmentModals';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

// creator: { nurseId } or { doctorId }
export const creatorBody = (creator) => (creator.nurseId ? { nurse_id: creator.nurseId } : { created_by_doctor_id: creator.doctorId });

// ---------------------------------------------------------------------------
// Appoint a student into a session: no time is picked, the student takes the next queue number of that session day
// ---------------------------------------------------------------------------
export const AppointModal = ({ isOpen, schedule, request, fixedDate, creator, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const [student, setStudent] = useState(null);
    const [dates, setDates] = useState([]);
    const [date, setDate] = useState('');
    const [queue, setQueue] = useState(null);
    const [visitType, setVisitType] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // how full the session day is and which number the student will get
    const loadQueue = useCallback(async (forDate) => {
        if (!schedule || !forDate) { setQueue(null); return; }
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${schedule.schedule_id}/queue?date=${forDate}`);
            const data = await res.json();
            setQueue(data.success ? data.queue : null);
        } catch (e) {
            setQueue(null);
        }
    }, [schedule]);

    useEffect(() => {
        if (!isOpen || !schedule) return;
        // a session that is already over is closed for appointments: only days that still have time left are offered
        const list = (fixedDate ? [fixedDate] : upcomingDates(schedule, 10)).filter((d) => !sessionEnded(schedule, d));
        const preferred = request && request.notified_schedule_id === schedule.schedule_id && request.notified_date && list.includes(String(request.notified_date).slice(0, 10))
            ? String(request.notified_date).slice(0, 10) : list[0] || '';
        setDates(list);
        setDate(preferred);
        setStudent(request ? {
            student_id: request.student_id, first_name: request.student_first_name, last_name: request.student_last_name,
            program_name: request.program_name, year_level: request.year_level, section: request.section
        } : null);
        // the purpose of the check-up is never guessed: it is the student's request, the session's own purpose, or picked by the staff
        setVisitType(request ? request.visit_type : visitTypes.includes(schedule.visit_type) ? schedule.visit_type : '');
        setReason('');
        setError('');
        setBusy(false);
        loadQueue(preferred);
    }, [isOpen, schedule, request, fixedDate, loadQueue, visitTypes]);

    const pickDate = (d) => { setDate(d); loadQueue(d); };

    const listed = queue ? queue.entries.filter((e) => e.lane === 'Listed' && e.state !== 'Void') : [];
    const nextNo = queue ? Math.max(0, ...queue.entries.filter((e) => e.lane === 'Listed').map((e) => e.queue_no)) + 1 : null;
    const full = !!queue && listed.length >= queue.capacity;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!student) { setError('Choose the student.'); return; }
        if (!visitType) { setError('Select the purpose of the check-up.'); return; }
        if (schedule.visit_type !== 'Any' && visitTypes.includes(schedule.visit_type) && visitType !== schedule.visit_type) {
            setError(`This session is for ${schedule.visit_type} check-ups, so the purpose has to be ${schedule.visit_type}.`); return;
        }
        if (!date) { setError('Pick the day of the session.'); return; }
        setBusy(true);
        try {
            const data = await send(`/api/doctor-schedules/${schedule.schedule_id}/appoint`, 'POST', {
                ...creatorBody(creator), sender_id: userId, student_id: student.student_id, request_id: request ? request.request_id : undefined,
                date, visit_type: visitType, reason
            });
            if (data.success) {
                showAlert(data.message, 'success');
                onDone?.();
                onClose();
            } else {
                setError(data.message || 'Could not appoint the student.');
                if (data.httpStatus === 409) loadQueue(date);
            }
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    if (!schedule) return null;
    const docName = schedule.doctor_name || `Dr. ${schedule.doc_first_name || ''} ${schedule.doc_last_name || ''}`.trim();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Appoint a student" icon={<CalendarPlus size={20} />} size="md">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    {docName} - {to12h(schedule.start_time)} to {to12h(schedule.end_time)}{schedule.location ? ` - ${schedule.location}` : ''}.
                    {schedule.covered_visit_types && <> Covers: <strong>{schedule.covered_visit_types.join(', ')}</strong>.</>}
                </div>
                {error && <div className="dp-error">{error}</div>}

                {request ? (
                    <div className="dp-notice">
                        <strong>{fullName(request.student_first_name, request.student_last_name)}</strong> - {visitLabel(request.visit_type, request.purpose_other)} (list no. #{request.queue_no})<br />
                        Reason: {request.reason}
                    </div>
                ) : <StudentPicker value={student} onChange={setStudent} />}

                {request ? (
                    <div className="dp-hint">The purpose follows the student's request: <strong>{visitLabel(request.visit_type, request.purpose_other)}</strong>.</div>
                ) : schedule.visit_type !== 'Any' && visitTypes.includes(schedule.visit_type) ? (
                    <div className="dp-hint">Purpose of the check-up: <strong>{schedule.visit_type}</strong> (the purpose of this session).</div>
                ) : (
                    <div className="dp-field">
                        <label htmlFor="appoint-type">Purpose of the check-up</label>
                        <select id="appoint-type" className="dp-select" required value={visitType} onChange={(e) => setVisitType(e.target.value)}>
                            <option value="">-- Select the purpose --</option>
                            {visitTypes.filter((p) => !schedule.covered_visit_types || schedule.covered_visit_types.includes(p)).map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                )}

                <div className="dp-field">
                    <label>Day of the session</label>
                    <select className="dp-select" required value={date} onChange={(e) => pickDate(e.target.value)}>
                        {dates.length === 0 && <option value="">No day left: the session is over</option>}
                        {dates.map((d) => <option key={d} value={d}>{dayLabel(d, { weekday: 'long', month: 'long', day: 'numeric' })}</option>)}
                    </select>
                </div>

                {queue && (
                    <div className={full ? 'dp-error' : 'dp-notice'}>
                        {full
                            ? `This session day is full (${queue.capacity} students).`
                            : <>The student will get queue number <strong>#{nextNo}</strong>. {listed.length} of {queue.capacity} places are taken.</>}
                    </div>
                )}

                <div className="dp-field">
                    <label>Note for the student (optional)</label>
                    <textarea className="dp-textarea" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || !date || !student || !visitType || full}>{busy ? 'Appointing...' : 'Appoint student'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Participants: everyone who has a place in one session, in queue order
// ---------------------------------------------------------------------------
// Before the session ends the nurse or doctor can cancel a waiting place (the student returns to the waiting list, keeping the place in line)
export const ParticipantsModal = ({ schedule, userId, onClose, onChanged }) => {
    const { showAlert } = useAlert();
    const [list, setList] = useState(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [moveFor, setMoveFor] = useState(null);
    const [cancelFor, setCancelFor] = useState(null);
    const canChange = !!schedule && schedule.state !== 'past';

    useEffect(() => {
        if (!schedule) return undefined;
        let live = true;
        setList(null);
        fetch(`${API}/api/doctor-schedules/${schedule.schedule_id}/participants?date=${schedule.date}`)
            .then((r) => r.json())
            .then((d) => { if (live) setList(d.success ? d.participants : []); })
            .catch(() => { if (live) setList([]); });
        return () => { live = false; };
    }, [schedule, reloadKey]);

    const changed = () => { setReloadKey((k) => k + 1); if (onChanged) onChanged(); };

    const move = async ({ start_time, end_time, reason }) => {
        const res = await send(`/api/doctor-visits/reschedule/${moveFor.appointment_id}`, 'PUT', { sender_id: userId, start_time, end_time, reason });
        if (res.success) { setMoveFor(null); showAlert('Appointment rescheduled. The student and parents were notified.', 'success'); changed(); return ''; }
        return res.message || 'Could not reschedule the appointment.';
    };

    const cancel = async (reason) => {
        const res = await send(`/api/doctor-visits/cancel/${cancelFor.appointment_id}`, 'PUT', { sender_id: userId, reason });
        if (res.success) { setCancelFor(null); showAlert('Place cancelled. The student and parents were notified.', 'success'); changed(); }
        else showAlert(res.message || 'Could not cancel the place.', 'error');
    };

    return (
        <>
        <Modal isOpen={!!schedule} onClose={onClose} title="Participants" icon={<Users size={20} />} size="lg">
            {schedule && (
                <>
                    <div className="dp-notice" style={{ marginBottom: 12 }}>
                        {schedule.doctor_name} - {dayLabel(schedule.date, { weekday: 'long', month: 'long', day: 'numeric' })}, {to12h(schedule.start_time)} to {to12h(schedule.end_time)}
                    </div>
                    {list === null ? <p className="dp-hint">Loading...</p> : list.length === 0 ? <p className="dp-hint">Nobody has a place in this session yet.</p> : (
                        <div className="table-card-dv">
                            <table className="sti-table-dv">
                                <thead>
                                    <tr><th>No.</th><th>Student</th><th>Purpose</th><th>How</th><th>Status</th>{canChange && <th>Actions</th>}</tr>
                                </thead>
                                <tbody>
                                    {list.map((p) => (
                                        <tr key={`${p.appointment_id}-${p.student_id}`} className={p.queue_state === 'Void' ? 'void-row-sc' : ''}>
                                            <td><strong>{p.queue_label || to12h(p.start_time.slice(11))}</strong></td>
                                            <td>
                                                {p.student_name}
                                                <div className="muted-ds">{p.student_id}{p.program_name ? ` - ${p.program_name} ${p.year_level || ''}${p.section || ''}` : ''}</div>
                                            </td>
                                            <td>{visitLabel(p.visit_type, p.purpose_other)}</td>
                                            <td><span className={`type-badge-sc ${SCHEDULING_WAYS[wayOf(p.booking_source)].cls}`}>{SCHEDULING_WAYS[wayOf(p.booking_source)].label}</span></td>
                                            <td>
                                                {p.queue_state || p.status}
                                                {p.attendance_status && p.attendance_status !== 'Pending' && <div className="muted-ds">{p.attendance_status}</div>}
                                            </td>
                                            {canChange && (
                                                <td>
                                                    {p.status === 'Scheduled' && (!p.queue_state || p.queue_state === 'Waiting') && (
                                                        <div className="row-actions-sc">
                                                            {!p.queue_state && schedule.state === 'upcoming' && (
                                                                <button type="button" className="icon-btn-ds" title="Change the time of this participant" onClick={() => setMoveFor({ ...p, schedule_id: schedule.schedule_id, doctor_id: schedule.doctor_id, student_first_name: p.student_name, student_last_name: '' })}><CalendarClock size={15} /></button>
                                                            )}
                                                            <button type="button" className="icon-btn-ds" title="Cancel this place" onClick={() => setCancelFor(p)}><Ban size={15} /></button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
                    </div>
                </>
            )}
        </Modal>
        {moveFor && <RescheduleModal key={moveFor.appointment_id} appt={moveFor} onSubmit={move} onClose={() => setMoveFor(null)} />}
        <ReasonModal
            isOpen={!!cancelFor}
            title="Cancel this place"
            message={cancelFor && `${cancelFor.student_name} - ${cancelFor.queue_label || to12h(cancelFor.start_time.slice(11))}. The student and parents are notified and the student can ask for a place in another listing.`}
            label="Reason (shown to the student)"
            placeholder="e.g. The doctor has to leave early"
            confirmLabel="Cancel place"
            danger
            onSubmit={cancel}
            onClose={() => setCancelFor(null)}
        />
        </>
    );
};

// ---------------------------------------------------------------------------
// Extend a session (the doctor stays longer)
// ---------------------------------------------------------------------------
const EXTRA_MINUTES = [15, 30, 45, 60, 90, 120];

export const ExtendSessionModal = ({ schedule, creator, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const [extra, setExtra] = useState(30);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { if (schedule) { setExtra(30); setReason(''); setError(''); setBusy(false); } }, [schedule]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const data = await send(`/api/doctor-schedules/${schedule.schedule_id}/extend`, 'PUT', {
                extra_minutes: extra, reason, sender_id: userId, created_by_doctor_id: creator.doctorId || undefined
            });
            if (data.success) { showAlert(data.message, 'success'); onDone?.(); onClose(); }
            else setError(data.message || 'Could not extend the session.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={!!schedule} onClose={onClose} title="Extend the session" icon={<TimerReset size={20} />} size="sm">
            {schedule && (
                <form className="dp-form" onSubmit={submit}>
                    <div className="dp-notice">
                        Now {to12h(schedule.start_time)} to {to12h(schedule.end_time)}.
                        {schedule.extended_minutes > 0 ? ` Already extended by ${schedule.extended_minutes} min.` : ''}
                        {' '}Appointments, open slots and walk-ins can all use the extra time.
                    </div>
                    {error && <div className="dp-error">{error}</div>}
                    <div className="dp-field">
                        <label>Extend by</label>
                        <select className="dp-select" value={extra} onChange={(e) => setExtra(Number(e.target.value))}>
                            {EXTRA_MINUTES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                        </select>
                    </div>
                    <div className="dp-field">
                        <label>Reason (optional)</label>
                        <input className="dp-input" type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Many walk-ins today" />
                    </div>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Extend'}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Extend one appointment (the check-up runs longer)
// ---------------------------------------------------------------------------
export const ExtendAppointmentModal = ({ appt, creator, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const [extra, setExtra] = useState(15);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { if (appt) { setExtra(15); setReason(''); setError(''); setBusy(false); } }, [appt]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!reason.trim()) { setError('Please give a reason for extending.'); return; }
        setBusy(true);
        try {
            const data = await send(`/api/doctor-visits/extend/${appt.appointment_id}`, 'PUT', {
                extra_minutes: extra, reason: reason.trim(), sender_id: userId, created_by_doctor_id: creator.doctorId || undefined
            });
            if (data.success) { showAlert(data.message, 'success'); onDone?.(); onClose(); }
            else setError(data.message || 'Could not extend the appointment.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={!!appt} onClose={onClose} title="Extend appointment" icon={<TimerReset size={20} />} size="sm">
            {appt && (
                <form className="dp-form" onSubmit={submit}>
                    <div className="dp-notice">
                        {appt.student_name} - {visitLabel(appt.visit_type, appt.purpose_other)}<br />
                        {to12h(appt.start_time)} to {to12h(appt.end_time)}{appt.extended_minutes > 0 ? ` (already +${appt.extended_minutes} min)` : ''}
                    </div>
                    {error && <div className="dp-error">{error}</div>}
                    <div className="dp-field">
                        <label>Extend by</label>
                        <select className="dp-select" value={extra} onChange={(e) => setExtra(Number(e.target.value))}>
                            {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                        </select>
                    </div>
                    <div className="dp-field">
                        <label>Reason (the student is told)</label>
                        <input className="dp-input" type="text" required maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. More tests needed" />
                    </div>
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Extend'}</button>
                    </div>
                </form>
            )}
        </Modal>
    );
};
