// FollowUps.jsx (the "Repeats" tab)
// The repeat list. Every assessment where the doctor says the student needs a repeat (a follow-up check-up) is one row for one student, so
// repeats are always set individually. From here the nurse or doctor appoints the student again (a direct appointment):
//   - a custom time (any date and hour the doctor is free), or
//   - a place in an upcoming session of the doctor for the same check-up service (no time slot: the student takes the next queue number).
// A student with no schedule to go to simply waits in the list until one is posted.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Search, RefreshCw, Undo2, EyeOff, CalendarPlus, Hourglass, FolderOpen, ChevronLeft, Users } from 'lucide-react';
import Modal from '../common/Modal';
import { notifyRecordChanged } from '../../hooks/useRecordSync';
import { ReasonModal } from '../doctor/AppointmentModals';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime, formatTime } from '../../utils/datetime';
import { visitLabel, fullName, localDateStr, localTimeStr, minTimeFor, isPastMoment } from '../../utils/visitPurpose';
import { API, timeRange, classLabel } from '../../utils/scheduling';
import { creatorBody } from './SessionModals';
import { Pager, paginate } from '../common/RecordFolders';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const REPEATS_PER_PAGE = 8;

const STATE_FILTERS = [
    ['needs_time', 'Waiting for a schedule'],
    ['scheduled', 'Scheduled'],
    ['done', 'Done']
];

const STATE_BADGE = {
    needs_time: ['badge-pending-ds', 'Waiting for a schedule'],
    scheduled: ['badge-open-ds', 'Scheduled'],
    done: ['badge-expired-ds', 'Done'],
    dismissed: ['badge-closed-ds', 'Taken off the list']
};

