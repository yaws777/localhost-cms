// AdvanceListing.jsx (first half of the "Listings" tab of the scheduling hub)
// The advance listing needs no schedule: the nurse opens it with a title (e.g. "Advance listing for next month"), picks the check-up services and the limit
// of each, and it stays open until a closing time or until she closes it. Students register for one service and get an advance number (A1, A2 ... per
// service). The overview is a table with one row per check-up service (listed 1/10, requests to review, waiting for a schedule, status) and its actions:
// open / close the service, view its list, review the requests, configure the limit, add a student, request a schedule. For a service the nurse sends a
// schedule request to a doctor (it carries the number of waiting students). When the doctor sets the schedule, those students take the first queue numbers
// of the session and the places left of its listing limit are opened for the students who are not in the advance listing. A service that has a schedule
// closes here by itself and moves to the Session Listing. The past advance listings stay viewable. The doctor sees the same lists, read only, limited to the check-up services that doctor covers (a dentist only sees Dental).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DoorOpen, DoorClosed, Settings2, RefreshCw, Search, Send, UserMinus, UserPlus, Check, XCircle, Eye, ClipboardCheck, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import Modal from '../common/Modal';
import { Pager } from '../common/RecordFolders';
import { ReasonModal, StudentPicker } from '../doctor/AppointmentModals';
import { ScheduleRequestModal } from './ScheduleRequests';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { fullName } from '../../utils/visitPurpose';
import { API, to12h, coveredTypes, classLabel } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const STATUS_CLASS = { Pending: 'badge-pending-ds', Denied: 'badge-closed-ds', Waiting: 'badge-pending-ds', Scheduled: 'badge-open-ds', Done: 'badge-open-ds', Ended: 'badge-expired-ds', Withdrawn: 'badge-closed-ds', Removed: 'badge-closed-ds' };
const STATUS_TEXT = { Pending: 'To review', Denied: 'Declined', Waiting: 'Waiting for a schedule', Scheduled: 'Has a queue number', Done: 'Seen', Ended: 'Place ended', Withdrawn: 'Left the listing', Removed: 'Removed' };
const SERVICE_STATUS_CLASS = { Open: 'badge-open-ds', Closed: 'badge-closed-ds', Scheduled: 'badge-expired-ds' };
const SERVICE_STATUS_TEXT = { Open: 'Open', Closed: 'Closed', Scheduled: 'Moved to Session Listing' };
const CLOSE_REASON_TEXT = { manual: 'Closed by the nurse', time: 'Closed: time was up', scheduled: 'Closed: every service has a schedule' };

const PAGE_SIZE = 8;
const pageCountOf = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));
const pageOf = (items, page) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

const send = async (path, method, body) => {
    const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return { ...data, httpStatus: res.status };
};

// value for <input type="datetime-local">
const localNow = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
};

// "1/10" of a service: registered / listing limit
const listedText = (s) => `${s.registered}/${s.listing_limit || '-'}`;

