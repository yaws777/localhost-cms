// WaitingList.jsx (the "Listings" tab of the scheduling hub; the file keeps its old name)
// One listing per posted schedule. The doctor set the schedule with a listing limit, the nurse opens its listing and students take a place in it:
// no reason and no approval, the student gets the next queue number of that session at once (in the order of asking).
// The nurse and the doctor use this same screen; only the nurse opens / closes a listing and adds students. Tabs: Queue (every student holding a
// number) and, for the nurse, Move in.
// The screen opens on a table of the sessions that have a listing (check-up service, listed x/limit, places left, status, icon actions), with the
// past sessions in a second panel. View list opens the list of one session. Session cards / schedule rows land here with
// `focusSchedule`: that session's list is already open.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, UserPlus, Eye, ArrowLeft, ArrowRightLeft, ChevronsRight } from 'lucide-react';
import { Pager } from '../common/RecordFolders';
import { AppointModal, creatorBody } from './SessionModals';
import { useAlert } from '../../context/AlertContext';
import { formatDateTime } from '../../utils/datetime';
import { visitLabel, fullName } from '../../utils/visitPurpose';
import { API, SCHEDULING_WAYS, wayOf, dayLabel, timeRange, classLabel, CUTOFF_KINDS, cutoffKindLabel } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

// `queue` is the whole queue of the session (advance listing students, accepted students, walk-ins); it is read from the session, not from the requests
// `move` (nurse only): follow-ups and cut off students the nurse can move into this session, the earliest listing first
const NURSE_GROUPS = [
    ['queue', 'Queue'],
    ['move', 'Move in']
];
const DOCTOR_GROUPS = NURSE_GROUPS.filter(([key]) => key === 'queue');
const PAGE_SIZE = 8;
const pageCountOf = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));

