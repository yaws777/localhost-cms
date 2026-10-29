// WaitingList.jsx
// Consultation requests of the students. The nurse and the doctor use this same screen:
//   review (approve / deny with a reason) -> waiting list -> ask to reconfirm for a posted session -> reconfirmed -> appoint.
// The session cards of the calendar land here: "Reconfirm" opens the waiting list and "Appoint from waiting list" opens the reconfirmed
// students, each with the session already picked, so the staff only selects the students.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check, XCircle, Bell, Star, History, UserPlus, Search, Wand2, RefreshCw } from 'lucide-react';
import Modal from '../common/Modal';
import { ReasonModal } from '../doctor/AppointmentModals';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { visitLabel, fullName } from '../../utils/visitPurpose';
import { useSpecializations } from '../../hooks/useSpecializations';
import {
    API, REQUEST_STATUS_CLASS, upcomingDates, dayLabel, timeRange, doctorOffers, sessionEnded
} from '../../utils/scheduling';
import { AppointModal, creatorBody } from './SessionModals';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const GROUPS = [
    ['review', 'Waiting for approval', ['Waiting for Approval']],
    ['waiting', 'Waiting list', ['Waiting List']],
    ['reconfirm', 'Awaiting reconfirmation', ['Awaiting Reconfirmation']],
    ['ready', 'Reconfirmed', ['Reconfirmed']],
    ['done', 'Appointed / seen', ['Appointed', 'Booked', 'Fulfilled']],
    ['closed', 'Denied / withdrawn', ['Denied', 'Withdrawn']],
    ['all', 'All', null]
];

const NOTIFIABLE = ['Waiting List', 'Awaiting Reconfirmation'];

const post = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

