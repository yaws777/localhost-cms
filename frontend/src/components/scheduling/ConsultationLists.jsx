// ConsultationLists.jsx
// The check-ups in three lists - Upcoming (not started: reschedule / cancel), On going (happening now: the queue of every running
// session: the doctor calls / skips / voids the numbers, the nurse or the doctor adds walk-ins, the NURSE times in the called number with its vital signs
// (not normal values are saved and flagged, then the doctor can document) and times out after the check-up (vital signs optional), extend, no-show) and Past (over: closed).
// Upcoming and Past are shown in one container per session day (a schedule on a date, or the direct appointments of a doctor on a date):
// the container opens to all its participants.
// The doctor (/DoctorCheckup) and the nurse (Doctor Visit > Check-up) mount this same screen:
//   role "doctor" - the doctor's own check-ups; past rows keep the assessment history and the repeat button
//   role "nurse"  - every doctor's check-ups; a past row can only be viewed (assessment or details)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, CalendarClock, History, ClipboardPlus, UserX, Ban, FileText, Printer, Pill, Stethoscope, TimerReset,
    Folder, FolderOpen, FolderHeart, ChevronLeft, ChevronRight, Eye, Repeat, Clock, Users, BellRing, LogOut
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, statusClass, statusLabel, fullName } from '../../utils/visitPurpose';
import { printDocument, visitDocumentHtml } from '../../utils/doctorVisitDocuments';
import { useSpecializations } from '../../hooks/useSpecializations';
import { ExtendAppointmentModal } from './SessionModals';
import SessionEndPrompt from './SessionEndPrompt';
import ExtendSessionModal from './ExtendSessionModal';
import QueuePanel from './QueuePanel';
import VitalsModal from './VitalsModal';
import StudentHealthRecordModal from '../doctor/StudentHealthRecordModal';
import { vitalsLine, inVitalsOf, outVitalsOf } from '../../utils/vitals';
import { RepeatModal } from './FollowUps';
import {
    ReasonModal, RescheduleModal, LogModal, WalkInModal
} from '../doctor/AppointmentModals';
import { Pager } from '../common/RecordFolders';
import { classLabel } from '../../utils/scheduling';
import { AssessmentViewModal, AssessmentHistoryModal } from '../doctor/AssessmentModals';
import ConsultationModal from '../doctor/ConsultationModal';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
// small pages keep a list on one screen
const PAGE_SIZE = 5;
const GROUP_PAGE_SIZE = 8;
const TABLE_SIZE = 6;
const END_CHECK_MS = 30000;

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

