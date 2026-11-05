// AdvanceListing.jsx (first half of the "Listings" tab of the scheduling hub)
// The advance listing needs no schedule: the nurse opens it with a title (e.g. "Advance listing for next month"), picks the check-up services and the limit
// of each, and it stays open until a closing time or until she closes it. Students register for one service and get an advance number (A1, A2 ... per
// service). The overview is a table with one row per check-up service (listed 1/10, requests to review, waiting for a schedule, status) and its actions:
// open / close the service, view its list, review the requests, configure the limit, add a student, request a schedule. For a service the nurse sends a
// schedule request to a doctor (it carries the number of waiting students). When the doctor sets the schedule, those students take the first queue numbers
// of the session and the places left of its listing limit are opened for the students who are not in the advance listing. A service that has a schedule
// closes here by itself and moves to the Session Listing. The past advance listings stay viewable. The doctor sees the same lists, read only, limited to the check-up services that doctor covers (a dentist only sees Dental).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings2,RefreshCw, Search, Send, UserMinus, UserPlus, Check, XCircle, Eye, ClipboardCheck, SlidersHorizontal, ArrowLeft, ArrowRightLeft, Scissors, Archive, Plus } from 'lucide-react';
import Modal from '../common/Modal';
import ConfirmModal from '../common/ConfirmModal';
import { Pager } from '../common/RecordFolders';
import { ReasonModal, StudentPicker } from '../doctor/AppointmentModals';
import { ScheduleRequestModal, usePendingScheduleRequests } from './ScheduleRequests';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { fullName } from '../../utils/visitPurpose';
import { API, to12h, coveredTypes, classLabel } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const STATUS_CLASS = {
    Pending: 'badge-pending-ds', Denied: 'badge-closed-ds', Waiting: 'badge-pending-ds', Scheduled: 'badge-open-ds', Done: 'badge-open-ds', Ended: 'badge-expired-ds',
    'No show': 'badge-closed-ds', Cutoff: 'badge-closed-ds', Moved: 'badge-expired-ds', Withdrawn: 'badge-closed-ds', Removed: 'badge-closed-ds'
};
const STATUS_TEXT = {
    Pending: 'To review', Denied: 'Declined', Waiting: 'Waiting', Scheduled: 'Queued', Done: 'Seen', Ended: 'Ended', 'No show': 'No show',
    Cutoff: 'Cut off', Moved: 'Moved', Withdrawn: 'Left', Removed: 'Removed'
};
const SERVICE_STATUS_CLASS = { Open: 'badge-open-ds', Closed: 'badge-closed-ds', Scheduled: 'badge-expired-ds', Done: 'badge-done-ds' };
const SERVICE_STATUS_TEXT = { Open: 'Open', Closed: 'Closed', Scheduled: 'Scheduled', Done: 'Done' };
const CLOSE_REASON_TEXT = { manual: 'Closed by nurse', time: 'Time was up', scheduled: 'All scheduled', dropped: 'Dropped' };

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
    const [busy, setBusy] = useState(false);
    const fail = (message) => showAlert(message, 'error');

    useEffect(() => {
        if (!isOpen || !state) return;
        const next = {};
        state.services.filter((s) => s.offered).forEach((s) => { next[s.visit_type] = String(s.listing_limit); });
        // a batch that still runs is opened again with its own title; a new batch (the last one is complete) starts with an empty title
        setTitle((state.is_open || state.batch_running) && state.listing ? state.listing.title : '');
        setPicked(next);
        setUntil(!!state.is_open && !!state.closes_at);
        setClosesAt(state.is_open && state.closes_at ? String(state.closes_at).replace(' ', 'T').slice(0, 16) : '');
        setBusy(false);
    }, [isOpen, state]);

    if (!state) return null;
    const registeredOf = (t) => (state.services.find((s) => s.visit_type === t) || {}).registered || 0;
    const cutoffOf = (t) => (state.services.find((s) => s.visit_type === t) || {}).cutoff || 0;
    const toggle = (t, on) => setPicked((p) => { const next = { ...p }; if (on) next[t] = next[t] || '30'; else delete next[t]; return next; });

    const submit = async (e) => {
        e.preventDefault();
        const services = Object.entries(picked).map(([visit_type, listing_limit]) => ({ visit_type, listing_limit: Number(listing_limit) }));
        if (!title.trim()) { fail('Enter a title.'); return; }
        if (services.length === 0) { fail('Pick at least one check-up service.'); return; }
        if (services.some((s) => !Number.isInteger(s.listing_limit) || s.listing_limit < 1 || s.listing_limit > 500)) { fail('Each limit must be 1 to 500.'); return; }
        if (until && !closesAt) { fail('Pick the closing date and time.'); return; }
        setBusy(true);
        let data;
        try {
            data = await send('/api/advance-listing', 'PUT', { sender_id: userId, is_open: true, title: title.trim(), closes_at: until ? closesAt : '', services });
        } catch (err) {
            data = { message: 'Could not reach the server.' };
        }
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else fail(data.message || 'Could not save.');
    };

    return (
        <Modal
            isOpen={isOpen} onClose={onClose} icon={<Settings2 size={20} />} size="md" closeOnBackdrop={false}
            title={state.is_open ? 'Advance Listing settings' : state.batch_running ? 'Open Advance Listing' : 'New Advance Listing'}
        >
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-field">
                    <label htmlFor="adv-title">Title</label>
                    <input
                        id="adv-title" className="dp-input" type="text" maxLength={120} value={title} placeholder="Advance listing for next month"
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                <fieldset className="dp-field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontWeight: 600, marginBottom: 6 }}>Check-up services and limit</legend>
                    {state.eligible.length === 0 && <small className="dp-hint">No check-up service available.</small>}
                    <div className="advance-services-sc">
                        {state.eligible.map((t) => {
                            const on = Object.prototype.hasOwnProperty.call(picked, t);
                            return (
                                <div key={t} className="advance-service-row-sc">
                                    <label className="dp-check"><input type="checkbox" checked={on} onChange={(e) => toggle(t, e.target.checked)} /> {t}</label>
                                    <label className="advance-limit-sc">
                                        <span>Limit</span>
                                        <input
                                            className="dp-input" type="number" min={Math.max(1, registeredOf(t))} max={500} disabled={!on}
                                            value={on ? picked[t] : ''} aria-label={`Listing limit for ${t}`}
                                            onChange={(e) => setPicked((p) => ({ ...p, [t]: e.target.value }))}
                                        />
                                    </label>
                                    {registeredOf(t) > 0 && <small className="dp-hint">{registeredOf(t)} registered</small>}
                                    {!state.is_open && !state.batch_running && cutoffOf(t) > 0 && <small className="dp-hint">{cutoffOf(t)} cut off</small>}
                                </div>
                            );
                        })}
                    </div>
                </fieldset>

                <fieldset className="dp-field" style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontWeight: 600, marginBottom: 6 }}>Stays open</legend>
                    <label className="dp-check"><input type="radio" name="adv-duration" checked={!until} onChange={() => setUntil(false)} /> Until I close it</label>
                    <label className="dp-check"><input type="radio" name="adv-duration" checked={until} onChange={() => setUntil(true)} /> Until a date</label>
                    <input
                        className="dp-input" type="datetime-local" min={localNow()} disabled={!until} value={closesAt} aria-label="Closing date and time"
                        onChange={(e) => setClosesAt(e.target.value)}
                    />
                </fieldset>

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : state.is_open ? 'Save' : state.batch_running ? 'Open' : 'Create'}</button>
                </div>
            </form>
        </Modal>
    );
};

