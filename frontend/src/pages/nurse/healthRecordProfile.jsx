import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useScreeningSync } from '../../hooks/useScreeningSync';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Download, FileText, AlertTriangle, Clock, Pencil,
    User, X, ShieldCheck, CheckCircle, XCircle, HeartPulse, ListChecks
} from 'lucide-react';
import stiLogo from '../../assets/sti-logof.png';
import { formatDate } from '../../utils/datetime';
import { useAlert } from '../../context/AlertContext';
import HealthInfoView from '../../components/common/HealthInfoView';
import HealthHistoryEditModal from '../../components/nurse/HealthHistoryEditModal';
import '../../styles/nurse/HealthRecordProfile.css';
import '../../styles/nurse/HealthRecordProfilePage.css';

const API = 'http://localhost:3001';

// doctors open this page from their Patient Records, so "back" returns there
const viewerIsDoctor = () => {
    try { return JSON.parse(sessionStorage.getItem('user') || 'null')?.role === 'doctor'; } catch (e) { return false; }
};

// The health table stores checkboxes as 1 / 0. Only those columns become true / false; text and number columns stay as they are.
const FLAG_KEY = /^(has_|reaction_(?!others)|blood_disorder_|digestive_(?!medication)|metabolic_|vision_with_)/;

// Conditions that show as a chip in the summary strip. tone: bad = needs attention first.
const FLAG_CHIPS = [
    ['has_allergies', 'Allergies', 'bad'],
    ['has_asthma', 'Asthma', 'bad'],
    ['has_heart_problems', 'Heart problems', 'bad'],
    ['has_seizure_episode', 'Seizures', 'bad'],
    ['has_blood_disorders', 'Blood disorders', 'warn'],
    ['has_kidney_bladder_problems', 'Kidney / bladder', 'warn'],
    ['has_digestive_disorders', 'Digestive', 'warn'],
    ['has_metabolic_diseases', 'Metabolic', 'warn'],
    ['has_other_respiratory', 'Respiratory', 'warn'],
    ['has_vision_problem', 'Vision', 'warn'],
    ['has_hearing_problem', 'Hearing', 'warn'],
    ['has_surgery', 'Surgery', 'warn']
];

const DAY_MS = 86400000;

// complete = submitted, danger = late or missing, warning = everything else (still pending)
const requirementKind = (req) => {
    const s = (req.status || '').toLowerCase();
    if (['completed', 'submitted'].includes(s)) return 'complete';
    if (['late', 'submitted late', 'overdue', 'missing', 'not submitted'].includes(s)) return 'danger';
    return 'warning';
};

const KIND_CHIP = {
    complete: { cls: 'ok', Icon: CheckCircle },
    warning: { cls: 'warn', Icon: Clock },
    danger: { cls: 'bad', Icon: AlertTriangle }
};

const FILTERS = [['all', 'All'], ['warning', 'Pending'], ['danger', 'Overdue'], ['complete', 'Complete']];

const daysUntil = (value) => {
    if (!value) return null;
    const due = new Date(value);
    if (Number.isNaN(due.getTime())) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - start.getTime()) / DAY_MS);
};

// status choices the nurse can set; Completed / Rejected need an uploaded file (the server checks too)
const EDIT_STATUSES = [['Pending', 'Pending'], ['Not Submitted', 'Missed'], ['Completed', 'Completed'], ['Rejected', 'Rejected']];

// local date as yyyy-mm-dd, the same day the table shows
const toDateInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// the nurse's user id, to look up the nurse_id the update endpoint wants
const storedUserId = () => {
    try {
        const u = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
        return u?.user_id || u?.id || u?.UserID || u?.userId || null;
    } catch (e) { return null; }
};

// dates as yyyy-mm-dd, checkbox columns (1 / 0) as true / false
const normalizeHealth = (raw) => {
    const health = { ...(raw || {}) };
    ['seizure_last_episode_date', 'surgery_date'].forEach((k) => {
        if (health[k]) health[k] = String(health[k]).split('T')[0];
    });
    Object.keys(health).forEach((key) => {
        if (FLAG_KEY.test(key) && (health[key] === 1 || health[key] === 0)) health[key] = health[key] === 1;
    });
    return health;
};

