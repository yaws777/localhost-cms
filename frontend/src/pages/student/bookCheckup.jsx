// bookCheckup.jsx - the student's check-up page (route /BookCheckup).
// The doctor sets a schedule with a listing limit and the nurse opens its listing. The student sees the open listings here and takes a
// place in one: no reason and no nurse approval, the student gets the next queue number of that session at once (in the order of asking)
// and sees which number is being served.
// Layout: header (title + updates bell), "My number in line" on top, then tabs (Listings | Follow-ups | Past | Requests). Only the active tab is
// shown and the latest updates sit behind the bell, so nothing long is open when the page loads.
// Look: one ticket per number (big number, now serving, people ahead, progress), a 3-step ticket for a request the nurse has not accepted,
// session cards led by a date block with a capacity meter, and every status is one tag = color + icon + word.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClipboardList, X, Clock, Info, Stethoscope, MapPin, Repeat, FileText, Bell, Footprints, UserPlus, ListPlus, XCircle, Undo2, Eye, Inbox, Ticket, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';
import { to12h, cutoffKindLabel } from '../../utils/scheduling';
import { vitalsLine, inVitalsOf, outVitalsOf } from '../../utils/vitals';
import { dispensedLine } from '../../utils/dispensed';
import { useQueueStatus } from '../../hooks/useQueueStatus';
import QueueStatus, { QueuePill } from '../../components/student/QueueStatus';
import '../../styles/student/BookCheckup.css';

const API = 'http://localhost:3001';

const EMPTY_REQUEST = { visit_type: '' };
const FINISHED = ['Missed', 'Denied', 'Withdrawn']; // a fulfilled request shows under Past check-ups
const LIVE_REFRESH_MS = 10000;
const UPDATE_TYPES = /^(ADVANCE_LISTING|CONSULTATION_|QUEUE_|APPOINTMENT_|BOOKING_|SCHEDULE_UPDATE|ASSESSMENT_|DOCTOR_VISIT)/;
const SEEN_KEY = 'bc-updates-seen'; // per-viewer convenience: when the student last opened the updates

// one status tag everywhere: tone (color) + icon + word, so a status is never color alone
const Tag = ({ tone = 'brand', Icon, children }) => (
    <span className={`tag-bc tag-${tone}-bc`}>{Icon && <Icon size={14} aria-hidden="true" />} {children}</span>
);