// The nurse's settings: title, services with a limit each, and how long the listing stays open
const SettingsModal = ({ isOpen, state, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const [title, setTitle] = useState('');
    const [picked, setPicked] = useState({});
    const [until, setUntil] = useState(false);
    const [closesAt, setClosesAt] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen || !state) return;
        const next = {};
        state.services.filter((s) => s.offered).forEach((s) => { next[s.visit_type] = String(s.listing_limit); });
        setTitle(state.is_open && state.listing ? state.listing.title : '');
        setPicked(next);
        setUntil(!!state.is_open && !!state.closes_at);
        setClosesAt(state.is_open && state.closes_at ? String(state.closes_at).replace(' ', 'T').slice(0, 16) : '');
        setError('');
        setBusy(false);
    }, [isOpen, state]);

    if (!state) return null;
    const registeredOf = (t) => (state.services.find((s) => s.visit_type === t) || {}).registered || 0;
    const toggle = (t, on) => setPicked((p) => { const next = { ...p }; if (on) next[t] = next[t] || '30'; else delete next[t]; return next; });

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        const services = Object.entries(picked).map(([visit_type, listing_limit]) => ({ visit_type, listing_limit: Number(listing_limit) }));
        if (!title.trim()) { setError('Give the advance listing a title.'); return; }
        if (services.length === 0) { setError('Pick at least one check-up service.'); return; }
        if (services.some((s) => !Number.isInteger(s.listing_limit) || s.listing_limit < 1 || s.listing_limit > 500)) { setError('Every service needs a listing limit from 1 to 500.'); return; }
        if (until && !closesAt) { setError('Pick the date and time the listing closes, or choose to keep it open until you close it.'); return; }
        setBusy(true);
        const data = await send('/api/advance-listing', 'PUT', { sender_id: userId, is_open: true, title: title.trim(), closes_at: until ? closesAt : '', services });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else setError(data.message || 'Could not save the advance listing.');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={state.is_open ? 'Advance Listing (No Schedule Yet) settings' : 'Open the Advance Listing (No Schedule Yet)'} icon={<Settings2 size={20} />} size="md" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">Students register for one check-up service and get an advance number. No schedule is needed yet: you ask a doctor for a schedule per service afterwards.</div>
                {error && <div className="dp-error" role="alert">{error}</div>}

                <div className="dp-field">
                    <label htmlFor="adv-title">Title of the advance listing</label>
                    <input
                        id="adv-title" className="dp-input" type="text" required maxLength={120} value={title} placeholder="Advance listing for next month"
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    <small className="dp-hint">Students and the past advance listings show this title.</small>
                </div>

                <fieldset className="dp-field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontWeight: 600, marginBottom: 6 }}>Check-up services and listing limit</legend>
                    {state.eligible.length === 0 && <small className="dp-hint">No check-up service is covered by a doctor with an account yet.</small>}
                    <div className="advance-services-sc">
                        {state.eligible.map((t) => {
                            const on = Object.prototype.hasOwnProperty.call(picked, t);
                            return (
                                <div key={t} className="advance-service-row-sc">
                                    <label className="dp-check"><input type="checkbox" checked={on} onChange={(e) => toggle(t, e.target.checked)} /> {t}</label>
                                    <label className="advance-limit-sc">
                                        <span>Limit</span>
                                        <input
                                            className="dp-input" type="number" min={Math.max(1, registeredOf(t))} max={500} disabled={!on} required={on}
                                            value={on ? picked[t] : ''} aria-label={`Listing limit for ${t}`}
                                            onChange={(e) => setPicked((p) => ({ ...p, [t]: e.target.value }))}
                                        />
                                    </label>
                                    {registeredOf(t) > 0 && <small className="dp-hint">{registeredOf(t)} registered</small>}
                                </div>
                            );
                        })}
                    </div>
                </fieldset>

                <fieldset className="dp-field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontWeight: 600, marginBottom: 6 }}>How long it stays open</legend>
                    <label className="dp-check"><input type="radio" name="adv-duration" checked={!until} onChange={() => setUntil(false)} /> Until I close it</label>
                    <label className="dp-check"><input type="radio" name="adv-duration" checked={until} onChange={() => setUntil(true)} /> Close automatically on</label>
                    <input
                        className="dp-input" type="datetime-local" min={localNow()} disabled={!until} value={closesAt} aria-label="Closing date and time"
                        onChange={(e) => setClosesAt(e.target.value)}
                    />
                    <small className="dp-hint">Closing never removes a registered student. They keep their number. A service closes by itself when it gets a schedule, and the whole listing closes when every service has one.</small>
                </fieldset>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : state.is_open ? 'Save settings' : 'Open the listing'}</button>
                </div>
            </form>
        </Modal>
    );
};

