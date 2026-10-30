// doctorPatients.jsx
// The doctor's access to student clinic records: search a student, read what the clinic documented, open the full health record.
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FolderHeart, CalendarPlus, Printer, Users, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, initials, fullName, statusClass, statusLabel } from '../../utils/visitPurpose';
import { printDocument, visitDocumentHtml } from '../../utils/doctorVisitDocuments';
import { DirectAppointmentModal } from '../../components/doctor/AppointmentModals';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const section = (s) => (s.program_name ? `${s.program_name} - Year ${s.year_level || '-'}${s.section ? `, Section ${s.section}` : ''}` : '');

const ConsultationDetails = ({ c, onPrint }) => {
    const rx = Array.isArray(c.prescriptions) ? c.prescriptions : [];
    const answers = Array.isArray(c.template_responses) ? c.template_responses : [];
    return (
        <>
            <dl className="dp-kv">
                <dt>Doctor</dt><dd>Dr. {c.doc_first_name} {c.doc_last_name}{c.specialization ? ` (${c.specialization})` : ''}</dd>
                <dt>Findings</dt><dd>{c.clinical_findings}</dd>
                <dt>Diagnosis</dt><dd>{c.diagnosis}</dd>
                {c.treatment_recommendations && <><dt>Treatment plan</dt><dd>{c.treatment_recommendations}</dd></>}
                {rx.length > 0 && (
                    <>
                        <dt>Prescription</dt>
                        <dd>{rx.map((p, i) => <div key={i}><strong>{p.medicine}</strong>{[p.dosage, p.frequency, p.duration ? `for ${p.duration}` : ''].filter(Boolean).length > 0 ? ` - ${[p.dosage, p.frequency, p.duration ? `for ${p.duration}` : ''].filter(Boolean).join(', ')}` : ''}{p.instructions ? ` (${p.instructions})` : ''}</div>)}</dd>
                    </>
                )}
                {answers.map((r) => <React.Fragment key={r.key}><dt>{r.label}</dt><dd>{Array.isArray(r.value) ? r.value.join(', ') : r.value}</dd></React.Fragment>)}
                {(c.follow_up_date || c.follow_up_notes) && <><dt>Follow-up</dt><dd>{[c.follow_up_date ? formatDate(c.follow_up_date) : '', c.follow_up_notes || ''].filter(Boolean).join(' - ')}</dd></>}
            </dl>
            <div style={{ marginTop: 10 }}>
                <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => onPrint(c)}><Printer size={15} /> Print summary</button>
            </div>
        </>
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
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [record, setRecord] = useState(null);
    const [recordPatient, setRecordPatient] = useState(null);
    const [recordLoading, setRecordLoading] = useState(false);
    const [open, setOpen] = useState(() => new Set());
    const [schedulePatient, setSchedulePatient] = useState(null);

    // the top bar search sends ?q=
    useEffect(() => { setSearch(urlQuery); setQuery(urlQuery); }, [urlQuery]);
    useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/patients${query ? `?q=${encodeURIComponent(query)}` : ''}`);
            const data = await res.json();
            if (data.success) setPatients(data.patients);
            else showAlert(data.message || 'Could not load the patients.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setLoading(false);
        }
    }, [doctorId, query, showAlert]);

    useEffect(() => { load(); }, [load]);

    const openRecord = async (p) => {
        setRecordPatient(p);
        setRecord(null);
        setOpen(new Set());
        setRecordLoading(true);
        try {
            const res = await fetch(`${API}/api/doctor/patients/${p.student_id}/record`);
            const data = await res.json();
            if (data.success) setRecord(data);
            else showAlert(data.message || 'Could not load the record.', 'error');
        } catch (e) {
            showAlert('Could not reach the server.', 'error');
        } finally {
            setRecordLoading(false);
        }
    };

    const toggle = (id) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

    const print = (c) => printDocument('Doctor visit summary', visitDocumentHtml('summary', c, 'School Nurse'),
        () => showAlert('The print window was blocked. Allow pop-ups for this site and try again.', 'warning'));

    const clearSearch = () => { setSearch(''); setQuery(''); if (urlQuery) setParams({}, { replace: true }); };

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Patient Records</h2>
                    <p>{query ? `Students matching "${query}".` : 'Students you have seen or have booked. Search to find any student in the clinic.'}</p>
                </div>
            </div>

            <div className="dp-filters">
                <div className="dp-search grow">
                    <Search size={16} />
                    <input className="dp-input" type="search" placeholder="Search by student name or ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search students" />
                </div>
                {query && <button className="dp-btn dp-btn-ghost" onClick={clearSearch}>Show my patients</button>}
            </div>

            {loading ? (
                <div className="dp-card dp-empty">Loading...</div>
            ) : patients.length === 0 ? (
                <div className="dp-card dp-empty">
                    <Users size={36} />
                    <p>{query ? 'No student found.' : 'No patients yet. Search for a student to open the record.'}</p>
                </div>
            ) : (
                <div className="dp-list">
                    {patients.map((p) => (
                        <article key={p.student_id} className="dp-appt" style={{ gridTemplateColumns: '48px minmax(0, 1fr) auto' }}>
                            <span className="dl-avatar" style={{ width: 48, height: 48 }}>{initials(p.first_name, p.last_name)}</span>
                            <div className="dp-appt-main">
                                <h4>{fullName(p.first_name, p.last_name)} <span className="dp-hint">{p.student_id}</span></h4>
                                <div className="dp-appt-sub">{section(p) || 'No section'}</div>
                                <div className="dp-appt-chips">
                                    {Number(p.visits_with_me) > 0
                                        ? <span className="dp-chip">{p.visits_with_me} visit{Number(p.visits_with_me) === 1 ? '' : 's'} with you{p.last_visit ? `, last ${formatDate(p.last_visit)}` : ''}</span>
                                        : <span className="dp-chip source">Not seen by you yet</span>}
                                    {!!Number(p.abnormal) && <span className="dp-chip abnormal">Abnormal finding</span>}
                                </div>
                            </div>
                            <div className="dp-appt-actions">
                                <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => openRecord(p)}><FolderHeart size={15} /> Open record</button>
                                <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setSchedulePatient(p)}><CalendarPlus size={15} /> Appoint</button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Modal isOpen={!!recordPatient} onClose={() => setRecordPatient(null)} title={recordPatient ? `${fullName(recordPatient.first_name, recordPatient.last_name)} - clinic record` : ''} icon={<FolderHeart size={20} />} size="xl">
                {recordLoading || !record ? <p className="dp-hint">Loading...</p> : (
                    <div className="dp-form">
                        <div className="dp-notice" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <span>{record.student.student_id} - {section(record.student) || 'No section'}</span>
                            <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => navigate(`/health-records/view/${record.student.student_id}`)}><FolderHeart size={15} /> Full health record</button>
                        </div>

                        {record.upcoming.length > 0 && (
                            <>
                                <div className="dp-section-label">Upcoming appointments</div>
                                {record.upcoming.map((u) => (
                                    <div key={u.appointment_id} className="dp-appt-sub">
                                        {formatDate(u.start_time)}, {formatTime(u.start_time)} - {visitLabel(u.visit_type, u.purpose_other)} with Dr. {u.doc_last_name}{' '}
                                        <span className={`dp-chip ${statusClass(u.status)}`}>{statusLabel(u.status)}</span>
                                    </div>
                                ))}
                            </>
                        )}

                        <div className="dp-section-label">Doctor check-ups ({record.consultations.length})</div>
                        {record.consultations.length === 0 && <p className="dp-hint" style={{ margin: 0 }}>No check-up has been documented for this student.</p>}
                        {record.consultations.map((c) => {
                            const isOpen = open.has(c.appointment_id);
                            return (
                                <div key={c.appointment_id} className="dp-card" style={{ padding: 14, boxShadow: 'none' }}>
                                    <button type="button" onClick={() => toggle(c.appointment_id)} aria-expanded={isOpen}
                                        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0, font: 'inherit' }}>
                                        <span>
                                            <strong>{formatDate(c.start_time)}</strong> - {visitLabel(c.visit_type, c.purpose_other)}
                                            <span className="dp-hint" style={{ display: 'block' }}>{c.diagnosis}</span>
                                        </span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                            {!!c.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
                                            {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </span>
                                    </button>
                                    {isOpen && <div style={{ marginTop: 12 }}><ConsultationDetails c={c} onPrint={print} /></div>}
                                </div>
                            );
                        })}

                        {record.clinic_visits.length > 0 && (
                            <>
                                <div className="dp-section-label">Recent clinic visits (nurse)</div>
                                {record.clinic_visits.map((v) => (
                                    <div key={v.visit_id} className="dp-appt-sub">
                                        <strong>{formatDate(v.visit_date)}</strong> - {v.specify_complaint_text || 'Clinic visit'}
                                        {v.assessment ? ` - ${v.assessment}` : ''}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </Modal>

            <DirectAppointmentModal
                isOpen={!!schedulePatient}
                fixedDoctorId={doctorId}
                creator={{ doctorId }}
                userId={userId}
                presetStudent={schedulePatient}
                onClose={() => setSchedulePatient(null)}
                onCreated={load}
            />
        </>
    );
};

export default DoctorPatients;
