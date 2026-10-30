// ConsultationLists.jsx
// The check-ups in three lists - Upcoming (not started: reschedule / cancel), On going (happening now: the queue of every running
// session with Call next / Void / Walk-in / Accommodate, time in or QR scan before the check-up is recorded, extend, no-show) and Past (over: closed).
// Upcoming and Past are shown in one container per session day (a schedule on a date, or the direct appointments of a doctor on a date):
// the container opens to all its participants.
// The doctor (/DoctorCheckup) and the nurse (Doctor Visit > Check-up) mount this same screen:
//   role "doctor" - the doctor's own check-ups; past rows keep the assessment history and the repeat button
//   role "nurse"  - every doctor's check-ups; a past row can only be viewed (assessment or details)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    CalendarPlus, Search, CalendarClock, History, ClipboardPlus, UserX, Ban, FileText, Printer, Pill, Stethoscope, TimerReset,
    FolderOpen, ChevronLeft, Eye, Repeat, Clock, QrCode, Users
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, statusClass, statusLabel, fullName } from '../../utils/visitPurpose';
import { printDocument, visitDocumentHtml } from '../../utils/doctorVisitDocuments';
import { useSpecializations } from '../../hooks/useSpecializations';
import { ExtendAppointmentModal } from './SessionModals';
import QueuePanel from './QueuePanel';
import AttendanceScanModal from './AttendanceScanModal';
import { RepeatModal } from './FollowUps';
import {
    ReasonModal, RescheduleModal, LogModal, DirectAppointmentModal, WalkInModal
} from '../doctor/AppointmentModals';
import { AssessmentViewModal, AssessmentHistoryModal } from '../doctor/AssessmentModals';
import ConsultationModal from '../doctor/ConsultationModal';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const PAGE_SIZE = 10;
const GROUP_PAGE_SIZE = 12;
const PAST_TABLE_SIZE = 15;

export const CONSULTATION_TABS = [
    ['upcoming', 'Upcoming Check-up'],
    ['ongoing', 'On going Check-up'],
    ['past', 'Past Check-up']
];

const toMs = (value) => new Date(String(value).replace(' ', 'T')).getTime();
// every check-up is in exactly one of three phases
const phaseOf = (a) => {
    const now = Date.now();
    if (toMs(a.end_time) <= now || ['Cancelled', 'Declined', 'No-Show'].includes(a.status)) return 'past';
    return toMs(a.start_time) <= now ? 'ongoing' : 'upcoming';
};

