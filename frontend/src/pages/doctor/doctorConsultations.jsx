// doctorConsultations.jsx
// Clinical consultation documentation: the patients waiting to be documented, today's visits and everything documented.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClipboardPlus, Search, Printer, Pill, Stethoscope, FileText, Footprints } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, statusClass, statusLabel, fullName } from '../../utils/visitPurpose';
import { printDocument, visitDocumentHtml } from '../../utils/doctorVisitDocuments';
import ConsultationModal from '../../components/doctor/ConsultationModal';
import { WalkInModal } from '../../components/doctor/AppointmentModals';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';
const PAGE_SIZE = 10;

const TABS = [
    ['queue', 'Ready to document'],
    ['today', "Today's visits"],
    ['documented', 'Documented']
];

const DoctorConsultations = () => {
    const { doctor, doctorId, userId, refreshPending } = useOutletContext();
    const { showAlert } = useAlert();

    const [tab, setTab] = useState('queue');
    const [items, setItems] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [counts, setCounts] = useState({ queue: 0 });
    const [target, setTarget] = useState(null);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const reqSeq = useRef(0);

    useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

    const fetchList = useCallback(async () => {
        const seq = ++reqSeq.current;
        setLoading(true);
        try {
            const qs = new URLSearchParams({ scope: tab, page, pageSize: PAGE_SIZE });
            if (query) qs.set('q', query);
            const res = await fetch(`${API}/api/doctor/${doctorId}/appointments?${qs.toString()}`);
            const data = await res.json();
            if (seq !== reqSeq.current) return;
            if (data.success) { setItems(data.appointments); setTotal(data.total); }
            else showAlert(data.message || 'Could not load the consultations.', 'error');
        } catch (e) {
            if (seq === reqSeq.current) showAlert('Could not reach the server.', 'error');
        } finally {
            if (seq === reqSeq.current) setLoading(false);
        }
    }, [doctorId, tab, page, query, showAlert]);

    const fetchCounts = useCallback(async () => {
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/appointments?scope=queue&pageSize=1`);
            const data = await res.json();
            if (data.success) setCounts({ queue: data.total });
        } catch (e) { /* cosmetic */ }
    }, [doctorId]);

    useEffect(() => { fetchList(); }, [fetchList]);
    useEffect(() => { fetchCounts(); }, [fetchCounts]);

    const refresh = () => { fetchList(); fetchCounts(); refreshPending?.(); };

    const print = (a, kind) => printDocument(
        kind === 'prescription' ? 'Prescription' : 'Doctor visit summary',
        visitDocumentHtml(kind, a, 'School Nurse'),
        () => showAlert('The print window was blocked. Allow pop-ups for this site and try again.', 'warning')
    );

    const afterWalkIn = async (created) => {
        setTab('queue');
        try {
            const res = await fetch(`${API}/api/doctor/${doctorId}/appointments?scope=queue&pageSize=50`);
            const data = await res.json();
            const row = data.appointments?.find((a) => a.appointment_id === created.appointment_id);
            if (row) setTarget(row);
        } catch (e) { /* the list still refreshes */ }
        refresh();
    };

    const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
    const rxCount = (a) => (Array.isArray(a.prescriptions) ? a.prescriptions.length : 0);

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Consultations</h2>
                    <p>Document the formal diagnosis, treatment plan, prescription and follow-up of each visit.</p>
                </div>
                <div className="dp-actions">
                    <button className="dp-btn dp-btn-accent" onClick={() => setShowWalkIn(true)}><Footprints size={17} /> Walk-in</button>
                </div>
            </div>

            <div className="dp-tabs" role="tablist" aria-label="Consultation lists">
                {TABS.map(([key, label]) => (
                    <button key={key} role="tab" aria-selected={tab === key} className={`dp-tab ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setPage(1); }}>
                        {label}
                        {key === 'queue' && counts.queue > 0 && <span className="n">{counts.queue}</span>}
                    </button>
                ))}
            </div>

            <div className="dp-filters">
                <div className="dp-search grow">
                    <Search size={16} />
                    <input className="dp-input" type="search" placeholder="Search student, ID or purpose" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search consultations" />
                </div>
            </div>

            {loading ? (
                <div className="dp-card dp-empty">Loading...</div>
            ) : items.length === 0 ? (
                <div className="dp-card dp-empty">
                    <FileText size={36} />
                    <p>{tab === 'queue' ? 'Nobody is waiting to be documented.' : tab === 'today' ? 'No visits today.' : 'No consultation has been documented yet.'}</p>
                </div>
            ) : (
                <div className="dp-list">
                    {items.map((a) => {
                        const documented = !!a.assessment_id;
                        return (
                            <article key={`${a.appointment_id}-${a.student_id}`} className="dp-appt">
                                <div className="dp-appt-when">
                                    <span className="d">{formatDate(a.start_time)}</span>
                                    <span className="t">{formatTime(a.start_time)} - {formatTime(a.end_time)}</span>
                                </div>
                                <div className="dp-appt-main">
                                    <h4>{fullName(a.student_first_name, a.student_last_name)} <span className="dp-hint">{a.student_id}</span></h4>
                                    <div className="dp-appt-sub">{visitLabel(a.visit_type, a.purpose_other)} - {sourceLabel(a.booking_source)}</div>
                                    {documented && (
                                        <>
                                            <div className="dp-appt-reason"><strong>Diagnosis:</strong> {a.diagnosis}</div>
                                            {a.treatment_recommendations && <div className="dp-appt-sub">Plan: {a.treatment_recommendations}</div>}
                                        </>
                                    )}
                                    <div className="dp-appt-chips">
                                        <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
                                        {documented && rxCount(a) > 0 && <span className="dp-chip"><Pill size={12} /> {rxCount(a)} medicine{rxCount(a) === 1 ? '' : 's'}</span>}
                                        {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Follow-up{a.follow_up_date ? `: ${formatDate(a.follow_up_date)}` : ''}</span>}
                                        {!!a.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
                                        {a.template_name && <span className="dp-chip source">{a.template_name}</span>}
                                    </div>
                                </div>
                                <div className="dp-appt-actions">
                                    {documented ? (
                                        <>
                                            <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setTarget(a)}><ClipboardPlus size={15} /> View / edit</button>
                                            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => print(a, 'summary')}><Printer size={15} /> Summary</button>
                                            {rxCount(a) > 0 && <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => print(a, 'prescription')}><Pill size={15} /> Prescription</button>}
                                        </>
                                    ) : ['Absent', 'Excused'].includes(a.attendance_status) ? (
                                        <span className="dp-chip st-no-show">{a.attendance_status === 'Absent' ? 'No-show' : 'Excused'}</span>
                                    ) : a.status === 'Scheduled' ? (
                                        <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setTarget(a)}><Stethoscope size={15} /> {a.attendance_status === 'Present' ? 'Document' : 'Start consultation'}</button>
                                    ) : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {total > PAGE_SIZE && (
                <div className="dp-pager">
                    <span>{total} visits</span>
                    <div>
                        <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                        <span>Page {page} of {pageCount}</span>
                        <button className="dp-btn dp-btn-ghost dp-btn-sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</button>
                    </div>
                </div>
            )}

            {target && <ConsultationModal key={target.appointment_id} appt={target} doctorId={doctorId} userId={userId} onClose={() => setTarget(null)} onSaved={refresh} />}
            <WalkInModal isOpen={showWalkIn} fixedDoctorId={doctor.doctor_id} creator={{ doctorId }} userId={userId} onClose={() => setShowWalkIn(false)} onCreated={afterWalkIn} />
        </>
    );
};

export default DoctorConsultations;
