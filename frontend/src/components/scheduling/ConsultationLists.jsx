// ConsultationLists.jsx
// The consultations in three lists - Upcoming (not started: reschedule / cancel), On going (happening now: document, extend, no-show,
// walk-ins) and Past (over: closed). Past consultations are in one folder per day; a folder opens the table of that day.
// The doctor (/DoctorConsultations) and the nurse (Doctor Visit > Consultation) mount this same screen:
//   role "doctor" - the doctor's own consultations; past rows keep the assessment history and the repeat button
//   role "nurse"  - every doctor's consultations; a past row can only be viewed (assessment or details)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    CalendarPlus, Footprints, Search, CalendarClock, History, ClipboardPlus, UserX, Ban, FileText, Printer, Pill, Stethoscope, TimerReset,
    FolderOpen, ChevronLeft, Eye, Repeat
} from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, statusClass, statusLabel, fullName } from '../../utils/visitPurpose';
import { printDocument, visitDocumentHtml } from '../../utils/doctorVisitDocuments';
import { useSpecializations } from '../../hooks/useSpecializations';
import { ExtendAppointmentModal } from './SessionModals';
import { RepeatModal } from './FollowUps';
import {
    ReasonModal, RescheduleModal, LogModal, DirectAppointmentModal, WalkInModal
} from '../doctor/AppointmentModals';
import { AssessmentViewModal, AssessmentHistoryModal } from '../doctor/AssessmentModals';
import ConsultationModal from '../doctor/ConsultationModal';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const PAGE_SIZE = 10;
const DAY_PAGE_SIZE = 12;
const DAY_TABLE_SIZE = 15;

export const CONSULTATION_TABS = [
    ['upcoming', 'Upcoming Consultation'],
    ['ongoing', 'On going Consultation'],
    ['past', 'Past Consultation']
];

const toMs = (value) => new Date(String(value).replace(' ', 'T')).getTime();
// every consultation is in exactly one of three phases
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

