// AdvanceListing.jsx (first half of the "Listings" tab of the scheduling hub)
// The advance listing needs no schedule. EVERY check-up service has its own advance listing: the nurse creates one for ONE service with a title (e.g.
// "Dental advance listing for next month"), a limit and a closing time (or until she closes it). The listings of different services are open at the same
// time; a service can have a new listing only after its last one is closed and the nurse dropped it. Students register for one service and get an
// advance number (A1, A2 ... per service). The overview is a table with one row per listing (listed 1/10, requests to review, waiting for a schedule,
// status) and its actions: open / close it, view its list, review the requests, settings, add a student, request a schedule, drop it. For a service the nurse sends a
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
import { API, to12h, coveredTypes, classLabel, CUTOFF_KINDS, cutoffKindLabel } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/doctor/DoctorLayout.css';
import '../../styles/scheduling/Scheduling.css';

const STATUS_CLASS = {
    Pending: 'badge-pending-ds', Denied: 'badge-closed-ds', Waiting: 'badge-pending-ds', Scheduled: 'badge-open-ds', Done: 'badge-open-ds', Ended: 'badge-expired-ds',
    'No show': 'badge-closed-ds', Cutoff: 'badge-closed-ds', Moved: 'badge-expired-ds', Withdrawn: 'badge-closed-ds', Removed: 'badge-closed-ds'
};
const STATUS_TEXT = {
    Pending: 'To review', Denied: 'Declined', Waiting: 'Waiting', Scheduled: 'Queued', Done: 'Completed', Ended: 'Ended', 'No show': 'No show',
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
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Manila' }).slice(0, 16).replace(' ', 'T');
};

// "1/10" of a service: registered / listing limit
const listedText = (s) => `${s.registered}/${s.listing_limit || '-'}`;