const QUEUE_STATE_TEXT = { Waiting: 'Waiting', Serving: 'In session', Done: 'Done', Void: 'Void' };
const QUEUE_STATE_CLASS = { Waiting: 'badge-pending-ds', Serving: 'badge-open-ds', Done: 'badge-open-ds', Void: 'badge-closed-ds' };
const queueWayText = (p) => (p.how === 'repeat' ? 'Follow-up' : p.how === 'advance' && p.advance_label ? `Advance listing ${p.advance_label}` : SCHEDULING_WAYS[wayOf(p.booking_source, p.how)].label);

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
    const { showAlert, showConfirm } = useAlert();
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

    const load = useCallback(async () => {
        try {
            const doctorQs = fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : '';
            const [schedRes, pastRes] = await Promise.all([
                fetch(`${API}/api/doctor-schedules?status=Open${doctorQs}`),
                fetch(`${API}/api/schedule-calendar?from=${daysAgo(60)}&to=${todayManila()}${doctorQs}`)
            ]);
            const schedData = await schedRes.json();
            const pastData = await pastRes.json();
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

    // The whole queue of the picked session: every student holding a number, however the place was got (advance listing, taken by the student, added by hand, walk-in)
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

    // Students the nurse can move into this session: follow-ups waiting for a schedule (this doctor) and cut off students (by listing limit, by time,
    // or a dropped listing). Only what the session's check-up service fits. Priority = date and time of the first listing, earliest first.
    const [movables, setMovables] = useState([]);
    const [moveLoading, setMoveLoading] = useState(false);
    const canMove = isNurse && !!session && !pastSession;
    const loadMovables = useCallback(async () => {
        if (!canMove) { setMovables([]); return; }
        setMoveLoading(true);
        try {
            const [cutRes, fuRes] = await Promise.all([
                fetch(`${API}/api/advance-listing/entries?scope=cutoff`),
                fetch(`${API}/api/follow-ups?doctor_id=${encodeURIComponent(session.doctor_id)}`)
            ]);
            const cutData = await cutRes.json();
            const fuData = await fuRes.json();
            const fitsCut = (vt) => session.visit_type === 'Any' || session.visit_type === vt;
            const fitsFollow = (vt) => session.visit_type === 'Any' || session.visit_type === vt || ['Follow-up', 'Referral'].includes(vt);
            const followUps = (fuData.success ? fuData.follow_ups : [])
                .filter((f) => f.state === 'needs_time' && fitsFollow(f.visit_type))
                .map((f) => ({
                    key: `f-${f.appointment_id}-${f.student_id}`, kind: 'followup', id: f.appointment_id, student_id: f.student_id,
                    student_name: fullName(f.student_first_name, f.student_last_name), class_text: classLabel(f), visit_type: f.visit_type, service_type: f.service_type, service_other: f.service_purpose_other, reason: f.follow_up_notes || f.diagnosis || '',
                    listed_at: f.assessment_date
                }))
                .sort((a, b) => String(a.listed_at).localeCompare(String(b.listed_at)));
            const cutoffs = (cutData.success ? cutData.entries : [])
                .filter((e) => fitsCut(e.visit_type))
                .map((e) => ({
                    key: `c-${e.entry_id}`, kind: 'cutoff', id: e.entry_id, student_id: e.student_id, student_name: fullName(e.student_first_name, e.student_last_name),
                    class_text: classLabel(e), visit_type: e.visit_type, reason: e.reason, listed_at: e.listed_at || e.created_at, cutoff_kind: e.cutoff_kind
                }))
                .sort((a, b) => String(a.listed_at).localeCompare(String(b.listed_at)));
            setMovables([...followUps, ...cutoffs]);
        } catch (e) {
            setMovables([]);
        } finally {
            setMoveLoading(false);
        }
    }, [canMove, session]);

    useEffect(() => { loadMovables(); }, [loadMovables, refreshKey]);

    // a cut off student can only go after the ones of the same check-up service who listed earlier (the server checks it too)
    const firstCutoffOf = useMemo(() => {
        const first = new Map();
        movables.filter((m) => m.kind === 'cutoff').forEach((m) => { if (!first.has(m.visit_type)) first.set(m.visit_type, m.key); });
        return first;
    }, [movables]);

    const queueRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return queue.filter((p) => !q || `${p.student_name} ${p.student_id} ${p.queue_label} ${p.advance_label || ''}`.toLowerCase().includes(q));
    }, [queue, search]);

    const counts = useMemo(() => {
        const map = {};
        GROUPS.forEach(([key]) => { map[key] = key === 'move' ? movables.length : queue.length; });
        return map;
    }, [GROUPS, queue, movables]);

    const moveRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return movables.filter((m) => !q || `${m.student_name} ${m.student_id} ${m.reason}`.toLowerCase().includes(q));
    }, [movables, search]);

    // back to the first page when the list in view changes
    useEffect(() => { setPage(1); }, [group, search, sessionId, pastSession]);
    useEffect(() => { setTablePage(1); }, [panel]);
    const curPage = Math.min(page, pageCountOf(group === 'move' ? moveRows.length : queueRows.length));
    const slice = (list) => list.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

    const changed = () => { load(); loadQueue(); loadMovables(); if (onChanged) onChanged(); };

    // move a follow-up or cut off students into the open session (the server checks the limit, the purpose and that nobody is listed twice)
    const moveIn = async (list) => {
        if (!session || list.length === 0) return;
        const names = list.length === 1 ? list[0].student_name : `${list.length} students`;
        const ok = await showConfirm(`Move ${names} into this session?`, { title: 'Move in', confirmLabel: 'Move in' });
        if (!ok) return;
        setBusy(true);
        try {
            const cut = list.filter((m) => m.kind === 'cutoff');
            const follow = list.filter((m) => m.kind === 'followup');
            const messages = [];
            let failed = false;
            for (const m of follow) {
                const data = await send(`/api/doctor-visits/${m.id}/follow-up`, 'POST', {
                    ...creatorBody(creator), sender_id: userId, student_id: m.student_id, schedule_id: session.schedule_id, date: session.listing_date
                });
                if (data.success) messages.push(data.message); else { failed = true; messages.push(`${m.student_name}: ${data.message || 'Could not move the follow-up.'}`); }
            }
            if (cut.length > 0) {
                const data = await send(`/api/doctor-schedules/${session.schedule_id}/place-cutoff`, 'PUT', { sender_id: userId, date: session.listing_date, entry_ids: cut.map((m) => m.id) });
                if (data.success) messages.push(data.message); else { failed = true; messages.push(data.message || 'Could not move the cut off students.'); }
            }
            showAlert(messages.join(' '), failed ? 'warning' : 'success');
            changed();
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
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
                                    <tr><th>Check-up service</th><th>Listed</th><th>Numbers left</th><th>Status</th><th>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {pageOf(currentRows, tablePageCur).map((x) => {
                                        const status = statusOf(x);
                                        return (
                                            <tr key={x.schedule_id}>
                                                <td><strong>{serviceName(x)}</strong><div className="muted-ds">Dr. {x.doc_last_name}, {whenText(x.listing_date, x)}</div></td>
                                                <td><span className="advance-count-sc">{x.accepted}/{x.listing_limit}</span></td>
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
                                                            <button type="button" className="icon-btn-ds" disabled={x.listing_full} title={x.listing_full ? 'The listing is full' : 'Add a student'}
                                                                aria-label={`Add a student to ${serviceName(x)}`} onClick={() => setAddFor(x)}><UserPlus size={15} /></button>
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
                                    <tr><th>Check-up service</th><th>Date and time</th><th>Listed</th><th>Completed</th><th>Actions</th></tr>
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
                            <input type="text" placeholder="Search student or ID..." aria-label="Search the students" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="status-chips-sc">
                            {GROUPS.filter(([key]) => !pastSession || key === 'queue').map(([key, label]) => (
                                <button key={key} type="button" className={`status-chip-sc ${group === key ? 'active-sc' : ''}`} onClick={() => setGroup(key)}>
                                    {label} <em>{counts[key]}</em>
                                </button>
                            ))}
                        </div>
                        {canMove && (
                            <div className="advance-actions-sc">
                                <button type="button" className="icon-btn-ds" disabled={busy || session.listing_full} onClick={() => setAddFor(session)}
                                    title={session.listing_full ? 'The listing is full' : 'Add a student'} aria-label="Add a student to this session"><UserPlus size={15} /></button>
                                {group === 'move' && moveRows.length > 0 && (
                                    <button type="button" className="icon-btn-ds" disabled={busy || session.listing_full} onClick={() => moveIn(moveRows)}
                                        title="Move all that fit, earliest listing first" aria-label={`Move all ${moveRows.length} students that fit into this session`}><ChevronsRight size={15} /></button>
                                )}
                            </div>
                        )}
                    </div>

                    {group === 'move' ? (
                        moveRows.length === 0 ? (
                            <div className="group-empty-ds">{moveLoading ? 'Loading...' : movables.length === 0 ? 'No follow-up or cut off student waits for this check-up service.' : 'Nobody matches.'}</div>
                        ) : (
                            <div className="table-card-dv">
                                <table className="sti-table-dv">
                                    <caption className="sr-only">Follow-ups and cut off students, earliest listing first</caption>
                                    <thead>
                                        <tr><th>Student</th><th>Check-up and reason</th><th>Listed (priority)</th><th>Type</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {slice(moveRows).map((m) => {
                                            const waitsFor = m.kind === 'cutoff' && firstCutoffOf.get(m.visit_type) !== m.key;
                                            const full = !!session.listing_full;
                                            return (
                                                <tr key={m.key}>
                                                    <td>{m.student_name}<div className="muted-ds">{m.student_id}{m.class_text ? ` - ${m.class_text}` : ''}</div></td>
                                                    <td className="reason-cell-sc"><strong>{visitLabel(m.visit_type)}</strong>{m.service_type && m.service_type !== m.visit_type && <div><span className="badge-ds badge-open-ds" title="Check-up service">{visitLabel(m.service_type, m.service_other)}</span></div>}{m.reason && <div>{m.reason}</div>}</td>
                                                    <td>{formatDateTime(m.listed_at)}</td>
                                                    <td>
                                                        {m.kind === 'followup'
                                                            ? <span className="badge-ds badge-pending-ds">Follow-up</span>
                                                            : <span className="badge-ds badge-closed-ds" title={(CUTOFF_KINDS[m.cutoff_kind] || CUTOFF_KINDS.LIMIT).hint}>Cut off: {cutoffKindLabel(m.cutoff_kind).toLowerCase()}</span>}
                                                    </td>
                                                    <td>
                                                        <div className="row-actions-sc">
                                                            <button
                                                                type="button" className="icon-btn-ds" disabled={busy || full || waitsFor} onClick={() => moveIn([m])}
                                                                aria-label={`Move ${m.student_name} into this session`}
                                                                title={full ? 'The listing is full' : waitsFor ? 'A student of this check-up service listed earlier and goes first' : 'Move into this session'}
                                                            ><ArrowRightLeft size={15} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <Pager page={curPage} pageCount={pageCountOf(moveRows.length)} total={moveRows.length} pageSize={PAGE_SIZE} onPage={setPage} noun="students" />
                            </div>
                        )
                    ) : group === 'queue' ? (
                        queueRows.length === 0 ? (
                            <div className="group-empty-ds">{queueLoading ? 'Loading the queue...' : queue.length === 0 ? 'Nobody holds a queue number yet.' : 'Nobody matches.'}</div>
                        ) : (
                            <div className="table-card-dv">
                                <table className="sti-table-dv">
                                    <thead>
                                        <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up</th><th>How the place was got</th><th>Queue status</th></tr>
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
                    ) : null}
                </>
            )}

            <AppointModal
                isOpen={!!addFor} schedule={addFor} fixedDate={addFor ? addFor.listing_date : undefined} creator={creator} userId={userId}
                onClose={() => setAddFor(null)} onDone={changed}
            />
        </>
    );
};

export default WaitingList;
