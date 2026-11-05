// WaitingList.jsx (the "Listings" tab of the scheduling hub; the file keeps its old name)
// One listing per posted schedule. The doctor set the schedule with a listing limit, the nurse opens its listing, students ask for a place and the
// nurse accepts (the student gets the next queue number of that session, in the order of acceptance) or declines with a reason.
// The nurse and the doctor use this same screen; only the nurse opens / closes a listing and accepts. Two tabs: To review (the nurse's asks) and
// Queue (every student holding a number). The doctor has no "To review" tab: the doctor only views the queue.
// The screen opens on a table of the sessions that have a listing (check-up service, listed x/limit, to review, places left, status, icon actions), with the
// past sessions in a second panel. View list opens the list of one session (To review / Queue). Session cards / schedule rows land here with
// `focusSchedule`: that session's list is already open.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { XCircle, History, Search, RefreshCw, Check, UserPlus, Eye, ClipboardCheck, ArrowLeft } from 'lucide-react';
import Modal from '../common/Modal';
import { Pager } from '../common/RecordFolders';
import { ReasonModal } from '../doctor/AppointmentModals';
import { AppointModal } from './SessionModals';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { visitLabel, fullName } from '../../utils/visitPurpose';
import { API, REQUEST_STATUS_CLASS, SCHEDULING_WAYS, wayOf, dayLabel, timeRange, classLabel } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

// `queue` is the whole queue of the session (advance listing students, accepted students, walk-ins); it is read from the session, not from the requests
const NURSE_GROUPS = [
    ['pending', 'To review', ['Waiting for Approval']],
    ['queue', 'Queue', null]
];
const DOCTOR_GROUPS = NURSE_GROUPS.filter(([key]) => key === 'queue');
const PAGE_SIZE = 8;
const pageCountOf = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));

const QUEUE_STATE_TEXT = { Waiting: 'Waiting', Serving: 'In session', Done: 'Done', Void: 'Void' };
const QUEUE_STATE_CLASS = { Waiting: 'badge-pending-ds', Serving: 'badge-open-ds', Done: 'badge-open-ds', Void: 'badge-closed-ds' };
const queueWayText = (p) => (p.how === 'repeat' ? 'Repeat' : p.how === 'advance' && p.advance_label ? `Advance listing ${p.advance_label}` : SCHEDULING_WAYS[wayOf(p.booking_source, p.how)].label);

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

const serviceName = (s) => (s.visit_type === 'Any' ? 'Any check-up' : s.visit_type);
const whenText = (date, s) => `${date ? dayLabel(date) : ''} ${timeRange(s.start_time, s.end_time)}`.trim();
const pageOf = (items, page) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
const todayManila = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
const queuedOf = (s) => (s.queue_done || 0) + (s.queue_waiting || 0) + (s.queue_void || 0) + (s.queue_serving ? 1 : 0);

