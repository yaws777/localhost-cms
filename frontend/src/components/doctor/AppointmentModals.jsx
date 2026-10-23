// AppointmentModals.jsx
// Small dialogs shared by the doctor portal and the nurse's Doctor Visit page:
// reason (cancel / decline / confirm note), reschedule with a reason, the reason log of an appointment,
// direct appointment (student + custom time block) and walk-in.
import React, { useState, useEffect, useMemo } from 'react';
import { History, CalendarPlus, Footprints, Search, X } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime, formatTime } from '../../utils/datetime';
import { PURPOSES, visitLabel, localDateStr, fullName } from '../../utils/visitPurpose';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const postJson = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

const parseParts = (value) => {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(String(value || ''));
    return m ? { date: m[1], time: m[2] } : { date: '', time: '' };
};

const minutesBetween = (a, b) => {
    const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(b) - toMin(a);
};

const addMinutes = (time, mins) => {
    const [h, m] = time.split(':').map(Number);
    const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Reason (cancel, decline, confirm note ...)
// ---------------------------------------------------------------------------
export const ReasonModal = ({ isOpen, title, message, label = 'Reason', placeholder, required = true, confirmLabel = 'Confirm', danger = false, onSubmit, onClose }) => {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { if (isOpen) { setText(''); setError(''); setBusy(false); } }, [isOpen]);

    const submit = async (e) => {
        e.preventDefault();
        if (required && !text.trim()) { setError('Please give a reason.'); return; }
        setBusy(true);
        try { await onSubmit(text.trim()); } finally { setBusy(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
            <form className="dp-form" onSubmit={submit}>
                {message && <div className="dp-notice">{message}</div>}
                {error && <div className="dp-error">{error}</div>}
                <div className="dp-field">
                    <label htmlFor="reason-text">{label}{required ? '' : ' (optional)'}</label>
                    <textarea id="reason-text" className="dp-textarea" rows={3} maxLength={255} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Back</button>
                    <button type="submit" className={`dp-btn ${danger ? 'dp-btn-danger' : 'dp-btn-primary'}`} disabled={busy}>{busy ? 'Please wait...' : confirmLabel}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Reschedule: a new date and time block, with the reason
// ---------------------------------------------------------------------------
export const RescheduleModal = ({ appt, onSubmit, onClose }) => {
    const start = parseParts(appt?.start_time);
    const end = parseParts(appt?.end_time);
    const [date, setDate] = useState(start.date);
    const [from, setFrom] = useState(start.time);
    const [to, setTo] = useState(end.time);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const duration = start.time && end.time ? minutesBetween(start.time, end.time) : 15;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!date || !from || !to) { setError('Pick the new date and the start and end time.'); return; }
        if (to <= from) { setError('The end time must be after the start time.'); return; }
        if (!reason.trim()) { setError('Please give a reason for rescheduling.'); return; }
        setBusy(true);
        try {
            const message = await onSubmit({ start_time: `${date} ${from}:00`, end_time: `${date} ${to}:00`, reason: reason.trim() });
            if (message) setError(message);
        } finally { setBusy(false); }
    };

    return (
        <Modal isOpen={!!appt} onClose={onClose} title="Reschedule appointment" size="md">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    {fullName(appt?.student_first_name, appt?.student_last_name)} - {visitLabel(appt?.visit_type, appt?.purpose_other)}<br />
                    Now: {formatDate(appt?.start_time)}, {formatTime(appt?.start_time)} - {formatTime(appt?.end_time)}
                    {appt?.booking_source === 'Student' && <><br />This booking came from an open time block, so the new time has to stay inside that block.</>}
                </div>
                {error && <div className="dp-error">{error}</div>}
                <div className="dp-row">
                    <div className="dp-field">
                        <label>New date</label>
                        <input className="dp-input" type="date" required min={localDateStr()} value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="dp-field">
                        <label>Start</label>
                        <input className="dp-input" type="time" required value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value) setTo(addMinutes(e.target.value, duration > 0 ? duration : 15)); }} />
                    </div>
                    <div className="dp-field">
                        <label>End</label>
                        <input className="dp-input" type="time" required value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                </div>
                <div className="dp-field">
                    <label>Reason (the student and parents are told)</label>
                    <textarea className="dp-textarea" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The doctor has an emergency consultation at that time" />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Back</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Reschedule'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Reason log of one appointment
// ---------------------------------------------------------------------------
export const LogModal = ({ appt, onClose }) => {
    const [logs, setLogs] = useState(null);

    useEffect(() => {
        if (!appt) return undefined;
        let live = true;
        setLogs(null);
        fetch(`${API}/api/doctor-appointments/${appt.appointment_id}/logs`)
            .then((r) => r.json())
            .then((d) => { if (live) setLogs(d.success ? d.logs : []); })
            .catch(() => { if (live) setLogs([]); });
        return () => { live = false; };
    }, [appt]);

    return (
        <Modal isOpen={!!appt} onClose={onClose} title="Appointment history" icon={<History size={20} />} size="md">
            {appt && (
                <div className="dp-notice" style={{ marginBottom: 14 }}>
                    {fullName(appt.student_first_name, appt.student_last_name)} - {visitLabel(appt.visit_type, appt.purpose_other)}<br />
                    {formatDate(appt.start_time)}, {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                </div>
            )}
            {logs === null ? <p className="dp-hint">Loading...</p> : logs.length === 0 ? (
                <p className="dp-hint">Nothing was logged for this appointment yet.</p>
            ) : (
                <ul className="dp-timeline">
                    {logs.map((l) => (
                        <li key={l.log_id}>
                            <div className="act">
                                {l.action}
                                {l.from_status && l.to_status && l.from_status !== l.to_status ? ` (${l.from_status} → ${l.to_status})` : ''}
                            </div>
                            <div className="meta">
                                {formatDateTime(l.created_at)} - {l.actor_name ? `${l.actor_name} (${l.actor_role})` : l.actor_role || 'System'}
                            </div>
                            {l.action === 'Rescheduled' && l.old_start_time && l.new_start_time && (
                                <div className="meta">{formatDateTime(l.old_start_time)} → {formatDateTime(l.new_start_time)}</div>
                            )}
                            {l.reason && <div className="why">{l.reason}</div>}
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Visit purpose: General Check Up | Dental | Vision | Other (please specify)
// ---------------------------------------------------------------------------
export const PurposeFields = ({ visitType, purposeOther, onChange, idPrefix = 'purpose' }) => (
    <>
        <div className="dp-field">
            <label htmlFor={`${idPrefix}-type`}>Purpose of the visit</label>
            <select id={`${idPrefix}-type`} className="dp-select" value={visitType} onChange={(e) => onChange({ visit_type: e.target.value, purpose_other: e.target.value === 'Other' ? purposeOther : '' })}>
                {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
        </div>
        {visitType === 'Other' && (
            <div className="dp-field">
                <label htmlFor={`${idPrefix}-other`}>Please specify</label>
                <input id={`${idPrefix}-other`} className="dp-input" type="text" required maxLength={150} value={purposeOther} onChange={(e) => onChange({ visit_type: 'Other', purpose_other: e.target.value })} placeholder="e.g. Counselling referral, wound check" />
            </div>
        )}
    </>
);

// ---------------------------------------------------------------------------
// Pick one student (type a name or ID)
// ---------------------------------------------------------------------------
export const StudentPicker = ({ value, onChange, label = 'Student' }) => {
    const { showAlert } = useAlert();
    const [students, setStudents] = useState([]);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let live = true;
        fetch(`${API}/api/students-list`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setStudents(d.students); })
            .catch(() => showAlert('Could not load the student list.', 'error'));
        return () => { live = false; };
    }, [showAlert]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return students.filter((s) => `${s.first_name} ${s.last_name} ${s.student_id}`.toLowerCase().includes(q)).slice(0, 8);
    }, [students, query]);

    if (value) {
        return (
            <div className="dp-field">
                <label>{label}</label>
                <div className="dp-notice" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span><strong>{fullName(value.first_name, value.last_name)}</strong> - {value.student_id}{value.program_name ? ` - ${value.program_name} ${value.year_level || ''}${value.section || ''}` : ''}</span>
                    <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm dp-btn-icon" onClick={() => onChange(null)} aria-label="Choose another student"><X size={15} /></button>
                </div>
            </div>
        );
    }

    return (
        <div className="dp-field">
            <label htmlFor="student-search">{label}</label>
            <div className="dp-search">
                <Search size={16} />
                <input id="student-search" className="dp-input" type="search" autoComplete="off" placeholder="Type a name or student ID" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {query.trim() && (
                <div style={{ border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
                    {matches.length === 0 ? (
                        <div className="dp-hint" style={{ padding: 10 }}>No student found.</div>
                    ) : matches.map((s) => (
                        <button key={s.student_id} type="button" className="dl-notif" style={{ borderBottom: '1px solid var(--card-border)' }} onClick={() => { onChange(s); setQuery(''); }}>
                            <strong>{fullName(s.first_name, s.last_name)}</strong>
                            <small>{s.student_id}{s.program_name ? ` - ${s.program_name} ${s.year_level || ''}${s.section || ''}` : ''}</small>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// creator: { nurseId } or { doctorId }
const creatorBody = (creator) => (creator.nurseId ? { nurse_id: creator.nurseId } : { created_by_doctor_id: creator.doctorId });

// ---------------------------------------------------------------------------
// Direct appointment: pick the student, set a custom time block
// ---------------------------------------------------------------------------
export const DirectAppointmentModal = ({ isOpen, doctors, fixedDoctorId, creator, userId, presetStudent, onClose, onCreated }) => {
    const { showAlert } = useAlert();
    const [doctorId, setDoctorId] = useState('');
    const [student, setStudent] = useState(null);
    const [purpose, setPurpose] = useState({ visit_type: 'General Check Up', purpose_other: '' });
    const [date, setDate] = useState('');
    const [from, setFrom] = useState('09:00');
    const [to, setTo] = useState('09:30');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDoctorId(fixedDoctorId || '');
        setStudent(presetStudent || null);
        setPurpose({ visit_type: 'General Check Up', purpose_other: '' });
        setDate(localDateStr());
        setFrom('09:00');
        setTo('09:30');
        setReason('');
        setError('');
        setBusy(false);
    }, [isOpen, fixedDoctorId, presetStudent]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!doctorId) { setError('Choose the doctor.'); return; }
        if (!student) { setError('Choose the student.'); return; }
        if (to <= from) { setError('The end time must be after the start time.'); return; }
        setBusy(true);
        try {
            const data = await postJson('/api/doctor-appointments/direct', 'POST', {
                ...creatorBody(creator), sender_id: userId, doctor_id: doctorId, student_id: student.student_id,
                visit_type: purpose.visit_type, purpose_other: purpose.purpose_other, reason,
                start_time: `${date} ${from}:00`, end_time: `${date} ${to}:00`
            });
            if (data.success) {
                showAlert(data.message, 'success');
                onCreated?.();
                onClose();
            } else {
                setError(data.message || 'Could not schedule the appointment.');
            }
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Direct appointment" icon={<CalendarPlus size={20} />} size="md">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">Pick a student and set your own time block. It is confirmed right away and the student and parents are notified.</div>
                {error && <div className="dp-error">{error}</div>}

                {!fixedDoctorId && (
                    <div className="dp-field">
                        <label>Doctor</label>
                        <select className="dp-select" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                            <option value="">-- Select doctor --</option>
                            {(doctors || []).map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}{d.specialization ? ` (${d.specialization})` : ''}</option>)}
                        </select>
                    </div>
                )}

                <StudentPicker value={student} onChange={setStudent} />
                <PurposeFields visitType={purpose.visit_type} purposeOther={purpose.purpose_other} onChange={setPurpose} idPrefix="direct" />

                <div className="dp-row">
                    <div className="dp-field">
                        <label>Date</label>
                        <input className="dp-input" type="date" required min={localDateStr()} value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="dp-field">
                        <label>Start</label>
                        <input className="dp-input" type="time" required value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value) setTo(addMinutes(e.target.value, Math.max(minutesBetween(from, to), 5))); }} />
                    </div>
                    <div className="dp-field">
                        <label>End</label>
                        <input className="dp-input" type="time" required value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                </div>

                <div className="dp-field">
                    <label>Notes for the student (optional)</label>
                    <textarea className="dp-textarea" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Bring your latest lab results" />
                </div>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Scheduling...' : 'Schedule appointment'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Walk-in: the student is at the clinic now
// ---------------------------------------------------------------------------
export const WalkInModal = ({ isOpen, doctors, fixedDoctorId, creator, userId, onClose, onCreated }) => {
    const { showAlert } = useAlert();
    const [doctorId, setDoctorId] = useState('');
    const [student, setStudent] = useState(null);
    const [purpose, setPurpose] = useState({ visit_type: 'General Check Up', purpose_other: '' });
    const [reason, setReason] = useState('');
    const [duration, setDuration] = useState(15);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDoctorId(fixedDoctorId || '');
        setStudent(null);
        setPurpose({ visit_type: 'General Check Up', purpose_other: '' });
        setReason('');
        setDuration(15);
        setError('');
        setBusy(false);
    }, [isOpen, fixedDoctorId]);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!doctorId) { setError('Choose the doctor.'); return; }
        if (!student) { setError('Choose the student.'); return; }
        setBusy(true);
        try {
            const data = await postJson('/api/doctor-visits/walk-in', 'POST', {
                ...creatorBody(creator), sender_id: userId, doctor_id: doctorId, student_id: student.student_id,
                visit_type: purpose.visit_type, purpose_other: purpose.purpose_other, reason, duration_min: duration
            });
            if (data.success) {
                showAlert(data.message, 'success');
                onCreated?.(data);
                onClose();
            } else {
                setError(data.message || 'Could not register the walk-in.');
            }
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Walk-in patient" icon={<Footprints size={20} />} size="md">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">A walk-in has no booking. The student is checked in right now and can be documented straight away.</div>
                {error && <div className="dp-error">{error}</div>}

                {!fixedDoctorId && (
                    <div className="dp-field">
                        <label>Doctor</label>
                        <select className="dp-select" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                            <option value="">-- Select doctor --</option>
                            {(doctors || []).map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}{d.specialization ? ` (${d.specialization})` : ''}</option>)}
                        </select>
                    </div>
                )}

                <StudentPicker value={student} onChange={setStudent} />
                <PurposeFields visitType={purpose.visit_type} purposeOther={purpose.purpose_other} onChange={setPurpose} idPrefix="walkin" />

                <div className="dp-row">
                    <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                        <label>Reason for the visit</label>
                        <input className="dp-input" type="text" required maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever since this morning" />
                    </div>
                    <div className="dp-field">
                        <label>Minutes</label>
                        <input className="dp-input" type="number" min={5} max={240} step={5} required value={duration} onChange={(e) => setDuration(e.target.value)} />
                    </div>
                </div>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Registering...' : 'Register walk-in'}</button>
                </div>
            </form>
        </Modal>
    );
};
