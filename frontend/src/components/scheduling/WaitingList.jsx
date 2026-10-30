// WaitingList.jsx (the "Listings" tab of the scheduling hub; the file keeps its old name)
// One listing per posted schedule. The doctor set the schedule with a listing limit, the nurse opens its listing, students ask for a place and the
// nurse accepts (the student gets the next queue number of that session, in the order of acceptance) or declines with a reason.
// The nurse and the doctor use this same screen; only the nurse opens / closes a listing and accepts. The doctor has no "To accept" list:
// the doctor only views the accepted students (and the ones already seen / closed).
// Session cards / schedule rows land here with `focusSchedule`: the session is already picked.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { XCircle, History, Search, RefreshCw, Check, DoorOpen, DoorClosed } from 'lucide-react';
import Modal from '../common/Modal';
import { ReasonModal } from '../doctor/AppointmentModals';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { visitLabel, fullName } from '../../utils/visitPurpose';
import { API, REQUEST_STATUS_CLASS, dayLabel, timeRange } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const NURSE_GROUPS = [
    ['pending', 'To accept', ['Waiting for Approval']],
    ['accepted', 'Accepted', ['Appointed']],
    ['closed', 'Seen / closed', ['Fulfilled', 'Missed', 'Denied', 'Withdrawn']],
    ['all', 'All', null]
];
const DOCTOR_GROUPS = NURSE_GROUPS.filter(([key]) => key === 'accepted' || key === 'closed');

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

const sessionName = (s) => `Dr. ${s.doc_last_name} - ${s.visit_type === 'Any' ? 'Any check-up' : s.visit_type} - ${s.listing_date ? dayLabel(s.listing_date) : ''} ${timeRange(s.start_time, s.end_time)}`;