// the date of a session as a small block (month, day, weekday)
const DateBlock = ({ value }) => {
    const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return (
        <div className="date-bc" aria-hidden="true">
            <small>{d.toLocaleDateString('en-US', { month: 'short' })}</small>
            <b>{d.getDate()}</b>
            <span>{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
        </div>
    );
};

// "x of y accepted" as text and a bar; the bar turns amber near the limit and red when full
const Meter = ({ accepted, limit, left }) => {
    const pct = limit > 0 ? Math.min(100, Math.round((accepted / limit) * 100)) : 0;
    const level = pct >= 100 ? 'full' : pct >= 80 ? 'low' : 'ok';
    return (
        <div>
            <div className="cap-bc"><span>{accepted} of {limit} accepted</span><span>{left} left</span></div>
            <div className={`meter-bc meter-${level}-bc`} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        </div>
    );
};

const requestTag = (status) => {
    if (status === 'Fulfilled') return { tone: 'ok', Icon: CheckCircle2 };
    if (status === 'Denied' || status === 'Withdrawn' || status === 'Missed') return { tone: 'bad', Icon: XCircle };
    return { tone: 'low', Icon: Clock };
};

// how far the called number is from mine (listed numbers only, when both are plain numbers)
const queueProgress = (a) => {
    if (a.lane === 'Walk-in' || /^w/i.test(String(a.now_serving || ''))) return null;
    const mine = parseInt(String(a.label).replace(/\D/g, ''), 10);
    if (!(mine > 0)) return null;
    const now = parseInt(String(a.now_serving || '').replace(/\D/g, ''), 10);
    return { mine, now: Number.isFinite(now) ? Math.min(now, mine) : 0 };
};

const NumberTicket = ({ a }) => {
    const live =!['Serving', 'Void', 'Done'].includes(a.state);
    const prog = live && a.in_session ? queueProgress(a) : null;
    return (
        <article className="ticket-bc" aria-label={`Your queue number ${a.label}`}>
            <div className="ticket-num-bc"><small>{a.lane === 'Walk-in' ? 'Walk-in' : 'Number'}</small><strong>{a.label}</strong></div>
            <div className="ticket-body-bc">
                <div className="booking-top-bc">
                    <strong>{visitLabel(a.visit_type)}</strong>
                    <QueuePill a={a} />
                </div>
                <div className="booking-line-bc"><Stethoscope size={14} aria-hidden="true" /> {a.doctor_name}, {formatDate(a.date)}, {to12h(a.session_start)} - {to12h(a.session_end)}</div>
                {a.location && <div className="booking-line-bc"><MapPin size={14} aria-hidden="true" /> {a.location}</div>}
                <QueueStatus a={a} />
                {a.state !== 'Done' && a.state !== 'Void' && (
                    <div className="stats-bc">
                        <div className="stat-bc"><span>In Session</span><b>{a.state === 'Serving' ? 'You' : a.now_serving || 'None yet'}</b></div>
                        <div className="stat-bc"><span>Ahead of you</span><b>{a.state === 'Serving' ? 0 : a.ahead}</b></div>
                    </div>
                )}
                {prog && (
                    <div>
                        <div className="progress-bc" role="progressbar" aria-label="Queue progress" aria-valuemin={0} aria-valuemax={prog.mine} aria-valuenow={prog.now}><span style={{ width: `${Math.round((prog.now / prog.mine) * 100)}%` }} /></div>
                        <div className="cap-bc"><span>{a.now_serving || 'None yet'} in session</span><span>You {a.label}</span></div>
                    </div>
                )}
            </div>
        </article>
    );
};

// a request the nurse has not accepted has no number yet: Sent, Nurse review, Number
const RequestTicket = ({ r, onWithdraw }) => {
    const pending = r.status === 'Waiting for Approval';
    const steps = [
        { label: 'Sent', cls: 'done', Icon: Check },
        { label: 'Nurse review', cls: pending ? 'now' : 'done', Icon: pending ? Clock : Check },
        { label: pending ? 'Number' : `Number #${r.queue_no}`, cls: pending ? '' : 'now', Icon: Ticket }
    ];
    return (
        <article className="ticket-bc ticket-wait-bc" aria-label={pending ? 'Request waiting for approval' : `Waiting list number ${r.queue_no}`}>
            <div className="ticket-body-bc">
                <div className="booking-top-bc">
                    <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                    <Tag tone="low" Icon={Clock}>{pending ? 'Waiting for approval' : r.status}</Tag>
                </div>
                {pending && r.listing_start_time && (
                    <div className="booking-line-bc"><Stethoscope size={14} aria-hidden="true" /> Dr. {r.listing_doc_first_name} {r.listing_doc_last_name}, {formatDate(r.listing_date)}, {to12h(r.listing_start_time)} - {to12h(r.listing_end_time)}</div>
                )}
                {!pending && r.queue_position ? <div className="booking-line-bc"><Info size={14} aria-hidden="true" /> Position {r.queue_position} of {r.queue_total}</div> : null}
                <ol className="steps-bc" aria-label="Request progress">
                    {steps.map(({ label, cls, Icon }) => (
                        <li key={label} className={cls} aria-current={cls === 'now' ? 'step' : undefined}>
                            <span className="dot-bc"><Icon size={15} aria-hidden="true" /></span>{label}
                        </li>
                    ))}
                </ol>
                <div className="request-foot-bc">
                    <button type="button" className="btn-bc btn-danger-bc btn-icon-bc" onClick={onWithdraw} aria-label="Withdraw the request" title="Withdraw the request"><Undo2 size={18} aria-hidden="true" /></button>
                </div>
            </div>
        </article>
    );
};

const BookCheckup = () => {
    const { studentId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();

    // the live numbers in line: pending asks and session queue numbers
    const { requests: active, appointments: allAppointments, loading, refresh } = useQueueStatus(studentId);
    // a number leaves the line once its check-up is done (it moves to Past) or its session is over
    const appointments = allAppointments.filter((a) => !a.session_over && !a.documented && a.state !== 'Done');
    // the session listing marks the student's own number Done when the check-up is documented, and drops the session once it is over
    const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
    const isDone = (a) => !!a && (!!a.documented || a.state === 'Done');
    const apptFor = (scheduleId, date) => allAppointments.find((a) => a.schedule_id === scheduleId && a.date === String(date).slice(0, 10));

    const [tab, setTab] = useState('listings');
    const [listings, setListings] = useState([]);
    const [listingsLoaded, setListingsLoaded] = useState(false);
    const [inAdvance, setInAdvance] = useState(false);
    const [advance, setAdvance] = useState(null); // the advance listing: open?, services with their limit, and my own entry
    const [advanceForm, setAdvanceForm] = useState({ visit_type: '' });
    const [advanceBusy, setAdvanceBusy] = useState(false);
    const [advanceOpen, setAdvanceOpen] = useState(false); // the request form opens only from the button
    const [history, setHistory] = useState([]);
    const [updates, setUpdates] = useState([]);
    const [updatesOpen, setUpdatesOpen] = useState(false); // the latest updates open only from the bell
    const [seenAt, setSeenAt] = useState(() => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (e) { return 0; } });
    const [seenBefore, setSeenBefore] = useState(0); // what was already seen when the updates were opened: newer ones get a dot
    const [checkups, setCheckups] = useState({ past: [], scheduled: [], waiting: [] }); // repeats + past check-ups with their assessment
    const [assessmentOf, setAssessmentOf] = useState(null);
    const [requestFor, setRequestFor] = useState(null); // the listing the student is asking a place in
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
    const [submitting, setSubmitting] = useState(false);

    const fetchListings = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/open-listings`);
            const data = await res.json();
            if (data.success) { setListings(data.listings); setInAdvance(!!data.in_advance); }
        } catch (e) { /* the page says there is no open listing */ }
        finally { setListingsLoaded(true); }
    }, [studentId]);

    const fetchAdvance = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/advance-listing?student_id=${encodeURIComponent(studentId)}`);
            const data = await res.json();
            if (data.success) setAdvance(data);
        } catch (e) { /* the section says the advance listing is not available */ }
    }, [studentId]);

    // `silent` = a background refresh: no error alert
    const fetchHistory = useCallback(async (silent = false) => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/consultation-requests`);
            const data = await res.json();
            if (data.success) setHistory(data.requests.filter((r) => FINISHED.includes(r.status)));
        } catch (e) { if (!silent) showAlert('Could not load your check-up history.', 'error'); }
    }, [studentId, showAlert]);

    const fetchCheckups = useCallback(async (silent = false) => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/checkup-history`);
            const data = await res.json();
            if (data.success) setCheckups({ past: data.past, scheduled: data.scheduled, waiting: data.waiting });
        } catch (e) { if (!silent) showAlert('Could not load your follow-ups and past check-ups.', 'error'); }
    }, [studentId, showAlert]);

    // the latest check-up news (accepted, declined, moved to a session, cut off, schedule cancelled, called, result ready)
    const fetchUpdates = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/notifications/student/${studentId}`);
            const data = await res.json();
            if (data.success) setUpdates((data.data || []).filter((n) => UPDATE_TYPES.test(n.type || '')).slice(0, 6));
        } catch (e) { /* the list is a convenience */ }
    }, [studentId]);

    useEffect(() => { fetchListings(); fetchHistory(); fetchAdvance(); fetchCheckups(); fetchUpdates(); }, [fetchListings, fetchHistory, fetchAdvance, fetchCheckups, fetchUpdates]);

    // everything on this page follows the clinic live: the queue hook polls by itself, the rest is refreshed every 10 s and when the tab comes back
    useEffect(() => {
        if (!studentId) return undefined;
        const tick = () => {
            if (document.hidden) return;
            fetchListings(); fetchHistory(true); fetchAdvance(); fetchCheckups(true); fetchUpdates();
        };
        const timer = setInterval(tick, LIVE_REFRESH_MS);
        window.addEventListener('focus', tick);
        document.addEventListener('visibilitychange', tick);
        return () => {
            clearInterval(timer);
            window.removeEventListener('focus', tick);
            document.removeEventListener('visibilitychange', tick);
        };
    }, [studentId, fetchListings, fetchHistory, fetchAdvance, fetchCheckups, fetchUpdates]);

    // Esc closes whichever modal is open, and focus goes back to the button that opened it
    const anyModal = updatesOpen || !!assessmentOf || advanceOpen || !!requestFor;
    const lastFocus = useRef(null);
    const wasModal = useRef(false);
    useEffect(() => {
        const onIn = (e) => { if (e.target.closest && !e.target.closest('.modal-overlay-bc')) lastFocus.current = e.target; };
        document.addEventListener('focusin', onIn);
        return () => document.removeEventListener('focusin', onIn);
    }, []);
    useEffect(() => {
        const opener = lastFocus.current;
        if (wasModal.current && !anyModal && opener && opener.isConnected) opener.focus();
        wasModal.current = anyModal;
    }, [anyModal]);
    useEffect(() => {
        if (!anyModal) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            setUpdatesOpen(false); setAssessmentOf(null); setAdvanceOpen(false); setRequestFor(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [anyModal]);

    const reloadAll = () => { refresh(); fetchHistory(); fetchListings(); fetchAdvance(); fetchCheckups(); fetchUpdates(); };

    const unread = updates.filter((n) => Date.parse(n.created_at) > seenAt).length;
    const openUpdates = () => {
        const now = Date.now();
        setSeenBefore(seenAt);
        setSeenAt(now);
        try { localStorage.setItem(SEEN_KEY, String(now)); } catch (e) { /* the badge just comes back */ }
        setUpdatesOpen(true);
    };

    const registerAdvance = async (e) => {
        e.preventDefault();
        if (!advanceForm.visit_type) { showAlert('Please select the check-up service you need.', 'warning'); return; }
        setAdvanceBusy(true);
        try {
            const res = await fetch(`${API}/api/student/advance-listing`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, ...advanceForm })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); setAdvanceForm({ visit_type: '' }); setAdvanceOpen(false); reloadAll(); }
            else { showAlert(data.message || 'Could not register in the advance listing.', 'error'); fetchAdvance(); }
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        } finally {
            setAdvanceBusy(false);
        }
    };

    const leaveAdvance = async (entry) => {
        const ok = await showConfirm(
            `Cancel the ${entry.visit_type} advance listing${entry.label ? ` (${entry.label})` : ''}? ${entry.label ? 'You lose your number.' : 'Your request is cancelled.'}`,
            { danger: true, confirmLabel: 'Cancel listing', cancelLabel: 'Keep it', title: 'Cancel the advance listing' }
        );
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/student/advance-listing/${entry.entry_id}/withdraw`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); reloadAll(); } else showAlert(data.message || 'Could not cancel the advance listing.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    // no reason and no nurse approval: the place (queue number) is given at once
    const takePlace = async (listing, visitType) => {
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/student/consultation-requests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, schedule_id: listing.schedule_id, visit_type: visitType })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); setRequestFor(null); setRequestForm(EMPTY_REQUEST); reloadAll(); }
            else { showAlert(data.message || 'Could not take a place.', 'error'); fetchListings(); }
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const openRequestForm = async (listing) => {
        if (listing.mine || submitting) return; // the student already has a number in this session
        if (listing.purposes.length === 1) {
            const ok = await showConfirm(
                `Take a place in the session of ${listing.doctor_name}, ${formatDate(listing.date)}, ${to12h(listing.start_time)} - ${to12h(listing.end_time)}?`,
                { confirmLabel: 'Take place', cancelLabel: 'Cancel', title: 'Take a place' }
            );
            if (ok) takePlace(listing, listing.purposes[0]);
            return;
        }
        setRequestForm(EMPTY_REQUEST);
        setRequestFor(listing);
    };

    const sendRequest = (e) => {
        e.preventDefault();
        if (!requestForm.visit_type) { showAlert('Please select the check-up you need.', 'warning'); return; }
        takePlace(requestFor, requestForm.visit_type);
    };

    const withdrawRequest = async (r) => {
        const ok = await showConfirm(
            `Withdraw your ${visitLabel(r.visit_type, r.purpose_other)} request?`,
            { danger: true, confirmLabel: 'Withdraw', cancelLabel: 'Keep it', title: 'Withdraw the request' }
        );
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/student/consultation-requests/${r.request_id}/withdraw`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); reloadAll(); }
            else showAlert(data.message || 'Could not withdraw the request.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    const historyHelp = (r) => {
        if (r.status === 'Denied') return r.review_reason ? `Declined: ${r.review_reason}` : 'Declined.';
        if (r.status === 'Missed') return 'Number skipped.';
        if (r.status === 'Fulfilled') return r.appointment_start ? `Seen ${formatDateTime(r.appointment_start)}, Dr. ${r.appt_doc_first_name} ${r.appt_doc_last_name}.` : 'Seen.';
        return 'Withdrawn.';
    };

    // the tag of a session card: done, my request, my number, full or open
    const listingTag = (l, done) => {
        if (done) return { tone: 'ok', Icon: CheckCircle2, text: 'Done' };
        if (l.mine) {
            return l.mine.status === 'Waiting for Approval'
                ? { tone: 'low', Icon: Clock, text: 'Request sent' }
                : { tone: 'brand', Icon: Ticket, text: `Number ${l.mine.label || `#${l.mine.queue_no}`}` };
        }
        return l.listing_full ? { tone: 'bad', Icon: AlertCircle, text: 'Full' } : { tone: 'ok', Icon: CheckCircle2, text: 'Open' };
    };

    const placesLeft = (l) => (Number.isFinite(l.places_left) ? l.places_left : Math.max(0, (l.listing_limit || 0) - (l.accepted || 0)));

    const advanceTag = (m) => {
        if (m.status === 'Pending') return { tone: 'low', Icon: Clock, text: 'Under review' };
        if (m.status === 'Waiting') return { tone: 'low', Icon: Clock, text: 'Waiting for a schedule' };
        if (m.status === 'Cutoff') return { tone: 'bad', Icon: XCircle, text: `Cut off ${cutoffKindLabel(m.cutoff_kind).toLowerCase()}` };
        return { tone: 'brand', Icon: Ticket, text: `Number ${m.queue_label || ''}` };
    };

    // a session is gone from the listing once it is over (end confirmed, or its date passed)
    const visibleListings = listings.filter((l) => {
        const a = apptFor(l.schedule_id, l.date);
        return !(a && a.session_over) && String(l.date).slice(0, 10) >= todayKey;
    });

    // tabs: only the active one is rendered
    const tabs = [
        { id: 'listings', label: 'Listings', Icon: ClipboardList, count: visibleListings.length },
        { id: 'repeats', label: 'Follow-ups', Icon: Repeat, count: checkups.waiting.length + checkups.scheduled.length },
        { id: 'past', label: 'Past', Icon: FileText, count: checkups.past.length },
        ...(history.length > 0 ? [{ id: 'requests', label: 'Requests', Icon: Inbox, count: history.length }] : [])
    ];
    const activeTab = tabs.some((t) => t.id === tab) ? tab : 'listings';

    const onTabKey = (e, i) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[next].id);
        const el = document.getElementById(`bc-tab-${tabs[next].id}`);
        if (el) el.focus();
    };

    // my advance entry that moved into a session: Done when the check-up is documented, gone when the session is over
    const mineRaw = advance?.mine;
    const mineApp = mineRaw && mineRaw.schedule_id ? apptFor(mineRaw.schedule_id, mineRaw.session_date) : null;
    const mineOver = !!mineRaw && (['Done', 'No show', 'Ended'].includes(mineRaw.status)
        || (mineRaw.status === 'Scheduled' && ((mineApp && mineApp.session_over) || (mineRaw.session_date && String(mineRaw.session_date).slice(0, 10) < todayKey))));
    const mine = mineOver ? null : mineRaw;
    const mineDone = isDone(mineApp);

    return (
        <div className="container-bc">
            <div className="header-bc">
                <h2><ClipboardList size={22} aria-hidden="true" /> Check-up</h2>
                <button type="button" className="btn-bc btn-light-bc btn-icon-bc bell-bc" onClick={openUpdates} aria-label={`Latest updates${unread ? `, ${unread} new` : ''}`} title="Latest updates">
                    <Bell size={20} aria-hidden="true" />
                    {unread > 0 && <span className="badge-bc" aria-hidden="true">{unread}</span>}
                </button>
            </div>

            <section className="section-bc line-bc" aria-label="My number in line">
                <div className="sec-head-bc"><h3><Ticket size={16} aria-hidden="true" /> My number in line</h3></div>
                {loading ? (
                    <div className="empty-bc">Loading...</div>
                ) : appointments.length === 0 && active.length === 0 ? (
                    <div className="empty-bc empty-row-bc"><Ticket size={20} aria-hidden="true" /> No number yet. Ask for one in Listings.</div>
                ) : (
                    <div className="ticket-grid-bc">
                        {appointments.map((a) => <NumberTicket key={a.appointment_id} a={a} />)}
                        {active.map((r) => <RequestTicket key={r.request_id} r={r} onWithdraw={() => withdrawRequest(r)} />)}
                    </div>
                )}
            </section>

            <div className="tabs-bc" role="tablist" aria-label="Check-up sections">
                {tabs.map(({ id, label, Icon, count }, i) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        id={`bc-tab-${id}`}
                        aria-selected={activeTab === id}
                        aria-controls={`bc-panel-${id}`}
                        tabIndex={activeTab === id ? 0 : -1}
                        className="tab-bc"
                        onClick={() => setTab(id)}
                        onKeyDown={(e) => onTabKey(e, i)}
                    >
                        <Icon size={16} aria-hidden="true" /> {label}
                        {count > 0 && <span className="tab-count-bc">{count}</span>}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`bc-panel-${activeTab}`} aria-labelledby={`bc-tab-${activeTab}`} className="panel-bc">
                {activeTab === 'listings' && (
                    <>
                        <section className="section-bc" aria-label="Advance Listing (No Schedule Yet)">
                            <div className="sec-head-bc">
                                <h3>Advance Listing <span className="paren-bc">(No Schedule Yet)</span></h3>
                                {advance && advance.is_open && !mine && (
                                    <button type="button" className="btn-bc btn-primary-bc btn-icon-bc" onClick={() => setAdvanceOpen(true)} aria-label="Request advance listing" title="Request advance listing"><ListPlus size={20} aria-hidden="true" /></button>
                                )}
                                {advance && !advance.is_open && !mine && <Tag tone="soft" Icon={Clock}>Closed</Tag>}
                            </div>
                            {!advance ? (
                                <div className="empty-bc">Loading...</div>
                            ) : mine ? (
                                <div className="booking-card-bc">
                                    <div className="booking-top-bc">
                                        <strong>{mine.visit_type}{mine.status !== 'Scheduled' && mine.label ? `: ${mine.label}` : ''}</strong>
                                        {mine.status === 'Scheduled' && mineDone
                                            ? <Tag tone="ok" Icon={CheckCircle2}>Done</Tag>
                                            : mine.status === 'Scheduled'
                                                ? <Tag tone="brand" Icon={Ticket}>Scheduled</Tag>
                                                : <Tag tone={advanceTag(mine).tone} Icon={advanceTag(mine).Icon}>{advanceTag(mine).text}</Tag>}
                                    </div>
                                    {mine.status === 'Scheduled' ? (
                                        <div className="booking-line-bc"><Info size={14} aria-hidden="true" /> Moved to the session listing.</div>
                                    ) : (
                                        <>
                                            {mine.status === 'Pending' && <div className="booking-line-bc"><Info size={14} aria-hidden="true" /> Under review.</div>}
                                            {mine.status === 'Waiting' && <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> Waiting for a schedule.</div>}
                                            {mine.status === 'Cutoff' && (
                                                <div className="booking-line-bc"><Info size={14} aria-hidden="true" /> Cut off {cutoffKindLabel(mine.cutoff_kind).toLowerCase()}{mine.cutoff_doctor_name ? `: ${mine.cutoff_doctor_name}` : ''}{mine.cutoff_date ? `, ${formatDate(mine.cutoff_date)}` : ''}.</div>
                                            )}
                                            {['Waiting', 'Pending', 'Cutoff'].includes(mine.status) && (
                                                <div className="booking-actions-bc">
                                                    <button type="button" className="btn-bc btn-danger-bc btn-icon-bc" onClick={() => leaveAdvance(mine)} aria-label="Cancel the advance listing" title="Cancel the advance listing"><XCircle size={18} aria-hidden="true" /></button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ) : advance.is_open && advance.closes_at ? (
                                <div className="booking-card-bc"><div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> Open until {formatDateTime(advance.closes_at)}.</div></div>
                            ) : null}
                        </section>

                        <section className="section-bc" aria-label="Session Listing (With Already Schedule)">
                            <div className="sec-head-bc"><h3>Session Listing <span className="paren-bc">(With Already Schedule)</span></h3></div>
                            {!listingsLoaded ? (
                                <div className="empty-bc">Loading...</div>
                            ) : mine?.status === 'Scheduled' ? (
                                <div className="booking-grid-bc">
                                    <article className="listing-bc">
                                        {mine.session_date && <DateBlock value={mine.session_date} />}
                                        <div className="listing-main-bc">
                                            <div className="booking-top-bc">
                                                <strong>{mine.visit_type} session</strong>
                                                {mineDone
                                                    ? <Tag tone="ok" Icon={CheckCircle2}>Done</Tag>
                                                    : <Tag tone="brand" Icon={Ticket}>{mine.queue_label ? `Number ${mine.queue_label}` : 'You have a place'}</Tag>}
                                            </div>
                                            {mine.doctor_name && <div className="booking-line-bc"><Stethoscope size={14} aria-hidden="true" /> {mine.doctor_name}</div>}
                                            {mine.session_date && (
                                                <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> <span className="sr-bc">{formatDate(mine.session_date)}, </span>{to12h(mine.session_start)} - {to12h(mine.session_end)}</div>
                                            )}
                                            {mine.location && <div className="booking-line-bc"><MapPin size={14} aria-hidden="true" /> {mine.location}</div>}
                                        </div>
                                    </article>
                                </div>
                            ) : inAdvance && mine?.status !== 'Cutoff' ? (
                                <div className="empty-bc">In the advance listing.</div>
                            ) : visibleListings.length === 0 ? (
                                <div className="empty-bc">No open listing.</div>
                            ) : (
                                <div className="booking-grid-bc">
                                    {visibleListings.map((l) => {
                                        const done = isDone(apptFor(l.schedule_id, l.date));
                                        const tag = listingTag(l, done);
                                        return (
                                        <article key={`${l.schedule_id}-${l.date}`} className="listing-bc">
                                            <DateBlock value={l.date} />
                                            <div className="listing-main-bc">
                                                <div className="booking-top-bc">
                                                    <strong>{l.visit_type === 'Any' ? 'Check-up session' : `${l.visit_type} session`}</strong>
                                                    <Tag tone={tag.tone} Icon={tag.Icon}>{tag.text}</Tag>
                                                </div>
                                                <div className="booking-line-bc"><Stethoscope size={14} aria-hidden="true" /> {l.doctor_name} ({l.specialization})</div>
                                                <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> <span className="sr-bc">{formatDate(l.date)}, </span>{to12h(l.start_time)} - {to12h(l.end_time)}</div>
                                                {l.location && <div className="booking-line-bc"><MapPin size={14} aria-hidden="true" /> {l.location}</div>}
                                                <div className="booking-line-bc"><Footprints size={14} aria-hidden="true" /> {l.allow_walk_in === false ? 'No walk-in' : 'Walk-ins accepted'}</div>
                                                {l.notes && <div className="muted-bc">{l.notes}</div>}
                                                <Meter accepted={l.accepted} limit={l.listing_limit} left={placesLeft(l)} />
                                                {!l.mine && (
                                                    <div className="booking-actions-bc">
                                                        <button type="button" className="btn-bc btn-primary-bc btn-icon-bc" disabled={!l.can_request || submitting} onClick={() => openRequestForm(l)} aria-label={l.listing_full ? 'Take a place, listing full' : 'Take a place'} title={l.listing_full ? 'Listing full' : 'Take a place'}><UserPlus size={20} aria-hidden="true" /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {activeTab === 'repeats' && (
                    <section className="section-bc" aria-label="Follow-ups">
                        {checkups.waiting.length === 0 && checkups.scheduled.length === 0 ? (
                            <div className="empty-bc">No follow-up check-up.</div>
                        ) : (
                            <div className="booking-grid-bc">
                                {checkups.scheduled.map((f) => (
                                    <div key={f.appointment_id} className="booking-card-bc">
                                        <div className="booking-top-bc">
                                            <strong>Follow-up check-up</strong>
                                            <Tag tone="brand" Icon={Ticket}>{f.label ? `Number ${f.label}` : 'Scheduled'}</Tag>
                                        </div>
                                        <div className="booking-line-bc"><Stethoscope size={14} aria-hidden="true" /> {f.doctor_name}</div>
                                        <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> {f.queued ? formatDate(f.date) : formatDateTime(f.start_time)}{f.location ? ` (${f.location})` : ''}</div>
                                    </div>
                                ))}
                                {checkups.waiting.map((w) => (
                                    <div key={w.appointment_id} className="booking-card-bc">
                                        <div className="booking-top-bc">
                                            <strong>{visitLabel(w.visit_type, w.purpose_other)}</strong>
                                            <Tag tone="soft" Icon={Clock}>Waiting for a schedule</Tag>
                                        </div>
                                        <div className="booking-line-bc"><Stethoscope size={14} aria-hidden="true" /> {w.doctor_name}</div>
                                        {w.follow_up_date && <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> By {formatDate(w.follow_up_date)}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'past' && (
                    <section className="section-bc" aria-label="Past check-ups">
                        {checkups.past.length === 0 ? (
                            <div className="empty-bc">No past check-up yet.</div>
                        ) : (
                            <div className="booking-grid-bc">
                                {checkups.past.map((c) => (
                                    <div key={c.appointment_id} className="booking-card-bc">
                                        <div className="booking-top-bc">
                                            <strong>{c.is_repeat ? 'Follow-up check-up' : visitLabel(c.visit_type, c.purpose_other)}</strong>
                                            <Tag tone={c.outcome === 'Seen' ? 'ok' : c.outcome === 'Missed' ? 'bad' : 'low'} Icon={c.outcome === 'Seen' ? CheckCircle2 : c.outcome === 'Missed' ? XCircle : Clock}>{c.outcome}</Tag>
                                        </div>
                                        <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> {formatDate(c.date)}, {c.doctor_name}</div>
                                        {c.assessment && (
                                            <>
                                                <div className="diag-bc">{c.assessment.diagnosis}</div>
                                                <div className="booking-actions-bc">
                                                    <button type="button" className="btn-bc btn-light-bc btn-icon-bc" onClick={() => setAssessmentOf(c)} aria-label="View assessment" title="View assessment"><Eye size={18} aria-hidden="true" /></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {activeTab === 'requests' && (
                    <section className="section-bc" aria-label="Other requests">
                        <div className="booking-grid-bc">
                            {history.map((r) => (
                                <div key={r.request_id} className="booking-card-bc">
                                    <div className="booking-top-bc">
                                        <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                        <Tag tone={requestTag(r.status).tone} Icon={requestTag(r.status).Icon}>{r.status}</Tag>
                                    </div>
                                    <div className="booking-line-bc"><Clock size={14} aria-hidden="true" /> Sent {formatDate(r.created_at)}</div>
                                    <p className="request-help-bc">{historyHelp(r)}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {updatesOpen && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-updates-title">
                    <div className="modal-bc">
                        <div className="modal-header-bc">
                            <h3 id="bc-updates-title"><Bell size={16} aria-hidden="true" /> Latest updates</h3>
                            <button type="button" className="close-bc" autoFocus onClick={() => setUpdatesOpen(false)} aria-label="Close" title="Close"><X size={20} aria-hidden="true" /></button>
                        </div>
                        {updates.length === 0 ? (
                            <div className="empty-bc">No updates.</div>
                        ) : (
                            <div className="stack-bc">
                                {updates.map((n) => {
                                    const isNew = Date.parse(n.created_at) > seenBefore;
                                    return (
                                        <div key={n.notification_id} className="update-bc">
                                            <span className={`dot-new-bc${isNew ? '' : ' read-bc'}`} aria-hidden="true" />
                                            <div>
                                                <strong>{n.title}{isNew && <span className="sr-bc"> (new)</span>}</strong>
                                                <p className="request-help-bc">{n.message}</p>
                                                <span className="muted-bc">{formatDateTime(n.created_at)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {assessmentOf && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-assess-title">
                    <div className="modal-bc">
                        <div className="modal-header-bc">
                            <h3 id="bc-assess-title">Assessment</h3>
                            <button type="button" className="close-bc" autoFocus onClick={() => setAssessmentOf(null)} aria-label="Close" title="Close"><X size={20} aria-hidden="true" /></button>
                        </div>
                        <p className="request-help-bc">{assessmentOf.doctor_name}, {formatDate(assessmentOf.date)}</p>
                        <dl className="assess-bc">
                            {[['Vital signs (time in)', vitalsLine(inVitalsOf(assessmentOf.assessment))], ['Vital signs (time out)', vitalsLine(outVitalsOf(assessmentOf.assessment))], ['Reason', assessmentOf.assessment.chief_complaint], ['Findings', assessmentOf.assessment.clinical_findings], ['Diagnosis', assessmentOf.assessment.diagnosis], ['Advice', assessmentOf.assessment.treatment_recommendations]]
                                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                            {assessmentOf.assessment.prescriptions.length > 0 && (
                                <div><dt>Prescription</dt><dd>
                                    {assessmentOf.assessment.prescriptions.map((m, i) => (
                                        <div key={i}>{[m.medicine, m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}{m.instructions ? ` (${m.instructions})` : ''}</div>
                                    ))}
                                </dd></div>
                            )}
                            {dispensedLine(assessmentOf.assessment) && <div><dt>Medicine dispensed</dt><dd>{dispensedLine(assessmentOf.assessment)}</dd></div>}
                            {assessmentOf.assessment.referral_facility && <div><dt>Referral</dt><dd>{assessmentOf.assessment.referral_facility}{assessmentOf.assessment.referral_reason ? `: ${assessmentOf.assessment.referral_reason}` : ''}</dd></div>}
                            {assessmentOf.assessment.follow_up_needed ? <div><dt>Follow-up</dt><dd>{assessmentOf.assessment.follow_up_date ? `By ${formatDate(assessmentOf.assessment.follow_up_date)}` : 'Needed'}{assessmentOf.assessment.follow_up_notes ? `: ${assessmentOf.assessment.follow_up_notes}` : ''}</dd></div> : null}
                        </dl>
                    </div>
                </div>
            )}

            {advanceOpen && advance && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-adv-title">
                    <form className="modal-bc" onSubmit={registerAdvance}>
                        <div className="modal-header-bc">
                            <h3 id="bc-adv-title">Advance listing</h3>
                            <button type="button" className="close-bc" onClick={() => setAdvanceOpen(false)} aria-label="Close" title="Close"><X size={20} aria-hidden="true" /></button>
                        </div>
                        <div className="field-bc">
                            <label htmlFor="bc-adv-service">Check-up service</label>
                            <select id="bc-adv-service" required autoFocus value={advanceForm.visit_type} onChange={(e) => setAdvanceForm({ ...advanceForm, visit_type: e.target.value })}>
                                <option value="">-- Select --</option>
                                {advance.services.filter((s) => s.offered).map((s) => (
                                    <option key={s.visit_type} value={s.visit_type} disabled={s.listing_full || s.scheduled || !s.service_open}>
                                        {s.visit_type} ({s.scheduled ? 'already scheduled' : !s.service_open ? 'closed' : `${s.registered} of ${s.listing_limit} registered${s.listing_full ? ', full' : ''}`})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setAdvanceOpen(false)}>Cancel</button>
                            <button type="submit" className="btn-bc btn-primary-bc" disabled={advanceBusy || !advanceForm.visit_type}>{advanceBusy ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            )}

            {requestFor && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-request-title">
                    <form className="modal-bc" onSubmit={sendRequest}>
                        <div className="modal-header-bc">
                            <h3 id="bc-request-title">Take a place</h3>
                            <button type="button" className="close-bc" onClick={() => setRequestFor(null)} aria-label="Close" title="Close"><X size={20} aria-hidden="true" /></button>
                        </div>
                        <p className="request-help-bc form-summary-bc">
                            {requestFor.doctor_name}, {formatDate(requestFor.date)}, {to12h(requestFor.start_time)} - {to12h(requestFor.end_time)}{requestFor.location ? ` (${requestFor.location})` : ''}
                        </p>
                        <div className="field-bc">
                            <label htmlFor="bc-service">Check-up</label>
                            <select id="bc-service" required autoFocus value={requestForm.visit_type} onChange={e => setRequestForm({ ...requestForm, visit_type: e.target.value })} disabled={requestFor.purposes.length === 1}>
                                <option value="">-- Select --</option>
                                {requestFor.purposes.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setRequestFor(null)}>Cancel</button>
                            <button type="submit" className="btn-bc btn-primary-bc" disabled={submitting || !requestForm.visit_type}>{submitting ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default BookCheckup;
