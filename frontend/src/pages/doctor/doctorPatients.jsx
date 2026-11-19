// doctorPatients.jsx
// The doctor's access to student clinic records: search a student, read what the clinic documented, open the full health record.
// A doctor appoints a student only into a schedule the doctor already has (no schedule, no appointing).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FolderHeart, CalendarClock, CalendarX, Users, ChevronDown, X, Check, AlertTriangle, ExternalLink, Flag, FlagOff } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { useSpecializations } from '../../hooks/useSpecializations';
import { formatDate, formatTime, formatTimeRange } from '../../utils/datetime';
import { classLabel } from '../../utils/scheduling';
import { visitLabel, initials, fullName, statusClass, statusLabel } from '../../utils/visitPurpose';
import AssessmentForm from '../../components/doctor/AssessmentForm';
import '../../styles/doctor/DoctorLayout.css';

const API = 'https://localhost-cms.onrender.com';

const SCOPES = [
    { key: 'mine', label: 'My patients' },
    { key: 'all', label: 'All students' },
    { key: 'attention', label: 'Need Attention' }
];

// "BSIT - 4B"
const section = (s) => classLabel({ program_id: s.program_id || s.program_name, year_level: s.year_level, section: s.section });

// marked by hand (flagged) or an abnormal finding in a check-up
const needsAttention = (p) => Number(p.abnormal) > 0 || Number(p.flagged) > 0;

// icon button: marks the student, or clears the mark when it is already set
const AttentionButton = ({ flagged, name, onClick }) => {
    const label = flagged ? `Clear Need Attention for ${name}` : `Mark ${name} as Need Attention`;
    return (
        <button type="button" className={`dp-btn dp-btn-ghost dp-btn-icon dpt-attn${flagged ? ' on' : ''}`} onClick={onClick} aria-label={label} title={flagged ? 'Clear Need Attention' : 'Mark Need Attention'}>
            {flagged ? <FlagOff size={20} aria-hidden="true" /> : <Flag size={20} aria-hidden="true" />}
        </button>
    );
};

const AttentionChip = () => <span className="dp-chip attention"><AlertTriangle size={14} aria-hidden="true" /> Need Attention</span>;

// one documented check-up: the assessment form, read only, with the PDF button
const ConsultationDetails = ({ c, student }) => (
    <AssessmentForm a={c} ctx={{ student: fullName(student?.first_name, student?.last_name), studentId: student?.student_id }} />
);

// A student is appointed into one of the doctor's own schedules (a place in its queue), never at a free time
const sessionLabel = (s) => {
    const places = s.listing_full ? 'Full' : (s.listing_limit ? `${s.accepted}/${s.listing_limit}` : '');
    return [formatDate(s.next_date), formatTimeRange(s.start_time, s.end_time), s.visit_type === 'Any' ? 'Any check-up' : s.visit_type, places].filter(Boolean).join(' · ');
};