// The limit of one service
const LimitModal = ({ isOpen, service, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const [limit, setLimit] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen || !service) return;
        setLimit(String(service.listing_limit || ''));
        setError('');
        setBusy(false);
    }, [isOpen, service]);

    if (!service) return null;

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        const value = Number(limit);
        if (!Number.isInteger(value) || value < 1 || value > 500) { setError('The listing limit is a whole number from 1 to 500.'); return; }
        if (value < service.registered) { setError(`${service.registered} student(s) are already registered, so the limit cannot be lower than ${service.registered}.`); return; }
        setBusy(true);
        const data = await send(`/api/advance-listing/services/${encodeURIComponent(service.visit_type)}`, 'PUT', { sender_id: userId, listing_limit: value });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else setError(data.message || 'Could not change the limit.');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Listing limit: ${service.visit_type}`} icon={<SlidersHorizontal size={20} />} size="sm" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">{service.registered} of {service.listing_limit || '-'} places are taken. The limit cannot go below the students already registered.</div>
                {error && <div className="dp-error" role="alert">{error}</div>}
                <div className="dp-field">
                    <label htmlFor="adv-limit">Listing limit</label>
                    <input id="adv-limit" className="dp-input" type="number" min={Math.max(1, service.registered)} max={500} required value={limit} onChange={(e) => setLimit(e.target.value)} />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save limit'}</button>
                </div>
            </form>
        </Modal>
    );
};

// The nurse adds a student by hand: same advance number and limit rules, works while the listing is closed
const AddStudentModal = ({ isOpen, state, presetService, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const [student, setStudent] = useState(null);
    const [visitType, setVisitType] = useState('');
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setStudent(null);
        setVisitType(presetService || '');
        setReason('');
        setError('');
        setBusy(false);
    }, [isOpen, presetService]);

    const offered = state ? state.services.filter((s) => s.offered) : [];

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (!student) { setError('Choose the student.'); return; }
        if (!visitType) { setError('Pick the check-up service.'); return; }
        if (!reason.trim()) { setError('Give the reason for the check-up.'); return; }
        setBusy(true);
        const data = await send('/api/advance-listing/entries', 'POST', { sender_id: userId, student_id: student.student_id, visit_type: visitType, reason: reason.trim() });
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else setError(data.message || 'Could not add the student.');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add a student to the Advance Listing (No Schedule Yet)" icon={<UserPlus size={20} />} size="md" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">The student gets the next advance number of the service and is told. This works even when the listing is closed, but not above the service limit.</div>
                {error && <div className="dp-error" role="alert">{error}</div>}
                <StudentPicker value={student} onChange={setStudent} />
                <div className="dp-field">
                    <label htmlFor="adv-add-service">Check-up service</label>
                    <select id="adv-add-service" className="dp-select" required value={visitType} onChange={(e) => setVisitType(e.target.value)}>
                        <option value="">-- Select the check-up service --</option>
                        {offered.map((s) => <option key={s.visit_type} value={s.visit_type} disabled={s.listing_full || s.scheduled}>{s.visit_type} ({s.scheduled ? 'already scheduled' : `${s.registered} of ${s.listing_limit} registered${s.listing_full ? ', full' : ''}`})</option>)}
                    </select>
                </div>
                <div className="dp-field">
                    <label htmlFor="adv-add-reason">Reason for the check-up</label>
                    <textarea id="adv-add-reason" className="dp-textarea" rows={2} maxLength={255} required value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Adding...' : 'Add student'}</button>
                </div>
            </form>
        </Modal>
    );
};

const AdvanceListing = ({ isNurse, doctors, nurseId, userId, refreshKey, onChanged }) => {
    const { showAlert } = useAlert();
    const [state, setState] = useState(null);
    const [history, setHistory] = useState([]);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [panel, setPanel] = useState('current'); // current | past
    const [viewing, setViewing] = useState(null); // null = the overview, { listing } = the list of students (listing = a past listing, or null for the current one)
    const [service, setService] = useState('all');
    const [pendingOnly, setPendingOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [servicePage, setServicePage] = useState(1);
    const [pastPage, setPastPage] = useState(1);
    const [search, setSearch] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [addFor, setAddFor] = useState(null); // service name to preset ('' = none) while the add modal is open
    const [limitFor, setLimitFor] = useState(null);
    const [requestPreset, setRequestPreset] = useState(null);
    const [removeFor, setRemoveFor] = useState(null);
    const [denyFor, setDenyFor] = useState(null);
    const [busy, setBusy] = useState(false);

    // the nurse sees every service; a doctor only the check-up services that doctor covers
    const allowed = useMemo(() => new Set((doctors || []).flatMap((d) => coveredTypes(d))), [doctors]);
    const visible = useCallback((visitType) => isNurse || allowed.has(visitType), [isNurse, allowed]);

    const pastListing = viewing ? viewing.listing : null;
    const listingId = pastListing ? pastListing.listing_id : null;

    const load = useCallback(async () => {
        try {
            const entryUrl = listingId
                ? `${API}/api/advance-listing/entries?listing_id=${encodeURIComponent(listingId)}`
                : `${API}/api/advance-listing/entries?scope=active`;
            const [stateRes, historyRes, entryRes] = await Promise.all([
                fetch(`${API}/api/advance-listing`),
                fetch(`${API}/api/advance-listing/history`),
                fetch(entryUrl)
            ]);
            const stateData = await stateRes.json();
            const historyData = await historyRes.json();
            const entryData = await entryRes.json();
            if (stateData.success) setState(stateData);
            if (historyData.success) setHistory(historyData.listings.map((l) => ({ ...l, services: l.services.filter((x) => visible(x.visit_type)) })).filter((l) => l.services.length > 0));
            if (entryData.success) setEntries(entryData.entries);
        } catch (e) {
            showAlert('Could not load the advance listing.', 'error');
        } finally {
            setLoading(false);
        }
    }, [listingId, showAlert, visible]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return entries.filter((e) => visible(e.visit_type) && (isNurse || e.status !== 'Pending') && (!pendingOnly || e.status === 'Pending')
            && (service === 'all' || e.visit_type === service)
            && (!q || `${e.student_name} ${e.student_id} ${e.reason} ${e.label}`.toLowerCase().includes(q)));
    }, [entries, service, search, isNurse, pendingOnly, visible]);

    // back to the first page when the list in view changes
    useEffect(() => { setPage(1); }, [service, search, pendingOnly, listingId, viewing]);
    const pageRows = pageOf(rows, Math.min(page, pageCountOf(rows.length)));

    const changed = () => { load(); if (onChanged) onChanged(); };

    // the entries reload by themselves only when the listing in view changes, so they are cleared only then (clearing them for the same listing left the list empty)
    const openList = (listing, visitType = 'all', onlyPending = false) => {
        if (listing || listingId) setEntries([]);
        setSearch('');
        setService(listing && visitType === 'all' ? (listing.services.find((x) => x.requests > 0) || {}).visit_type || 'all' : visitType);
        setPendingOnly(onlyPending);
        setViewing({ listing });
    };
    const backToOverview = () => { if (listingId) setEntries([]); setViewing(null); setPendingOnly(false); setService('all'); };

    const closeListing = async () => {
        setBusy(true);
        try {
            const data = await send('/api/advance-listing', 'PUT', { sender_id: userId, is_open: false });
            if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not close the advance listing.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleService = async (svc) => {
        setBusy(true);
        try {
            const data = await send(`/api/advance-listing/services/${encodeURIComponent(svc.visit_type)}`, 'PUT', { sender_id: userId, is_open: svc.status !== 'Open' });
            if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not change the service.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const accept = async (e) => {
        setBusy(true);
        try {
            const data = await send(`/api/advance-listing/entries/${e.entry_id}/accept`, 'PUT', { sender_id: userId });
            if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not accept the request.', 'error');
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const deny = async (reason) => {
        const data = await send(`/api/advance-listing/entries/${denyFor.entry_id}/deny`, 'PUT', { sender_id: userId, reason });
        setDenyFor(null);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not decline the request.', 'error');
    };

    const remove = async (reason) => {
        const data = await send(`/api/advance-listing/entries/${removeFor.entry_id}/remove`, 'PUT', { sender_id: userId, reason });
        setRemoveFor(null);
        if (data.success) { showAlert(data.message, 'success'); changed(); } else showAlert(data.message || 'Could not remove the student.', 'error');
    };

    const requestSchedule = (svc) => setRequestPreset({
        visit_type: svc.visit_type, advance_listing: true, note: `${svc.waiting} student(s) in the ${svc.visit_type} advance listing`
    });

    if (loading) return <div className="loading-dv">Loading the advance listing...</div>;
    if (!state) return <div className="group-empty-ds">The advance listing could not be loaded.</div>;

    const statusText = state.is_open ? 'Open' : (CLOSE_REASON_TEXT[state.closed_reason] || 'Closed');
    const shownServices = state.services.filter((s) => visible(s.visit_type));
    const listServices = shownServices.filter((s) => s.offered || s.waiting > 0 || s.pending > 0);
    const offeredAny = shownServices.some((s) => s.offered);
    const currentService = service === 'all' ? null : shownServices.find((s) => s.visit_type === service) || null;

    // ---- the list of students (second view): the toolbar and the table only ----
    const listView = (
        <>
            <div className="list-head-sc">
                <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={backToOverview}><ArrowLeft size={14} /> Back to the advance listing</button>
                <h3>{service !== 'all' ? `${service}: ` : ''}{pastListing ? `${pastListing.title} (past)` : state.listing ? state.listing.title : 'Advance listing'}</h3>
            </div>
            <div className="toolbar-sc">
                <div className="search-box-dv" style={{ width: 260 }}>
                    <Search size={16} />
                    <input type="text" placeholder="Search student, ID or number..." aria-label="Search the advance listing" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {pastListing && (
                    <div className="status-chips-sc" role="group" aria-label="Check-up services of this listing">
                        {pastListing.services.filter((x) => x.requests > 0).map((x) => (
                            <button key={x.visit_type} type="button" className={`status-chip-sc ${service === x.visit_type ? 'active-sc' : ''}`} aria-pressed={service === x.visit_type} onClick={() => setService(x.visit_type)}>
                                {x.visit_type} <em>{x.requests}</em>
                            </button>
                        ))}
                    </div>
                )}
                {!pastListing && (
                    <div className="status-chips-sc" role="group" aria-label="Advance listing tabs">
                        <button type="button" className={`status-chip-sc ${!pendingOnly ? 'active-sc' : ''}`} aria-pressed={!pendingOnly} onClick={() => setPendingOnly(false)}>
                            Advance list <em>{currentService ? currentService.waiting : shownServices.reduce((n, s) => n + s.waiting, 0)}</em>
                        </button>
                        {isNurse && (
                            <button type="button" className={`status-chip-sc ${pendingOnly ? 'active-sc' : ''}`} aria-pressed={pendingOnly} onClick={() => setPendingOnly(true)}>
                                To review <em>{(currentService ? [currentService] : shownServices).reduce((n, s) => n + s.pending, 0)}</em>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {rows.length === 0 ? (
                <div className="group-empty-ds">
                    {pendingOnly ? 'No request waits for your review.'
                        : entries.length === 0 ? 'Nobody is in this advance listing.' : 'Nobody matches.'}
                </div>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead>
                            <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up service and reason</th><th>Registered</th><th>Status</th>{isNurse && !pastListing && <th>Actions</th>}</tr>
                        </thead>
                        <tbody>
                            {pageRows.map((e) => (
                                <tr key={e.entry_id}>
                                    <td>
                                        <strong className="queue-no-sc">{e.label || '-'}</strong>
                                        {e.status === 'Pending' && <div className="muted-ds">No number yet</div>}
                                    </td>
                                    <td>
                                        {fullName(e.student_first_name, e.student_last_name)}
                                        <div className="muted-ds">{e.student_id}{classLabel(e) ? ` - ${classLabel(e)}` : ''}</div>
                                    </td>
                                    <td className="reason-cell-sc"><strong>{e.visit_type}</strong><div>{e.reason}</div></td>
                                    <td>{formatDate(e.created_at)}</td>
                                    <td>
                                        <span className={`badge-ds ${STATUS_CLASS[e.status] || 'badge-expired-ds'}`}>{STATUS_TEXT[e.status] || e.status}</span>
                                        {e.queue_label && e.session_date && (
                                            <div className="muted-ds">Queue {e.queue_label}: {e.doctor_name}, {formatDate(e.session_date)}, {to12h(e.session_start)} - {to12h(e.session_end)}</div>
                                        )}
                                        {(e.status === 'Removed' || e.status === 'Denied') && e.remove_reason && <div className="muted-ds">{e.remove_reason}</div>}
                                    </td>
                                    {isNurse && !pastListing && (
                                        <td>
                                            {e.status === 'Pending' && (
                                                <div className="row-actions-sc">
                                                    <button type="button" className="sti-btn-dv sti-btn-primary-dv btn-sm-sc" disabled={busy || state.services.some((s) => s.visit_type === e.visit_type && s.listing_full)} onClick={() => accept(e)}
                                                        title="Accept: the student gets the next advance number of this service"><Check size={13} /> Accept</button>
                                                    <button type="button" className="icon-btn-ds" title="Decline this request" aria-label={`Decline the request of ${e.student_name}`} onClick={() => setDenyFor(e)}><XCircle size={14} /></button>
                                                </div>
                                            )}
                                            {e.status === 'Waiting' && (
                                                <button type="button" className="icon-btn-ds" title="Remove from the advance listing" aria-label={`Remove ${e.student_name} from the advance listing`} onClick={() => setRemoveFor(e)}><UserMinus size={14} /></button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Pager page={Math.min(page, pageCountOf(rows.length))} pageCount={pageCountOf(rows.length)} total={rows.length} pageSize={PAGE_SIZE} onPage={setPage} noun="students" />
                </div>
            )}
        </>
    );

    // ---- the overview (first view): the title, the status and one table row per check-up service ----
    const currentPanel = listServices.length === 0 ? (
        <div className="group-empty-ds">
            {!offeredAny && !shownServices.some((s) => s.registered > 0)
                ? (isNurse ? 'No check-up service is set yet. Open the advance listing and pick the services students can register for.' : 'The nurse has not set up the advance listing yet.')
                : 'Nobody is waiting in the advance listing. Students with a schedule are in the Session Listing.'}
        </div>
    ) : (
        <div className="table-card-dv">
            <table className="sti-table-dv">
                <caption className="sr-only">Check-up services of the advance listing</caption>
                <thead>
                    <tr><th>Check-up service</th><th>Listed</th><th>To review</th><th>Places left</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {pageOf(listServices, Math.min(servicePage, pageCountOf(listServices.length))).map((s) => {
                        const canSwitch = isNurse && s.offered && state.is_open && !s.scheduled;
                        return (
                            <tr key={s.visit_type}>
                                <td><strong>{s.visit_type}</strong>{!s.offered && <div className="muted-ds">Not offered now</div>}</td>
                                <td>
                                    <span className="advance-count-sc">{listedText(s)}</span>
                                    {s.listing_full && <div className="muted-ds">Full</div>}
                                </td>
                                <td>{s.pending}</td>
                                <td>{s.offered ? s.places_left : '-'}</td>
                                <td>
                                    <span className={`badge-ds ${SERVICE_STATUS_CLASS[s.status]}`}>{SERVICE_STATUS_TEXT[s.status]}</span>
                                </td>
                                <td>
                                    <div className="advance-actions-sc">
                                        {isNurse && (
                                            <button
                                                type="button" role="switch" aria-checked={s.status === 'Open'} className="switch-sc" disabled={busy || !canSwitch} onClick={() => toggleService(s)}
                                                aria-label={`${s.visit_type} advance listing: ${s.status === 'Open' ? 'open' : 'closed'}`}
                                                title={s.scheduled ? 'This service has a schedule: it moved to the Session Listing' : !state.is_open ? 'The advance listing is closed: open it in Settings' : s.status === 'Open' ? 'Close this service' : 'Open this service'}
                                            >
                                                <span className="switch-track-sc" aria-hidden="true" />
                                            </button>
                                        )}
                                        <button type="button" className="icon-btn-ds" onClick={() => openList(null, s.visit_type)} title="View list" aria-label={`View the ${s.visit_type} advance list`}>
                                            <Eye size={15} />
                                        </button>
                                        {isNurse && (
                                            <>
                                                <button type="button" className="icon-btn-ds" disabled={s.scheduled || s.pending === 0} onClick={() => openList(null, s.visit_type, true)}
                                                    title={s.scheduled ? 'Moved to the Session Listing' : s.pending === 0 ? 'No request to review' : 'Review requests'} aria-label={`Review the ${s.pending} request(s) of ${s.visit_type}`}>
                                                    <ClipboardCheck size={15} />
                                                </button>
                                                <button type="button" className="icon-btn-ds" disabled={!s.offered || s.scheduled} title={s.scheduled ? 'Moved to the Session Listing' : 'Configure limit'} aria-label={`Configure the listing limit of ${s.visit_type}`} onClick={() => setLimitFor(s)}><SlidersHorizontal size={15} /></button>
                                                <button type="button" className="icon-btn-ds" disabled={!s.offered || s.scheduled} title={s.scheduled ? 'It has a schedule: add the student in the Session Listing' : 'Add a student'} aria-label={`Add a student to ${s.visit_type}`} onClick={() => setAddFor(s.visit_type)}><UserPlus size={15} /></button>
                                                <button type="button" className="icon-btn-ds" disabled={s.scheduled || s.waiting === 0} aria-label={`Request a schedule for ${s.visit_type}`}
                                                    title={s.scheduled ? 'Moved to the Session Listing' : s.waiting === 0 ? 'Nobody is waiting for a schedule in this service' : 'Ask a doctor for a schedule for these students'} onClick={() => requestSchedule(s)}><Send size={15} /></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <Pager page={Math.min(servicePage, pageCountOf(listServices.length))} pageCount={pageCountOf(listServices.length)} total={listServices.length} pageSize={PAGE_SIZE} onPage={setServicePage} noun="services" />
        </div>
    );

    const pastPanel = history.length === 0 ? (
        <div className="group-empty-ds">No advance listing was closed yet. A listing moves here once it closes.</div>
    ) : (
        <div className="table-card-dv">
            <table className="sti-table-dv">
                <caption className="sr-only">Past advance listings</caption>
                <thead>
                    <tr><th>Title</th><th>Opened</th><th>Closed</th><th>Check-up services (registered/limit)</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {pageOf(history, Math.min(pastPage, pageCountOf(history.length))).map((l) => (
                        <tr key={l.listing_id}>
                            <td><strong>{l.title}</strong></td>
                            <td>{formatDateTime(l.opened_at)}</td>
                            <td>{formatDateTime(l.closed_at)}<div className="muted-ds">{CLOSE_REASON_TEXT[l.close_reason] || 'Closed'}</div></td>
                            <td>
                                <span className="advance-chips-sc">
                                    {l.services.map((s) => <span key={s.visit_type} className="badge-ds badge-expired-ds">{s.visit_type} {s.registered}/{s.listing_limit || '-'}</span>)}
                                </span>
                            </td>
                            <td>
                                <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => openList(l)}><Eye size={14} /> View list</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <Pager page={Math.min(pastPage, pageCountOf(history.length))} pageCount={pageCountOf(history.length)} total={history.length} pageSize={PAGE_SIZE} onPage={setPastPage} noun="listings" />
        </div>
    );

    const overview = (
        <>
            <div className="notify-bar-sc advance-head-sc" role="status">
                <div>
                    <strong className="advance-title-sc">{state.listing ? state.listing.title : 'No advance listing yet'}</strong>
                    <div className="advance-note-sc">
                        <span className={`badge-ds ${state.is_open ? 'badge-open-ds' : 'badge-expired-ds'}`}>Advance Listing <span className="paren-sc">(No Schedule Yet)</span>: {statusText.toLowerCase()}</span>
                        {state.is_open && state.closes_at && <span className="muted-ds">Closes {formatDateTime(state.closes_at)}</span>}
                    </div>
                </div>
                <div className="advance-actions-sc">
                    {isNurse && (
                        <>
                            <button type="button" className="sti-btn-dv sti-btn-secondary-dv btn-sm-sc" onClick={() => setSettingsOpen(true)}>
                                {state.is_open ? <><Settings2 size={14} /> Settings</> : <><DoorOpen size={14} /> Open advance listing</>}
                            </button>
                            {state.is_open && (
                                <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" disabled={busy} onClick={closeListing}><DoorClosed size={14} /> Close listing</button>
                            )}
                        </>
                    )}
                    <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh" onClick={load}><RefreshCw size={15} /></button>
                </div>
            </div>

            <div className="status-chips-sc" role="group" aria-label="Advance listings" style={{ marginBottom: 14 }}>
                <button type="button" className={`status-chip-sc ${panel === 'current' ? 'active-sc' : ''}`} aria-pressed={panel === 'current'} onClick={() => setPanel('current')}>Current listing</button>
                <button type="button" className={`status-chip-sc ${panel === 'past' ? 'active-sc' : ''}`} aria-pressed={panel === 'past'} onClick={() => setPanel('past')}>Past advance listings <em>{history.length}</em></button>
            </div>

            {panel === 'current' ? currentPanel : pastPanel}
        </>
    );

    return (
        <>
            {viewing ? listView : overview}

            <SettingsModal isOpen={settingsOpen} state={state} userId={userId} onClose={() => setSettingsOpen(false)} onSaved={changed} />
            <LimitModal isOpen={!!limitFor} service={limitFor ? state.services.find((s) => s.visit_type === limitFor.visit_type) || limitFor : null} userId={userId} onClose={() => setLimitFor(null)} onSaved={changed} />
            <AddStudentModal isOpen={addFor !== null} state={state} presetService={addFor || ''} userId={userId} onClose={() => setAddFor(null)} onSaved={changed} />
            <ScheduleRequestModal
                isOpen={!!requestPreset} preset={requestPreset} doctors={doctors} nurseId={nurseId} userId={userId}
                onClose={() => setRequestPreset(null)} onSent={changed}
            />
            <ReasonModal
                isOpen={!!denyFor} title="Decline the Advance Listing request" confirmLabel="Decline" danger label="Reason (shown to the student)"
                message={denyFor ? `${fullName(denyFor.student_first_name, denyFor.student_last_name)} - ${denyFor.visit_type}: ${denyFor.reason}` : ''}
                placeholder="e.g. Please see the nurse first for a basic check-up" onSubmit={deny} onClose={() => setDenyFor(null)}
            />
            <ReasonModal
                isOpen={!!removeFor} title="Remove from the Advance Listing (No Schedule Yet)" confirmLabel="Remove" danger label="Reason (shown to the student)"
                message={removeFor ? `${fullName(removeFor.student_first_name, removeFor.student_last_name)} - ${removeFor.visit_type} (${removeFor.label || ''})` : ''}
                placeholder="e.g. Please see the nurse first for a basic check-up" onSubmit={remove} onClose={() => setRemoveFor(null)}
            />
        </>
    );
};

export default AdvanceListing;