const WaitingList = ({ doctors, fixedDoctorId, creator, userId, refreshKey, initialGroup, focusSchedule, onFocusConsumed, onChanged }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const [requests, setRequests] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [group, setGroup] = useState(initialGroup || 'review');
    useEffect(() => { if (initialGroup) setGroup(initialGroup); }, [initialGroup]);
    const [search, setSearch] = useState('');
    const [purpose, setPurpose] = useState('');
    const [selected, setSelected] = useState(() => new Set());

    const [sessionId, setSessionId] = useState('');
    const [sessionDate, setSessionDate] = useState('');
    const [busy, setBusy] = useState(false);

    const [denyTarget, setDenyTarget] = useState(null);
    const [approveTarget, setApproveTarget] = useState(null);
    const [priorityOnApprove, setPriorityOnApprove] = useState(false);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [history, setHistory] = useState(null);
    const [appointTarget, setAppointTarget] = useState(null);
    const [pickSession, setPickSession] = useState(null);
    const [pickedSessionId, setPickedSessionId] = useState('');
    const [skippedInfo, setSkippedInfo] = useState(null);

    const load = useCallback(async () => {
        try {
            const doctorQs = fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : '';
            const [reqRes, schedRes] = await Promise.all([
                fetch(`${API}/api/consultation-requests?status=all${doctorQs}`),
                fetch(`${API}/api/doctor-schedules?status=Open${fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : ''}`)
            ]);
            const reqData = await reqRes.json();
            const schedData = await schedRes.json();
            if (reqData.success) setRequests(reqData.requests);
            if (schedData.success) setSchedules(schedData.schedules.filter((s) => !s.is_expired));
        } catch (e) {
            showAlert('Could not load the consultation requests.', 'error');
        } finally {
            setLoading(false);
        }
    }, [fixedDoctorId, showAlert]);

    useEffect(() => { load(); }, [load, refreshKey]);

    // Sent here from a schedule row / the calendar: pre-select that session and show the list the staff picks students from
    // (mode 'reconfirm': the waiting list, mode 'appoint': the reconfirmed students)
    useEffect(() => {
        if (!focusSchedule || schedules.length === 0) return;
        const found = schedules.find((s) => s.schedule_id === focusSchedule.schedule_id);
        if (found) {
            setSessionId(found.schedule_id);
            setSessionDate(focusSchedule.date || '');
            setGroup(focusSchedule.mode === 'appoint' ? 'ready' : 'waiting');
            setSelected(new Set());
        }
        if (onFocusConsumed) onFocusConsumed();
    }, [focusSchedule, schedules, onFocusConsumed]);

    const counts = useMemo(() => {
        const map = {};
        GROUPS.forEach(([key, , statuses]) => { map[key] = statuses ? requests.filter((r) => statuses.includes(r.status)).length : requests.length; });
        return map;
    }, [requests]);

    // First time the list loads: open the list that needs someone's attention
    const [autoPicked, setAutoPicked] = useState(!!initialGroup);
    useEffect(() => {
        if (autoPicked || loading) return;
        setAutoPicked(true);
        const next = ['review', 'ready', 'reconfirm', 'waiting'].find((key) => counts[key] > 0);
        if (next) setGroup(next);
    }, [autoPicked, loading, counts]);

    const rows = useMemo(() => {
        const statuses = GROUPS.find(([key]) => key === group)[2];
        const q = search.trim().toLowerCase();
        return requests.filter((r) => {
            if (statuses && !statuses.includes(r.status)) return false;
            if (purpose && r.visit_type !== purpose) return false;
            if (!q) return true;
            return `${r.student_first_name} ${r.student_last_name} ${r.student_id} ${r.reason}`.toLowerCase().includes(q);
        });
    }, [requests, group, search, purpose]);

    const session = schedules.find((s) => s.schedule_id === sessionId) || null;
    const sessionDates = useMemo(() => (session ? upcomingDates(session, 10).filter((d) => !sessionEnded(session, d)) : []), [session]);
    useEffect(() => {
        if (!session) { setSessionDate(''); return; }
        if (!sessionDates.includes(sessionDate)) setSessionDate(sessionDates[0] || '');
    }, [session, sessionDates, sessionDate]);

    // can this request be asked to reconfirm for (waiting list) or appointed into (reconfirmed) the picked session?
    const fitsSession = useCallback((r) => {
        if (!session) return false;
        if (!NOTIFIABLE.includes(r.status) && r.status !== 'Reconfirmed') return false;
        if (session.visit_type !== 'Any' && session.visit_type !== r.visit_type) return false;
        const doctor = doctors.find((d) => d.doctor_id === session.doctor_id);
        if (doctor && !doctorOffers(doctor, r.visit_type)) return false;
        return true;
    }, [session, doctors]);

    const toggle = (id) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const changed = () => { load(); setSelected(new Set()); if (onChanged) onChanged(); };

    const approve = async () => {
        const r = approveTarget;
        setApproveTarget(null);
        const data = await post(`/api/consultation-requests/${r.request_id}/approve`, 'PUT', { sender_id: userId, is_priority: priorityOnApprove });
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not approve.', 'error');
    };

    const deny = async (reason) => {
        const data = await post(`/api/consultation-requests/${denyTarget.request_id}/deny`, 'PUT', { sender_id: userId, reason });
        setDenyTarget(null);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not deny.', 'error');
    };

    const togglePriority = async (r) => {
        const data = await post(`/api/consultation-requests/${r.request_id}/priority`, 'PUT', { is_priority: !r.is_priority });
        if (data.success) load(); else showAlert(data.message || 'Could not change the priority.', 'error');
    };

    // asks the chosen students to reconfirm their appointment request for the picked session
    const reconfirm = async (ids) => {
        if (!session) { showAlert('Pick the session first.', 'warning'); return; }
        setBusy(true);
        try {
            const data = await post('/api/consultation-requests/notify', 'POST', {
                schedule_id: session.schedule_id, date: sessionDate || undefined, request_ids: ids, sender_id: userId
            });
            if (data.success) {
                showAlert(data.message, data.notified > 0 ? 'success' : 'warning');
                if (data.skipped && data.skipped.length > 0) setSkippedInfo(data.skipped);
                changed();
            } else showAlert(data.message || 'Could not send the reconfirmation.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    // appoints the chosen reconfirmed students into the picked session, each on the earliest free slot
    const autoAppoint = async (ids) => {
        if (!session || !sessionDate) { showAlert('Pick the session and its day first.', 'warning'); return; }
        setBusy(true);
        try {
            const data = await post(`/api/doctor-schedules/${session.schedule_id}/auto-appoint`, 'POST', { ...creatorBody(creator), sender_id: userId, date: sessionDate, request_ids: ids });
            if (data.success) {
                showAlert(data.message, data.appointed.length > 0 ? 'success' : 'warning');
                if (data.unassigned && data.unassigned.length > 0) setSkippedInfo(data.unassigned);
                changed();
            } else showAlert(data.message || 'Could not appoint the students.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const openHistory = async (r) => {
        setHistoryTarget(r);
        setHistory(null);
        try {
            const res = await fetch(`${API}/api/consultation-requests/${r.request_id}/logs`);
            const data = await res.json();
            setHistory(data.success ? data.logs : []);
        } catch (e) { setHistory([]); }
    };

    // sessions where this request could be appointed or moved to: any session with time slots whose purpose matches the student's purpose
    const appointableSessions = (r) => schedules.filter((s) => (s.visit_type === 'Any' || s.visit_type === r.visit_type)
        && (!fixedDoctorId || s.doctor_id === fixedDoctorId)
        && doctorOffers(doctors.find((d) => d.doctor_id === s.doctor_id) || { specialization: s.specialization, allowed_visit_types: s.covered_visit_types, covered_visit_types: s.covered_visit_types }, r.visit_type))
        .sort((a, b) => String(a.next_date || '').localeCompare(String(b.next_date || '')));

    const startAppoint = (r) => {
        const options = appointableSessions(r);
        if (options.length === 0) { showAlert(`There is no open session for ${visitLabel(r.visit_type, r.purpose_other)} consultations. Post one first.`, 'warning'); return; }
        const preferred = options.find((s) => s.schedule_id === r.notified_schedule_id) || options[0];
        if (options.length === 1 || (r.notified_schedule_id && preferred.schedule_id === r.notified_schedule_id)) setAppointTarget({ request: r, schedule: preferred });
        else { setPickSession({ request: r, options }); setPickedSessionId(preferred.schedule_id); }
    };

    const nameOf = (id) => { const r = requests.find((x) => x.request_id === id); return r ? fullName(r.student_first_name, r.student_last_name) : id; };
    const selectedFit = [...selected].filter((id) => { const r = requests.find((x) => x.request_id === id); return r && fitsSession(r); });

    const compatibleSessions = schedules.filter((s) => !fixedDoctorId || s.doctor_id === fixedDoctorId);
    // waiting list / awaiting reconfirmation: pick students to ask to reconfirm; reconfirmed: pick students to appoint
    const appointMode = group === 'ready';
    const showNotifyBar = group === 'waiting' || group === 'reconfirm' || appointMode;
    const pickable = rows.filter((r) => fitsSession(r));
    const allPicked = pickable.length > 0 && pickable.every((r) => selected.has(r.request_id));
    const toggleAll = () => setSelected(allPicked ? new Set() : new Set(pickable.map((r) => r.request_id)));

    return (
        <>
            <div className="toolbar-sc">
                <div className="search-box-dv" style={{ width: 260 }}>
                    <Search size={16} />
                    <input type="text" placeholder="Search student, ID or reason..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="Purpose">
                    <option value="">All purposes</option>
                    {visitTypes.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button type="button" className="icon-btn-ds" title="Refresh" onClick={load}><RefreshCw size={15} /></button>
            </div>

            <div className="status-chips-sc" style={{ marginBottom: 14 }}>
                {GROUPS.map(([key, label]) => (
                    <button key={key} type="button" className={`status-chip-sc ${group === key ? 'active-sc' : ''}`} onClick={() => { setGroup(key); setSelected(new Set()); }}>
                        {label} <em>{counts[key]}</em>
                    </button>
                ))}
            </div>

            {showNotifyBar && (
                <div className="notify-bar-sc">
                    <strong style={{ fontSize: '0.88rem' }}>Session</strong>
                    <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setSelected(new Set()); }} aria-label={appointMode ? 'Session to appoint into' : 'Session to reconfirm for'}>
                        <option value="">-- Pick a posted session --</option>
                        {compatibleSessions.map((s) => (
                            <option key={s.schedule_id} value={s.schedule_id}>
                                Dr. {s.doc_last_name} - {s.visit_type === 'Any' ? 'Any visit' : s.visit_type} - {s.next_date ? dayLabel(s.next_date) : ''} {timeRange(s.start_time, s.end_time)}
                            </option>
                        ))}
                    </select>
                    {session && sessionDates.length > 1 && (
                        <select value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} aria-label="Day of the session">
                            {sessionDates.map((d) => <option key={d} value={d}>{dayLabel(d, { weekday: 'long', month: 'short', day: 'numeric' })}</option>)}
                        </select>
                    )}
                    {session && !appointMode && (
                        <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" disabled={busy || selectedFit.length === 0} onClick={() => reconfirm(selectedFit)}>
                            <Bell size={14} /> Reconfirm selected ({selectedFit.length})
                        </button>
                    )}
                    {session && appointMode && (
                        <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" disabled={busy || selectedFit.length === 0} onClick={() => autoAppoint(selectedFit)} title="Gives each selected student the earliest free slot of the session, priority students first">
                            <Wand2 size={14} /> Appoint selected ({selectedFit.length})
                        </button>
                    )}
                    {!session && (
                        <span className="muted-ds">
                            {appointMode
                                ? 'Pick a posted session, then select the reconfirmed students to appoint to it.'
                                : 'Pick a posted session, then select the students to ask to reconfirm their appointment request for it.'}
                        </span>
                    )}
                </div>
            )}

            {loading ? <div className="loading-dv">Loading consultation requests...</div> : rows.length === 0 ? (
                <div className="group-empty-ds">Nothing in this list.</div>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead>
                            <tr>
                                {showNotifyBar && (
                                    <th style={{ width: 34 }}>
                                        <input type="checkbox" aria-label="Select every student that fits the session" disabled={pickable.length === 0} checked={allPicked} onChange={toggleAll} />
                                    </th>
                                )}
                                <th>Student</th><th>Purpose and reason</th><th>Requested</th><th>Status</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.request_id}>
                                    {showNotifyBar && (
                                        <td>
                                            <input
                                                type="checkbox" aria-label={`Select ${fullName(r.student_first_name, r.student_last_name)}`}
                                                disabled={!fitsSession(r)} checked={selected.has(r.request_id)} onChange={() => toggle(r.request_id)}
                                                title={session ? (fitsSession(r) ? '' : 'This request does not fit the picked session') : 'Pick a session first'}
                                            />
                                        </td>
                                    )}
                                    <td>
                                        {r.is_priority ? <Star size={13} className="priority-star-sc" fill="currentColor" /> : null} {fullName(r.student_first_name, r.student_last_name)}
                                        <div className="muted-ds">{r.student_id}{r.program_name ? ` - ${r.program_name} ${r.year_level || ''}${r.section || ''}` : ''}</div>
                                    </td>
                                    <td className="reason-cell-sc">
                                        <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                        <div>{r.reason}</div>
                                        {r.preferred_doctor_id && <div className="muted-ds">Asked for Dr. {r.pref_first_name} {r.pref_last_name}</div>}
                                        {r.preferred_note && <div className="muted-ds">Preferred: {r.preferred_note}</div>}
                                    </td>
                                    <td>
                                        {formatDate(r.created_at)}
                                        {r.reviewed_at && <div className="muted-ds">Approved {formatDate(r.reviewed_at)}</div>}
                                    </td>
                                    <td>
                                        <span className={`badge-ds ${REQUEST_STATUS_CLASS[r.status] || 'badge-expired-ds'}`}>{r.status}</span>
                                        {r.status === 'Denied' && r.review_reason && <div className="muted-ds">{r.review_reason}</div>}
                                        {r.status === 'Waiting List' && r.review_reason && <div className="muted-ds">Note: {r.review_reason}</div>}
                                        {r.last_notified_at && NOTIFIABLE.includes(r.status) && (
                                            <div className="muted-ds">Asked to reconfirm {formatDateTime(r.last_notified_at)}{r.notify_count > 1 ? ` (x${r.notify_count})` : ''}</div>
                                        )}
                                        {r.status === 'Reconfirmed' && <div className="muted-ds">Still interested{r.reconfirm_note ? `: ${r.reconfirm_note}` : ''}</div>}
                                        {r.appointment_start && ['Appointed', 'Booked', 'Fulfilled'].includes(r.status) && (
                                            <div className="muted-ds">{formatDateTime(r.appointment_start)} with Dr. {r.appt_doc_first_name} {r.appt_doc_last_name}</div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="row-actions-sc">
                                            {r.status === 'Waiting for Approval' && (
                                                <>
                                                    <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => { setApproveTarget(r); setPriorityOnApprove(false); }}><Check size={13} /> Approve</button>
                                                    <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => setDenyTarget(r)}><XCircle size={13} /> Deny</button>
                                                </>
                                            )}
                                            {NOTIFIABLE.includes(r.status) && (
                                                <>
                                                    <button
                                                        type="button" className="sti-btn-dv sti-btn-secondary-dv btn-sm-sc" disabled={busy || !fitsSession(r)}
                                                        title={session ? '' : 'Pick a session above first'} onClick={() => reconfirm([r.request_id])}
                                                    >
                                                        <Bell size={13} /> {r.status === 'Awaiting Reconfirmation' ? 'Reconfirm again' : 'Reconfirm'}
                                                    </button>
                                                    <button type="button" className="icon-btn-ds" title={r.is_priority ? 'Remove priority' : 'Make priority'} onClick={() => togglePriority(r)}>
                                                        <Star size={14} className={r.is_priority ? 'priority-star-sc' : ''} fill={r.is_priority ? 'currentColor' : 'none'} />
                                                    </button>
                                                </>
                                            )}
                                            {(NOTIFIABLE.includes(r.status) || r.status === 'Reconfirmed') && (
                                                <button
                                                    type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => startAppoint(r)}
                                                    title={`Give this student a time in a session for ${visitLabel(r.visit_type, r.purpose_other)}: an appointment session, an open booking time block or a hybrid session`}
                                                >
                                                    <UserPlus size={13} /> Appoint / move
                                                </button>
                                            )}
                                            <button type="button" className="icon-btn-ds" title="History" onClick={() => openHistory(r)}><History size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* approve */}
            <Modal isOpen={!!approveTarget} onClose={() => setApproveTarget(null)} title="Approve the request" size="sm">
                {approveTarget && (
                    <div className="dp-form">
                        <div className="dp-notice">
                            {fullName(approveTarget.student_first_name, approveTarget.student_last_name)} - {visitLabel(approveTarget.visit_type, approveTarget.purpose_other)}<br />
                            Reason: {approveTarget.reason}<br />
                            The student goes on the waiting list and is told to stay active: you ask them to reconfirm when a session is posted.
                        </div>
                        <label className="check-ds">
                            <input type="checkbox" checked={priorityOnApprove} onChange={(e) => setPriorityOnApprove(e.target.checked)} />
                            Priority (scheduled before the rest of the waiting list)
                        </label>
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setApproveTarget(null)}>Back</button>
                            <button type="button" className="dp-btn dp-btn-primary" onClick={approve}>Approve</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* deny */}
            <ReasonModal
                isOpen={!!denyTarget} title="Deny the request" confirmLabel="Deny request" danger label="Reason (shown to the student)"
                message={denyTarget ? `${fullName(denyTarget.student_first_name, denyTarget.student_last_name)} - ${visitLabel(denyTarget.visit_type, denyTarget.purpose_other)}: ${denyTarget.reason}` : ''}
                placeholder="e.g. Please see the nurse first for a basic check-up" onSubmit={deny} onClose={() => setDenyTarget(null)}
            />

            {/* pick which session to appoint into */}
            <Modal isOpen={!!pickSession} onClose={() => setPickSession(null)} title="Appoint or move to which session?" size="md">
                {pickSession && (
                    <div className="dp-form">
                        <div className="dp-notice">
                            {fullName(pickSession.request.student_first_name, pickSession.request.student_last_name)} - {visitLabel(pickSession.request.visit_type, pickSession.request.purpose_other)}.
                            Only sessions whose purpose matches this consultation are listed.
                        </div>
                        <div className="dp-field">
                            <label>Session</label>
                            <select className="dp-select" value={pickedSessionId} onChange={(e) => setPickedSessionId(e.target.value)}>
                                {pickSession.options.map((s) => (
                                    <option key={s.schedule_id} value={s.schedule_id}>
                                        Dr. {s.doc_first_name} {s.doc_last_name} - {s.next_date ? dayLabel(s.next_date) : ''} {timeRange(s.start_time, s.end_time)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="dp-modal-foot">
                            <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setPickSession(null)}>Back</button>
                            <button type="button" className="dp-btn dp-btn-primary" onClick={() => {
                                setAppointTarget({ request: pickSession.request, schedule: pickSession.options.find((s) => s.schedule_id === pickedSessionId) });
                                setPickSession(null);
                            }}>Continue</button>
                        </div>
                    </div>
                )}
            </Modal>

            <AppointModal
                isOpen={!!appointTarget} schedule={appointTarget ? appointTarget.schedule : null} request={appointTarget ? appointTarget.request : null}
                creator={creator} userId={userId} onClose={() => setAppointTarget(null)} onDone={changed}
            />

            {/* skipped / unplaced */}
            <Modal isOpen={!!skippedInfo} onClose={() => setSkippedInfo(null)} title="Not everyone could be included" size="md">
                {skippedInfo && (
                    <ul className="timeline-sc">
                        {skippedInfo.map((s) => <li key={s.request_id}><strong>{s.student_name || nameOf(s.request_id)}</strong><small>{s.reason}</small></li>)}
                    </ul>
                )}
            </Modal>

            {/* history */}
            <Modal isOpen={!!historyTarget} onClose={() => setHistoryTarget(null)} title="Request history" icon={<History size={20} />} size="md">
                {historyTarget && (
                    <>
                        <div className="dp-notice" style={{ marginBottom: 12 }}>
                            {fullName(historyTarget.student_first_name, historyTarget.student_last_name)} - {visitLabel(historyTarget.visit_type, historyTarget.purpose_other)}
                        </div>
                        {history === null ? <p className="dp-hint">Loading...</p> : history.length === 0 ? <p className="dp-hint">Nothing was logged yet.</p> : (
                            <ul className="dp-timeline">
                                {history.map((l) => (
                                    <li key={l.log_id}>
                                        <div className="act">{l.action}{l.from_status && l.to_status && l.from_status !== l.to_status ? ` (${l.from_status} → ${l.to_status})` : ''}</div>
                                        <div className="meta">{formatDateTime(l.created_at)} - {l.actor_name ? `${l.actor_name} (${l.actor_role})` : l.actor_role || 'System'}</div>
                                        {l.reason && <div className="why">{l.reason}</div>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </Modal>
        </>
    );
};

export default WaitingList;