const dayTitle = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const ConsultationLists = ({ role, doctorId, doctors, nurseId, userId, tab, onTab, focusId, onChanged }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const isNurse = role === 'nurse';
    const doctorPath = doctorId || 'all';
    const creator = isNurse ? { nurseId } : { doctorId };

    const [items, setItems] = useState([]);
    const [days, setDays] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState({ upcoming: 0, ongoing: 0, past: 0 });
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [purpose, setPurpose] = useState('');
    const [day, setDay] = useState('');
    const [doctorFilter, setDoctorFilter] = useState('');
    const [openDay, setOpenDay] = useState('');

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
    const reqSeq = useRef(0);

    // past consultations: the folders of the days, until a day is opened
    const inFolders = tab === 'past' && !openDay;
    const pageSize = inFolders ? DAY_PAGE_SIZE : tab === 'past' ? DAY_TABLE_SIZE : PAGE_SIZE;

    const setTab = (key) => { onTab(key); setOpenDay(''); setPage(1); };

    useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

    // the other tab of the list the nurse or doctor came from
    useEffect(() => { setOpenDay(''); setPage(1); }, [tab]);

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
            if (openDay) { qs.set('from', openDay); qs.set('to', openDay); }
            else if (day) { qs.set('from', day); qs.set('to', day); }
            const res = await fetch(`${API}/api/doctor/${doctorPath}/${inFolders ? 'appointment-days' : 'appointments'}?${qs.toString()}`);
            const data = await res.json();
            if (seq !== reqSeq.current) return;
            if (data.success) {
                if (inFolders) setDays(data.days); else setItems(data.appointments);
                setTotal(data.total);
            } else showAlert(data.message || 'Could not load the consultations.', 'error');
        } catch (e) {
            if (seq === reqSeq.current) showAlert('Could not reach the server.', 'error');
        } finally {
            if (seq === reqSeq.current) setLoading(false);
        }
    }, [doctorPath, tab, page, pageSize, inFolders, openDay, day, filterParams, showAlert]);

    useEffect(() => { fetchList(); }, [fetchList]);
    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    const refresh = () => { fetchList(); fetchCounts(); onChanged?.(); };

    // ---- lifecycle actions ----
    const cancelAppointment = async (reason) => {
        const data = await put(`/api/doctor-visits/cancel/${cancelTarget.appointment_id}`, { sender_id: userId, reason });
        if (data.success) { setCancelTarget(null); showAlert('Consultation cancelled. The student and parents were notified.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not cancel the consultation.', 'error');
    };

    const reschedule = async ({ start_time, end_time, reason }) => {
        const data = await put(`/api/doctor-visits/reschedule/${moveTarget.appointment_id}`, { sender_id: userId, start_time, end_time, reason });
        if (data.success) { setMoveTarget(null); showAlert('Consultation rescheduled. The student and parents were notified.', 'success'); refresh(); return ''; }
        return data.message || 'Could not reschedule the consultation.';
    };

    const markNoShow = async (a) => {
        const data = await put(`/api/doctor-visits/status/${a.appointment_id}`, { student_id: a.student_id, status: 'Absent', reason: 'No-show' });
        if (data.success) { showAlert('Marked as no-show.', 'success'); refresh(); }
        else showAlert(data.message || 'Could not update the attendance.', 'error');
    };

    const afterWalkIn = async (created) => {
        setTab('ongoing');
        try {
            const res = await fetch(`${API}/api/doctor/${doctorPath}/appointments?scope=ongoing&pageSize=50`);
            const data = await res.json();
            const row = data.appointments?.find((a) => a.appointment_id === created.appointment_id);
            if (row) setConsultTarget(row);
        } catch (e) { /* the list still refreshes */ }
        refresh();
    };

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
                buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit consultation</button>);
            } else if (phase === 'ongoing') {
                buttons.push(<button key="doc" className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setConsultTarget(a)}><Stethoscope size={15} /> {a.attendance_status === 'Present' ? 'Document' : 'Start consultation'}</button>);
            }
            if (phase === 'upcoming') {
                buttons.push(<button key="mv" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setMoveTarget(a)}><CalendarClock size={15} /> Reschedule</button>);
                buttons.push(<button key="cx" className="dp-btn dp-btn-danger dp-btn-sm" onClick={() => setCancelTarget(a)}><Ban size={15} /> Cancel</button>);
            }
            if (phase === 'ongoing' && !documented) {
                if (a.attendance_status === 'Pending') buttons.push(<button key="ns" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => markNoShow(a)}><UserX size={15} /> No-show</button>);
                buttons.push(<button key="ex" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setExtendTarget(withName(a))}><TimerReset size={15} /> Extend</button>);
            }
        } else if (a.status === 'Completed' && documented) {
            buttons.push(<button key="doc" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit consultation</button>);
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
            buttons.push(<button key="doc" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setConsultTarget(a)}><ClipboardPlus size={15} /> View / edit consultation</button>);
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
            {items.map((a) => {
                const documented = !!a.assessment_id;
                return (
                    <article key={`${a.appointment_id}-${a.student_id}`} className={`dp-appt ${focusId === a.appointment_id ? 'focus' : ''}`}>
                        <div className="dp-appt-when">
                            <span className="d">{formatDate(a.start_time)}</span>
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

    const renderFolders = () => (
        <div className="dp-day-grid">
            {days.map((d) => (
                <button key={d.day} type="button" className="dp-day-folder" onClick={() => { setOpenDay(d.day); setPage(1); }}>
                    <FolderOpen size={26} />
                    <strong>{dayTitle(d.day)}</strong>
                    <span>{d.total} consultation{d.total === 1 ? '' : 's'} - {d.documented} documented</span>
                    {d.abnormal > 0 && <span className="dp-chip abnormal">{d.abnormal} abnormal</span>}
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

    const rows = inFolders ? days : items;
    const unit = inFolders ? 'days' : 'consultations';

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Consultations</h2>
                    <p>
                        {isNurse ? 'The upcoming, on going and past consultations of every doctor.' : 'Your upcoming, on going and past consultations.'}
                        {' '}Past consultations are closed and kept in a folder for each day: they can no longer be booked, rescheduled or cancelled.
                    </p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-primary" onClick={() => setShowDirect(true)}><CalendarPlus size={17} /> Direct appointment</button>
                    {tab === 'ongoing' && (
                        <button className="dp-btn dp-btn-accent" onClick={() => setShowWalkIn(true)}><Footprints size={17} /> Walk-in</button>
                    )}
                </div>
            </div>

            <div className="dp-tabs" role="tablist" aria-label="Consultation lists">
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
                    <input className="dp-input" type="search" placeholder="Search student, ID or purpose" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search consultations" />
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
                {!openDay && <input className="dp-input" style={{ width: 'auto' }} type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }} aria-label="Date" />}
                {filtering && <button className="dp-btn dp-btn-ghost" onClick={clearFilters}>Clear</button>}
            </div>

            {tab === 'past' && openDay && (
                <div className="dp-crumbs">
                    <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setOpenDay(''); setPage(1); }}><ChevronLeft size={15} /> All days</button>
                    <FolderOpen size={17} />
                    <strong>{dayTitle(openDay)}</strong>
                </div>
            )}

            {loading ? (
                <div className="dp-card dp-empty">Loading consultations...</div>
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
                title="Cancel consultation"
                message={cancelTarget && `${fullName(cancelTarget.student_first_name, cancelTarget.student_last_name)} - ${formatDate(cancelTarget.start_time)}, ${formatTime(cancelTarget.start_time)}. The student and parents are notified.`}
                label="Reason (shown to the student)"
                placeholder="e.g. Emergency at the clinic, please rebook"
                confirmLabel="Cancel consultation"
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

            <DirectAppointmentModal isOpen={showDirect} doctors={doctors} fixedDoctorId={doctorId} creator={creator} userId={userId} onClose={() => setShowDirect(false)} onCreated={refresh} />
            <WalkInModal isOpen={showWalkIn} doctors={doctors} fixedDoctorId={doctorId} creator={creator} userId={userId} onClose={() => setShowWalkIn(false)} onCreated={afterWalkIn} />
        </>
    );
};

export default ConsultationLists;