// A repeat belongs to the folder of the session it was put in (schedule + day). A repeat with a custom time (no schedule) goes to
// "Direct appointments"; one that still waits for a schedule is in no session folder, only in "All schedules".
const ALL_FOLDER = 'all';
const DIRECT_FOLDER = 'direct';
const folderKeyOf = (r) => {
    const f = r.follow_up;
    if (!f) return null;
    return f.schedule_id ? `${f.schedule_id}|${formatDate(f.start_time)}` : DIRECT_FOLDER;
};
const timeOf = (value) => { const t = new Date(value).getTime(); return Number.isNaN(t) ? 0 : t; };

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

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
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const today = localDateStr();

    useEffect(() => {
        if (!item) return;
        const wanted = item.follow_up_date ? String(item.follow_up_date).slice(0, 10) : '';
        setMode('time');
        setDate(wanted && wanted >= today ? wanted : today);
        setTime(localTimeStr());
        setDuration(15);
        setNotes(item.follow_up_notes || '');
        setSessionId('');
        setError('');
        setBusy(false);
        let live = true;
        fetch(`${API}/api/doctor-schedules?status=Open&doctor_id=${encodeURIComponent(item.doctor_id)}`)
            .then((r) => r.json())
            .then((d) => { if (live && d.success) setSessions(d.schedules.filter((s) => !s.is_expired)); })
            .catch(() => { if (live) setSessions([]); });
        return () => { live = false; };
    }, [item, today]);

    // Only sessions that have not started: same check-up service as the visit that is repeated, with a date and a start time still to come.
    // A session on going (or waiting for its end to be confirmed) or already past is not listed.
    const upcoming = useMemo(() => {
        if (!item) return [];
        const now = `${localDateStr()} ${new Date().toTimeString().slice(0, 5)}`;
        return sessions.filter((x) => x.next_date
            && !x.in_session_now && !x.is_ongoing && !x.awaiting_end
            && `${String(x.next_date).slice(0, 10)} ${String(x.start_time).slice(0, 5)}` > now
            && (x.visit_type === 'Any' || x.visit_type === item.visit_type || ['Follow-up', 'Referral'].includes(item.visit_type)));
    }, [sessions, item]);

    // no double place: a session where this student already holds a number is shown but cannot be picked
    const [heldIds, setHeldIds] = useState(() => new Set());
    useEffect(() => {
        setHeldIds(new Set());
        if (!item || upcoming.length === 0) return undefined;
        let live = true;
        Promise.all(upcoming.map((x) => fetch(`${API}/api/doctor-schedules/${encodeURIComponent(x.schedule_id)}/participants?date=${encodeURIComponent(String(x.next_date).slice(0, 10))}`)
            .then((r) => r.json())
            .then((d) => (d.success && d.participants.some((p) => p.student_id === item.student_id && p.status === 'Scheduled' && (!p.queue_state || ['Waiting', 'Serving'].includes(p.queue_state))) ? x.schedule_id : null))
            .catch(() => null)))
            .then((ids) => { if (live) setHeldIds(new Set(ids.filter(Boolean))); });
        return () => { live = false; };
    }, [item, upcoming]);
    useEffect(() => {
        if (mode !== 'schedule') return;
        if (!upcoming.some((x) => x.schedule_id === sessionId)) setSessionId('');
    }, [mode, upcoming, sessionId]);

    if (!item) return null;
    const session = upcoming.find((x) => x.schedule_id === sessionId) || null;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        let body;
        if (mode === 'schedule') {
            if (!session) { setError('Pick the schedule the student goes into.'); return; }
            body = { schedule_id: session.schedule_id, date: session.next_date };
        } else {
            if (!date) { setError('Pick the date of the follow-up.'); return; }
            if (!time) { setError('Pick the time of the follow-up.'); return; }
            if (isPastMoment(date, time)) { setError('The date and time cannot be in the past.'); return; }
            body = { start_time: `${date} ${time}:00`, duration_min: parseInt(duration, 10) };
        }
        setBusy(true);
        try {
            const data = await send(`/api/doctor-visits/${item.appointment_id}/follow-up`, 'POST', {
                ...creatorBody(creator), sender_id: userId, student_id: item.student_id, ...body, notes
            });
            if (data.success) { showAlert(data.message, 'success'); onDone?.(); onClose(); }
            else setError(data.message || 'Could not schedule the follow-up.');
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen={!!item} onClose={onClose} title="Appoint the follow-up" icon={<CalendarPlus size={20} />} size="lg">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    <strong>{fullName(item.student_first_name, item.student_last_name)}</strong> - follow-up of {visitLabel(item.visit_type, item.purpose_other)} on {formatDate(item.visit_start)}<br />
                    Dr. {item.doc_first_name} {item.doc_last_name}
                    {item.follow_up_date ? ` - the doctor asked for ${formatDate(item.follow_up_date)}` : ''}
                    {item.follow_up_notes ? ` - ${item.follow_up_notes}` : ''}
                </div>
                {error && <div className="dp-error">{error}</div>}

                <div className="status-chips-sc" role="group" aria-label="How to appoint">
                    <button type="button" className={`status-chip-sc ${mode === 'time' ? 'active-sc' : ''}`} onClick={() => setMode('time')}>Pick a time</button>
                    <button type="button" className={`status-chip-sc ${mode === 'schedule' ? 'active-sc' : ''}`} onClick={() => setMode('schedule')}>Put in a schedule</button>
                </div>

                {mode === 'time' && (
                    <div className="dp-row">
                        <div className="dp-field">
                            <label htmlFor="fu-date">Date</label>
                            <input id="fu-date" className="dp-input" type="date" min={today} required value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        <div className="dp-field">
                            <label htmlFor="fu-time">Start time</label>
                            <input id="fu-time" className="dp-input" type="time" required min={minTimeFor(date)} value={time} onChange={(e) => setTime(e.target.value)} />
                        </div>
                        <div className="dp-field">
                            <label htmlFor="fu-min">Minutes</label>
                            <input id="fu-min" className="dp-input" type="number" min={5} max={240} step={5} required value={duration} onChange={(e) => setDuration(e.target.value)} />
                        </div>
                    </div>
                )}

                {mode === 'schedule' && upcoming.length > 0 && (
                    <div className="dp-field" role="radiogroup" aria-labelledby="fu-schedules-label">
                        <span id="fu-schedules-label" className="dp-label">Upcoming schedules for {visitLabel(item.visit_type, item.purpose_other)}</span>
                        <div className="dp-choice-grid">
                            {upcoming.map((x) => {
                                const full = !!x.listing_full;
                                const held = heldIds.has(x.schedule_id);
                                const picked = sessionId === x.schedule_id;
                                return (
                                    <button
                                        key={x.schedule_id} type="button" role="radio" aria-checked={picked} disabled={full || held}
                                        className={`dp-choice ${picked ? 'selected-sc' : ''}`} onClick={() => setSessionId(x.schedule_id)}
                                    >
                                        <strong>{formatDate(x.next_date)}</strong>
                                        <span>{timeRange(x.start_time, x.end_time)}{x.location ? ` - ${x.location}` : ''}</span>
                                        <span>{x.accepted} of {x.listing_limit} places taken{full ? ' (full)' : ''}{held ? ' - the student already has a place here' : ''}{picked ? ' - selected' : ''}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="dp-field">
                    <label htmlFor="fu-notes">Note for the student (optional)</label>
                    <input id="fu-notes" className="dp-input" type="text" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring the lab results" />
                </div>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || (mode === 'schedule' && !session)}>{busy ? 'Saving...' : 'Appoint follow-up'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Repeat from a past check-up (doctor): the student joins the Repeats list; only the nurse puts the student in a schedule
// ---------------------------------------------------------------------------
export const RepeatModal = ({ appt, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const [wantedDate, setWantedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!appt) return;
        setWantedDate(appt.follow_up_date ? String(appt.follow_up_date).slice(0, 10) : '');
        setNotes(appt.follow_up_notes || '');
        setBusy(false);
        setError('');
    }, [appt]);

    if (!appt) return null;

    // the repeat list only holds check-ups flagged "repeat needed": flag this one first
    const flag = async () => {
        const data = await send(`/api/follow-ups/${appt.appointment_id}/flag`, 'PUT', { student_id: appt.student_id, follow_up_date: wantedDate || undefined, notes: notes.trim() || undefined });
        if (!data.success) setError(data.message || 'Could not set the follow-up.');
        else notifyRecordChanged('checkup');
        return !!data.success;
    };

    // the doctor does not schedule the repeat: the student joins the Repeats list and the nurse moves the student into a schedule
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (!(await flag())) return;
            showAlert('The student is in the Follow-ups list. The nurse puts the student in a schedule.', 'success');
            onDone?.();
            onClose();
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title="Follow-up check-up" icon={<CalendarClock size={20} />} size="md">
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> - follow-up of {visitLabel(appt.visit_type, appt.purpose_other)} on {formatDate(appt.start_time)}.
                    The student joins the Follow-ups list and waits for a schedule. The nurse sets it.
                </div>
                {error && <div className="dp-error">{error}</div>}
                <div className="dp-row">
                    <div className="dp-field">
                        <label htmlFor="rp-date">Follow-up around (optional)</label>
                        <input id="rp-date" className="dp-input" type="date" min={localDateStr()} value={wantedDate} onChange={(e) => setWantedDate(e.target.value)} />
                    </div>
                    <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                        <label htmlFor="rp-notes">Note for the student (optional)</label>
                        <input id="rp-notes" className="dp-input" type="text" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Bring the lab results" />
                    </div>
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}><Hourglass size={14} /> {busy ? 'Saving...' : 'Add to Follow-ups list'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------
const FollowUps = ({ fixedDoctorId, doctors, creator, userId, refreshKey, onChanged }) => {
    const { showAlert } = useAlert();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [state, setState] = useState('needs_time');
    const [folder, setFolder] = useState(null); // null = the folder list, ALL_FOLDER, DIRECT_FOLDER or "schedule_id|day"
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [doctorFilter, setDoctorFilter] = useState('');
    const [appointTarget, setAppointTarget] = useState(null);
    const [dismissTarget, setDismissTarget] = useState(null);
    // only the nurse schedules a repeat (appoint here, or move the students into a requested schedule); the doctor flags the repeat in the assessment
    const isNurse = !creator.doctorId;

    const load = useCallback(async () => {
        try {
            const doctor = fixedDoctorId || doctorFilter;
            const res = await fetch(`${API}/api/follow-ups${doctor ? `?doctor_id=${encodeURIComponent(doctor)}` : ''}`);
            const data = await res.json();
            if (data.success) setItems(data.follow_ups);
        } catch (e) {
            showAlert('Could not load the follow-up list.', 'error');
        } finally {
            setLoading(false);
        }
    }, [fixedDoctorId, doctorFilter, showAlert]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const changed = () => { load(); if (onChanged) onChanged(); };

    const searched = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((r) => !q || `${r.student_first_name} ${r.student_last_name} ${r.student_id}`.toLowerCase().includes(q));
    }, [items, search]);

    // one folder per session (schedule + day), newest first, and "All schedules" with every repeat
    const folders = useMemo(() => {
        const map = new Map();
        searched.forEach((r) => {
            const key = folderKeyOf(r);
            if (!key) return;
            if (!map.has(key)) map.set(key, { key, f: r.follow_up, rows: [] });
            map.get(key).rows.push(r);
        });
        return [...map.values()].sort((a, b) => timeOf(b.f.start_time) - timeOf(a.f.start_time));
    }, [searched]);

    const tallies = (list) => ({
        needs_time: list.filter((r) => r.state === 'needs_time').length,
        scheduled: list.filter((r) => r.state === 'scheduled').length,
        done: list.filter((r) => r.state === 'done').length
    });

    const folderRows = useMemo(() => {
        if (!folder) return [];
        if (folder === ALL_FOLDER) return searched;
        return searched.filter((r) => folderKeyOf(r) === folder);
    }, [searched, folder]);
    const openMeta = folder && folder !== ALL_FOLDER ? folders.find((x) => x.key === folder) : null;
    const folderCounts = tallies(folderRows);

    const rows = useMemo(() => folderRows.filter((r) => r.state === state), [folderRows, state]);

    const openFolder = (key) => { setFolder(key); setState(key === ALL_FOLDER ? 'needs_time' : 'scheduled'); };
    const folderTitle = (x) => (x.key === DIRECT_FOLDER
        ? 'Direct appointments'
        : `Dr. ${x.f.doc_first_name} ${x.f.doc_last_name} - ${formatDate(x.f.start_time)}`);

    useEffect(() => { setPage(1); }, [state, search, doctorFilter, folder]);
    const paged = paginate(rows, page, REPEATS_PER_PAGE);

    const dismiss = async (reason) => {
        const r = dismissTarget;
        const data = await send(`/api/follow-ups/${r.appointment_id}/dismiss`, 'PUT', { student_id: r.student_id, dismissed: true, reason });
        setDismissTarget(null);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not update the follow-up.', 'error');
    };

    const restore = async (r) => {
        const data = await send(`/api/follow-ups/${r.appointment_id}/dismiss`, 'PUT', { student_id: r.student_id, dismissed: false });
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not update the follow-up.', 'error');
    };

    return (
        <>
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

            {folder && (
                <div className="dp-crumbs">
                    <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setFolder(null)}><ChevronLeft size={15} /> All folders</button>
                    <FolderOpen size={17} />
                    <strong>{folder === ALL_FOLDER ? 'All schedules' : openMeta ? folderTitle(openMeta) : 'Session'}</strong>
                </div>
            )}

            {folder && (
                <div className="status-chips-sc" style={{ marginBottom: 14 }}>
                    {STATE_FILTERS.map(([key, label]) => (
                        <button key={key} type="button" className={`status-chip-sc ${state === key ? 'active-sc' : ''}`} aria-pressed={state === key} onClick={() => setState(key)}>
                            {label} <em>{folderCounts[key] || 0}</em>
                        </button>
                    ))}
                </div>
            )}

            {loading ? <div className="loading-dv">Loading the follow-up list...</div> : !folder ? (
                <div className="dp-day-grid">
                    {[{ key: ALL_FOLDER, all: true, rows: searched }, ...folders].map((x) => {
                        const t = tallies(x.rows);
                        const name = x.all ? 'All schedules' : folderTitle(x);
                        return (
                            <button key={x.key} type="button" className="dp-day-folder" onClick={() => openFolder(x.key)} aria-label={`Open ${name}`}>
                                <FolderOpen size={26} />
                                <strong>{name}</strong>
                                {x.all && <span>Every follow-up, in every schedule</span>}
                                {!x.all && x.key !== DIRECT_FOLDER && (
                                    <span>{formatTime(x.f.start_time)} - {formatTime(x.f.end_time)}{x.f.location ? ` - ${x.f.location}` : ''}</span>
                                )}
                                <span><Users size={13} /> {x.rows.length} follow-up{x.rows.length === 1 ? '' : 's'}</span>
                                <span>{t.needs_time} waiting - {t.scheduled} scheduled - {t.done} done</span>
                            </button>
                        );
                    })}
                </div>
            ) : rows.length === 0 ? (
                <div className="group-empty-ds"><CalendarClock size={16} /> {state === 'needs_time' ? 'No student is waiting for a follow-up.' : 'Nothing in this list.'}</div>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead>
                            <tr><th>Student</th><th>Follow-up of</th><th>Asked for</th><th>Status</th><th>Actions</th></tr>
                        </thead>
                        <tbody>
                            {paged.items.map((r) => {
                                const [badgeClass, badgeText] = STATE_BADGE[r.state];
                                return (
                                    <tr key={`${r.appointment_id}-${r.student_id}`}>
                                        <td>
                                            {fullName(r.student_first_name, r.student_last_name)}
                                            <div className="muted-ds">{r.student_id}{classLabel(r) ? ` - ${classLabel(r)}` : ''}</div>
                                        </td>
                                        <td>
                                            <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                            {r.service_type && r.service_type !== r.visit_type && (
                                                <div><span className="badge-ds badge-open-ds" title="Check-up service">{visitLabel(r.service_type, r.service_purpose_other)}</span></div>
                                            )}
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
                                                        {isNurse && <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" onClick={() => setAppointTarget(r)}><CalendarPlus size={13} /> Appoint</button>}
                                                        <button type="button" className="icon-btn-ds" title="Take off the list" aria-label="Take off the list" onClick={() => setDismissTarget(r)}><EyeOff size={15} /></button>
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
                    <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={REPEATS_PER_PAGE} onPage={setPage} noun="follow-ups" />
                </div>
            )}

            <AppointFollowUpModal item={appointTarget} creator={creator} userId={userId} onClose={() => setAppointTarget(null)} onDone={changed} />
            <ReasonModal
                isOpen={!!dismissTarget} title="Take the follow-up off the list" confirmLabel="Take off the list" label="Reason"
                message={dismissTarget ? `${fullName(dismissTarget.student_first_name, dismissTarget.student_last_name)} - follow-up of ${visitLabel(dismissTarget.visit_type, dismissTarget.purpose_other)}` : ''}
                placeholder="e.g. The student recovered, or was seen elsewhere" onSubmit={dismiss} onClose={() => setDismissTarget(null)}
            />
        </>
    );
};

export default FollowUps;
