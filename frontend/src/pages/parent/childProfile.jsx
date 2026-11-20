import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, FileText, HeartPulse, ListChecks, Lock } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { useAlert } from '../../context/AlertContext';
import HealthInfoView from '../../components/common/HealthInfoView';
import '../../styles/nurse/HealthRecordProfilePage.css';

const API = 'http://localhost:3001';
const DAY_MS = 86400000;

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

// complete = submitted, danger = late or missing, warning = everything else (still pending)
const requirementKind = (req) => {
    const s = (req.status || '').toLowerCase();
    if (['completed', 'submitted'].includes(s)) return 'complete';
    if (['late', 'submitted late', 'overdue', 'missing'].includes(s)) return 'danger';
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

function Field({ label, value, full }) {
    const has = value !== null && value !== undefined && String(value).trim() !== '';
    return (
        <div className={full ? 'full' : undefined}>
            <dt>{label}</dt>
            <dd className={has ? undefined : 'empty'}>{has ? value : '—'}</dd>
        </div>
    );
}

const TABS = [['personal', 'Personal'], ['health', 'Health'], ['requirements', 'Requirements']];

export default function ChildProfile() {
    const outletContext = useOutletContext();
    const { showAlert } = useAlert();

    // Extract linked students list from Outlet Context or fallback to localStorage
    const linkedStudents = useMemo(() => {
        if (outletContext?.linkedStudents && Array.isArray(outletContext.linkedStudents) && outletContext.linkedStudents.length > 0) {
            return outletContext.linkedStudents;
        }
        try {
            const stored = localStorage.getItem('linkedStudents');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Error parsing linkedStudents from localStorage:", e);
            return [];
        }
    }, [outletContext?.linkedStudents]);

    // Track currently selected student ID
    const [selectedStudentId, setSelectedStudentId] = useState(() => {
        return (
            outletContext?.selectedChildId ||
            localStorage.getItem('selectedStudentId') ||
            (linkedStudents.length > 0 ? linkedStudents[0].student_id : '')
        );
    });

    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(true);
    const [reqFilter, setReqFilter] = useState('all');

    const [studentHeader, setStudentHeader] = useState(null);
    const [personalInfo, setPersonalInfo] = useState({});
    const [healthInfo, setHealthInfo] = useState({});
    const [healthProofs, setHealthProofs] = useState({});
    const [requirementsList, setRequirementsList] = useState([]);
    const tabRefs = useRef({});

    // Keep selectedStudentId updated if context or list changes initially
    useEffect(() => {
        if (!selectedStudentId && linkedStudents.length > 0) {
            const defaultId = linkedStudents[0].student_id;
            setSelectedStudentId(defaultId);
            localStorage.setItem('selectedStudentId', defaultId);
        }
    }, [linkedStudents, selectedStudentId]);

    // Handle child selection change
    const handleStudentChange = (e) => {
        const newStudentId = e.target.value;
        setSelectedStudentId(newStudentId);
        localStorage.setItem('selectedStudentId', newStudentId);
    };

    // header, profile and requirements load together; the summary strip needs all three
    useEffect(() => {
        if (!selectedStudentId) {
            setLoading(false);
            return undefined;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const id = encodeURIComponent(selectedStudentId);
                const [studentData, profileData, reqData] = await Promise.all([
                    fetch(`${API}/api/get-student-by-studentId/${id}`).then((r) => r.json()),
                    fetch(`${API}/api/profile/${id}`).then((r) => r.json()),
                    fetch(`${API}/api/students/${id}/full-requirements`).then((r) => r.json()).catch(() => [])
                ]);
                if (cancelled) return;

                if (!studentData.success || !profileData.success) {
                    showAlert('Cannot load this profile.', 'error');
                    return;
                }

                const personal = { ...(profileData.personalInfo || {}) };
                if (personal.birth_date) personal.birth_date = String(personal.birth_date).split('T')[0];

                const health = { ...(profileData.healthInfo || {}) };
                ['seizure_last_episode_date', 'surgery_date'].forEach((k) => {
                    if (health[k]) health[k] = String(health[k]).split('T')[0];
                });
                Object.keys(health).forEach((key) => {
                    if (health[key] === 1) health[key] = true;
                    if (health[key] === 0) health[key] = false;
                });

                setStudentHeader(studentData.student);
                setPersonalInfo(personal);
                setHealthInfo(health);
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
    }, [selectedStudentId]);

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

    const fullName = `${studentHeader?.first_name || ''} ${studentHeader?.last_name || ''}`.trim();
    const initials = `${(studentHeader?.first_name || '?')[0]}${(studentHeader?.last_name || '')[0] || ''}`.toUpperCase();
    const flagChips = FLAG_CHIPS.filter(([key]) => healthInfo[key]);

    const counts = { all: requirementsList.length, warning: 0, danger: 0, complete: 0 };
    requirementsList.forEach((r) => { counts[requirementKind(r)] += 1; });
    const shownRequirements = requirementsList.filter((r) => reqFilter === 'all' || requirementKind(r) === reqFilter);

    return (
        <div className="hrp-page">
            {linkedStudents.length > 0 && (
                <div className="hrp-selector">
                    <label htmlFor="studentSelect">Child</label>
                    <select id="studentSelect" value={selectedStudentId} onChange={handleStudentChange}>
                        {linkedStudents.map((st) => (
                            <option key={st.student_id} value={st.student_id}>
                                {st.first_name ? `${st.first_name} ${st.last_name} (${st.student_id})` : st.student_id}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="hrp-loading" role="status">Loading child profile...</div>
            ) : !studentHeader ? (
                <div className="hrp-empty">No child record.</div>
            ) : (
                <>
                    <header className="hrp-banner">
                        <div className="hrp-avatar" aria-hidden="true">{initials}</div>
                        <div className="hrp-who">
                            <div className="hrp-name-row">
                                <h1>{fullName}</h1>
                            </div>
                            <div className="hrp-meta">
                                <span>{studentHeader.program_id || 'N/A'} - {studentHeader.year_level ? `${studentHeader.year_level} Year` : 'Student'}</span>
                                <span className="hrp-id">{selectedStudentId}</span>
                            </div>
                        </div>
                        <span className="hrp-lock"><Lock size={14} aria-hidden="true" /> Read only</span>
                    </header>

                    <section className="hrp-summary" aria-label="Summary">
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
                    </section>

                    <div className="hrp-tabs" role="tablist" aria-label="Child record sections">
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

                    <div>
                        {/* PERSONAL */}
                        <section id="hrp-panel-personal" role="tabpanel" aria-labelledby="hrp-tab-personal" className="hrp-panel" hidden={activeTab !== 'personal'}>
                            <div className="hrp-grid">
                                <div className="hrp-card">
                                    <h3>Identity</h3>
                                    <dl className="hrp-fields">
                                        <Field label="Gender" value={personalInfo.gender} />
                                        <Field label="Date of birth" value={personalInfo.birth_date ? formatDate(personalInfo.birth_date) : ''} />
                                        <Field label="Age" value={personalInfo.age} />
                                        <Field label="Height (cm)" value={personalInfo.height_cm} />
                                        <Field label="Weight (kg)" value={personalInfo.weight_kg} />
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

                        {/* HEALTH */}
                        <section id="hrp-panel-health" role="tabpanel" aria-labelledby="hrp-tab-health" className="hrp-panel" hidden={activeTab !== 'health'}>
                            <div className="hrp-card">
                                <HealthInfoView studentId={selectedStudentId} healthInfo={healthInfo} healthProofs={healthProofs} personalInfo={personalInfo} />
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
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