const AppointModal = ({ patient, sessions, doctorId, userId, onClose, onDone }) => {
    const { showAlert } = useAlert();
    const { visitTypes } = useSpecializations();
    const [sid, setSid] = useState('');
    const [purpose, setPurpose] = useState('General Check Up');
    const [busy, setBusy] = useState(false);
    const available = useMemo(() => sessions.filter((s) => !s.listing_full), [sessions]);

    useEffect(() => {
        if (!patient) return;
        setSid(available.length ? available[0].schedule_id : '');
        setPurpose('General Check Up');
        setBusy(false);
    }, [patient, available]);

    const chosen = available.find((s) => s.schedule_id === sid);

    const submit = async (e) => {
        e.preventDefault();
        if (!chosen) return;
        setBusy(true);
        try {
            const res = await fetch(`${API}/api/doctor-schedules/${chosen.schedule_id}/appoint`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    created_by_doctor_id: doctorId, sender_id: userId, student_id: patient.student_id,
                    date: chosen.next_date, visit_type: chosen.visit_type === 'Any' ? purpose : chosen.visit_type
                })
            });
            const data = await res.json();
            if (data.success) {
                showAlert(data.message, 'success');
                onDone();
                onClose();
            } else {
                showAlert(data.message || 'Could not appoint the student.', 'error');
            }
        } catch (err) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            isOpen={!!patient}
            onClose={onClose}
            title="Appoint"
            icon={<CalendarClock size={20} />}
            size="lg"
            footer={(
                <>
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>{available.length ? 'Cancel' : 'Close'}</button>
                    {available.length > 0 && <button type="submit" form="dpt-appoint-form" className="dp-btn dp-btn-primary" disabled={busy || !chosen}>Save</button>}
                </>
            )}
        >
            {patient && (
                <form id="dpt-appoint-form" className="dp-form" onSubmit={submit}>
                    <div className="dpt-who-line">
                        <span className="dpt-avatar" aria-hidden="true">{initials(patient.first_name, patient.last_name)}</span>
                        <div>
                            <strong>{fullName(patient.first_name, patient.last_name)}</strong>
                            <div className="dpt-sid">{patient.student_id}</div>
                        </div>
                    </div>
                    {available.length === 0 ? (
                        <div className="dpt-none" role="status">
                            <CalendarX size={36} aria-hidden="true" />
                            <strong>No available schedule</strong>
                        </div>
                    ) : (
                        <div className="dp-field">
                            <label htmlFor="dpt-session">Your schedule</label>
                            <select id="dpt-session" className="dp-select" value={sid} onChange={(e) => setSid(e.target.value)}>
                                {available.map((s) => <option key={s.schedule_id} value={s.schedule_id}>{sessionLabel(s)}</option>)}
                            </select>
                        </div>
                    )}
                    {chosen && chosen.visit_type === 'Any' && (
                        <div className="dp-field">
                            <label htmlFor="dpt-purpose">Purpose</label>
                            <select id="dpt-purpose" className="dp-select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                                {visitTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    )}
                </form>
            )}
        </Modal>
    );
};