// The limit of one service
const LimitModal = ({ isOpen, service, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const [limit, setLimit] = useState('');
    const [busy, setBusy] = useState(false);
    const fail = (message) => showAlert(message, 'error');

    useEffect(() => {
        if (!isOpen || !service) return;
        setLimit(String(service.listing_limit || ''));
        setBusy(false);
    }, [isOpen, service]);

    if (!service) return null;

    const submit = async (e) => {
        e.preventDefault();
        const value = Number(limit);
        if (!Number.isInteger(value) || value < 1 || value > 500) { fail('The limit must be 1 to 500.'); return; }
        if (value < service.registered) { fail(`The limit cannot be below ${service.registered} registered.`); return; }
        setBusy(true);
        let data;
        try {
            data = await send(`/api/advance-listing/services/${encodeURIComponent(service.visit_type)}`, 'PUT', { sender_id: userId, listing_limit: value });
        } catch (err) {
            data = { message: 'Could not reach the server.' };
        }
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else fail(data.message || 'Could not change the limit.');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Limit: ${service.visit_type}`} icon={<SlidersHorizontal size={20} />} size="sm" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-field">
                    <label htmlFor="adv-limit">Limit ({service.registered} registered)</label>
                    <input id="adv-limit" className="dp-input" type="number" min={Math.max(1, service.registered)} max={500} value={limit} onChange={(e) => setLimit(e.target.value)} />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
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
    const [busy, setBusy] = useState(false);
    const fail = (message) => showAlert(message, 'error');

    useEffect(() => {
        if (!isOpen) return;
        setStudent(null);
        setVisitType(presetService || '');
        setReason('');
        setBusy(false);
    }, [isOpen, presetService]);

    const offered = state ? state.services.filter((s) => s.offered) : [];

    const submit = async (e) => {
        e.preventDefault();
        if (!student) { fail('Choose the student.'); return; }
        if (!visitType) { fail('Pick the check-up service.'); return; }
        if (!reason.trim()) { fail('Enter the reason.'); return; }
        setBusy(true);
        let data;
        try {
            data = await send('/api/advance-listing/entries', 'POST', { sender_id: userId, student_id: student.student_id, visit_type: visitType, reason: reason.trim() });
        } catch (err) {
            data = { message: 'Could not reach the server.' };
        }
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else fail(data.message || 'Could not add the student.');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add a student" icon={<UserPlus size={20} />} size="md" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <StudentPicker value={student} onChange={setStudent} />
                <div className="dp-field">
                    <label htmlFor="adv-add-service">Check-up service</label>
                    <select id="adv-add-service" className="dp-select" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
                        <option value="">-- Select --</option>
                        {offered.map((s) => <option key={s.visit_type} value={s.visit_type} disabled={s.listing_full || s.scheduled}>{s.visit_type} ({s.scheduled ? 'scheduled' : `${s.registered}/${s.listing_limit}${s.listing_full ? ', full' : ''}`})</option>)}
                    </select>
                </div>
                <div className="dp-field">
                    <label htmlFor="adv-add-reason">Reason</label>
                    <textarea id="adv-add-reason" className="dp-textarea" rows={2} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Adding...' : 'Add'}</button>
                </div>
            </form>
        </Modal>
    );
};

const AdvanceListing = ({ isNurse, doctors, nurseId, userId, refreshKey, onChanged }) => {
    const { showAlert, showConfirm } = useAlert();
    const [state, setState] = useState(null);
    const [history, setHistory] = useState([]);
    const [entries, setEntries] = useState([]);
    const [cutoffEntries, setCutoffEntries] = useState([]); // students over a doctor's listing limit, waiting to move to a new advance listing (any batch)
    const [loading, setLoading] = useState(true);
    const [panel, setPanel] = useState('current'); // current | past
    const [viewing, setViewing] = useState(null); // null = the overview, { listing } = the list of students (listing = a past listing, or null for the current one)
    const [service, setService] = useState('all');
    const [tab, setTab] = useState('list'); // list | review | cutoff
    const pendingOnly = tab === 'review';
    const cutoffTab = tab === 'cutoff';
    const [page, setPage] = useState(1);
    const [servicePage, setServicePage] = useState(1);
    const [pastPage, setPastPage] = useState(1);
    const [search, setSearch] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [dropOpen, setDropOpen] = useState(false);
    const [addFor, setAddFor] = useState(null); // service name to preset ('' = none) while the add modal is open
    const [limitFor, setLimitFor] = useState(null);
    const [requestPreset, setRequestPreset] = useState(null);
    // services that already have a pending schedule request: asking again is disabled (no double request)
    const pendingRequests = usePendingScheduleRequests(`${refreshKey}-${requestPreset ? 'open' : 'closed'}`);
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
            const [stateRes, historyRes, entryRes, cutoffRes] = await Promise.all([
                fetch(`${API}/api/advance-listing`),
                fetch(`${API}/api/advance-listing/history`),
                fetch(entryUrl),
                fetch(`${API}/api/advance-listing/entries?scope=cutoff`)
            ]);
            const stateData = await stateRes.json();
            const historyData = await historyRes.json();
            const entryData = await entryRes.json();
            const cutoffData = await cutoffRes.json();
            if (stateData.success) setState(stateData);
            if (historyData.success) setHistory(historyData.listings.map((l) => ({ ...l, services: l.services.filter((x) => visible(x.visit_type)) })).filter((l) => l.services.length > 0));
            if (entryData.success) setEntries(entryData.entries);
            if (cutoffData.success) setCutoffEntries(cutoffData.entries);
        } catch (e) {
            showAlert('Could not load the advance listing.', 'error');
        } finally {
            setLoading(false);
        }
    }, [listingId, showAlert, visible]);

    useEffect(() => { load(); }, [load, refreshKey]);

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        // the cut off tab lists the students cut off in any batch; the other tabs list the batch in view
        const source = cutoffTab && !listingId ? cutoffEntries : entries;
        return source.filter((e) => visible(e.visit_type) && (isNurse || e.status !== 'Pending') && (!pendingOnly || e.status === 'Pending')
            && (!(cutoffTab && !listingId) || e.status === 'Cutoff')
            && (service === 'all' || e.visit_type === service)
            && (!q || `${e.student_name} ${e.student_id} ${e.reason} ${e.label}`.toLowerCase().includes(q)));
    }, [entries, cutoffEntries, service, search, isNurse, pendingOnly, cutoffTab, listingId, visible]);

    // back to the first page when the list in view changes
    useEffect(() => { setPage(1); }, [service, search, tab, listingId, viewing]);
    const pageRows = pageOf(rows, Math.min(page, pageCountOf(rows.length)));

    const changed = () => { load(); if (onChanged) onChanged(); };

    // the entries reload by themselves only when the listing in view changes, so they are cleared only then (clearing them for the same listing left the list empty)
    const openList = (listing, visitType = 'all', startTab = 'list') => {
        if (listing || listingId) setEntries([]);
        setSearch('');
        setService(listing && visitType === 'all' ? (listing.services.find((x) => x.requests > 0) || {}).visit_type || 'all' : visitType);
        setTab(startTab === true ? 'review' : startTab || 'list');
        setViewing({ listing });
    };
    const backToOverview = () => { if (listingId) setEntries([]); setViewing(null); setTab('list'); setService('all'); };

    // the nurse moves cut off students to the advance listing that is open now
    const moveCutoff = async (list) => {
        if (list.length === 0) return;
        if (!state.is_open) { showAlert('Open an advance listing first.', 'warning'); return; }
        if (!(await showConfirm(list.length === 1 ? 'Move this student to the open advance listing?' : `Move ${list.length} students to the open advance listing?`, { title: 'Move students', confirmLabel: 'Move' }))) return;
        setBusy(true);
        try {
            const data = await send('/api/advance-listing/cutoff/move', 'PUT', { sender_id: userId, entry_ids: list.map((e) => e.entry_id) });
            showAlert(data.message || (data.success ? 'Moved.' : 'Could not move the students.'), data.success ? 'success' : 'error');
            if (data.success) changed();
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    // the slider of the whole listing: closing asks first, opening again goes through the settings (title, services, limits)
    const switchListing = async () => {
        if (!state.is_open) { setSettingsOpen(true); return; }
        if (!(await showConfirm('Close registration? Registered students keep their number.', { title: 'Close advance listing', confirmLabel: 'Close', danger: true }))) return;
        closeListing();
    };

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

    // drop the current advance listing: it moves to the past advance listings (every check-up service must be closed first)
    const askDrop = () => {
        if (openServices.length > 0) { showAlert(`Close these services first: ${openServices.join(', ')}.`, 'warning'); return; }
        setDropOpen(true);
    };

    const dropListing = async () => {
        setDropOpen(false);
        setBusy(true);
        try {
            const data = await send('/api/advance-listing/drop', 'PUT', { sender_id: userId });
            if (data.success) { showAlert(data.message, 'success'); setPanel('current'); changed(); } else showAlert(data.message || 'Could not drop the advance listing.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleService = async (svc) => {
        const closing = svc.status === 'Open';
        if (!(await showConfirm(`${closing ? 'Close' : 'Open'} the ${svc.visit_type} advance listing?`, { title: closing ? 'Close service' : 'Open service', confirmLabel: closing ? 'Close' : 'Open', danger: closing }))) return;
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
        if (state.services.some((s) => s.visit_type === e.visit_type && s.listing_full)) { showAlert(`The ${e.visit_type} listing is full.`, 'warning'); return; }
        if (!(await showConfirm(`Accept ${fullName(e.student_first_name, e.student_last_name)} for ${e.visit_type}?`, { title: 'Accept request', confirmLabel: 'Accept' }))) return;
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

    // a button that cannot act says why in a warning modal instead of staying dead
    const warnIf = (message, action) => () => { if (message) showAlert(message, 'warning'); else action(); };

    if (loading) return <div className="loading-dv">Loading the advance listing...</div>;
    if (!state) return <div className="group-empty-ds">The advance listing could not be loaded.</div>;

    // no current advance listing = none was created yet, or the last one is complete / dropped (it is in the past advance listings)
    const hasCurrent = state.batch_running;
    const openServices = state.services.filter((s) => s.offered && s.status === 'Open').map((s) => s.visit_type);
    const shownServices = state.services.filter((s) => visible(s.visit_type));
    const listServices = shownServices.filter((s) => s.offered || s.waiting > 0 || s.pending > 0 || s.cutoff > 0);
    const cutoffCount = shownServices.reduce((n, s) => n + s.cutoff, 0);
    const offeredAny = shownServices.some((s) => s.offered);
    const currentService = service === 'all' ? null : shownServices.find((s) => s.visit_type === service) || null;

    // ---- the list of students (second view): the toolbar and the table only ----
    const listView = (
        <>
            <div className="list-head-sc">
                <button type="button" className="icon-btn-ds" onClick={backToOverview} title="Back" aria-label="Back to the advance listing"><ArrowLeft size={16} /></button>
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
                        <button type="button" className={`status-chip-sc ${tab === 'list' ? 'active-sc' : ''}`} aria-pressed={tab === 'list'} onClick={() => setTab('list')}>
                            Advance list <em>{currentService ? currentService.waiting : shownServices.reduce((n, s) => n + s.waiting, 0)}</em>
                        </button>
                        {isNurse && (
                            <button type="button" className={`status-chip-sc ${tab === 'review' ? 'active-sc' : ''}`} aria-pressed={tab === 'review'} onClick={() => setTab('review')}>
                                To review <em>{(currentService ? [currentService] : shownServices).reduce((n, s) => n + s.pending, 0)}</em>
                            </button>
                        )}
                        <button type="button" className={`status-chip-sc ${tab === 'cutoff' ? 'active-sc' : ''}`} aria-pressed={tab === 'cutoff'} onClick={() => setTab('cutoff')}>
                            Cut off <em>{(currentService ? [currentService] : shownServices).reduce((n, s) => n + s.cutoff, 0)}</em>
                        </button>
                    </div>
                )}
                {isNurse && cutoffTab && !pastListing && rows.length > 0 && (
                    <button
                        type="button" className="icon-btn-ds" disabled={busy} onClick={() => moveCutoff(rows)}
                        title={`Move all (${rows.length})`} aria-label={`Move all ${rows.length} cut off students to the open advance listing`}
                    >
                        <ArrowRightLeft size={16} />
                    </button>
                )}
            </div>

            {rows.length === 0 ? (
                <div className="group-empty-ds">
                    {pendingOnly ? 'No requests to review.'
                        : cutoffTab && !pastListing ? 'Nobody is cut off.'
                            : entries.length === 0 ? 'Nobody listed.' : 'No match.'}
                </div>
            ) : (
                <div className="table-card-dv">
                    <table className="sti-table-dv">
                        <thead>
                            <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up service and reason</th><th>{cutoffTab && !pastListing ? 'Cut off' : 'Registered'}</th><th>Status</th>{isNurse && !pastListing && <th>Actions</th>}</tr>
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
                                    <td>
                                        {cutoffTab && !pastListing && e.cutoff_date ? formatDate(e.cutoff_date) : formatDate(e.created_at)}
                                        {e.listing_title && <div className="muted-ds">{e.listing_title}</div>}
                                    </td>
                                    <td>
                                        <span className={`badge-ds ${STATUS_CLASS[e.status] || 'badge-expired-ds'}`}>{STATUS_TEXT[e.status] || e.status}</span>
                                        {e.queue_label && e.session_date && (
                                            <div className="muted-ds">{e.queue_label}: {e.doctor_name}, {formatDate(e.session_date)}, {to12h(e.session_start)} - {to12h(e.session_end)}</div>
                                        )}
                                        {(e.status === 'Removed' || e.status === 'Denied') && e.remove_reason && <div className="muted-ds">{e.remove_reason}</div>}
                                    </td>
                                    {isNurse && !pastListing && (
                                        <td>
                                            {e.status === 'Pending' && (
                                                <div className="row-actions-sc">
                                                    <button type="button" className="icon-btn-ds" disabled={busy} onClick={() => accept(e)}
                                                        title="Accept" aria-label={`Accept the request of ${e.student_name}`}><Check size={15} /></button>
                                                    <button type="button" className="icon-btn-ds" title="Decline" aria-label={`Decline the request of ${e.student_name}`} onClick={() => setDenyFor(e)}><XCircle size={15} /></button>
                                                </div>
                                            )}
                                            {e.status === 'Cutoff' && (
                                                <div className="row-actions-sc">
                                                    <button type="button" className="icon-btn-ds" disabled={busy} onClick={() => moveCutoff([e])}
                                                        title="Move" aria-label={`Move ${e.student_name} to the open advance listing`}><ArrowRightLeft size={15} /></button>
                                                    <button type="button" className="icon-btn-ds" title="Remove" aria-label={`Remove ${e.student_name} from the advance listing`} onClick={() => setRemoveFor(e)}><UserMinus size={15} /></button>
                                                </div>
                                            )}
                                            {e.status === 'Waiting' && (
                                                <button type="button" className="icon-btn-ds" title="Remove" aria-label={`Remove ${e.student_name} from the advance listing`} onClick={() => setRemoveFor(e)}><UserMinus size={15} /></button>
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
    const currentPanel = !hasCurrent ? (
        <div className="group-empty-ds">
            <p>No current advance listing.</p>
            {isNurse && (
                <button type="button" className="icon-btn-ds" onClick={() => setSettingsOpen(true)} title="New advance listing" aria-label="Create a new advance listing"><Plus size={16} /></button>
            )}
        </div>
    ) : listServices.length === 0 ? (
        <div className="group-empty-ds">
            {!offeredAny && !shownServices.some((s) => s.registered > 0) ? 'No check-up service set.' : 'Nobody is waiting.'}
        </div>
    ) : (
        <div className="table-card-dv">
            <table className="sti-table-dv">
                <caption className="sr-only">Check-up services of the advance listing</caption>
                <thead>
                    <tr><th>Check-up service</th><th>Listed</th><th>To review</th><th>Cut off</th><th>Places left</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {pageOf(listServices, Math.min(servicePage, pageCountOf(listServices.length))).map((s) => {
                        const isDone = s.status === 'Done';
                        const canSwitch = isNurse && s.offered && state.is_open && !s.scheduled && !isDone;
                        return (
                            <tr key={s.visit_type}>
                                <td><strong>{s.visit_type}</strong>{!s.offered && <div className="muted-ds">Not offered</div>}</td>
                                <td>
                                    <span className="advance-count-sc">{listedText(s)}</span>
                                    {s.listing_full && <div className="muted-ds">Full</div>}
                                </td>
                                <td>{s.pending}</td>
                                <td>
                                    {s.cutoff > 0 ? (
                                        <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => openList(null, s.visit_type, 'cutoff')} aria-label={`View the ${s.cutoff} cut off student(s) of ${s.visit_type}`}>
                                            <Scissors size={13} /> {s.cutoff}
                                        </button>
                                    ) : 0}
                                </td>
                                <td>{s.offered ? s.places_left : '-'}</td>
                                <td>
                                    <span className={`badge-ds ${SERVICE_STATUS_CLASS[s.status]}`}>{SERVICE_STATUS_TEXT[s.status]}</span>
                                </td>
                                <td>
                                    <div className="advance-actions-sc">
                                        {isNurse && (
                                            <button
                                                type="button" role="switch" aria-checked={s.status === 'Open'} className="switch-sc" disabled={busy || isDone} aria-disabled={!canSwitch}
                                                onClick={warnIf(!canSwitch ? (s.scheduled ? 'This service has a schedule. Use the Session Listing.' : s.status === 'Done' ? 'This service is done.' : !s.offered ? 'This service is not offered.' : 'The advance listing is closed. Open it first.') : '', () => toggleService(s))}
                                                aria-label={`${s.visit_type} advance listing: ${s.status === 'Open' ? 'open' : 'closed'}`}
                                                title={s.status === 'Open' ? 'Close' : 'Open'}
                                            >
                                                <span className="switch-track-sc" aria-hidden="true" />
                                            </button>
                                        )}
                                        <button type="button" className="icon-btn-ds" onClick={() => openList(null, s.visit_type)} title="View list" aria-label={`View the ${s.visit_type} advance list`}>
                                            <Eye size={15} />
                                        </button>
                                        {isNurse && (
                                            <>
                                                <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={s.scheduled || s.pending === 0} onClick={warnIf(s.scheduled ? 'This service has a schedule. Use the Session Listing.' : s.pending === 0 ? 'No requests to review.' : '', () => openList(null, s.visit_type, 'review'))}
                                                    title="Review requests" aria-label={`Review the ${s.pending} request(s) of ${s.visit_type}`}>
                                                    <ClipboardCheck size={15} />
                                                </button>
                                                <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={!s.offered || s.scheduled} title="Limit" aria-label={`Configure the listing limit of ${s.visit_type}`} onClick={warnIf(s.scheduled ? 'This service has a schedule. Use the Session Listing.' : !s.offered ? 'This service is not offered.' : '', () => setLimitFor(s))}><SlidersHorizontal size={15} /></button>
                                                <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={!s.offered || s.scheduled} title="Add a student" aria-label={`Add a student to ${s.visit_type}`} onClick={warnIf(s.scheduled ? 'This service has a schedule. Add the student in the Session Listing.' : !s.offered ? 'This service is not offered.' : '', () => setAddFor(s.visit_type))}><UserPlus size={15} /></button>
                                                {(() => {
                                                    const asked = pendingRequests.advanceServices.has(s.visit_type);
                                                    const why = s.scheduled ? 'This service has a schedule already.' : asked ? 'A schedule request for this service is already pending. Wait for the doctor to answer it.' : s.waiting === 0 ? 'Nobody is waiting in this service.' : '';
                                                    return (
                                                        <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={!!why} aria-label={`Request a schedule for ${s.visit_type}${asked ? ' (already requested)' : ''}`}
                                                            title={asked ? 'Schedule already requested' : 'Request a schedule'} onClick={warnIf(why, () => requestSchedule(s))}><Send size={15} /></button>
                                                    );
                                                })()}
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
        <div className="group-empty-ds">No past advance listings.</div>
    ) : (
        <div className="table-card-dv">
            <table className="sti-table-dv">
                <caption className="sr-only">Past advance listings</caption>
                <thead>
                    <tr><th>Title</th><th>Opened</th><th>Completed</th><th>Check-up services (registered/limit)</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {pageOf(history, Math.min(pastPage, pageCountOf(history.length))).map((l) => (
                        <tr key={l.listing_id}>
                            <td><strong>{l.title}</strong></td>
                            <td>{formatDateTime(l.opened_at)}</td>
                            <td>{formatDateTime(l.completed_at || l.closed_at)}<div className="muted-ds">{CLOSE_REASON_TEXT[l.close_reason] || 'Registration closed'}</div></td>
                            <td>
                                <span className="advance-chips-sc">
                                    {l.services.map((s) => <span key={s.visit_type} className="badge-ds badge-expired-ds">{s.visit_type} {s.registered}/{s.listing_limit || '-'}</span>)}
                                </span>
                            </td>
                            <td>
                                <button type="button" className="icon-btn-ds" onClick={() => openList(l)} title="View list" aria-label={`View the list of ${l.title}`}><Eye size={15} /></button>
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
                    <strong className="advance-title-sc">{hasCurrent ? state.listing.title : 'No current advance listing'}</strong>
                    <div className="advance-note-sc">
                        {hasCurrent && isNurse && (
                            <button
                                type="button" role="switch" aria-checked={!!state.is_open} className="switch-sc" disabled={busy} onClick={switchListing}
                                aria-label={`Advance listing: ${state.is_open ? 'open' : 'closed'}`} title={state.is_open ? 'Close' : 'Open'}
                            >
                                <span className="switch-track-sc" aria-hidden="true" />
                                <span>{state.is_open ? 'Open' : 'Closed'}</span>
                            </button>
                        )}
                        {hasCurrent && !isNurse && <span className={`badge-ds ${state.is_open ? 'badge-open-ds' : 'badge-closed-ds'}`}>{state.is_open ? 'Open' : 'Closed'}</span>}
                        {hasCurrent && state.is_open && state.closes_at && <span className="muted-ds">Until {formatDateTime(state.closes_at)}</span>}
                        {hasCurrent && <span className="muted-ds">{state.batch_done_services}/{state.batch_services} done</span>}
                    </div>
                </div>
                <div className="advance-actions-sc">
                    {isNurse && (
                        <>
                            {hasCurrent && state.is_open && (
                                <button type="button" className="icon-btn-ds" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Advance listing settings"><Settings2 size={16} /></button>
                            )}
                            {hasCurrent && (
                                <button type="button" className="icon-btn-ds" aria-disabled={openServices.length > 0} disabled={busy} onClick={askDrop} title="Drop" aria-label="Drop the current advance listing"><Archive size={16} /></button>
                            )}
                            {!hasCurrent && (
                                <button type="button" className="icon-btn-ds" onClick={() => setSettingsOpen(true)} title="New advance listing" aria-label="Create a new advance listing"><Plus size={16} /></button>
                            )}
                        </>
                    )}
                    <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh" onClick={load}><RefreshCw size={15} /></button>
                </div>
            </div>

            <div className="status-chips-sc" role="group" aria-label="Advance listings" style={{ marginBottom: 14 }}>
                <button type="button" className={`status-chip-sc ${panel === 'current' ? 'active-sc' : ''}`} aria-pressed={panel === 'current'} onClick={() => setPanel('current')}>Current listing</button>
                <button type="button" className={`status-chip-sc ${panel === 'past' ? 'active-sc' : ''}`} aria-pressed={panel === 'past'} onClick={() => setPanel('past')}>Past advance listings <em>{history.length}</em></button>
                <button type="button" className="status-chip-sc" onClick={() => openList(null, 'all', 'cutoff')}>Cut off students <em>{cutoffCount}</em></button>
            </div>

            {panel === 'current' ? currentPanel : pastPanel}
        </>
    );

    return (
        <>
            {viewing ? listView : overview}

            <ConfirmModal
                isOpen={dropOpen} danger title="Drop advance listing" confirmLabel="Drop" onCancel={() => setDropOpen(false)} onConfirm={dropListing}
                message={`Drop "${state.listing ? state.listing.title : ''}"? Waiting students go to the Cut off list.`}
            />
            <SettingsModal isOpen={settingsOpen} state={state} userId={userId} onClose={() => setSettingsOpen(false)} onSaved={changed} />
            <LimitModal isOpen={!!limitFor} service={limitFor ? state.services.find((s) => s.visit_type === limitFor.visit_type) || limitFor : null} userId={userId} onClose={() => setLimitFor(null)} onSaved={changed} />
            <AddStudentModal isOpen={addFor !== null} state={state} presetService={addFor || ''} userId={userId} onClose={() => setAddFor(null)} onSaved={changed} />
            <ScheduleRequestModal
                isOpen={!!requestPreset} preset={requestPreset} doctors={doctors} nurseId={nurseId} userId={userId}
                onClose={() => setRequestPreset(null)} onSent={changed}
            />
            <ReasonModal
                isOpen={!!denyFor} title="Decline request" confirmLabel="Decline" danger label="Reason"
                message={denyFor ? `${fullName(denyFor.student_first_name, denyFor.student_last_name)} - ${denyFor.visit_type}: ${denyFor.reason}` : ''}
                placeholder="e.g. Please see the nurse first for a basic check-up" onSubmit={deny} onClose={() => setDenyFor(null)}
            />
            <ReasonModal
                isOpen={!!removeFor} title="Remove student" confirmLabel="Remove" danger label="Reason"
                message={removeFor ? `${fullName(removeFor.student_first_name, removeFor.student_last_name)} - ${removeFor.visit_type} (${removeFor.label || ''})` : ''}
                placeholder="e.g. Please see the nurse first for a basic check-up" onSubmit={remove} onClose={() => setRemoveFor(null)}
            />
        </>
    );
};

export default AdvanceListing;
