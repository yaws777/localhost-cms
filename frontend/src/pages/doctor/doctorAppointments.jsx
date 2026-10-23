// doctorAppointments.jsx
// The doctor's appointment lifecycle: review incoming requests, confirm / decline, reschedule, cancel (each with a reason),
// check in and document the consultation, and see the reason log of every appointment.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
    CalendarPlus, Footprints, Search, Check, X, CalendarClock, History, ClipboardPlus, UserX, Ban, CalendarX, Stethoscope
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { PURPOSES, visitLabel, sourceLabel, statusLabel, statusClass, localDateStr, fullName } from '../../utils/visitPurpose';
import {
    ReasonModal, RescheduleModal, LogModal, DirectAppointmentModal, WalkInModal
} from '../../components/doctor/AppointmentModals';
import ConsultationModal from '../../components/doctor/ConsultationModal';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const PAGE_SIZE = 10;

const TABS = [
    ['requests', 'Requests'],
    ['today', 'Today'],
    ['upcoming', 'Upcoming'],
    ['past', 'Past'],
    ['all', 'All']
];

const put = async (path, body) => {
    const res = await fetch(`${API}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return data;
};

const DoctorAppointments = () => {
    const { doctorId, userId, refreshPending } = useOutletContext();
    const { showAlert } = useAlert();
    const [params, setParams] = useSearchParams();

    const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'upcoming';
    const focusId = params.get('focus');

    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ requests: 0, today: 0 });
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [purpose, setPurpose] = useState('');
    const [day, setDay] = useState('');

    const [confirmTarget, setConfirmTarget] = useState(null);
    const [declineTarget, setDeclineTarget] = useState(null);
    const [cancelTarget, setCancelTarget] = useState(null);
    const [moveTarget, setMoveTarget] = useState(null);
    const [logTarget, setLogTarget] = useState(null);
    const [consultTarget, setConsultTarget] = useState(null);
    const [showDirect, setShowDirect] = useState(false);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const reqSeq = useRef(0);

    const setTab = (key) => { const next = new URLSearchParams(params); next.set('tab', key); next.delete('focus'); setParams(next, { replace: true }); setPage(1); };

    useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

    const fetchCounts = useCallback(async () => {
        try {
            const [r, t] = await Promise.all([
                fetch(`${API}/api/doctor/${doctorId}/appointments?scope=requests&pageSize=1`).then((x) => x.json()),
                fetch(`${API}/api/doctor/${doctorId}/appointments?scope=today&pageSize=1`).then((x) => x.json())
            ]);
            setCounts({ requests: r.success ? r.total : 0, today: t.success ? t.total : 0 });
        } catch (e) { /* counts are cosmetic */ }
    }, [doctorId]);

    const fetchList = useCallback(async () => {
        const seq = ++reqSeq.current;
        setLoading(true);
        try {
            const qs = new URLSearchParams({ scope: tab, page, pageSize: PAGE_SIZE });
            if (query) qs.set('q', query);
            if (purpose) qs.set('purpose', purpose);
            if (day) { qs.set('from', day); qs.set('to', day); }
            const res = await fetch(`${API}/api/doctor/${doctorId}/appointments?${qs.toString()}`);
            const data = await res.json();
            if (seq !== reqSeq.current) return;
            if (data.success) { setItems(data.appointments); setTotal(data.total); }
            else showAlert(data.message || 'Could not load the appointments.', 'error');
        } catch (e) {
            if (seq === reqSeq.current) showAlert('Could not reach the server.', 'error');
        } finally {
            if (seq === reqSeq.current) setLoading(false);
        }
    }, [doctorId, tab, page, query, purpose, day, showAlert]);

    useEffect(() => { fetchList(); }, [fetchList]);
    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    const refresh = () => { fetchList(); fetchCounts(); refreshPending?.(); };

    // ---- lifecycle actions ----
    const confirmBooking = async (note) => {
        const data = await put(`/api/doctor-bookings/${confirmTarget.appointment_id}/approve`, { sender_id: userId, reason: note });
        if (data.success) { setConfirmTarget(null); showAlert('Booking confirmed. The student and parents were notified.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not confirm the booking.', 'error');
    };

    const declineBooking = async (reason) => {
        const data = await put(`/api/doctor-bookings/${declineTarget.appointment_id}/decline`, { sender_id: userId, reason });
        if (data.success) { setDeclineTarget(null); showAlert('Booking declined. The student and parents were notified.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not decline the booking.', 'error');
    };

    const cancelAppointment = async (reason) => {
        const data = await put(`/api/doctor-visits/cancel/${cancelTarget.appointment_id}`, { sender_id: userId, reason });
        if (data.success) { setCancelTarget(null); showAlert('Appointment cancelled. The student and parents were notified.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not cancel the appointment.', 'error');
    };

    const reschedule = async ({ start_time, end_time, reason }) => {
        const data = await put(`/api/doctor-visits/reschedule/${moveTarget.appointment_id}`, { sender_id: userId, start_time, end_time, reason });
        if (data.success) { setMoveTarget(null); showAlert('Appointment rescheduled. The student and parents were notified.', 'success'); refresh(); return ''; }
        return data.message || 'Could not reschedule the appointment.';
    };

    const markNoShow = async (a) => {
        const data = await put(`/api/doctor-visits/status/${a.appointment_id}`, { student_id: a.student_id, status: 'Absent', reason: 'No-show' });
        if (data.success) { showAlert('Marked as no-show.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not update the attendance.', 'error');
    };

    const afterWalkIn = async (created) => {
        setTab('today');
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/appointments?scope=today&pageSize=50`);
            const data = await res.json();
            const row = data.appointments?.find((a) => a.appointment_id === created.appointment_id);
            if (row) setConsultTarget(row);
        } catch (e) { /* the list still refreshes */ }
        refresh();
    };

    const today = localDateStr();
    const startedOrToday = (a) => String(a.start_time).slice(0, 10) <= today;

    const renderActions = (a) => {
        const buttons = [];
        const documented = !!a.assessment_id;

        if (a.status === 'Pending Approval') {
            buttons.push(<button key="ok" className="dp-btn dp-btn-success dp-btn-sm" onClick={() => setConfirmTarget(a)}><Check size={15} /> Confirm</button>);
            buttons.push(<button key="mv" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setMoveTarget(a)}><CalendarClock size={15} /> Reschedule</button>);
            buttons.push(<button key="no" className="dp-btn dp-btn-danger dp-btn-sm" onClick={() => setDeclineTarget(a)}><X size={15} /> Decline</button>);
        } else if (a.status === 'Scheduled') {
            if (['Absent', 'Excused'].includes(a.attendance_status)) {
                buttons.push(<span key="att" className="dp-chip st-no-show">{a.attendance_status === 'Absent' ? 'No-show' : 'Excused'}</span>);
            } else if (documented) {
                buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit consultation</button>);
            } else if (startedOrToday(a)) {
                buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><Stethoscope size={15} /> {a.attendance_status === 'Present' ? 'Document' : 'Start consultation'}</button>);
            }
            if (a.attendance_status === 'Pending' && !documented) {
                buttons.push(<button key="mv" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setMoveTarget(a)}><CalendarClock size={15} /> Reschedule</button>);
                if (startedOrToday(a)) buttons.push(<button key="ns" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => markNoShow(a)}><UserX size={15} /> No-show</button>);
                buttons.push(<button key="cx" className="dp-btn dp-btn-danger dp-btn-sm" onClick={() => setCancelTarget(a)}><Ban size={15} /> Cancel</button>);
            }
        } else if (a.status === 'Completed' && documented) {
            buttons.push(<button key="doc" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit consultation</button>);
        }
        buttons.push(<button key="log" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setLogTarget(a)} title="History and reasons"><History size={15} /> History</button>);
        return buttons;
    };

    const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Appointments</h2>
                    <p>Review requests, confirm, reschedule or cancel with a reason, and document each consultation.</p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary" onClick={() => setShowDirect(true)}><CalendarPlus size={17} /> Direct appointment</button>
                    <button className="dp-btn dp-btn-accent" onClick={() => setShowWalkIn(true)}><Footprints size={17} /> Walk-in</button>
                </div>
            </div>

            <div className="dp-tabs" role="tablist" aria-label="Appointment lists">
                {TABS.map(([key, label]) => (
                    <button key={key} role="tab" aria-selected={tab === key} className={`dp-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                        {label}
                        {(key === 'requests' || key === 'today') && counts[key] > 0 && <span className="n">{counts[key]}</span>}
                    </button>
                ))}
            </div>

            <div className="dp-filters">
                <div className="dp-search grow">
                    <Search size={16} />
                    <input className="dp-input" type="search" placeholder="Search student, ID or purpose" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search appointments" />
                </div>
                <select className="dp-select" style={{ width: 'auto', minWidth: 170 }} value={purpose} onChange={(e) => { setPurpose(e.target.value); setPage(1); }} aria-label="Purpose">
                    <option value="">All purposes</option>
                    {PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                    <option value="Follow-up">Follow-up</option>
                </select>
                <input className="dp-input" style={{ width: 'auto' }} type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} aria-label="Date" />
                {(day || purpose || search) && <button className="dp-btn dp-btn-ghost" onClick={() => { setDay(''); setPurpose(''); setSearch(''); }}>Clear</button>}
            </div>

            {loading ? (
                <div className="dp-card dp-empty">Loading appointments...</div>
            ) : items.length === 0 ? (
                <div className="dp-card dp-empty">
                    <CalendarX size={36} />
                    <p>{tab === 'requests' ? 'No booking requests are waiting for you.' : 'No appointments to show here.'}</p>
                </div>
            ) : (
                <div className="dp-list">
                    {items.map((a) => (
                        <article key={`${a.appointment_id}-${a.student_id}`} className={`dp-appt ${focusId === a.appointment_id ? 'focus' : ''}`}>
                            <div className="dp-appt-when">
                                <span className="d">{formatDate(a.start_time)}</span>
                                <span className="t">{formatTime(a.start_time)} - {formatTime(a.end_time)}</span>
                            </div>
                            <div className="dp-appt-main">
                                <h4>{fullName(a.student_first_name, a.student_last_name)} <span className="dp-hint">{a.student_id}</span></h4>
                                <div className="dp-appt-sub">{visitLabel(a.visit_type, a.purpose_other)}{a.year_level ? ` - Year ${a.year_level}${a.section ? `, Section ${a.section}` : ''}` : ''}</div>
                                {a.booking_reason && <div className="dp-appt-reason">Reason: {a.booking_reason}</div>}
                                {a.decline_reason && ['Cancelled', 'Declined'].includes(a.status) && <div className="dp-appt-reason">{a.status === 'Declined' ? 'Declined' : 'Cancelled'}: {a.decline_reason}</div>}
                                <div className="dp-appt-chips">
                                    <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
                                    <span className="dp-chip source">{sourceLabel(a.booking_source)}</span>
                                    {a.assessment_id && <span className="dp-chip st-completed">Documented</span>}
                                    {!!a.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
                                    {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Follow-up</span>}
                                </div>
                            </div>
                            <div className="dp-appt-actions">{renderActions(a)}</div>
                        </article>
                    ))}
                </div>
            )}

            {total > PAGE_SIZE && (
                <div className="dp-pager">
                    <span>{total} appointments</span>
                    <div>
                        <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span>Page {page} of {pageCount}</span>
                        <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                </div>
            )}

            <ReasonModal
                isOpen={!!confirmTarget}
                title="Confirm booking"
                message={confirmTarget && `${fullName(confirmTarget.student_first_name, confirmTarget.student_last_name)} - ${formatDate(confirmTarget.start_time)}, ${formatTime(confirmTarget.start_time)}. The student and parents are notified.`}
                label="Note for the student"
                required={false}
                confirmLabel="Confirm booking"
                onSubmit={confirmBooking}
                onClose={() => setConfirmTarget(null)}
            />
            <ReasonModal
                isOpen={!!declineTarget}
                title="Decline booking"
                message={declineTarget && `${fullName(declineTarget.student_first_name, declineTarget.student_last_name)} - ${formatDate(declineTarget.start_time)}, ${formatTime(declineTarget.start_time)}.`}
                label="Reason (shown to the student)"
                placeholder="e.g. Please book one of the afternoon blocks instead"
                confirmLabel="Decline booking"
                danger
                onSubmit={declineBooking}
                onClose={() => setDeclineTarget(null)}
            />
            <ReasonModal
                isOpen={!!cancelTarget}
                title="Cancel appointment"
                message={cancelTarget && `${fullName(cancelTarget.student_first_name, cancelTarget.student_last_name)} - ${formatDate(cancelTarget.start_time)}, ${formatTime(cancelTarget.start_time)}. The student and parents are notified.`}
                label="Reason (shown to the student)"
                placeholder="e.g. Emergency at the clinic, please rebook"
                confirmLabel="Cancel appointment"
                danger
                onSubmit={cancelAppointment}
                onClose={() => setCancelTarget(null)}
            />
            {moveTarget && <RescheduleModal key={moveTarget.appointment_id} appt={moveTarget} onSubmit={reschedule} onClose={() => setMoveTarget(null)} />}
            <LogModal appt={logTarget} onClose={() => setLogTarget(null)} />
            {consultTarget && <ConsultationModal key={consultTarget.appointment_id} appt={consultTarget} doctorId={doctorId} userId={userId} onClose={() => setConsultTarget(null)} onSaved={refresh} />}

            <DirectAppointmentModal isOpen={showDirect} fixedDoctorId={doctorId} creator={{ doctorId }} userId={userId} onClose={() => setShowDirect(false)} onCreated={refresh} />
            <WalkInModal isOpen={showWalkIn} fixedDoctorId={doctorId} creator={{ doctorId }} userId={userId} onClose={() => setShowWalkIn(false)} onCreated={afterWalkIn} />
        </>
    );
};

export default DoctorAppointments;