const DoctorPatients = () => {
    const { doctorId, userId } = useOutletContext();
    const { showAlert } = useAlert();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const urlQuery = params.get('q') || '';

    const [search, setSearch] = useState(urlQuery);
    const [query, setQuery] = useState(urlQuery);
    const [scope, setScope] = useState('mine');
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [record, setRecord] = useState(null);
    const [recordPatient, setRecordPatient] = useState(null);
    const [recordLoading, setRecordLoading] = useState(false);
    const [open, setOpen] = useState(() => new Set());
    const [appointPatient, setAppointPatient] = useState(null);
    const [schedules, setSchedules] = useState(null);

    // the top bar search sends ?q=
    useEffect(() => { setSearch(urlQuery); setQuery(urlQuery); }, [urlQuery]);
    useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const qs = query ? `?q=${encodeURIComponent(query)}` : (scope === 'all' ? '?all=1' : '');
            const res = await fetch(`${API}/api/doctor/${doctorId}/patients${qs}`);
            const data = await res.json();
            if (data.success) setPatients(data.patients);
            else showAlert(data.message || 'Could not load the patients.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setLoading(false);
        }
    }, [doctorId, query, scope, showAlert]);

    useEffect(() => { load(); }, [load]);

    // the doctor's own open schedules that still have a session to come
    const loadSchedules = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor-schedules?doctor_id=${encodeURIComponent(doctorId)}&status=Open`);
            const data = await res.json();
            if (data.success) setSchedules(data.schedules);
        } catch (e) {
            // keep the last list; the server checks the schedule again when saving
        }
    }, [doctorId]);

    useEffect(() => { loadSchedules(); }, [loadSchedules]);

    const sessions = useMemo(() => (schedules || []).filter((s) => s.next_date && !s.is_expired), [schedules]);

    const rows = useMemo(
        () => (!query && scope === 'attention' ? patients.filter(needsAttention) : patients),
        [patients, query, scope]
    );

    const openRecord = async (p) => {
        setRecordPatient(p);
        setRecord(null);
        setOpen(new Set());
        setRecordLoading(true);
        try {
            const res = await fetch(`${API}/api/doctor/patients/${p.student_id}/record`);
            const data = await res.json();
            if (data.success) {
                setRecord(data);
                // the latest check-up opens first
                if (data.consultations.length > 0) setOpen(new Set([data.consultations[0].appointment_id]));
            } else {
                showAlert(data.message || 'Could not load the record.', 'error');
            }
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setRecordLoading(false);
        }
    };

    const setAttention = async (student, flagged) => {
        try {
            const res = await fetch(`${API}/api/doctor/patients/${student.student_id}/attention`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doctor_id: doctorId, flagged })
            });
            const data = await res.json();
            if (data.success) {
                setPatients((prev) => prev.map((x) => (x.student_id === student.student_id ? { ...x, flagged: flagged ? 1 : 0 } : x)));
                setRecord((r) => (r && r.student.student_id === student.student_id ? { ...r, flagged } : r));
                showAlert(data.message, 'success');
            } else {
                showAlert(data.message || 'Could not update the student.', 'error');
            }
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        }
    };

    const toggle = (id) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });


    const clearSearch = () => { setSearch(''); setQuery(''); if (urlQuery) setParams({}, { replace: true }); };
    const pickScope = (key) => { setScope(key); clearSearch(); };

    const recordNeedsAttention = !!record && (!!record.flagged || Number(recordPatient?.abnormal) > 0 || record.consultations.some((c) => !!c.is_abnormal));

    return (
        <div className="dpt">
            <header className="dpt-head">
                <h2>Patient Records</h2>
                <p className="dpt-sub" role="status" aria-live="polite">{loading ? '' : `${rows.length} ${rows.length === 1 ? 'student' : 'students'}`}</p>
            </header>

            <div className="dpt-toolbar">
                <div className="dp-search dpt-search">
                    <Search size={18} aria-hidden="true" />
                    <input className="dp-input" type="search" placeholder="Name or student ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" autoComplete="off" />
                    {search && (
                        <button type="button" className="dpt-clear" onClick={clearSearch} aria-label="Clear search" title="Clear search"><X size={18} aria-hidden="true" /></button>
                    )}
                </div>
                <div className="dpt-seg" role="group" aria-label="Show students">
                    {SCOPES.map((s) => {
                        const on = !query && scope === s.key;
                        return (
                            <button key={s.key} type="button" aria-pressed={on} onClick={() => pickScope(s.key)}>
                                {on && <Check size={16} aria-hidden="true" />}{s.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <section className="dpt-roster" aria-label="Students">
                {loading ? (
                    <div className="dp-empty">Loading...</div>
                ) : rows.length === 0 ? (
                    <div className="dp-empty">
                        <Users size={40} aria-hidden="true" />
                        <p><strong>{query ? 'No student found' : 'No patients yet'}</strong></p>
                        {(query || scope !== 'all') && (
                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon"
                                onClick={() => { if (query) clearSearch(); else pickScope('all'); }}
                                aria-label={query ? 'Clear search' : 'Show all students'} title={query ? 'Clear search' : 'Show all students'}>
                                {query ? <X size={20} aria-hidden="true" /> : <Users size={20} aria-hidden="true" />}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="dpt-cols" aria-hidden="true"><span /><span>Student</span><span>Program</span><span>Visits</span><span>Attention</span><span /></div>
                        <ul className="dpt-list">
                            {rows.map((p) => {
                                const name = fullName(p.first_name, p.last_name);
                                const visits = Number(p.visits_with_me);
                                return (
                                    <li key={p.student_id} className="dpt-row">
                                        <span className="dpt-avatar" aria-hidden="true">{initials(p.first_name, p.last_name)}</span>
                                        <div className="dpt-who">
                                            <button type="button" className="dpt-name" onClick={() => openRecord(p)}>{name}</button>
                                            <span className="dpt-sid">{p.student_id}</span>
                                        </div>
                                        <div className="dpt-sec">{section(p) || 'No section'}</div>
                                        <div className="dpt-seen">
                                            {visits > 0 ? (
                                                <>
                                                    <span>{visits} visit{visits === 1 ? '' : 's'} with you</span>
                                                    {p.last_visit && <small>Last {formatDate(p.last_visit)}</small>}
                                                </>
                                            ) : <span className="dp-chip source">Not seen yet</span>}
                                        </div>
                                        <div className="dpt-flag">
                                            {needsAttention(p) && (
                                                <span className="dpt-flag-ico" title="Need Attention" role="img" aria-label="Need Attention"><AlertTriangle size={20} aria-hidden="true" /></span>
                                            )}
                                        </div>
                                        <div className="dpt-acts">
                                            <button type="button" className="dp-btn dp-btn-primary dp-btn-icon" onClick={() => openRecord(p)} aria-label={`Open record of ${name}`} title="Open record"><FolderHeart size={20} aria-hidden="true" /></button>
                                            <AttentionButton flagged={Number(p.flagged) > 0} name={name} onClick={() => setAttention(p, !(Number(p.flagged) > 0))} />
                                            <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={() => setAppointPatient(p)}
                                                aria-label={`Appoint ${name}`} title="Appoint"><CalendarClock size={20} aria-hidden="true" /></button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </section>

            <Modal isOpen={!!recordPatient} onClose={() => setRecordPatient(null)} title={recordPatient ? fullName(recordPatient.first_name, recordPatient.last_name) : ''}
                icon={recordPatient ? <span className="dpt-avatar" aria-hidden="true">{initials(recordPatient.first_name, recordPatient.last_name)}</span> : null} size="xl">
                {recordLoading || !record ? <p className="dp-hint">Loading...</p> : (
                    <div className="dpt-record">
                        <div className="dpt-recmeta">
                            <span className="dpt-sid">{record.student.student_id}</span>
                            <span>{section(record.student) || 'No section'}</span>
                            {recordNeedsAttention && <AttentionChip />}
                            <span className="dpt-recacts">
                                <AttentionButton flagged={!!record.flagged} name={fullName(record.student.first_name, record.student.last_name)} onClick={() => setAttention(record.student, !record.flagged)} />
                            </span>
                            <button type="button" className="dp-btn dp-btn-primary dp-btn-icon dpt-full" onClick={() => navigate(`/health-records/view/${record.student.student_id}`)} aria-label="Open full health record" title="Full health record"><ExternalLink size={20} aria-hidden="true" /></button>
                        </div>

                        <div className="dpt-rec">
                            <section className="dpt-block" aria-label="Check-ups">
                                <h3>Check-ups <span className="dpt-count">{record.consultations.length}</span></h3>
                                {record.consultations.length === 0 && <p className="dp-hint">No check-up documented</p>}
                                {record.consultations.map((c) => {
                                    const isOpen = open.has(c.appointment_id);
                                    const panelId = `dpt-cu-${c.appointment_id}`;
                                    return (
                                        <div key={c.appointment_id} className={`dpt-cu${c.is_abnormal ? ' attention' : ''}`}>
                                            <button type="button" className="dpt-cu-head" onClick={() => toggle(c.appointment_id)} aria-expanded={isOpen} aria-controls={panelId}>
                                                <span className="dpt-cu-title">
                                                    <strong>{formatDate(c.start_time)}</strong> · {visitLabel(c.visit_type, c.purpose_other)}
                                                    <span className="dpt-cu-dx">{c.diagnosis}</span>
                                                </span>
                                                {!!c.is_abnormal && <AttentionChip />}
                                                <ChevronDown size={20} className="dpt-chev" aria-hidden="true" />
                                            </button>
                                            {isOpen && <div id={panelId} className="dpt-cu-body"><ConsultationDetails c={c} student={record.student} /></div>}
                                        </div>
                                    );
                                })}
                            </section>

                            <div className="dpt-side">
                                <section className="dpt-block" aria-label="Upcoming">
                                    <h3>Upcoming <span className="dpt-count">{record.upcoming.length}</span></h3>
                                    {record.upcoming.length === 0 && <p className="dp-hint">None</p>}
                                    {record.upcoming.map((u) => (
                                        <div key={u.appointment_id} className="dpt-mini">
                                            <div className="dpt-mini-top">
                                                <strong>{formatDate(u.start_time)}, {formatTime(u.start_time)}</strong>
                                                <span className={`dp-chip ${statusClass(u.status)}`}>{statusLabel(u.status)}</span>
                                            </div>
                                            <span>{visitLabel(u.visit_type, u.purpose_other)} with Dr. {u.doc_last_name}</span>
                                        </div>
                                    ))}
                                </section>

                                <section className="dpt-block" aria-label="Recent Clinic Visits">
                                    <h3>Recent Clinic Visits <span className="dpt-count">{record.clinic_visits.length}</span></h3>
                                    {record.clinic_visits.length === 0 && <p className="dp-hint">None</p>}
                                    {record.clinic_visits.map((v) => (
                                        <div key={v.visit_id} className="dpt-mini">
                                            <strong>{formatDate(v.visit_date)}</strong>
                                            <span>{v.specify_complaint_text || 'Clinic visit'}{v.assessment ? ` - ${v.assessment}` : ''}</span>
                                        </div>
                                    ))}
                                </section>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <AppointModal
                patient={appointPatient}
                sessions={sessions}
                doctorId={doctorId}
                userId={userId}
                onClose={() => setAppointPatient(null)}
                onDone={() => { load(); loadSchedules(); }}
            />
        </div>
    );
};

export default DoctorPatients;