const WaitingList = ({ fixedDoctorId, creator, userId, refreshKey, focusSchedule, onFocusConsumed, onChanged }) => {
    const { showAlert } = useAlert();
    const [requests, setRequests] = useState([]);
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState('');
    const [pastSessions, setPastSessions] = useState([]);
    const [pastSession, setPastSession] = useState(null); // a past session whose list is open
    const [viewing, setViewing] = useState(false); // false = the table of sessions, true = the list of one session
    const [panel, setPanel] = useState('current'); // current | past
    const [tablePage, setTablePage] = useState(1);
    const isNurse = !!(creator && creator.nurseId);
    const GROUPS = isNurse ? NURSE_GROUPS : DOCTOR_GROUPS;
    const firstGroup = GROUPS[0][0];
    const [group, setGroup] = useState(firstGroup);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    const [addFor, setAddFor] = useState(null);
    const [denyTarget, setDenyTarget] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [history, setHistory] = useState(null);

    const load = useCallback(async () => {
        try {
            const doctorQs = fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : '';
            const [reqRes, schedRes, pastRes] = await Promise.all([
                fetch(`${API}/api/consultation-requests?status=all${doctorQs}`),
                fetch(`${API}/api/doctor-schedules?status=Open${doctorQs}`),
                fetch(`${API}/api/schedule-calendar?from=${daysAgo(60)}&to=${todayManila()}${doctorQs}`)
            ]);
            const reqData = await reqRes.json();
            const schedData = await schedRes.json();
            const pastData = await pastRes.json();
            if (reqData.success) setRequests(reqData.requests);
            if (schedData.success) setSchedules(schedData.schedules.filter((s) => !s.is_expired && s.listing_date));
            // the sessions of the last two months that are over and had students in the queue, newest first
            if (pastData.success) setPastSessions(pastData.sessions.filter((x) => x.state === 'past' && queuedOf(x) > 0).sort((a, b) => String(b.date).localeCompare(String(a.date))));
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
            setPastSession(null);
            setPanel('current');
            setViewing(true);
            setGroup(firstGroup);
        }
        if (onFocusConsumed) onFocusConsumed();
    }, [focusSchedule, schedules, onFocusConsumed, firstGroup]);

    const session = useMemo(() => (pastSession
        ? { ...pastSession, listing_date: pastSession.date, listing_open: false, listing_full: true, pending: 0, accepted: queuedOf(pastSession) }
        : schedules.find((s) => s.schedule_id === sessionId) || null), [pastSession, schedules, sessionId]);
    const inList = viewing && !!session;
    const inSession = useMemo(
        () => requests.filter((r) => session && r.listing_schedule_id === session.schedule_id && String(r.listing_date || '').slice(0, 10) === session.listing_date),
        [requests, session]
    );

    // The whole queue of the picked session: every student holding a number, however the place was got (advance listing, accepted ask, added by hand, walk-in)
    const [queue, setQueue] = useState([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const sessionKey = session ? `${session.schedule_id}|${session.listing_date}` : '';
    const loadQueue = useCallback(async () => {
        if (!sessionKey) { setQueue([]); return; }
        const [scheduleId, date] = sessionKey.split('|');
        setQueueLoading(true);
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${encodeURIComponent(scheduleId)}/participants?date=${encodeURIComponent(date)}`);
            const data = await res.json();
            setQueue(data.success ? data.participants.filter((p) => p.queue_label) : []);
        } catch (e) {
            setQueue([]);
        } finally {
            setQueueLoading(false);
        }
    }, [sessionKey]);

    useEffect(() => { loadQueue(); }, [loadQueue, refreshKey]);

    const queueRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return queue.filter((p) => !q || `${p.student_name} ${p.student_id} ${p.queue_label} ${p.advance_label || ''} ${p.booking_reason || ''}`.toLowerCase().includes(q));
    }, [queue, search]);

    const counts = useMemo(() => {
        const map = {};
        GROUPS.forEach(([key, , statuses]) => {
            map[key] = key === 'queue' ? queue.length : statuses ? inSession.filter((r) => statuses.includes(r.status)).length : inSession.length;
        });
        return map;
    }, [inSession, GROUPS, queue]);

    const rows = useMemo(() => {
        const statuses = GROUPS.find(([key]) => key === group)[2];
        const q = search.trim().toLowerCase();
        return inSession
            .filter((r) => (!statuses || statuses.includes(r.status))
                && (!q || `${r.student_first_name} ${r.student_last_name} ${r.student_id} ${r.reason}`.toLowerCase().includes(q)))
            // asks wait in the order they were sent
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    }, [inSession, group, search, GROUPS]);

    // back to the first page when the list in view changes
    useEffect(() => { setPage(1); }, [group, search, sessionId, pastSession]);
    useEffect(() => { setTablePage(1); }, [panel]);
    const curPage = Math.min(page, pageCountOf(group === 'queue' ? queueRows.length : rows.length));
    const slice = (list) => list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

    const changed = () => { load(); loadQueue(); if (onChanged) onChanged(); };

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

    const toggleListing = async (target) => {
        setBusy(true);
        try {
            const data = await send(`/api/doctor-schedules/${target.schedule_id}/listing`, 'PUT', { listing_open: !target.listing_open, sender_id: userId });
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

    const statusOf = (x) => (x.listing_open ? (x.listing_full ? 'Full' : 'Open') : 'Closed');
    const STATUS_CLASS = { Open: 'badge-open-ds', Full: 'badge-pending-ds', Closed: 'badge-closed-ds' };

    const openSession = (x, onGroup) => { setPastSession(null); setSessionId(x.schedule_id); setGroup(onGroup || firstGroup); setSearch(''); setViewing(true); };
    const openPast = (x) => { setPastSession(x); setSessionId(x.schedule_id); setGroup('queue'); setSearch(''); setViewing(true); };
    const backToTable = () => { setViewing(false); setPastSession(null); };

    const currentRows = [...schedules].sort((a, b) => serviceName(a).localeCompare(serviceName(b)) || String(a.listing_date).localeCompare(String(b.listing_date)));
    const tableList = panel === 'current' ? currentRows : pastSessions;
    const tablePageCur = Math.min(tablePage, pageCountOf(tableList.length));

    return (
        <>
            {loading ? <div className="loading-dv">Loading the listings...</div> : !inList ? (
                <>
                    <div className="toolbar-sc">
                        <div className="status-chips-sc" role="group" aria-label="Session listings">
                            <button type="button" className={`status-chip-sc ${panel === 'current' ? 'active-sc' : ''}`} aria-pressed={panel === 'current'} onClick={() => setPanel('current')}>Current sessions <em>{schedules.length}</em></button>
                            <button type="button" className={`status-chip-sc ${panel === 'past' ? 'active-sc' : ''}`} aria-pressed={panel === 'past'} onClick={() => setPanel('past')}>Past session listings <em>{pastSessions.length}</em></button>
                        </div>
                        <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh" onClick={load}><RefreshCw size={15} /></button>
                    </div>

                    {tableList.length === 0 ? (
                        <div className="group-empty-ds">{panel === 'current' ? 'No upcoming schedule yet.' : 'No past session listing yet.'}</div>
                    ) : panel === 'current' ? (
                        <div className="table-card-dv">
                            <table className="sti-table-dv">
                                <caption className="sr-only">Check-up services with a session listing</caption>
                                <thead>
                                    <tr><th>Check-up service</th><th>Listed</th>{isNurse && <th>To review</th>}<th>Places left</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {pageOf(currentRows, tablePageCur).map((x) => {
                                        const status = statusOf(x);
                                        return (
                                            <tr key={x.schedule_id}>
                                                <td><strong>{serviceName(x)}</strong><div className="muted-ds">Dr. {x.doc_last_name}, {whenText(x.listing_date, x)}</div></td>
                                                <td><span className="advance-count-sc">{x.accepted}/{x.listing_limit}</span></td>
                                                {isNurse && <td>{x.pending}</td>}
                                                <td>{x.places_left}</td>
                                                <td><span className={`badge-ds ${STATUS_CLASS[status]}`}>{status}</span></td>
                                                <td>
                                                    <div className="advance-actions-sc">
                                                        {isNurse && (
                                                            <button
                                                                type="button" role="switch" aria-checked={!!x.listing_open} className="switch-sc" disabled={busy} onClick={() => toggleListing(x)}
                                                                aria-label={`${serviceName(x)} listing of ${whenText(x.listing_date, x)}: ${x.listing_open ? 'open' : 'closed'}`}
                                                                title={x.listing_open ? 'Close this listing' : 'Open this listing'}
                                                            >
                                                                <span className="switch-track-sc" aria-hidden="true" />
                                                            </button>
                                                        )}
                                                        <button type="button" className="icon-btn-ds" title="View list" aria-label={`View the list of ${serviceName(x)}, ${whenText(x.listing_date, x)}`} onClick={() => openSession(x)}><Eye size={15} /></button>
                                                        {isNurse && (
                                                            <>
                                                                <button type="button" className="icon-btn-ds" disabled={x.pending === 0} title={x.pending === 0 ? 'No request to review' : 'Review requests'}
                                                                    aria-label={`Review the ${x.pending} request(s) of ${serviceName(x)}`} onClick={() => openSession(x, 'pending')}><ClipboardCheck size={15} /></button>
                                                                <button type="button" className="icon-btn-ds" disabled={x.listing_full} title={x.listing_full ? 'The listing is full' : 'Add a student'}
                                                                    aria-label={`Add a student to ${serviceName(x)}`} onClick={() => setAddFor(x)}><UserPlus size={15} /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <Pager page={tablePageCur} pageCount={pageCountOf(currentRows.length)} total={currentRows.length} pageSize={PAGE_SIZE} onPage={setTablePage} noun="sessions" />
                        </div>
                    ) : (
                        <div className="table-card-dv">
                            <table className="sti-table-dv">
                                <caption className="sr-only">Past session listings</caption>
                                <thead>
                                    <tr><th>Check-up service</th><th>Date and time</th><th>Listed</th><th>Seen</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {pageOf(pastSessions, tablePageCur).map((x) => (
                                        <tr key={`${x.schedule_id}|${x.date}`}>
                                            <td><strong>{serviceName(x)}</strong><div className="muted-ds">{x.doctor_name}</div></td>
                                            <td>{whenText(x.date, x)}</td>
                                            <td><span className="advance-count-sc">{queuedOf(x)}/{x.listing_limit}</span></td>
                                            <td>{x.queue_done}</td>
                                            <td>
                                                <div className="advance-actions-sc">
                                                    <button type="button" className="icon-btn-ds" title="View list" aria-label={`View the list of ${serviceName(x)}, ${whenText(x.date, x)}`} onClick={() => openPast(x)}><Eye size={15} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pager page={tablePageCur} pageCount={pageCountOf(pastSessions.length)} total={pastSessions.length} pageSize={PAGE_SIZE} onPage={setTablePage} noun="sessions" />
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="list-head-sc">
                        <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={backToTable}><ArrowLeft size={14} /> Back to the session listing</button>
                        <h3>{serviceName(session)}: {pastSession ? `${session.doctor_name}, ` : `Dr. ${session.doc_last_name}, `}{whenText(session.listing_date, session)}</h3>
                    </div>

                    <div className="toolbar-sc">
                        <div className="search-box-dv" style={{ width: 260 }}>
                            <Search size={16} />
                            <input type="text" placeholder="Search student, ID or reason..." aria-label="Search the requests" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="status-chips-sc">
                            {GROUPS.filter(([key]) => !pastSession || key === 'queue').map(([key, label]) => (
                                <button key={key} type="button" className={`status-chip-sc ${group === key ? 'active-sc' : ''}`} onClick={() => setGroup(key)}>
                                    {label} <em>{counts[key]}</em>
                                </button>
                            ))}
                        </div>
                    </div>

                    {group === 'queue' ? (
                        queueRows.length === 0 ? (
                            <div className="group-empty-ds">{queueLoading ? 'Loading the queue...' : queue.length === 0 ? 'Nobody holds a queue number yet.' : 'Nobody matches.'}</div>
                        ) : (
                            <div className="table-card-dv">
                                <table className="sti-table-dv">
                                    <thead>
                                        <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up and reason</th><th>How the place was got</th><th>Queue status</th></tr>
                                    </thead>
                                    <tbody>
                                        {slice(queueRows).map((p) => (
                                            <tr key={p.appointment_id}>
                                                <td><strong className="queue-no-sc">{p.queue_label}</strong></td>
                                                <td>
                                                    {p.student_name}
                                                    <div className="muted-ds">{p.student_id}{classLabel(p) ? ` - ${classLabel(p)}` : ''}</div>
                                                </td>
                                                <td className="reason-cell-sc">
                                                    <strong>{visitLabel(p.visit_type, p.purpose_other)}</strong>
                                                    {p.booking_reason && <div>{p.booking_reason}</div>}
                                                </td>
                                                <td>{queueWayText(p)}</td>
                                                <td>
                                                    <span className={`badge-ds ${QUEUE_STATE_CLASS[p.queue_state] || 'badge-expired-ds'}`}>{QUEUE_STATE_TEXT[p.queue_state] || p.queue_state}</span>
                                                    {p.attendance_status === 'Present' && <div className="muted-ds">Arrived</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <Pager page={curPage} pageCount={pageCountOf(queueRows.length)} total={queueRows.length} pageSize={PAGE_SIZE} onPage={setPage} noun="students" />
                            </div>
                        )
                    ) : rows.length === 0 ? (
                        <div className="group-empty-ds">{search ? 'Nobody matches.' : 'No request to review.'}</div>
                    ) : (
                        <div className="table-card-dv">
                            <table className="sti-table-dv">
                                <thead>
                                    <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up and reason</th><th>Requested</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {slice(rows).map((r) => (
                                        <tr key={r.request_id}>
                                            <td>
                                                <strong className="queue-no-sc">{r.appointment_queue_no ? `${r.appointment_queue_lane === 'Walk-in' ? 'W' : '#'}${r.appointment_queue_no}` : '-'}</strong>
                                                {r.status === 'Waiting for Approval' && <div className="muted-ds">No number yet</div>}
                                            </td>
                                            <td>
                                                {fullName(r.student_first_name, r.student_last_name)}
                                                <div className="muted-ds">{r.student_id}{classLabel(r) ? ` - ${classLabel(r)}` : ''}</div>
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
                            <Pager page={curPage} pageCount={pageCountOf(rows.length)} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} noun="requests" />
                        </div>
                    )}
                </>
            )}

            <AppointModal
                isOpen={!!addFor} schedule={addFor} fixedDate={addFor ? addFor.listing_date : undefined} creator={creator} userId={userId}
                onClose={() => setAddFor(null)} onDone={changed}
            />
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