const put = async (path, body) => {
    const res = await fetch(`${API}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* not json */ }
    return data;
};

// Upcoming and Past are shown as containers first
const GROUPED_TABS = ['upcoming', 'past'];

const dayTitle = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const ConsultationLists = ({ role, doctorId, doctors, nurseId, userId, tab, onTab, focusId, onChanged }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const isNurse = role === 'nurse';
    const doctorPath = doctorId || 'all';
    const creator = isNurse ? { nurseId } : { doctorId };

    const [items, setItems] = useState([]);
    const [groups, setGroups] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ upcoming: 0, ongoing: 0, past: 0 });
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [purpose, setPurpose] = useState('');
    const [day, setDay] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');
    const [openGroup, setOpenGroup] = useState(null);

    const [cancelTarget, setCancelTarget] = useState(null);
    const [moveTarget, setMoveTarget] = useState(null);
    const [logTarget, setLogTarget] = useState(null);
    const [consultTarget, setConsultTarget] = useState(null);
    const [viewTarget, setViewTarget] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [repeatTarget, setRepeatTarget] = useState(null);
    const [showDirect, setShowDirect] = useState(false);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [extendTarget, setExtendTarget] = useState(null);
    const [runningSessions, setRunningSessions] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [queueKey, setQueueKey] = useState(0);
    const reqSeq = useRef(0);

    // upcoming / past check-ups: the containers of the sessions, until one is opened
    const inFolders = GROUPED_TABS.includes(tab) && !openGroup;
    const pageSize = inFolders ? GROUP_PAGE_SIZE : tab === 'past' ? PAST_TABLE_SIZE : PAGE_SIZE;

    const setTab = (key) => { onTab(key); setOpenGroup(null); setPage(1); };

    useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

    // the other tab of the list the nurse or doctor came from
    useEffect(() => { setOpenGroup(null); setPage(1); }, [tab]);

    const filterParams = useCallback((scope) => {
        const qs = new URLSearchParams({ scope });
        if (query) qs.set('q', query);
        if (purpose) qs.set('purpose', purpose);
        if (isNurse && doctorFilter) qs.set('doctor_id', doctorFilter);
        return qs;
    }, [query, purpose, isNurse, doctorFilter]);

    const fetchCounts = useCallback(async () => {
        try {
            const scopes = CONSULTATION_TABS.map(([k]) => k);
            const results = await Promise.all(scopes.map((scope) => {
                const qs = new URLSearchParams({ scope, pageSize: 1 });
                if (isNurse && doctorFilter) qs.set('doctor_id', doctorFilter);
                return fetch(`${API}/api/doctor/${doctorPath}/appointments?${qs.toString()}`).then((x) => x.json());
            }));
            setCounts(Object.fromEntries(scopes.map((scope, i) => [scope, results[i].success ? results[i].total : 0])));
        } catch (e) { /* counts are cosmetic */ }
    }, [doctorPath, isNurse, doctorFilter]);

    const fetchList = useCallback(async () => {
        const seq = ++reqSeq.current;
        setLoading(true);
        try {
            const qs = filterParams(tab);
            qs.set('page', page);
            qs.set('pageSize', pageSize);
            if (openGroup) {
                qs.set('from', openGroup.day); qs.set('to', openGroup.day);
                qs.set('schedule_id', openGroup.schedule_id || 'none');
                if (openGroup.doctor_id) qs.set('doctor_id', openGroup.doctor_id);
            } else if (day) { qs.set('from', day); qs.set('to', day); }
            const res = await fetch(`${API}/api/doctor/${doctorPath}/${inFolders ? 'appointment-groups' : 'appointments'}?${qs.toString()}`);
            const data = await res.json();
            if (seq !== reqSeq.current) return;
            if (data.success) {
                if (inFolders) setGroups(data.groups); else setItems(data.appointments);
                setTotal(data.total);
            } else showAlert(data.message || 'Could not load the check-ups.', 'error');
        } catch (e) {
            if (seq === reqSeq.current) showAlert('Could not reach the server.', 'error');
        } finally {
            if (seq === reqSeq.current) setLoading(false);
        }
    }, [doctorPath, tab, page, pageSize, inFolders, openGroup, day, filterParams, showAlert]);

    useEffect(() => { fetchList(); }, [fetchList]);
    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    // the sessions running right now: each one has a queue the doctor works through
    const fetchRunning = useCallback(async () => {
        try {
            const today = new Date().toLocaleDateString('sv-SE');
            const qs = new URLSearchParams({ from: today, to: today });
            if (doctorId) qs.set('doctor_id', doctorId);
            else if (isNurse && doctorFilter) qs.set('doctor_id', doctorFilter);
            const res = await fetch(`${API}/api/schedule-calendar?${qs.toString()}`);
            const data = await res.json();
            if (data.success) setRunningSessions(data.sessions.filter((s) => s.state === 'ongoing'));
        } catch (e) { /* the list below still works */ }
    }, [doctorId, isNurse, doctorFilter]);

    useEffect(() => { if (tab === 'ongoing') fetchRunning(); }, [tab, fetchRunning]);

    const refresh = () => { fetchList(); fetchCounts(); fetchRunning(); setQueueKey((k) => k + 1); onChanged?.(); };

    // open the check-up of a number that is being served
    const documentEntry = async (entry) => {
        try {
            const res = await fetch(`${API}/api/doctor/${doctorPath}/appointments?scope=ongoing&pageSize=100`);
            const data = await res.json();
            const row = data.appointments?.find((a) => a.appointment_id === entry.appointment_id);
            if (row) setConsultTarget(row); else showAlert('Could not find this check-up.', 'warning');
        } catch (e) { showAlert('Could not open the check-up.', 'error'); }
    };

    // ---- lifecycle actions ----
    const cancelAppointment = async (reason) => {
        const data = await put(`/api/doctor-visits/cancel/${cancelTarget.appointment_id}`, { sender_id: userId, reason });
        if (data.success) { setCancelTarget(null); showAlert('Check-up cancelled. The student and parents were notified.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not cancel the check-up.', 'error');
    };

    const reschedule = async ({ start_time, end_time, reason }) => {
        const data = await put(`/api/doctor-visits/reschedule/${moveTarget.appointment_id}`, { sender_id: userId, start_time, end_time, reason });
        if (data.success) { setMoveTarget(null); showAlert('Check-up rescheduled. The student and parents were notified.', 'success'); refresh(); return ''; }
        return data.message || 'Could not reschedule the check-up.';
    };

    const markNoShow = async (a) => {
        const data = await put(`/api/doctor-visits/status/${a.appointment_id}`, { student_id: a.student_id, status: 'Absent', reason: 'No-show' });
        if (data.success) { showAlert('Marked as no-show.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not update the attendance.', 'error');
    };

    // manual time in (or a QR scan): the student is at the clinic, so the check-up can be recorded
    const timeIn = async (a, quiet = false) => {
        const data = await put(`/api/doctor-visits/status/${a.appointment_id}`, { student_id: a.student_id, status: 'Present' });
        if (data.success) { if (!quiet) showAlert(`${fullName(a.student_first_name, a.student_last_name)} has a time in now.`, 'success'); refresh(); return true; }
        if (!quiet) showAlert(data.message || 'Could not record the time in.', 'error');
        return false;
    };

    // the walk-in waits in the walk-in queue: the doctor calls the number
    const afterWalkIn = () => { setTab('ongoing'); refresh(); };

    const print = (a, kind) => printDocument(
        kind === 'prescription' ? 'Prescription' : 'Doctor visit summary',
        visitDocumentHtml(kind, a, 'School Nurse'),
        () => showAlert('The print window was blocked. Allow pop-ups for this site and try again.', 'warning')
    );

    const rxCount = (a) => (Array.isArray(a.prescriptions) ? a.prescriptions.length : 0);
    const withName = (a) => ({ ...a, student_name: fullName(a.student_first_name, a.student_last_name) });

    // ---- the actions of Upcoming and On going rows (the same for the doctor and the nurse) ----
    const renderActions = (a) => {
        const buttons = [];
        const documented = !!a.assessment_id;
        const phase = phaseOf(a);

        if (a.status === 'Scheduled') {
            if (['Absent', 'Excused'].includes(a.attendance_status)) {
                buttons.push(<span key="att" className="dp-chip st-no-show">{a.attendance_status === 'Absent' ? 'No-show' : 'Excused'}</span>);
            } else if (documented) {
                buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit check-up</button>);
            } else if (phase === 'ongoing' && (!a.queue_state || a.queue_state === 'Serving')) {
                // the check-up is recorded only after the time in (by hand or QR code)
                if (a.attendance_status === 'Present') buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><Stethoscope size={15} /> Document</button>);
                else buttons.push(<button key="in" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => timeIn(a)} title="Record the time in by hand, or scan the QR code of the student"><Clock size={15} /> Time in</button>);
            }
            if (phase === 'upcoming') {
                // a place in a session queue has no time of its own: the doctor reschedules the whole session instead (My Schedule)
                if (!a.queue_state) buttons.push(<button key="mv" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setMoveTarget(a)}><CalendarClock size={15} /> Reschedule</button>);
                buttons.push(<button key="cx" className="dp-btn dp-btn-danger dp-btn-sm" onClick={() => setCancelTarget(a)}><Ban size={15} /> Cancel</button>);
            }
            if (phase === 'ongoing' && !documented && !a.queue_state) {
                if (a.attendance_status === 'Pending') buttons.push(<button key="ns" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => markNoShow(a)}><UserX size={15} /> No-show</button>);
                buttons.push(<button key="ex" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setExtendTarget(withName(a))}><TimerReset size={15} /> Extend</button>);
            }
        } else if (a.status === 'Completed' && documented) {
            buttons.push(<button key="doc" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit check-up</button>);
        }
        if (documented) {
            buttons.push(<button key="sum" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => print(a, 'summary')}><Printer size={15} /> Summary</button>);
            if (rxCount(a) > 0) buttons.push(<button key="rx" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => print(a, 'prescription')}><Pill size={15} /> Prescription</button>);
        }
        buttons.push(<button key="log" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setLogTarget(a)} title="History and reasons"><History size={15} /> History</button>);
        return buttons;
    };

    // ---- the actions of a Past row ----
    const renderPastActions = (a) => {
        const documented = !!a.assessment_id;
        // the nurse can only look: the assessment, or the details when nothing was documented
        if (isNurse) {
            return (
                <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setViewTarget(a)}>
                    <Eye size={15} /> {documented ? 'View assessment' : 'View details'}
                </button>
            );
        }
        const buttons = [];
        if (documented) {
            buttons.push(<button key="doc" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit check-up</button>);
        } else if (a.status === 'Scheduled' && a.attendance_status === 'Present') {
            buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><Stethoscope size={15} /> Document</button>);
        }
        if (documented) {
            buttons.push(<button key="sum" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => print(a, 'summary')}><Printer size={15} /> Summary</button>);
            if (rxCount(a) > 0) buttons.push(<button key="rx" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => print(a, 'prescription')}><Pill size={15} /> Prescription</button>);
            buttons.push(<button key="rp" className="dp-btn dp-btn-accent dp-btn-sm" onClick={() => setRepeatTarget(a)} title="Direct appointment, or wait for a schedule"><Repeat size={15} /> Repeat</button>);
        }
        buttons.push(<button key="log" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setHistoryTarget(a)} title="Assessment history of the student"><History size={15} /> Assessment history</button>);
        return buttons;
    };

    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const tabLabel = (CONSULTATION_TABS.find(([k]) => k === tab) || CONSULTATION_TABS[0])[1].toLowerCase();
    const filtering = !!(day || purpose || search || doctorFilter);
    const clearFilters = () => { setDay(''); setPurpose(''); setSearch(''); setDoctorFilter(''); setPage(1); };

    const doctorLine = (a) => (isNurse ? ` - Dr. ${a.doc_first_name} ${a.doc_last_name}` : '');

    const renderCards = () => (
        <div className="dp-list">
            {items.filter((a) => !(tab === 'ongoing' && a.queue_state)).map((a) => {
                const documented = !!a.assessment_id;
                return (
                    <article key={`${a.appointment_id}-${a.student_id}`} className={`dp-appt ${focusId === a.appointment_id ? 'focus' : ''}`}>
                        <div className="dp-appt-when">
                            <span className="d">{a.queue_state ? `${a.queue_lane === 'Walk-in' ? 'W' : '#'}${a.queue_no}` : formatDate(a.start_time)}</span>
                            <span className="t">{formatTime(a.start_time)} - {formatTime(a.end_time)}</span>
                        </div>
                        <div className="dp-appt-main">
                            <h4>{fullName(a.student_first_name, a.student_last_name)} <span className="dp-hint">{a.student_id}</span></h4>
                            <div className="dp-appt-sub">{visitLabel(a.visit_type, a.purpose_other)}{a.year_level ? ` - Year ${a.year_level}${a.section ? `, Section ${a.section}` : ''}` : ''}{doctorLine(a)}</div>
                            {a.booking_reason && <div className="dp-appt-reason">Reason: {a.booking_reason}</div>}
                            {a.decline_reason && ['Cancelled', 'Declined'].includes(a.status) && <div className="dp-appt-reason">{a.status === 'Declined' ? 'Declined' : 'Cancelled'}: {a.decline_reason}</div>}
                            {documented && (
                                <>
                                    <div className="dp-appt-reason"><strong>Diagnosis:</strong> {a.diagnosis}</div>
                                    {a.treatment_recommendations && <div className="dp-appt-sub">Plan: {a.treatment_recommendations}</div>}
                                </>
                            )}
                            <div className="dp-appt-chips">
                                <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
                                <span className="dp-chip source">{sourceLabel(a.booking_source)}</span>
                                {documented && <span className="dp-chip st-completed">Documented</span>}
                                {documented && rxCount(a) > 0 && <span className="dp-chip"><Pill size={12} /> {rxCount(a)} medicine{rxCount(a) === 1 ? '' : 's'}</span>}
                                {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Repeat{a.follow_up_date ? `: ${formatDate(a.follow_up_date)}` : ''}</span>}
                                {!!a.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
                                {a.template_name && <span className="dp-chip source">{a.template_name}</span>}
                            </div>
                        </div>
                        <div className="dp-appt-actions">{renderActions(a)}</div>
                    </article>
                );
            })}
        </div>
    );

    const groupName = (g) => {
        const who = isNurse ? `Dr. ${g.doc_first_name} ${g.doc_last_name} - ` : '';
        if (!g.schedule_id) return `${who}Direct appointments`;
        const purpose = g.schedule_visit_type && g.schedule_visit_type !== 'Any' ? g.schedule_visit_type : g.visit_types;
        return `${who}${purpose || 'Check-up session'}`;
    };

    // one container per session day: it opens to all its participants
    const renderFolders = () => (
        <div className="dp-day-grid">
            {groups.map((g) => (
                <button key={`${g.schedule_id || 'none'}-${g.doctor_id}-${g.day}`} type="button" className="dp-day-folder" onClick={() => { setOpenGroup(g); setPage(1); }} aria-label={`Open ${groupName(g)}, ${dayTitle(g.day)}`}>
                    <FolderOpen size={26} />
                    <strong>{groupName(g)}</strong>
                    <span>{dayTitle(g.day)}</span>
                    <span>{formatTime(g.first_start)} - {formatTime(g.last_end)}{g.location ? ` - ${g.location}` : ''}</span>
                    <span><Users size={13} /> {g.total} participant{g.total === 1 ? '' : 's'}{tab === 'past' ? ` - ${g.documented} documented` : ''}</span>
                    {g.abnormal > 0 && <span className="dp-chip abnormal">{g.abnormal} abnormal</span>}
                    {tab === 'past' && g.missed > 0 && <span className="dp-chip st-no-show">{g.missed} missed or cancelled</span>}
                </button>
            ))}
        </div>
    );

    const renderDayTable = () => (
        <div className="dp-card dp-table-wrap">
            <table className="dp-table">
                <thead>
                    <tr>
                        <th>Time</th><th>Student</th><th>Purpose</th>{isNurse && <th>Doctor</th>}<th>Status</th><th>Assessment</th><th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((a) => {
                        const documented = !!a.assessment_id;
                        return (
                            <tr key={`${a.appointment_id}-${a.student_id}`} className={focusId === a.appointment_id ? 'focus' : ''}>
                                <td className="nowrap">{formatTime(a.start_time)} - {formatTime(a.end_time)}</td>
                                <td>
                                    <strong>{fullName(a.student_first_name, a.student_last_name)}</strong>
                                    <div className="dp-hint">{a.student_id}{a.year_level ? ` - Year ${a.year_level}${a.section ? `, ${a.section}` : ''}` : ''}</div>
                                </td>
                                <td>
                                    {visitLabel(a.visit_type, a.purpose_other)}
                                    <div className="dp-hint">{sourceLabel(a.booking_source)}</div>
                                </td>
                                {isNurse && <td>Dr. {a.doc_first_name} {a.doc_last_name}</td>}
                                <td>
                                    <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
                                    {['Absent', 'Excused'].includes(a.attendance_status) && <div className="dp-hint">{a.attendance_status === 'Absent' ? 'No-show' : 'Excused'}</div>}
                                    {a.decline_reason && ['Cancelled', 'Declined'].includes(a.status) && <div className="dp-hint">{a.decline_reason}</div>}
                                </td>
                                <td>
                                    {documented ? (
                                        <>
                                            <div className="dp-cell-clip">{a.diagnosis}</div>
                                            <div className="dp-appt-chips">
                                                {rxCount(a) > 0 && <span className="dp-chip"><Pill size={12} /> {rxCount(a)}</span>}
                                                {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Repeat</span>}
                                                {!!a.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
                                            </div>
                                        </>
                                    ) : <span className="dp-hint">Not documented</span>}
                                </td>
                                <td><div className="dp-row-actions">{renderPastActions(a)}</div></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const rows = inFolders ? groups : items;
    const unit = inFolders ? 'sessions' : 'participants';

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Check-ups</h2>
                    <p>
                        {isNurse ? 'The upcoming, on going and past check-ups of every doctor.' : 'Your upcoming, on going and past check-ups.'}
                        {' '}Upcoming and past check-ups are kept in a container for each session: open one to see all its participants. Past check-ups are closed and can no longer be booked, rescheduled or cancelled.
                    </p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary" onClick={() => setShowDirect(true)}><CalendarPlus size={17} /> Direct appointment</button>
                </div>
            </div>

            <div className="dp-tabs" role="tablist" aria-label="Check-up lists">
                {CONSULTATION_TABS.map(([key, label]) => (
                    <button key={key} role="tab" aria-selected={tab === key} className={`dp-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                        {label}
                        {counts[key] > 0 && <span className="n">{counts[key]}</span>}
                    </button>
                ))}
            </div>

            <div className="dp-filters">
                <div className="dp-search grow">
                    <Search size={16} />
                    <input className="dp-input" type="search" placeholder="Search student, ID or purpose" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search check-ups" />
                </div>
                {isNurse && (
                    <select className="dp-select" style={{ width: 'auto', minWidth: 170 }} value={doctorFilter} onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }} aria-label="Doctor">
                        <option value="">All doctors</option>
                        {(doctors || []).map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.first_name} {d.last_name}</option>)}
                    </select>
                )}
                <select className="dp-select" style={{ width: 'auto', minWidth: 170 }} value={purpose} onChange={(e) => { setPurpose(e.target.value); setPage(1); }} aria-label="Purpose">
                    <option value="">All purposes</option>
                    {visitTypes.map((p) => <option key={p} value={p}>{p}</option>)}
                    <option value="Follow-up">Follow-up</option>
                </select>
                {!openGroup && <input className="dp-input" style={{ width: 'auto' }} type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} aria-label="Date" />}
                {filtering && <button className="dp-btn dp-btn-ghost" onClick={clearFilters}>Clear</button>}
            </div>

            {GROUPED_TABS.includes(tab) && openGroup && (
                <div className="dp-crumbs">
                    <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setOpenGroup(null); setPage(1); }}><ChevronLeft size={15} /> All sessions</button>
                    <FolderOpen size={17} />
                    <strong>{groupName(openGroup)} - {dayTitle(openGroup.day)}</strong>
                </div>
            )}

            {tab === 'ongoing' && runningSessions.map((s) => (
                <section key={`${s.schedule_id}-${s.date}`} className="dp-card running-queue-sc" aria-label="Session queue">
                    <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>
                        {s.doctor_name} - {formatTime(`${s.date} ${s.start_time}`)} to {formatTime(`${s.date} ${s.end_time}`)}{s.location ? ` - ${s.location}` : ''}
                        <span className="dp-hint"> {s.visit_type === 'Any' ? 'Any check-up' : s.visit_type}</span>
                    </h3>
                    <QueuePanel scheduleId={s.schedule_id} date={s.date} creator={creator} userId={userId} refreshKey={queueKey} onChanged={refresh} onDocument={documentEntry} onWalkIn={() => setShowWalkIn(true)} />
                </section>
            ))}

            {tab === 'ongoing' && items.some((a) => !a.queue_state && a.status === 'Scheduled' && a.attendance_status === 'Pending') && (
                <div className="dp-actions" style={{ marginBottom: 12 }}>
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setScanning(true)} title="Scan the QR code of a student to record the time in"><QrCode size={17} /> Scan QR for attendance</button>
                </div>
            )}

            {loading ? (
                <div className="dp-card dp-empty">Loading check-ups...</div>
            ) : rows.length === 0 ? (
                <div className="dp-card dp-empty">
                    <FileText size={36} />
                    <p>No {tabLabel} to show here.</p>
                </div>
            ) : inFolders ? renderFolders() : tab === 'past' ? renderDayTable() : renderCards()}

            {total > pageSize && (
                <div className="dp-pager">
                    <span>{total} {unit}</span>
                    <div>
                        <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span>Page {page} of {pageCount}</span>
                        <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                </div>
            )}

            <ReasonModal
                isOpen={!!cancelTarget}
                title="Cancel check-up"
                message={cancelTarget && `${fullName(cancelTarget.student_first_name, cancelTarget.student_last_name)} - ${formatDate(cancelTarget.start_time)}, ${formatTime(cancelTarget.start_time)}. The student and parents are notified.`}
                label="Reason (shown to the student)"
                placeholder="e.g. Emergency at the clinic, please rebook"
                confirmLabel="Cancel check-up"
                danger
                onSubmit={cancelAppointment}
                onClose={() => setCancelTarget(null)}
            />
            {moveTarget && <RescheduleModal key={moveTarget.appointment_id} appt={moveTarget} onSubmit={reschedule} onClose={() => setMoveTarget(null)} />}
            <LogModal appt={logTarget} onClose={() => setLogTarget(null)} />
            <AssessmentViewModal appt={viewTarget} onClose={() => setViewTarget(null)} />
            <AssessmentHistoryModal appt={historyTarget} onClose={() => setHistoryTarget(null)} />
            <ExtendAppointmentModal appt={extendTarget} creator={creator} userId={userId} onClose={() => setExtendTarget(null)} onDone={refresh} />
            {repeatTarget && <RepeatModal key={repeatTarget.appointment_id} appt={repeatTarget} creator={creator} userId={userId} onClose={() => setRepeatTarget(null)} onDone={refresh} />}
            {consultTarget && (
                <ConsultationModal
                    key={consultTarget.appointment_id} appt={consultTarget} doctorId={isNurse ? consultTarget.doctor_id : doctorId} nurseId={isNurse ? nurseId : undefined}
                    userId={userId} onClose={() => setConsultTarget(null)} onSaved={refresh}
                />
            )}

            <AttendanceScanModal
                isOpen={scanning} onClose={() => setScanning(false)}
                entries={items.filter((a) => !a.queue_state && a.status === 'Scheduled').map((a) => ({
                    appointment_id: a.appointment_id, student_id: a.student_id, student_name: fullName(a.student_first_name, a.student_last_name),
                    label: formatTime(a.start_time), state: 'Waiting', arrived: a.attendance_status === 'Present' ? 1 : 0, raw: a
                }))}
                onArrived={(entry) => timeIn(entry.raw, true)}
            />
            <DirectAppointmentModal isOpen={showDirect} doctors={doctors} fixedDoctorId={doctorId} creator={creator} userId={userId} onClose={() => setShowDirect(false)} onCreated={refresh} />
            <WalkInModal isOpen={showWalkIn} doctors={doctors} fixedDoctorId={doctorId} creator={creator} userId={userId} onClose={() => setShowWalkIn(false)} onCreated={afterWalkIn} />
        </>
    );
};

export default ConsultationLists;