const WaitingList = ({ fixedDoctorId, creator, userId, refreshKey, focusSchedule, onFocusConsumed, onChanged }) => {
    const { showAlert } = useAlert();
    const [requests, setRequests] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState('');
    const isNurse = !!(creator && creator.nurseId);
    const GROUPS = isNurse ? NURSE_GROUPS : DOCTOR_GROUPS;
    const firstGroup = GROUPS[0][0];
    const [group, setGroup] = useState(firstGroup);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [denyTarget, setDenyTarget] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [history, setHistory] = useState(null);

    const load = useCallback(async () => {
        try {
            const doctorQs = fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : '';
            const [reqRes, schedRes] = await Promise.all([
                fetch(`${API}/api/consultation-requests?status=all${doctorQs}`),
                fetch(`${API}/api/doctor-schedules?status=Open${doctorQs}`)
            ]);
            const reqData = await reqRes.json();
            const schedData = await schedRes.json();
            if (reqData.success) setRequests(reqData.requests);
            if (schedData.success) setSchedules(schedData.schedules.filter((s) => !s.is_expired && s.listing_date));
        } catch (e) {
            showAlert('Could not load the listings.', 'error');
        } finally {
            setLoading(false);
        }
    }, [fixedDoctorId, showAlert]);

    useEffect(() => { load(); }, [load, refreshKey]);

    // Sent here from a session card / schedule row: that session is picked
    useEffect(() => {
        if (!focusSchedule || schedules.length === 0) return;
        if (schedules.some((s) => s.schedule_id === focusSchedule.schedule_id)) {
            setSessionId(focusSchedule.schedule_id);
            setGroup(firstGroup);
        }
        if (onFocusConsumed) onFocusConsumed();
    }, [focusSchedule, schedules, onFocusConsumed, firstGroup]);

    // The first time the sessions load: the session with the most asks waiting for the nurse, else the first open listing
    useEffect(() => {
        if (sessionId || schedules.length === 0) return;
        const best = [...schedules].sort((a, b) => (isNurse ? b.pending - a.pending : b.accepted - a.accepted) || (Number(b.listing_open) - Number(a.listing_open)))[0];
        setSessionId(best.schedule_id);
    }, [schedules, sessionId, isNurse]);

    const session = schedules.find((s) => s.schedule_id === sessionId) || null;
    const inSession = useMemo(
        () => requests.filter((r) => session && r.listing_schedule_id === session.schedule_id && String(r.listing_date || '').slice(0, 10) === session.listing_date),
        [requests, session]
    );
    const counts = useMemo(() => {
        const map = {};
        GROUPS.forEach(([key, , statuses]) => { map[key] = statuses ? inSession.filter((r) => statuses.includes(r.status)).length : inSession.length; });
        return map;
    }, [inSession, GROUPS]);

    const rows = useMemo(() => {
        const statuses = GROUPS.find(([key]) => key === group)[2];
        const q = search.trim().toLowerCase();
        return inSession
            .filter((r) => (!statuses || statuses.includes(r.status))
                && (!q || `${r.student_first_name} ${r.student_last_name} ${r.student_id} ${r.reason}`.toLowerCase().includes(q)))
            // asks wait in the order they were sent, accepted students in the order of their queue number
            .sort((a, b) => (group === 'accepted' ? (a.queue_no || 0) - (b.queue_no || 0) : String(a.created_at).localeCompare(String(b.created_at))));
    }, [inSession, group, search, GROUPS]);

    const changed = () => { load(); if (onChanged) onChanged(); };

    const accept = async (r) => {
        setBusy(true);
        try {
            const data = await send(`/api/consultation-requests/${r.request_id}/accept`, 'PUT', { sender_id: userId });
            if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not accept the request.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const deny = async (reason) => {
        const data = await send(`/api/consultation-requests/${denyTarget.request_id}/deny`, 'PUT', { sender_id: userId, reason });
        setDenyTarget(null);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not decline the request.', 'error');
    };

    const toggleListing = async () => {
        if (!session) return;
        setBusy(true);
        try {
            const data = await send(`/api/doctor-schedules/${session.schedule_id}/listing`, 'PUT', { listing_open: !session.listing_open, sender_id: userId });
            if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not change the listing.', 'error');
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

    const listingChip = session && (session.listing_open ? (session.listing_full ? 'Open - full' : 'Open') : 'Closed');

    return (
        <>
            {loading ? <div className="loading-dv">Loading the listings...</div> : schedules.length === 0 ? (
                <div className="group-empty-ds">No upcoming schedule yet. The nurse asks a doctor for a schedule (Schedules tab); the doctor sets it with a listing limit; then the nurse opens its listing here.</div>
            ) : (
                <>
                    <div className="notify-bar-sc">
                        <strong style={{ fontSize: '0.88rem' }}>Session</strong>
                        <select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setGroup(firstGroup); }} aria-label="Session">
                            {schedules.map((s) => <option key={s.schedule_id} value={s.schedule_id}>{sessionName(s)}{isNurse && s.pending > 0 ? ` (${s.pending} to accept)` : ''}</option>)}
                        </select>
                        <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh" onClick={load}><RefreshCw size={15} /></button>
                    </div>

                    {session && (
                        <div className="notify-bar-sc" role="status">
                            <span className={`badge-ds ${session.listing_open ? 'badge-open-ds' : 'badge-expired-ds'}`}>Listing {listingChip.toLowerCase()}</span>
                            <strong>{session.accepted} of {session.listing_limit} accepted</strong>
                            <span className="muted-ds">
                                {session.location ? `${session.location}. ` : ''}Each accepted student gets the next queue number of this session, in the order of acceptance.
                            </span>
                            {isNurse && (
                                <button
                                    type="button" className="sti-btn-dv sti-btn-secondary-dv btn-sm-sc" disabled={busy} onClick={toggleListing}
                                    title={session.listing_open ? 'Students can no longer ask for a place. Accepted students keep theirs.' : 'Students can ask for a place in this session'}
                                >
                                    {session.listing_open ? <><DoorClosed size={14} /> Close listing</> : <><DoorOpen size={14} /> Open listing</>}
                                </button>
                            )}
                            {!isNurse && !session.listing_open && <span className="muted-ds">The nurse has not opened this listing yet.</span>}
                        </div>
                    )}

                    <div className="toolbar-sc">
                        <div className="search-box-dv" style={{ width: 260 }}>
                            <Search size={16} />
                            <input type="text" placeholder="Search student, ID or reason..." aria-label="Search the requests" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="status-chips-sc">
                            {GROUPS.map(([key, label]) => (
                                <button key={key} type="button" className={`status-chip-sc ${group === key ? 'active-sc' : ''}`} onClick={() => setGroup(key)}>
                                    {label} <em>{counts[key]}</em>
                                </button>
                            ))}
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <div className="group-empty-ds">{group === 'pending' ? 'No request is waiting for you in this listing.' : group === 'accepted' ? 'Nobody is accepted in this listing yet. The nurse accepts the students.' : 'Nobody in this list.'}</div>
                    ) : (
                        <div className="table-card-dv">
                            <table className="sti-table-dv">
                                <thead>
                                    <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up and reason</th><th>Requested</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.request_id}>
                                            <td>
                                                <strong className="queue-no-sc">{r.appointment_queue_no ? `${r.appointment_queue_lane === 'Walk-in' ? 'W' : '#'}${r.appointment_queue_no}` : '-'}</strong>
                                                {r.status === 'Waiting for Approval' && <div className="muted-ds">No number yet</div>}
                                            </td>
                                            <td>
                                                {fullName(r.student_first_name, r.student_last_name)}
                                                <div className="muted-ds">{r.student_id}{r.program_name ? ` - ${r.program_name} ${r.year_level || ''}${r.section || ''}` : ''}</div>
                                            </td>
                                            <td className="reason-cell-sc">
                                                <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                                <div>{r.reason}</div>
                                                {r.preferred_note && <div className="muted-ds">Note: {r.preferred_note}</div>}
                                            </td>
                                            <td>{formatDate(r.created_at)}</td>
                                            <td>
                                                <span className={`badge-ds ${REQUEST_STATUS_CLASS[r.status] || 'badge-expired-ds'}`}>{r.status}</span>
                                                {['Denied', 'Missed'].includes(r.status) && r.review_reason && <div className="muted-ds">{r.review_reason}</div>}
                                            </td>
                                            <td>
                                                <div className="row-actions-sc">
                                                    {r.status === 'Waiting for Approval' && (
                                                        <>
                                                            {isNurse && (
                                                                <button
                                                                    type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" disabled={busy || session.listing_full} onClick={() => accept(r)}
                                                                    title={session.listing_full ? 'The listing is full' : 'Accept: the student gets the next queue number of this session'}
                                                                >
                                                                    <Check size={13} /> Accept
                                                                </button>
                                                            )}
                                                            <button type="button" className="icon-btn-ds" title="Decline this request" aria-label="Decline this request" onClick={() => setDenyTarget(r)}><XCircle size={14} /></button>
                                                        </>
                                                    )}
                                                    <button type="button" className="icon-btn-ds" title="History" aria-label="History" onClick={() => openHistory(r)}><History size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            <ReasonModal
                isOpen={!!denyTarget} title="Decline the request" confirmLabel="Decline" danger label="Reason (shown to the student)"
                message={denyTarget ? `${fullName(denyTarget.student_first_name, denyTarget.student_last_name)} - ${visitLabel(denyTarget.visit_type, denyTarget.purpose_other)}: ${denyTarget.reason}` : ''}
                placeholder="e.g. Please see the nurse first for a basic check-up" onSubmit={deny} onClose={() => setDenyTarget(null)}
            />

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