// New advance listing (service = null) or the settings of one (service = its row): ONE check-up service per listing, with its own title, limit and
// closing time. The listings of different services run at the same time; a service can have a new one only when it has none (its last one was dropped).
const ListingModal = ({ isOpen, state, service, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const [visitType, setVisitType] = useState('');
    const [title, setTitle] = useState('');
    const [limit, setLimit] = useState('30');
    const [until, setUntil] = useState(false);
    const [closesAt, setClosesAt] = useState('');
    const [busy, setBusy] = useState(false);
    const fail = (message) => showAlert(message, 'error');
    const editing = !!service;
    const isOpenNow = editing && service.status === 'Open';

    // services a doctor covers that have no current advance listing yet
    const available = state ? state.eligible.filter((t) => !state.services.some((s) => s.visit_type === t && s.offered)) : [];

    useEffect(() => {
        if (!isOpen || !state) return;
        if (service) {
            setVisitType(service.visit_type);
            setTitle(service.title || '');
            setLimit(String(service.listing_limit || ''));
            setUntil(!!service.closes_at);
            setClosesAt(service.closes_at ? String(service.closes_at).replace(' ', 'T').slice(0, 16) : '');
        } else {
            setVisitType(available[0] || '');
            setTitle('');
            setLimit('30');
            setUntil(false);
            setClosesAt('');
        }
        setBusy(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, service]);

    if (!state) return null;

    const submit = async (e) => {
        e.preventDefault();
        const value = Number(limit);
        if (!visitType) { fail('Pick a check-up service.'); return; }
        if (!title.trim()) { fail('Enter a title.'); return; }
        if (!Number.isInteger(value) || value < 1 || value > 500) { fail('The limit must be 1 to 500.'); return; }
        if (editing && value < service.registered) { fail(`The limit cannot be below ${service.registered} registered.`); return; }
        if (until && !closesAt) { fail('Pick the closing date and time.'); return; }
        setBusy(true);
        let data;
        try {
            const body = { sender_id: userId, visit_type: visitType, title: title.trim(), listing_limit: value };
            if (!editing || isOpenNow) body.closes_at = until ? closesAt : '';
            data = await send('/api/advance-listing', 'PUT', body);
        } catch (err) {
            data = { message: 'Could not reach the server.' };
        }
        setBusy(false);
        if (data.success) { showAlert(data.message, 'success'); onSaved(); onClose(); } else fail(data.message || 'Could not save.');
    };

    return (
        <Modal
            isOpen={isOpen} onClose={onClose} icon={<Settings2 size={20} />} size="md" closeOnBackdrop={false}
            title={editing ? `Settings: ${service.visit_type}` : 'New Advance Listing'}
        >
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-field">
                    <label htmlFor="adv-service">Check-up service</label>
                    <select id="adv-service" className="dp-select" value={visitType} disabled={editing} onChange={(e) => setVisitType(e.target.value)}>
                        {!editing && available.length === 0 && <option value="">No service available</option>}
                        {editing ? <option value={service.visit_type}>{service.visit_type}</option> : available.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="dp-field">
                    <label htmlFor="adv-title">Title</label>
                    <input
                        id="adv-title" className="dp-input" type="text" maxLength={120} value={title} placeholder="Dental advance listing for next month"
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div className="dp-field">
                    <label htmlFor="adv-limit">Limit{editing && service.registered > 0 ? ` (${service.registered} registered)` : ''}</label>
                    <input
                        id="adv-limit" className="dp-input" type="number" min={Math.max(1, editing ? service.registered : 1)} max={500} value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                    />
                </div>

                {(!editing || isOpenNow) && (
                    <fieldset className="dp-field" style={{ border: 0, padding: 0, margin: 0 }}>
                        <legend style={{ fontWeight: 600, marginBottom: 6 }}>Stays open</legend>
                        <label className="dp-check"><input type="radio" name="adv-duration" checked={!until} onChange={() => setUntil(false)} /> Until I close it</label>
                        <label className="dp-check"><input type="radio" name="adv-duration" checked={until} onChange={() => setUntil(true)} /> Until a date</label>
                        <input
                            className="dp-input" type="datetime-local" min={localNow()} disabled={!until} value={closesAt} aria-label="Closing date and time"
                            onChange={(e) => setClosesAt(e.target.value)}
                        />
                    </fieldset>
                )}

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy || (!editing && available.length === 0)}>{busy ? 'Saving...' : editing ? 'Save' : 'Create'}</button>
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
    const [busy, setBusy] = useState(false);
    const fail = (message) => showAlert(message, 'error');

    useEffect(() => {
        if (!isOpen) return;
        setStudent(null);
        setVisitType(presetService || '');
        setBusy(false);
    }, [isOpen, presetService]);

    const offered = state ? state.services.filter((s) => s.offered) : [];

    const submit = async (e) => {
        e.preventDefault();
        if (!student) { fail('Choose the student.'); return; }
        if (!visitType) { fail('Pick the check-up service.'); return; }
        setBusy(true);
        let data;
        try {
            data = await send('/api/advance-listing/entries', 'POST', { sender_id: userId, student_id: student.student_id, visit_type: visitType });
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
    const [listingFor, setListingFor] = useState(null); // undefined/null = closed, 'new' = create, a service row = its settings
    const [dropFor, setDropFor] = useState(null); // the service row to drop
    const [addFor, setAddFor] = useState(null); // service name to preset ('' = none) while the add modal is open
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
        if (!(await showConfirm(list.length === 1 ? 'Move this student to the open advance listing of the service?' : `Move ${list.length} students to the open advance listings of their services?`, { title: 'Move students', confirmLabel: 'Move' }))) return;
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

    // drop the advance listing of one service: as soon as it is closed (it moves to the past advance listings)
    const askDrop = (svc) => {
        if (!svc.offered) { showAlert('This service has no advance listing.', 'warning'); return; }
        if (!svc.can_drop) { showAlert('Close the listing first. A closed listing can be dropped.', 'warning'); return; }
        setDropFor(svc);
    };

    const dropListing = async () => {
        const svc = dropFor;
        setDropFor(null);
        setBusy(true);
        try {
            const data = await send('/api/advance-listing/drop', 'PUT', { sender_id: userId, visit_type: svc.visit_type });
            if (data.success) { showAlert(data.message, 'success'); setPanel('current'); changed(); } else showAlert(data.message || 'Could not drop the advance listing.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleService = async (svc) => {
        const closing = svc.status === 'Open';
        if (!(await showConfirm(`${closing ? 'Close' : 'Open'} the ${svc.visit_type} advance listing${closing ? '? Registered students keep their number.' : '?'}`, { title: closing ? 'Close service' : 'Open service', confirmLabel: closing ? 'Close' : 'Open', danger: closing }))) return;
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

    // one advance listing per service: it stays the current one of its service, even when done, until the nurse drops it (then it is in the past advance listings)
    const shownServices = state.services.filter((s) => visible(s.visit_type));
    // a dropped listing leaves the table (its cut off students stay under the Cut off students button)
    const listServices = shownServices.filter((s) => s.offered);
    const cutoffCount = shownServices.reduce((n, s) => n + s.cutoff, 0);
    const canCreate = state.eligible.some((t) => !state.services.some((s) => s.visit_type === t && s.offered));
    // students are listed at once now (no reason, no review); the review tab only shows for requests that were sent before and are still unanswered
    const hasReview = isNurse && shownServices.some((s) => s.pending > 0);
    const currentService = service === 'all' ? null : shownServices.find((s) => s.visit_type === service) || null;

    // ---- the list of students (second view): the toolbar and the table only ----
    const listView = (
        <>
            <div className="list-head-sc">
                <button type="button" className="icon-btn-ds" onClick={backToOverview} title="Back" aria-label="Back to the advance listing"><ArrowLeft size={16} /></button>
                <h3>{pastListing ? `${pastListing.title} (past)` : currentService && currentService.title ? currentService.title : `${service !== 'all' ? `${service}: ` : ''}Advance listings`}</h3>
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
                        {hasReview && (
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
                            <tr><th style={{ width: 74 }}>No.</th><th>Student</th><th>Check-up service</th><th>{cutoffTab && !pastListing ? 'Listed (priority)' : 'Registered'}</th><th>Status</th>{isNurse && !pastListing && <th>Actions</th>}</tr>
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
                                    <td className="reason-cell-sc"><strong>{e.visit_type}</strong>{e.reason && <div>{e.reason}</div>}</td>
                                    <td>
                                        {cutoffTab && !pastListing ? formatDateTime(e.listed_at || e.created_at) : formatDate(e.created_at)}
                                        {cutoffTab && !pastListing && e.cutoff_date && <div className="muted-ds">Cut off {formatDate(e.cutoff_date)}</div>}
                                        {e.listing_title && <div className="muted-ds">{e.listing_title}</div>}
                                    </td>
                                    <td>
                                        <span className={`badge-ds ${STATUS_CLASS[e.status] || 'badge-expired-ds'}`}>{STATUS_TEXT[e.status] || e.status}</span>
                                        {['Cutoff', 'Moved'].includes(e.status) && e.cutoff_kind && (
                                            <div className="muted-ds" title={(CUTOFF_KINDS[e.cutoff_kind] || {}).hint}>{cutoffKindLabel(e.cutoff_kind)}</div>
                                        )}
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
    const currentPanel = listServices.length === 0 ? (
        <div className="group-empty-ds">
            <p>No advance listing.</p>
            {isNurse && canCreate && (
                <button type="button" className="icon-btn-ds" onClick={() => setListingFor('new')} title="New advance listing" aria-label="Create a new advance listing"><Plus size={16} /></button>
            )}
        </div>
    ) : (
        <div className="table-card-dv">
            <table className="sti-table-dv">
                <caption className="sr-only">Check-up services of the advance listing</caption>
                <thead>
                    <tr><th>Advance listing</th><th>Listed</th>{hasReview && <th>To review</th>}<th>Cut off</th><th>Numbers left</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    {pageOf(listServices, Math.min(servicePage, pageCountOf(listServices.length))).map((s) => {
                        const isDone = s.status === 'Done';
                        const canSwitch = isNurse && s.offered && !s.scheduled && !isDone;
                        return (
                            <tr key={s.visit_type}>
                                <td>
                                    <strong>{s.title || s.visit_type}</strong>
                                    <div className="muted-ds">{s.offered ? `${s.visit_type}${s.status === 'Open' && s.closes_at ? ` - until ${formatDateTime(s.closes_at)}` : ''}` : `${s.visit_type} - no listing`}</div>
                                </td>
                                <td>
                                    <span className="advance-count-sc">{listedText(s)}</span>
                                    {s.listing_full && <div className="muted-ds">Full</div>}
                                </td>
                                {hasReview && <td>{s.pending}</td>}
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
                                                onClick={warnIf(!canSwitch ? (s.scheduled ? 'This service has a schedule. Use the Session Listing.' : s.status === 'Done' ? 'This listing is done. Drop it to create a new one.' : 'This service has no advance listing.') : '', () => toggleService(s))}
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
                                                {hasReview && (
                                                    <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={s.scheduled || s.pending === 0} onClick={warnIf(s.scheduled ? 'This service has a schedule. Use the Session Listing.' : s.pending === 0 ? 'No requests to review.' : '', () => openList(null, s.visit_type, 'review'))}
                                                        title="Review requests" aria-label={`Review the ${s.pending} request(s) of ${s.visit_type}`}>
                                                        <ClipboardCheck size={15} />
                                                    </button>
                                                )}
                                                <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={!s.offered || s.scheduled} title="Settings" aria-label={`Settings of the ${s.visit_type} advance listing`} onClick={warnIf(s.scheduled ? 'This service has a schedule. Use the Session Listing.' : !s.offered ? 'This service has no advance listing.' : '', () => setListingFor(s))}><SlidersHorizontal size={15} /></button>
                                                <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={!s.offered || s.scheduled} title="Add a student" aria-label={`Add a student to ${s.visit_type}`} onClick={warnIf(s.scheduled ? 'This service has a schedule. Add the student in the Session Listing.' : !s.offered ? 'This service is not offered.' : '', () => setAddFor(s.visit_type))}><UserPlus size={15} /></button>
                                                {(() => {
                                                    const asked = pendingRequests.advanceServices.has(s.visit_type);
                                                    const why = s.scheduled ? 'This service has a schedule already.' : asked ? 'A schedule request for this service is already pending. Wait for the doctor to answer it.' : s.waiting === 0 ? 'Nobody is waiting in this service.' : '';
                                                    return (
                                                        <button type="button" className="icon-btn-ds" disabled={isDone} aria-disabled={!!why} aria-label={`Request a schedule for ${s.visit_type}${asked ? ' (already requested)' : ''}`}
                                                            title={asked ? 'Schedule already requested' : 'Request a schedule'} onClick={warnIf(why, () => requestSchedule(s))}><Send size={15} /></button>
                                                    );
                                                })()}
                                                <button
                                                    type="button" className="icon-btn-ds" disabled={busy} aria-disabled={!s.can_drop} title="Drop" aria-label={`Drop the ${s.visit_type} advance listing`}
                                                    onClick={() => askDrop(s)}
                                                ><Archive size={15} /></button>
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
                    <strong className="advance-title-sc">Advance listings</strong>
                    <div className="advance-note-sc">
                        <span className="muted-ds">{state.services.filter((x) => x.offered && x.status === 'Open').length} open - {state.services.filter((x) => x.offered).length} total</span>
                    </div>
                </div>
                <div className="advance-actions-sc">
                    {isNurse && (
                        <button
                            type="button" className="icon-btn-ds" aria-disabled={!canCreate} onClick={warnIf(!canCreate ? 'Every check-up service has an advance listing. Drop a done one to create a new one.' : '', () => setListingFor('new'))}
                            title="New advance listing" aria-label="Create a new advance listing"
                        ><Plus size={16} /></button>
                    )}
                    <button type="button" className="icon-btn-ds" title="Refresh" aria-label="Refresh" onClick={load}><RefreshCw size={15} /></button>
                </div>
            </div>

            <div className="status-chips-sc" role="group" aria-label="Advance listings" style={{ marginBottom: 14 }}>
                <button type="button" className={`status-chip-sc ${panel === 'current' ? 'active-sc' : ''}`} aria-pressed={panel === 'current'} onClick={() => setPanel('current')}>Current listings</button>
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
                isOpen={!!dropFor} danger title="Drop advance listing" confirmLabel="Drop" onCancel={() => setDropFor(null)} onConfirm={dropListing}
                message={dropFor ? `Drop "${dropFor.title || dropFor.visit_type}" (${dropFor.visit_type})?${dropFor.waiting > 0 ? ' Waiting students go to the Cut off list.' : ''}` : ''}
            />
            <ListingModal
                isOpen={!!listingFor} state={state} userId={userId} onClose={() => setListingFor(null)} onSaved={changed}
                service={listingFor && listingFor !== 'new' ? state.services.find((x) => x.visit_type === listingFor.visit_type) || listingFor : null}
            />
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