// "today", "2 days ago", "in 3 days"; further out the plain date (the right column of a folder row)
const relativeDay = (day) => {
    const diff = Math.round((new Date(`${day}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'tomorrow';
    if (diff === -1) return 'yesterday';
    if (Math.abs(diff) <= 14) return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
    return new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

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
    const [openDoctor, setOpenDoctor] = useState(null); // nurse: the doctor folder opened from All folders
    const [doctorFolders, setDoctorFolders] = useState([]);

    const [cancelTarget, setCancelTarget] = useState(null);
    const [moveTarget, setMoveTarget] = useState(null);
    const [logTarget, setLogTarget] = useState(null);
    const [consultTarget, setConsultTarget] = useState(null);
    const [viewTarget, setViewTarget] = useState(null);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [repeatTarget, setRepeatTarget] = useState(null);
    const [walkInFor, setWalkInFor] = useState(null);
    const [extendTarget, setExtendTarget] = useState(null);
    const [extendSession, setExtendSession] = useState(null);
    const [runningSessions, setRunningSessions] = useState([]);
    const [dismissedEnds, setDismissedEnds] = useState([]);
    const [vitalsTarget, setVitalsTarget] = useState(null); // { appt, mode: 'in' | 'out' }: the nurse's vital signs form
    const [recordTarget, setRecordTarget] = useState(null);
    const [queueKey, setQueueKey] = useState(0);
    const reqSeq = useRef(0);

    // upcoming / past check-ups. Nurse: All folders (one folder per doctor) > the doctor's session containers > the participants.
    // Doctor: the session containers > the participants.
    const grouped = GROUPED_TABS.includes(tab);
    const doctorScope = isNurse ? (openDoctor ? openDoctor.doctor_id : doctorFilter) : '';
    const atRoot = grouped && isNurse && !openGroup && !doctorScope;
    const inFolders = grouped && !openGroup && !atRoot;
    const pageSize = inFolders ? GROUP_PAGE_SIZE : tab === 'past' || tab === 'upcoming' ? TABLE_SIZE : PAGE_SIZE;

    const setTab = (key) => { onTab(key); setOpenGroup(null); setOpenDoctor(null); setPage(1); };

    useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

    // the other tab of the list the nurse or doctor came from
    useEffect(() => { setOpenGroup(null); setOpenDoctor(null); setPage(1); }, [tab]);

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
            qs.set('pageSize', atRoot ? 'all' : pageSize);
            if (openGroup) {
                qs.set('from', openGroup.day); qs.set('to', openGroup.day);
                qs.set('schedule_id', openGroup.schedule_id || 'none');
                if (openGroup.doctor_id) qs.set('doctor_id', openGroup.doctor_id);
            } else {
                if (day) { qs.set('from', day); qs.set('to', day); }
                if (openDoctor) qs.set('doctor_id', openDoctor.doctor_id);
            }
            const res = await fetch(`${API}/api/doctor/${doctorPath}/${atRoot || inFolders ? 'appointment-groups' : 'appointments'}?${qs.toString()}`);
            const data = await res.json();
            if (seq !== reqSeq.current) return;
            if (data.success) {
                if (atRoot) {
                    // one folder per doctor, built from the session containers
                    const byDoctor = new Map();
                    data.groups.forEach((g) => {
                        const f = byDoctor.get(g.doctor_id) || { doctor_id: g.doctor_id, name: `Dr. ${g.doc_first_name} ${g.doc_last_name}`, sessions: 0, total: 0, documented: 0, missed: 0, abnormal: 0, day: g.day };
                        f.sessions += 1; f.total += g.total; f.documented += g.documented; f.missed += g.missed; f.abnormal += g.abnormal;
                        if (tab === 'past' ? g.day > f.day : g.day < f.day) f.day = g.day;
                        byDoctor.set(g.doctor_id, f);
                    });
                    setDoctorFolders([...byDoctor.values()].sort((a, b) => a.name.localeCompare(b.name)));
                } else if (inFolders) setGroups(data.groups); else setItems(data.appointments);
                setTotal(data.total);
            } else showAlert(data.message || 'Could not load the check-ups.', 'error');
        } catch (e) {
            if (seq === reqSeq.current) showAlert('Could not reach the server.', 'error');
        } finally {
            if (seq === reqSeq.current) setLoading(false);
        }
    }, [doctorPath, tab, page, pageSize, inFolders, atRoot, openGroup, openDoctor, day, filterParams, showAlert]);

    useEffect(() => { fetchList(); }, [fetchList]);
    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    // the sessions running right now: each one has a queue the doctor works through
    const fetchRunning = useCallback(async () => {
        try {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
            const qs = new URLSearchParams({ from: today, to: today });
            if (doctorId) qs.set('doctor_id', doctorId);
            else if (isNurse && doctorFilter) qs.set('doctor_id', doctorFilter);
            const res = await fetch(`${API}/api/schedule-calendar?${qs.toString()}`);
            const data = await res.json();
            if (data.success) setRunningSessions(data.sessions.filter((s) => s.state === 'ongoing'));
        } catch (e) { /* the list below still works */ }
    }, [doctorId, isNurse, doctorFilter]);

    // asked on every tab, and again every half minute: the end time can pass while the staff look at another list
    useEffect(() => {
        fetchRunning();
        const timer = setInterval(() => { if (!document.hidden) fetchRunning(); }, END_CHECK_MS);
        return () => clearInterval(timer);
    }, [fetchRunning, tab]);

    // the end time passed: confirm the end (the session moves to Past Check-up) or extend it; "Ask me later" keeps the question on the session card
    const endKey = (s) => `${s.schedule_id}|${s.date}|${s.end_time}`;
    const endAsk = runningSessions.find((s) => s.awaiting_end && !dismissedEnds.includes(endKey(s))) || null;
    const confirmEnd = async (s) => {
        const data = await put(`/api/doctor-schedules/${s.schedule_id}/end-session`, { sender_id: userId, created_by_doctor_id: creator.doctorId || undefined });
        if (!data.success) return data.message || 'Could not end the session.';
        showAlert(data.message, 'success');
        refresh();
        return '';
    };
    const extendEnd = async (s, minutes) => {
        const data = await put(`/api/doctor-schedules/${s.schedule_id}/extend`, { extra_minutes: minutes, sender_id: userId, created_by_doctor_id: creator.doctorId || undefined });
        if (!data.success) return data.message || 'Could not extend the session.';
        showAlert(data.message, 'success');
        refresh();
        return '';
    };

    const refresh = () => { fetchList(); fetchCounts(); fetchRunning(); setQueueKey((k) => k + 1); onChanged?.(); };

    // the full check-up row of a queue number (its assessment included)
    const rowOfEntry = async (entry) => {
        try {
            const res = await fetch(`${API}/api/doctor/${doctorPath}/appointments?scope=ongoing&pageSize=100`);
            const data = await res.json();
            const row = data.appointments?.find((a) => a.appointment_id === entry.appointment_id);
            if (!row) showAlert('Could not find this check-up.', 'warning');
            return row || null;
        } catch (e) { showAlert('Could not open the check-up.', 'error'); return null; }
    };
    // open the check-up of a number that is being served
    const documentEntry = async (entry) => { const row = await rowOfEntry(entry); if (row) setConsultTarget(row); };
    // the assessment of a Done number, and every assessment of its student
    const viewEntry = async (entry) => { const row = await rowOfEntry(entry); if (row) setViewTarget(row); };
    // the student's health records (doctor): the queue entry already carries the student
    const recordEntry = (entry) => setRecordTarget({ student_id: entry.student_id, student_name: entry.student_name });

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

    // Time in / Time out are the nurse's: the vital signs form (VitalsModal). The doctor documents only after the time in.
    const openVitals = (a, mode) => setVitalsTarget({ appt: { appointment_id: a.appointment_id, student_id: a.student_id, name: fullName(a.student_first_name, a.student_last_name), label: a.queue_state ? `${a.queue_lane === 'Walk-in' ? 'W' : '#'}${a.queue_no}` : '', prescriptions: a.prescriptions }, mode });
    // the nurse times the student out after the check-up is documented; its vital signs are optional
    const canTimeOut = (a) => isNurse && !!a.assessment_id && !!a.checkup_visit_id && !a.visit_time_out;

    // the walk-in waits in the walk-in queue: the doctor calls the number
    // the walk-in form takes the time in vital signs, so the walk-in is already timed in
    const afterWalkIn = () => {
        setTab('ongoing');
        refresh();
    };

    const print = (a, kind) => printDocument(
        kind === 'prescription' ? 'Prescription' : 'Doctor visit summary',
        visitDocumentHtml(kind, a, 'School Nurse'),
        () => showAlert('The print window was blocked. Allow pop-ups for this site and try again.', 'warning')
    );

    const rxCount = (a) => (Array.isArray(a.prescriptions) ? a.prescriptions.length : 0);
    const withName = (a) => ({ ...a, student_name: fullName(a.student_first_name, a.student_last_name) });

    // every action is an icon only; the name is in aria-label and title
    const act = (key, variant, Icon, label, onClick, title, disabled = false) => (
        <button key={key} type="button" className={`dp-btn dp-btn-${variant} dp-btn-icon`} onClick={onClick} disabled={disabled}
            title={title || label} aria-label={label}>
            <Icon size={17} aria-hidden="true" />
        </button>
    );


    // ---- the actions of Upcoming and On going rows (the same for the doctor and the nurse) ----
    const renderActions = (a) => {
        const buttons = [];
        const documented = !!a.assessment_id;
        // the server puts a row in On going while its session waits for the end to be confirmed, even past the end time
        const phase = tab === 'ongoing' && !['Cancelled', 'Declined', 'No-Show'].includes(a.status) ? 'ongoing' : phaseOf(a);

        if (a.status === 'Scheduled') {
            if (['Absent', 'Excused'].includes(a.attendance_status)) {
                buttons.push(<span key="att" className="dp-chip st-no-show">{a.attendance_status === 'Absent' ? 'No-show' : 'Excused'}</span>);
            } else if (documented) {
                buttons.push(act('doc', 'primary', ClipboardPlus, 'View / edit check-up', () => setConsultTarget(a)));
            } else if (phase === 'ongoing' && (!a.queue_state || a.queue_state === 'Serving')) {
                // the check-up is recorded only after the nurse's time in with the vital signs
                if (a.attendance_status === 'Present') buttons.push(act('doc', 'primary', Stethoscope, 'Document', () => setConsultTarget(a)));
                else if (isNurse) {
                    // a student the doctor documented must be timed out before the next time in
                    const open = items.find((x) => x.appointment_id !== a.appointment_id && x.doctor_id === a.doctor_id && !!x.checkup_visit_id && !x.visit_time_out && !!x.assessment_id
                        && String(x.start_time).slice(0, 10) === String(a.start_time).slice(0, 10) && ['Scheduled', 'Completed'].includes(x.status));
                    buttons.push(act('in', 'primary', Clock, 'Time in', () => openVitals(a, 'in'),
                        open ? `${fullName(open.student_first_name, open.student_last_name)} still needs a time out first` : 'Time in: record the vital signs', !!open));
                }
                else buttons.push(<span key="wait" className="dp-chip st-pending-approval">Waiting for time in</span>);
            }
            if (phase === 'upcoming') {
                // a place in a session queue has no time of its own: the doctor reschedules the whole session instead (My Schedule)
                if (!a.queue_state) buttons.push(act('mv', 'ghost', CalendarClock, 'Reschedule', () => setMoveTarget(a)));
                buttons.push(act('cx', 'danger', Ban, 'Cancel', () => setCancelTarget(a)));
            }
            if (phase === 'ongoing' && !documented && !a.queue_state) {
                if (a.attendance_status === 'Pending') buttons.push(act('ns', 'ghost', UserX, 'No-show', () => markNoShow(a)));
                if (!isNurse) buttons.push(act('ex', 'ghost', TimerReset, 'Extend', () => setExtendTarget(withName(a))));
            }
            // an on going check-up is cancelled by the doctor only (a number already voided / done has nothing left to cancel)
            if (phase === 'ongoing' && !documented && !isNurse && !['Void', 'Done'].includes(a.queue_state)) {
                buttons.push(act('cx', 'danger', Ban, 'Cancel', () => setCancelTarget(a)));
            }
        } else if (a.status === 'Completed' && documented) {
            buttons.push(act('doc', 'ghost', ClipboardPlus, 'View / edit check-up', () => setConsultTarget(a)));
        }
        if (canTimeOut(a)) buttons.push(act('out', 'primary', LogOut, 'Time out', () => openVitals(a, 'out'), 'Time out: the vital signs after the check-up are optional'));
        if (documented) {
            buttons.push(act('sum', 'ghost', Printer, 'Summary', () => print(a, 'summary')));
            if (rxCount(a) > 0) buttons.push(act('rx', 'ghost', Pill, 'Prescription', () => print(a, 'prescription')));
        }
        // the student's health records
        buttons.push(act('rec', 'ghost', FolderHeart, 'Student health records', () => setRecordTarget(withName(a)), 'Health records of the student'));
        buttons.push(act('log', 'ghost', History, 'History', () => setLogTarget(a), 'History and reasons'));
        return buttons;
    };

    // ---- the actions of a Past row ----
    const renderPastActions = (a) => {
        const documented = !!a.assessment_id;
        // the nurse can only look: the assessment, or the details when nothing was documented, and the past assessments of the student
        if (isNurse) {
            return [
                ...(canTimeOut(a) ? [act('out', 'primary', LogOut, 'Time out', () => openVitals(a, 'out'), 'Time out: the vital signs after the check-up are optional')] : []),
                act('view', 'ghost', Eye, documented ? 'View assessment' : 'View details', () => setViewTarget(a)),
                act('log', 'ghost', History, 'Past assessments', () => setHistoryTarget(a), 'Past assessments of the student')
            ];
        }
        const buttons = [];
        if (documented) {
            buttons.push(act('doc', 'ghost', ClipboardPlus, 'View / edit check-up', () => setConsultTarget(a)));
        } else if (a.status === 'Scheduled' && a.attendance_status === 'Present') {
            buttons.push(act('doc', 'primary', Stethoscope, 'Document', () => setConsultTarget(a)));
        }
        if (documented) {
            buttons.push(act('sum', 'ghost', Printer, 'Summary', () => print(a, 'summary')));
            if (rxCount(a) > 0) buttons.push(act('rx', 'ghost', Pill, 'Prescription', () => print(a, 'prescription')));
            buttons.push(act('rp', 'accent', Repeat, 'Follow-up', () => setRepeatTarget(a), 'Follow-up: direct appointment, or wait for a schedule'));
        }
        buttons.push(act('rec', 'ghost', FolderHeart, 'Student health records', () => setRecordTarget(withName(a)), 'Health records of the student'));
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
                            <div className="dp-appt-sub">{visitLabel(a.visit_type, a.purpose_other)}{classLabel(a) ? ` - ${classLabel(a)}` : ''}{doctorLine(a)}</div>
                            {a.booking_reason && <div className="dp-appt-reason">Reason: {a.booking_reason}</div>}
                            {a.decline_reason && ['Cancelled', 'Declined'].includes(a.status) && <div className="dp-appt-reason">{a.status === 'Declined' ? 'Declined' : 'Cancelled'}: {a.decline_reason}</div>}
                            {documented && (
                                <>
                                    <div className="dp-appt-reason"><strong>Diagnosis:</strong> {a.diagnosis}</div>
                                    {a.treatment_recommendations && <div className="dp-appt-sub">Plan: {a.treatment_recommendations}</div>}
                                </>
                            )}
                            {a.checkup_visit_id && <div className="dp-appt-sub">Vital signs in: {vitalsLine(inVitalsOf(a)) || '-'}</div>}
                            {a.visit_time_out && vitalsLine(outVitalsOf(a)) && <div className="dp-appt-sub">Vital signs out: {vitalsLine(outVitalsOf(a))}</div>}
                            {a.dispensed_medicine && <div className="dp-appt-sub"><Pill size={13} aria-hidden="true" /> Dispensed: {a.dispensed_medicine} ({Math.round(a.dispensed_quantity)} {a.dispensed_unit})</div>}
                            <div className="dp-appt-chips">
                                <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
                                {a.checkup_visit_id && <span className="dp-chip st-completed">Timed in {formatTime(a.visit_time_in)}</span>}
                                {a.visit_time_out && <span className="dp-chip source">Timed out {formatTime(a.visit_time_out)}</span>}
                                <span className="dp-chip source">{sourceLabel(a.booking_source)}</span>
                                {documented && <span className="dp-chip st-completed">Documented</span>}
                                {documented && rxCount(a) > 0 && <span className="dp-chip"><Pill size={12} /> {rxCount(a)} medicine{rxCount(a) === 1 ? '' : 's'}</span>}
                                {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Follow-up{a.follow_up_date ? `: ${formatDate(a.follow_up_date)}` : ''}</span>}
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

    // All folders (nurse): one row per doctor, like a repository file list - icon + name, what is inside, when
    const renderDoctorFolders = () => (
        <div className="dp-card dp-repo-list" role="list" aria-label="All folders">
            {doctorFolders.map((f) => (
                <button key={f.doctor_id} role="listitem" type="button" className="dp-repo-row" onClick={() => { setOpenDoctor(f); setPage(1); }} aria-label={`Open ${f.name}`}>
                    <span className="dp-repo-name"><Folder size={18} aria-hidden="true" /> <strong>{f.name}</strong></span>
                    <span className="dp-repo-desc">
                        {f.sessions} session{f.sessions === 1 ? '' : 's'} - {f.total} participant{f.total === 1 ? '' : 's'}{tab === 'past' ? ` - ${f.documented} documented` : ''}
                        {f.abnormal > 0 && <span className="dp-chip abnormal">{f.abnormal} abnormal</span>}
                        {tab === 'past' && f.missed > 0 && <span className="dp-chip st-no-show">{f.missed} missed or cancelled</span>}
                    </span>
                    <span className="dp-repo-when">{relativeDay(f.day)}</span>
                </button>
            ))}
        </div>
    );

    // one container per session day, same list style: it opens to all its participants
    const renderFolders = () => (
        <div className="dp-card dp-repo-list" role="list" aria-label="Sessions">
            {groups.map((g) => (
                <button key={`${g.schedule_id || 'none'}-${g.doctor_id}-${g.day}`} role="listitem" type="button" className="dp-repo-row" onClick={() => { setOpenGroup(g); setPage(1); }} aria-label={`Open ${groupName(g)}, ${dayTitle(g.day)}`}>
                    <span className="dp-repo-name"><Folder size={18} aria-hidden="true" /> <strong>{groupName(g)}</strong></span>
                    <span className="dp-repo-desc">
                        {dayTitle(g.day)} - {formatTime(g.first_start)} to {formatTime(g.last_end)}{g.location ? ` - ${g.location}` : ''} - <Users size={13} aria-hidden="true" /> {g.total}{tab === 'past' ? ` - ${g.documented} documented` : ''}
                        {g.abnormal > 0 && <span className="dp-chip abnormal">{g.abnormal} abnormal</span>}
                        {tab === 'past' && g.missed > 0 && <span className="dp-chip st-no-show">{g.missed} missed or cancelled</span>}
                    </span>
                    <span className="dp-repo-when">{relativeDay(g.day)}</span>
                </button>
            ))}
        </div>
    );

    // the participants of an opened Upcoming / Past container, one row each
    const renderDayTable = () => (
        <div className="dp-card dp-table-wrap">
            <table className="dp-table">
                <thead>
                    <tr>
                        {tab === 'upcoming' && <th>No.</th>}<th>Time</th><th>Student</th><th>Purpose</th>{isNurse && <th>Doctor</th>}<th>Status</th>{tab === 'past' ? <th>Assessment</th> : <th>Reason</th>}<th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((a) => {
                        const documented = !!a.assessment_id;
                        return (
                            <tr key={`${a.appointment_id}-${a.student_id}`} className={focusId === a.appointment_id ? 'focus' : ''}>
                                {tab === 'upcoming' && <td className="nowrap"><strong>{a.queue_state ? `${a.queue_lane === 'Walk-in' ? 'W' : '#'}${a.queue_no}` : '-'}</strong></td>}
                                <td className="nowrap">{formatTime(a.start_time)} - {formatTime(a.end_time)}</td>
                                <td>
                                    <strong>{fullName(a.student_first_name, a.student_last_name)}</strong>
                                    <div className="dp-hint">{a.student_id}{classLabel(a) ? ` - ${classLabel(a)}` : ''}</div>
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
                                    {tab === 'upcoming' ? (
                                        a.booking_reason ? <div className="dp-cell-clip">{a.booking_reason}</div> : <span className="dp-hint">-</span>
                                    ) : documented ? (
                                        <>
                                            <div className="dp-cell-clip">{a.diagnosis}</div>
                                            <div className="dp-appt-chips">
                                                {rxCount(a) > 0 && <span className="dp-chip"><Pill size={12} /> {rxCount(a)}</span>}
                                                {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Follow-up</span>}
                                                {!!a.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
                                            </div>
                                        </>
                                    ) : <span className="dp-hint">Not documented</span>}
                                </td>
                                <td><div className="dp-row-actions">{tab === 'upcoming' ? renderActions(a) : renderPastActions(a)}</div></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const rows = atRoot ? doctorFolders : inFolders ? groups : items;
    const unit = inFolders ? 'sessions' : 'participants';
    const backToRoot = () => { setOpenGroup(null); setOpenDoctor(null); setPage(1); };

    return (
        <>
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

            {grouped && !atRoot && (openGroup || openDoctor) && (
                <nav className="dp-crumbs" aria-label="Folder path">
                    {isNurse ? (
                        <>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={backToRoot}><ChevronLeft size={15} aria-hidden="true" /> All folders</button>
                            <ChevronRight size={15} aria-hidden="true" />
                            {openGroup ? (
                                <>
                                    <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setOpenGroup(null); setOpenDoctor(openDoctor || { doctor_id: openGroup.doctor_id, name: `Dr. ${openGroup.doc_first_name} ${openGroup.doc_last_name}` }); setPage(1); }}>
                                        {openDoctor ? openDoctor.name : `Dr. ${openGroup.doc_first_name} ${openGroup.doc_last_name}`}
                                    </button>
                                    <ChevronRight size={15} aria-hidden="true" />
                                    <FolderOpen size={17} aria-hidden="true" />
                                    <strong>{groupName(openGroup).replace(/^Dr\. [^-]+ - /, '')} - {dayTitle(openGroup.day)}</strong>
                                </>
                            ) : (
                                <>
                                    <FolderOpen size={17} aria-hidden="true" />
                                    <strong>{openDoctor.name}</strong>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setOpenGroup(null); setPage(1); }}><ChevronLeft size={15} aria-hidden="true" /> All sessions</button>
                            <FolderOpen size={17} aria-hidden="true" />
                            <strong>{groupName(openGroup)} - {dayTitle(openGroup.day)}</strong>
                        </>
                    )}
                </nav>
            )}

            {tab === 'ongoing' && runningSessions.map((s) => (
                <section key={`${s.schedule_id}-${s.date}`} className="dp-card running-queue-sc" aria-label="Session queue">
                    <h3 style={{ margin: '0 0 10px', fontSize: '1rem' }}>
                        {s.doctor_name} - {formatTime(`${s.date} ${s.start_time}`)} to {formatTime(`${s.date} ${s.end_time}`)}{s.location ? ` - ${s.location}` : ''}
                        <span className="dp-hint"> {s.visit_type === 'Any' ? 'Any check-up' : s.visit_type}</span>
                    </h3>
                    {s.awaiting_end && (
                        <div className="dp-notice" role="status" style={{ marginBottom: 10 }}>
                            <BellRing size={15} aria-hidden="true" /> The end time ({formatTime(`${s.date} ${s.end_time}`)}) has passed. Confirm the end to move this session to Past Check-up, or extend it.
                            {' '}
                            <button type="button" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setDismissedEnds((list) => list.filter((k) => k !== endKey(s)))}>Confirm or extend</button>
                        </div>
                    )}
                    <QueuePanel scheduleId={s.schedule_id} date={s.date} creator={creator} userId={userId} refreshKey={queueKey} onChanged={refresh} onDocument={documentEntry} onView={viewEntry} onRecords={recordEntry} onWalkIn={isNurse ? () => setWalkInFor(s) : undefined} onExtend={isNurse ? undefined : () => setExtendSession(s)} />
                </section>
            ))}

            {loading ? (
                <div className="dp-card dp-empty">Loading check-ups...</div>
            ) : rows.length === 0 ? (
                <div className="dp-card dp-empty">
                    <FileText size={36} />
                    <p>No {tabLabel} to show here.</p>
                </div>
            ) : atRoot ? renderDoctorFolders() : inFolders ? renderFolders() : tab === 'past' || tab === 'upcoming' ? renderDayTable() : renderCards()}

            {!loading && !atRoot && <Pager page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} noun={unit} />}

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
            <ExtendSessionModal session={extendSession} onExtend={(minutes) => extendEnd(extendSession, minutes)} onClose={() => setExtendSession(null)} />
            {endAsk && (
                <SessionEndPrompt
                    item={{ key: endKey(endAsk), kind: 'check-up', endTime: endAsk.end_time, title: `${endAsk.doctor_name}'s ${endAsk.visit_type === 'Any' ? 'check-up' : endAsk.visit_type} session on ${formatDate(endAsk.date)}` }}
                    onConfirm={() => confirmEnd(endAsk)}
                    onExtend={isNurse ? undefined : (minutes) => extendEnd(endAsk, minutes)}
                    onLater={() => setDismissedEnds((list) => [...list, endKey(endAsk)])}
                />
            )}
            {repeatTarget && <RepeatModal key={repeatTarget.appointment_id} appt={repeatTarget} creator={creator} userId={userId} onClose={() => setRepeatTarget(null)} onDone={refresh} />}
            {consultTarget && (
                <ConsultationModal
                    key={consultTarget.appointment_id} appt={consultTarget} doctorId={isNurse ? consultTarget.doctor_id : doctorId} nurseId={isNurse ? nurseId : undefined}
                    userId={userId} onClose={() => setConsultTarget(null)} onSaved={refresh}
                />
            )}

            {vitalsTarget && <VitalsModal appt={vitalsTarget.appt} mode={vitalsTarget.mode} userId={userId} onClose={() => setVitalsTarget(null)} onDone={refresh} />}
            <StudentHealthRecordModal appt={recordTarget} onClose={() => setRecordTarget(null)} />
            <WalkInModal isOpen={!!walkInFor} doctors={doctors} fixedDoctorId={walkInFor ? walkInFor.doctor_id || doctorId : doctorId} schedule={walkInFor} creator={creator} userId={userId} onClose={() => setWalkInFor(null)} onCreated={afterWalkIn} />
        </>
    );
};

export default ConsultationLists;