function Field({ label, value, full }) {
    const has = value !== null && value !== undefined && String(value).trim() !== '';
    return (
        <div className={full ? 'full' : undefined}>
            <dt>{label}</dt>
            <dd className={has ? undefined : 'empty'}>{has ? value : '—'}</dd>
        </div>
    );
}

export default function HealthRecordsProfile() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const { showAlert, showConfirm } = useAlert();

    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(true);
    const [reqFilter, setReqFilter] = useState('all');

    const [studentHeader, setStudentHeader] = useState(null);
    const [personalInfo, setPersonalInfo] = useState({});
    const [healthInfo, setHealthInfo] = useState({});
    const [healthProofs, setHealthProofs] = useState({});
    const [requirementsList, setRequirementsList] = useState([]);

    // Connected parent profile modal
    const [showParentModal, setShowParentModal] = useState(false);
    const [parentDetails, setParentDetails] = useState(null);
    const [parentLoading, setParentLoading] = useState(false);
    const [parentError, setParentError] = useState('');
    const openerRef = useRef(null);
    const modalRef = useRef(null);
    const tabRefs = useRef({});
    const busyRef = useRef(false);

    // Nurse only: edit one requirement submission (doctors keep the read view)
    const [nurseId, setNurseId] = useState(null);
    const [editReq, setEditReq] = useState(null);
    const [saving, setSaving] = useState(false);
    const [editHistory, setEditHistory] = useState(false);
    const [historySaving, setHistorySaving] = useState(false);

    useEffect(() => {
        if (viewerIsDoctor()) return undefined;
        const userId = storedUserId();
        if (!userId) return undefined;
        let cancelled = false;
        fetch(`${API}/api/get-nurse/${encodeURIComponent(userId)}`)
            .then((r) => r.json())
            .then((d) => { if (!cancelled && d.success && d.nurse?.nurse_id) setNurseId(d.nurse.nurse_id); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // header, profile and requirements load together; the summary strip needs all three
    useEffect(() => {
        if (!studentId) return undefined;
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const id = encodeURIComponent(studentId);
                const [headerData, profileData, reqData] = await Promise.all([
                    fetch(`${API}/api/health-records/student-header/${id}`).then((r) => r.json()),
                    fetch(`${API}/api/profile/${id}`).then((r) => r.json()),
                    fetch(`${API}/api/students/${id}/full-requirements`).then((r) => r.json()).catch(() => [])
                ]);
                if (cancelled) return;

                if (!headerData.success || !profileData.success) {
                    showAlert('Cannot load this profile.', 'error');
                    return;
                }

                const personal = { ...(profileData.personalInfo || {}) };
                if (personal.birth_date) personal.birth_date = String(personal.birth_date).split('T')[0];

                setStudentHeader(headerData.student);
                setPersonalInfo(personal);
                setHealthInfo(normalizeHealth(profileData.healthInfo));
                setHealthProofs(profileData.healthProofs || {});
                setRequirementsList(Array.isArray(reqData) ? reqData : []);
            } catch (err) {
                if (!cancelled) showAlert('Cannot load this profile.', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
        // showAlert is stable (useCallback in AlertContext)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId]);

    // a screening result (BMI moves height / weight) changed: refresh the header quietly
    useScreeningSync(useCallback(() => {
        if (!studentId) return;
        fetch(`${API}/api/health-records/student-header/${encodeURIComponent(studentId)}`)
            .then((r) => r.json())
            .then((d) => { if (d.success && d.student) setStudentHeader(d.student); })
            .catch(() => {});
    }, [studentId]), { enabled: !!studentId });

    const reloadRequirements = async () => {
        try {
            const data = await fetch(`${API}/api/students/${encodeURIComponent(studentId)}/full-requirements`).then((r) => r.json());
            setRequirementsList(Array.isArray(data) ? data : []);
        } catch (err) {
            showAlert('Cannot refresh requirements.', 'error');
        }
    };

    const handleOpenHistory = (e) => {
        openerRef.current = e.currentTarget;
        setEditHistory(true);
    };

    const closeHistory = () => {
        setEditHistory(false);
        if (openerRef.current) openerRef.current.focus();
    };

    // files = [[has_* flag, File], ...]; multipart like the student's form (student_id first: the upload name uses it)
    const handleSaveHistory = async (info, files = []) => {
        if (historySaving) return;
        setHistorySaving(true);
        const ok = await showConfirm('Save changes to the health history?', { title: 'Save changes', confirmLabel: 'Save' });
        if (!ok) { setHistorySaving(false); return; }
        try {
            const formData = new FormData();
            formData.append('student_id', studentId);
            formData.append('healthInfo', JSON.stringify(info));
            formData.append('nurse_edit', '1');
            const senderId = storedUserId();
            if (senderId) formData.append('sender_id', senderId);
            files.forEach(([key, file]) => formData.append(`proof_${key}`, file));
            const res = await fetch(`${API}/api/update-profile`, { method: 'PUT', body: formData });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                showAlert(data?.message || 'Cannot save.', 'error');
                return;
            }
            const fresh = await fetch(`${API}/api/profile/${encodeURIComponent(studentId)}`).then((r) => r.json());
            if (fresh.success) {
                setHealthInfo(normalizeHealth(fresh.healthInfo));
                setHealthProofs(fresh.healthProofs || {});
            }
            closeHistory();
            showAlert('Saved.', 'success');
        } catch (err) {
            showAlert('Cannot save.', 'error');
        } finally {
            setHistorySaving(false);
        }
    };

    const handleOpenEdit = (e, req) => {
        openerRef.current = e.currentTarget;
        setEditReq({
            name: req.requirement_name,
            type: req.type || 'Program',
            config_id: req.config_id || null,
            hasFile: !!req.file_url,
            status: req.status || 'Pending',
            deadline: toDateInput(req.submission_deadline),
            allowLate: [1, true, '1'].includes(req.allow_late_submission),
            remarks: req.nurse_remarks || ''
        });
    };

    const handleSaveRequirement = async (e) => {
        e.preventDefault();
        const r = editReq;
        if (!r || saving) return;
        if (['Completed', 'Rejected'].includes(r.status) && !r.hasFile) {
            showAlert('No file uploaded.', 'warning');
            return;
        }
        busyRef.current = true;
        const ok = await showConfirm(`Save changes to "${r.name}"?`, { title: 'Save changes', confirmLabel: 'Save' });
        if (!ok) { busyRef.current = false; return; }
        setSaving(true);
        try {
            const res = await fetch(`${API}/api/students/${encodeURIComponent(studentId)}/requirements/${encodeURIComponent(r.name)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: r.status,
                    nurse_remarks: r.remarks,
                    submission_deadline: r.deadline || null,
                    type: r.type,
                    config_id: r.config_id,
                    override_allow_late_submission: r.allowLate,
                    nurse_id: nurseId
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                showAlert(data?.error || 'Cannot save.', 'error');
                return;
            }
            closeModal();
            showAlert('Saved.', 'success');
            await reloadRequirements();
        } catch (err) {
            showAlert('Cannot save.', 'error');
        } finally {
            setSaving(false);
            busyRef.current = false;
        }
    };

    const handleOpenParentModal = async (e) => {
        openerRef.current = e.currentTarget;
        setShowParentModal(true);
        setParentLoading(true);
        setParentError('');
        try {
            const res = await fetch(`${API}/api/health-records/parent-profile/${encodeURIComponent(studentId)}`);
            const data = await res.json();
            if (data.success) {
                setParentDetails(data.parent);
            } else {
                setParentDetails(null);
                setParentError(data.message || 'No parent account.');
            }
        } catch (err) {
            setParentDetails(null);
            setParentError('Cannot load the parent profile.');
        } finally {
            setParentLoading(false);
        }
    };

    const closeModal = () => {
        setShowParentModal(false);
        setEditReq(null);
        if (openerRef.current) openerRef.current.focus();
    };

    // modal (parent profile or requirement edit): focus the close button, Esc closes, Tab stays inside
    const modalOpen = showParentModal || !!editReq;
    useEffect(() => {
        if (!modalOpen) return undefined;
        const root = modalRef.current;
        const first = root && root.querySelector('button');
        if (first) first.focus();
        const onKey = (e) => {
            if (busyRef.current) return;
            if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
            if (e.key !== 'Tab' || !root) return;
            const items = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (!items.length) return;
            const head = items[0];
            const tail = items[items.length - 1];
            if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
            else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modalOpen]);

    const TABS = [['personal', 'Personal'], ['health', 'Health'], ['requirements', 'Requirements']];
    const onTabKey = (e, index) => {
        let next = null;
        if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = TABS.length - 1;
        if (next === null) return;
        e.preventDefault();
        const key = TABS[next][0];
        setActiveTab(key);
        if (tabRefs.current[key]) tabRefs.current[key].focus();
    };

    if (loading) return <div className="hrp-loading" role="status">Loading student record...</div>;

    const isInactive = studentHeader?.is_active === 0 || studentHeader?.is_active === false;
    const fullName = `${studentHeader?.first_name || ''} ${studentHeader?.last_name || ''}`.trim();
    const initials = `${(studentHeader?.first_name || '?')[0]}${(studentHeader?.last_name || '')[0] || ''}`.toUpperCase();

    const flagChips = FLAG_CHIPS.filter(([key]) => healthInfo[key]);

    const counts = { all: requirementsList.length, warning: 0, danger: 0, complete: 0 };
    requirementsList.forEach((r) => { counts[requirementKind(r)] += 1; });
    const shownRequirements = requirementsList.filter((r) => reqFilter === 'all' || requirementKind(r) === reqFilter);

    const parentName = studentHeader?.parent_first_name
        ? `${studentHeader.parent_first_name} ${studentHeader.parent_last_name || ''}`.trim()
        : null;

    return (
        <div className="hrp-page">
            <div className="hrp-actions hrp-no-print">
                <button
                    type="button"
                    className="hrp-btn-icon"
                    onClick={() => navigate(viewerIsDoctor() ? '/DoctorPatients' : '/HealthRecords')}
                    aria-label="Back to records"
                    title="Back to records"
                >
                    <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <p className="hrp-crumbs">Health Records / {studentHeader?.last_name}, {studentHeader?.first_name}</p>
                <button
                    type="button"
                    className="hrp-btn-icon solid"
                    onClick={() => window.print()}
                    aria-label="Export health report"
                    title="Export health report"
                >
                    <Download size={18} aria-hidden="true" />
                </button>
            </div>

            <header className="hrp-banner hrp-no-print">
                <div className="hrp-avatar" aria-hidden="true">{initials}</div>
                <div className="hrp-who">
                    <div className="hrp-name-row">
                        <h1>{fullName}</h1>
                        {isInactive && <span className="hrp-chip bad"><AlertTriangle size={14} aria-hidden="true" /> Inactive account</span>}
                    </div>
                    <div className="hrp-meta">
                        <span>{studentHeader?.program_id} - {studentHeader?.year_level} Year</span>
                        <span className="hrp-id">{studentId}</span>
                    </div>
                </div>
            </header>

            <section className="hrp-summary hrp-no-print" aria-label="Summary">
                <article className="hrp-tile">
                    <div className="hrp-tile-head"><h2><HeartPulse size={18} aria-hidden="true" /> Health flags</h2></div>
                    {flagChips.length === 0 ? (
                        <span className="hrp-chip ok"><CheckCircle size={14} aria-hidden="true" /> None recorded</span>
                    ) : (
                        <ul className="hrp-flags">
                            {flagChips.map(([key, label, tone]) => (
                                <li key={key}><span className={`hrp-chip ${tone}`}><AlertTriangle size={14} aria-hidden="true" /> {label}</span></li>
                            ))}
                        </ul>
                    )}
                </article>

                <article className="hrp-tile">
                    <div className="hrp-tile-head"><h2><ListChecks size={18} aria-hidden="true" /> Requirements</h2></div>
                    {counts.all === 0 ? (
                        <p className="hrp-muted">None assigned.</p>
                    ) : (
                        <>
                            <p className="hrp-prog-num">{counts.complete}<small> of {counts.all} complete</small></p>
                            <div
                                className="hrp-bar"
                                role="progressbar"
                                aria-label="Requirements complete"
                                aria-valuemin={0}
                                aria-valuemax={counts.all}
                                aria-valuenow={counts.complete}
                            >
                                <i style={{ width: `${Math.round((counts.complete / counts.all) * 100)}%` }} />
                            </div>
                            <div className="hrp-flags">
                                {counts.danger > 0 && <span className="hrp-chip bad"><AlertTriangle size={14} aria-hidden="true" /> {counts.danger} overdue</span>}
                                {counts.warning > 0 && <span className="hrp-chip warn"><Clock size={14} aria-hidden="true" /> {counts.warning} pending</span>}
                            </div>
                        </>
                    )}
                </article>

                <article className="hrp-tile">
                    <div className="hrp-tile-head">
                        <h2><User size={18} aria-hidden="true" /> Parent account</h2>
                        <button
                            type="button"
                            className="hrp-btn-icon"
                            onClick={handleOpenParentModal}
                            aria-label="View parent account"
                            title="View parent account"
                            aria-haspopup="dialog"
                        >
                            <User size={18} aria-hidden="true" />
                        </button>
                    </div>
                    {parentName ? (
                        <>
                            <p className="hrp-parent-name">{parentName}</p>
                            <p className="hrp-muted">{studentHeader?.parent_phone || 'No number'}</p>
                        </>
                    ) : (
                        <p className="hrp-muted">No parent account.</p>
                    )}
                </article>
            </section>

            <div className="hrp-tabs hrp-no-print" role="tablist" aria-label="Record sections">
                {TABS.map(([key, label], i) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`hrp-tab-${key}`}
                        aria-controls={`hrp-panel-${key}`}
                        aria-selected={activeTab === key}
                        tabIndex={activeTab === key ? 0 : -1}
                        ref={(el) => { tabRefs.current[key] = el; }}
                        onClick={() => setActiveTab(key)}
                        onKeyDown={(e) => onTabKey(e, i)}
                    >
                        {label}
                        {key === 'requirements' && counts.danger > 0 && (
                            <span className="hrp-count" aria-label={`${counts.danger} overdue`}>{counts.danger}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="hrp-no-print">
                {/* PERSONAL */}
                <section id="hrp-panel-personal" role="tabpanel" aria-labelledby="hrp-tab-personal" className="hrp-panel" hidden={activeTab !== 'personal'}>
                    <div className="hrp-grid">
                        <div className="hrp-card">
                            <h3>Identity</h3>
                            <dl className="hrp-fields">
                                <Field label="Gender" value={personalInfo.gender} />
                                <Field label="Date of birth" value={personalInfo.birth_date ? formatDate(personalInfo.birth_date) : ''} />
                                <Field label="Age" value={personalInfo.age} />
                            </dl>
                        </div>
                        <div className="hrp-card">
                            <h3>Contact</h3>
                            <dl className="hrp-fields">
                                <Field label="Contact no." value={personalInfo.contact_number} />
                                <Field label="Address" value={personalInfo.address} full />
                            </dl>
                        </div>
                        <div className="hrp-card">
                            <h3>Family</h3>
                            <dl className="hrp-fields">
                                <Field label="Father's name" value={personalInfo.father_name} />
                                <Field label="Mother's name" value={personalInfo.mother_name} />
                            </dl>
                        </div>
                    </div>
                </section>

                {/* HEALTH: body, history, latest check-up per service, latest screening per type */}
                <section id="hrp-panel-health" role="tabpanel" aria-labelledby="hrp-tab-health" className="hrp-panel" hidden={activeTab !== 'health'}>
                    <div className="hrp-card">
                        <HealthInfoView studentId={studentId} healthInfo={healthInfo} healthProofs={healthProofs} showCheckups onEditHistory={nurseId ? handleOpenHistory : undefined} />
                    </div>
                </section>

                {/* REQUIREMENTS */}
                <section id="hrp-panel-requirements" role="tabpanel" aria-labelledby="hrp-tab-requirements" className="hrp-panel" hidden={activeTab !== 'requirements'}>
                    <div className="hrp-filters" role="group" aria-label="Filter by status">
                        {FILTERS.map(([key, label]) => (
                            <button key={key} type="button" aria-pressed={reqFilter === key} onClick={() => setReqFilter(key)}>
                                {label} <span className="n">{counts[key]}</span>
                            </button>
                        ))}
                    </div>

                    {shownRequirements.length === 0 ? (
                        <div className="hrp-empty">Nothing here.</div>
                    ) : (
                        <div className="hrp-table-wrap">
                            <table className="hrp-table">
                                <caption className="hrp-sr-only">Requirements</caption>
                                <thead>
                                    <tr>
                                        <th>Requirement</th>
                                        <th>Type</th>
                                        <th>Deadline</th>
                                        <th>Status</th>
                                        <th>Remarks</th>
                                        <th>File</th>
                                        {nurseId && <th>Edit</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {shownRequirements.map((req) => {
                                        const kind = requirementKind(req);
                                        const { cls, Icon } = KIND_CHIP[kind];
                                        const left = daysUntil(req.submission_deadline);
                                        let hint = null;
                                        if (kind !== 'complete' && left !== null) {
                                            if (left < 0) hint = <span className="sub bad">Overdue by {-left} {left === -1 ? 'day' : 'days'}</span>;
                                            else if (left <= 7) hint = <span className="sub warn">Due in {left} {left === 1 ? 'day' : 'days'}</span>;
                                        }
                                        return (
                                            <tr key={req.config_id ?? `${req.type}-${req.requirement_name}`}>
                                                <th scope="row">{req.requirement_name}</th>
                                                <td>
                                                    <span className={`hrp-chip ${req.type === 'Special' ? 'warn' : 'brand'}`}>{req.type || 'Program'}</span>
                                                </td>
                                                <td>
                                                    {req.submission_deadline ? formatDate(new Date(req.submission_deadline)) : 'No deadline'}
                                                    {hint}
                                                </td>
                                                <td>
                                                    <span className={`hrp-chip ${cls}`}><Icon size={14} aria-hidden="true" /> {req.status || 'Pending'}</span>
                                                </td>
                                                <td>{req.nurse_remarks || <span className="hrp-muted">—</span>}</td>
                                                <td>
                                                    {req.file_url ? (
                                                        <a
                                                            className="hrp-btn-icon"
                                                            href={req.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            aria-label={`Open file of ${req.requirement_name}`}
                                                            title="Open file"
                                                        >
                                                            <FileText size={18} aria-hidden="true" />
                                                        </a>
                                                    ) : (
                                                        <span className="hrp-muted">No file</span>
                                                    )}
                                                </td>
                                                {nurseId && (
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="hrp-btn-icon"
                                                            onClick={(e) => handleOpenEdit(e, req)}
                                                            aria-label={`Edit ${req.requirement_name}`}
                                                            title="Edit"
                                                            aria-haspopup="dialog"
                                                        >
                                                            <Pencil size={18} aria-hidden="true" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {/* CONNECTED PARENT PROFILE MODAL */}
            {showParentModal && (
                <div className="hrp-backdrop hrp-no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
                    <div className="hrp-modal" role="dialog" aria-modal="true" aria-labelledby="hrp-parent-title" ref={modalRef}>
                        <div className="hrp-modal-head">
                            <h2 id="hrp-parent-title"><User size={20} aria-hidden="true" /> Parent profile</h2>
                            <button type="button" className="hrp-btn-icon" onClick={closeModal} aria-label="Close" title="Close">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <div className="hrp-modal-body">
                            {parentLoading ? (
                                <p className="hrp-muted" role="status">Loading...</p>
                            ) : parentError ? (
                                <p className="hrp-chip bad" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {parentError}</p>
                            ) : parentDetails ? (
                                <dl className="hrp-fields">
                                    <Field label="Parent ID" value={parentDetails.parent_id} />
                                    <Field label="Full name" value={`${parentDetails.first_name} ${parentDetails.last_name}`} />
                                    <Field label="Primary contact" value={parentDetails.primary_phone} />
                                    <Field label="Username" value={parentDetails.username} />
                                    <div>
                                        <dt>SMS</dt>
                                        <dd>
                                            {parentDetails.is_sms_verified
                                                ? <span className="hrp-chip ok"><ShieldCheck size={14} aria-hidden="true" /> Verified</span>
                                                : <span className="hrp-chip neutral">Not verified</span>}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Account</dt>
                                        <dd>
                                            {parentDetails.is_active === 1 || parentDetails.is_active === true
                                                ? <span className="hrp-chip ok"><CheckCircle size={14} aria-hidden="true" /> Active</span>
                                                : <span className="hrp-chip bad"><XCircle size={14} aria-hidden="true" /> Inactive</span>}
                                        </dd>
                                    </div>
                                </dl>
                            ) : null}
                        </div>
                        <div className="hrp-modal-foot">
                            <button type="button" className="hrp-btn-text" onClick={closeModal}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* NURSE: EDIT ONE REQUIREMENT SUBMISSION */}
            {editReq && (
                <div className="hrp-backdrop hrp-no-print" onMouseDown={(e) => { if (e.target === e.currentTarget && !busyRef.current) closeModal(); }}>
                    <div className="hrp-modal" role="dialog" aria-modal="true" aria-labelledby="hrp-edit-title" ref={modalRef}>
                        <div className="hrp-modal-head">
                            <h2 id="hrp-edit-title"><Pencil size={20} aria-hidden="true" /> Edit requirement</h2>
                            <button type="button" className="hrp-btn-icon" onClick={closeModal} aria-label="Close" title="Close">
                                <X size={18} aria-hidden="true" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveRequirement}>
                            <div className="hrp-modal-body hrp-form">
                                <p className="hrp-form-name">{editReq.name}</p>

                                <label htmlFor="hrp-edit-status">Status</label>
                                <select
                                    id="hrp-edit-status"
                                    value={editReq.status}
                                    onChange={(e) => setEditReq({ ...editReq, status: e.target.value })}
                                >
                                    {EDIT_STATUSES.map(([value, label]) => (
                                        <option key={value} value={value} disabled={['Completed', 'Rejected'].includes(value) && !editReq.hasFile}>
                                            {label}{['Completed', 'Rejected'].includes(value) && !editReq.hasFile ? ' (no file)' : ''}
                                        </option>
                                    ))}
                                    {!EDIT_STATUSES.some(([value]) => value === editReq.status) && (
                                        <option value={editReq.status}>{editReq.status}</option>
                                    )}
                                </select>

                                <label htmlFor="hrp-edit-deadline">Deadline</label>
                                <input
                                    id="hrp-edit-deadline"
                                    type="date"
                                    value={editReq.deadline}
                                    onChange={(e) => setEditReq({ ...editReq, deadline: e.target.value })}
                                />

                                <label className="hrp-check">
                                    <input
                                        type="checkbox"
                                        checked={editReq.allowLate}
                                        onChange={(e) => setEditReq({ ...editReq, allowLate: e.target.checked })}
                                    />
                                    Late allowed
                                </label>

                                <label htmlFor="hrp-edit-remarks">Remarks</label>
                                <textarea
                                    id="hrp-edit-remarks"
                                    rows={3}
                                    value={editReq.remarks}
                                    onChange={(e) => setEditReq({ ...editReq, remarks: e.target.value })}
                                />
                            </div>
                            <div className="hrp-modal-foot hrp-modal-foot-split">
                                <button type="button" className="hrp-btn-text ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="hrp-btn-text" disabled={saving}>Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* NURSE: EDIT HEALTH HISTORY */}
            {editHistory && (
                <div className="hrp-no-print">
                    <HealthHistoryEditModal initial={healthInfo} savedProofs={healthProofs} saving={historySaving} onSave={handleSaveHistory} onClose={closeHistory} />
                </div>
            )}

            {/* PRINTABLE PDF REPORT CONTAINER */}
            <div className="printable-health-report">
                <div className="hrp-report-head">
                    <img src={stiLogo} alt="STI Logo" />
                    <h2>STI College Baliuag</h2>
                    <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan.</p>
                    <h3>HEALTH PROFILE REPORT</h3>
                </div>

                <div className="hrp-report-block">
                    <h4>Student Information</h4>
                    <p><strong>Student ID:</strong> {studentId} {isInactive ? '(Inactive Account)' : ''}</p>
                    <p><strong>Name:</strong> {fullName}</p>
                    <p><strong>Program & Year:</strong> {studentHeader?.program_id} - {studentHeader?.year_level} Year</p>
                    <p><strong>Gender:</strong> {personalInfo.gender || 'N/A'} | <strong>Age:</strong> {personalInfo.age || 'N/A'} | <strong>Date of Birth:</strong> {personalInfo.birth_date ? formatDate(personalInfo.birth_date) : 'N/A'}</p>
                    <p><strong>Contact No.:</strong> {personalInfo.contact_number || 'N/A'}</p>
                    <p><strong>Address:</strong> {personalInfo.address || 'N/A'}</p>
                    <p><strong>Height / Weight:</strong> {personalInfo.height_cm ? `${personalInfo.height_cm} cm` : 'N/A'} / {personalInfo.weight_kg ? `${personalInfo.weight_kg} kg` : 'N/A'}</p>
                </div>

                <div className="hrp-report-block">
                    <h4>Connected Parent Information</h4>
                    <p><strong>Parent Name:</strong> {parentName || 'N/A'}</p>
                    <p><strong>Parent Contact No.:</strong> {studentHeader?.parent_phone || 'N/A'}</p>
                </div>

                <div className="hrp-report-block">
                    <h4>Health Profile Summary</h4>
                    <ul>
                        {healthInfo.has_allergies && <li>Allergies (Food: {healthInfo.allergy_food || 'None'}, Meds: {healthInfo.allergy_medicine || 'None'})</li>}
                        {healthInfo.has_asthma && <li>Asthma (Triggers: {healthInfo.asthma_triggers || 'N/A'})</li>}
                        {healthInfo.has_other_respiratory && <li>Respiratory Conditions ({healthInfo.other_respiratory_specify || 'Specified'})</li>}
                        {healthInfo.has_blood_disorders && <li>Blood Disorders noted</li>}
                        {healthInfo.has_digestive_disorders && <li>Digestive Conditions noted</li>}
                        {healthInfo.has_heart_problems && <li>Heart Problems ({healthInfo.heart_problems_specify || 'Specified'})</li>}
                        {healthInfo.has_kidney_bladder_problems && <li>Kidney/Bladder Issues ({healthInfo.kidney_bladder_specify || 'Specified'})</li>}
                        {healthInfo.has_seizure_episode && <li>Seizure Episodes (Last: {healthInfo.seizure_last_episode_date ? formatDate(healthInfo.seizure_last_episode_date) : 'N/A'})</li>}
                        {healthInfo.has_surgery && <li>History of Surgery ({healthInfo.surgery_specify || 'Specified'})</li>}
                        {healthInfo.has_vision_problem && <li>Vision Problem ({healthInfo.vision_specify || 'Specified'})</li>}
                        {flagChips.length === 0 && <li>No critical medical conditions or allergies recorded.</li>}
                    </ul>
                </div>

                <div className="hrp-report-block">
                    <h4>Requirements</h4>
                    <p>{counts.all === 0 ? 'None assigned.' : `${counts.complete} of ${counts.all} complete, ${counts.danger} overdue, ${counts.warning} pending.`}</p>
                </div>

                <div className="hrp-report-sign">
                    <p className="by"><strong>Prepared by:</strong></p>
                    <p className="nurse">Marilou H. Balarao</p>
                    <p>School Nurse</p>
                </div>
            </div>
        </div>
    );
}
