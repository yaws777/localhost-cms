import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, HeartPulse, Pencil, Scale, Stethoscope } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { hasVitals, vitalsLine, inVitalsOf } from '../../utils/vitals';
import { dispensedLine } from '../../utils/dispensed';
import HealthProofList from './HealthProofList';
import '../../styles/common/HealthInfoView.css';

// Each condition: the has_* flag, then the detail rows to show. Only conditions the student ticked are listed,
// and only the details the student filled in.
//   text  = plain value, date = formatted date, flags = list of ticked checkboxes
export const CONDITIONS = [
    {
        flag: 'has_allergies', label: 'History of Allergies', details: [
            { type: 'text', label: 'Food', key: 'allergy_food' },
            { type: 'text', label: 'Medicine', key: 'allergy_medicine' },
            { type: 'text', label: 'Insect sting', key: 'allergy_insect_sting' },
            { type: 'text', label: 'Environmental', key: 'allergy_environmental' },
            { type: 'text', label: 'Others', key: 'allergy_others' },
            {
                type: 'flags', label: 'Reactions', flags: [
                    ['reaction_diarrhea', 'Diarrhea'], ['reaction_hives', 'Hives'], ['reaction_local', 'Local reaction'],
                    ['reaction_rash', 'Rash'], ['reaction_swelling', 'Swelling'], ['reaction_trouble_breathing', 'Trouble breathing']
                ]
            },
            { type: 'text', label: 'Other reaction', key: 'reaction_others' },
            { type: 'text', label: 'Medication taken', key: 'allergy_medication_taken' }
        ]
    },
    {
        flag: 'has_asthma', label: 'Asthma', details: [
            { type: 'text', label: 'Triggers', key: 'asthma_triggers' },
            { type: 'text', label: 'Medication taken', key: 'asthma_medication_taken' }
        ]
    },
    {
        flag: 'has_other_respiratory', label: 'Other Respiratory Problems', details: [
            { type: 'text', label: 'Specify', key: 'other_respiratory_specify' },
            { type: 'text', label: 'Medication taken', key: 'other_respiratory_medication' }
        ]
    },
    {
        flag: 'has_blood_disorders', label: 'Blood Disorders', details: [
            {
                type: 'flags', label: 'Type', flags: [
                    ['blood_disorder_anemia', 'Anemia'], ['blood_disorder_leukopenia', 'Leukopenia'], ['blood_disorder_thrombocytopenia', 'Thrombocytopenia']
                ]
            }
        ]
    },
    { flag: 'has_chicken_pox', label: 'Chicken Pox', details: [{ type: 'text', label: 'Age', key: 'chicken_pox_age' }] },
    {
        flag: 'has_digestive_disorders', label: 'Digestive Disorders', details: [
            {
                type: 'flags', label: 'Type', flags: [
                    ['digestive_ulcer', 'Ulcer'], ['digestive_appendicitis', 'Appendicitis'], ['digestive_gastritis', 'Gastritis'], ['digestive_hemorrhoids', 'Hemorrhoids']
                ]
            },
            { type: 'text', label: 'Medication taken', key: 'digestive_medication_taken' }
        ]
    },
    {
        flag: 'has_heart_problems', label: 'Heart Problems', details: [
            { type: 'text', label: 'Specify', key: 'heart_problems_specify' },
            { type: 'text', label: 'Medication', key: 'heart_problems_medication' }
        ]
    },
    {
        flag: 'has_kidney_bladder_problems', label: 'Kidney/Bladder Problems', details: [
            { type: 'text', label: 'Specify', key: 'kidney_bladder_specify' },
            { type: 'text', label: 'Medication', key: 'kidney_bladder_medication' }
        ]
    },
    { flag: 'has_measles', label: 'Measles', details: [{ type: 'text', label: 'Age', key: 'measles_age' }] },
    {
        flag: 'has_metabolic_diseases', label: 'Metabolic Diseases', details: [
            { type: 'flags', label: 'Type', flags: [['metabolic_hyperglycemia', 'Hyperglycemia'], ['metabolic_hypoglycemia', 'Hypoglycemia']] }
        ]
    },
    { flag: 'has_muscle_bone_disorder', label: 'Muscle/Bone Disorder', details: [{ type: 'text', label: 'Specify', key: 'muscle_bone_specify' }] },
    {
        flag: 'has_seizure_episode', label: 'Seizure Episode', details: [
            { type: 'date', label: 'Last episode', key: 'seizure_last_episode_date' },
            { type: 'text', label: 'Medication', key: 'seizure_medication_taken' }
        ]
    },
    {
        flag: 'has_surgery', label: 'History of Surgery', details: [
            { type: 'text', label: 'Specify', key: 'surgery_specify' },
            { type: 'date', label: 'Date', key: 'surgery_date' }
        ]
    },
    {
        flag: 'has_vision_problem', label: 'Vision Problem', details: [
            { type: 'text', label: 'Specify', key: 'vision_specify' },
            { type: 'flags', label: 'Correction', flags: [['vision_with_eyeglasses', 'Eyeglasses'], ['vision_with_contact_lens', 'Contact lenses']] }
        ]
    },
    { flag: 'has_hearing_problem', label: 'Hearing Problem', details: [{ type: 'text', label: 'Specify', key: 'hearing_specify' }] },
    { flag: 'has_other_condition', label: 'Other Condition', details: [{ type: 'text', label: 'Specify', key: 'other_condition_specify' }] }
];

const filled = (v) => v !== null && v !== undefined && String(v).trim() !== '';

function detailValue(detail, info) {
    if (detail.type === 'flags') {
        const on = detail.flags.filter(([key]) => info[key]).map(([, label]) => label);
        return on.length ? on.join(', ') : null;
    }
    const raw = info[detail.key];
    if (!filled(raw)) return null;
    return detail.type === 'date' ? formatDate(raw) : String(raw);
}

function ResultBadge({ abnormal }) {
    return abnormal ? (
        <span className="hiv-badge hiv-badge-critical"><AlertTriangle size={14} aria-hidden="true" /> Abnormal</span>
    ) : (
        <span className="hiv-badge hiv-badge-ok"><CheckCircle2 size={14} aria-hidden="true" /> Normal</span>
    );
}

const API = 'http://localhost:3001';

const changeText = (now, before, unit) => {
    if (now == null || before == null) return '';
    const d = Math.round((Number(now) - Number(before)) * 10) / 10;
    return d === 0 ? 'No change' : `${d > 0 ? '+' : ''}${d} ${unit}`;
};

function BmiBadge({ label }) {
    if (!label) return null;
    if (/normal/i.test(label)) return <span className="hiv-badge hiv-badge-ok"><CheckCircle2 size={14} aria-hidden="true" /> {label}</span>;
    if (/obese/i.test(label)) return <span className="hiv-badge hiv-badge-critical"><AlertTriangle size={14} aria-hidden="true" /> {label}</span>;
    return <span className="hiv-badge hiv-badge-low"><AlertTriangle size={14} aria-hidden="true" /> {label}</span>;
}

// Height, weight and BMI. They follow the newest BMI screening; before the first one it is what the student reported.
function BodyCard({ body }) {
    return (
        <section className="hiv-section" aria-labelledby="hiv-body">
            <h4 id="hiv-body" className="hiv-heading"><Scale size={18} aria-hidden="true" /> Body Measurements</h4>
            {!body ? (
                <p className="hiv-muted">No measurements yet.</p>
            ) : (
                <div className="hiv-card">
                    <header className="hiv-card-head">
                        {body.source === 'screening'
                            ? <span className="hiv-badge hiv-badge-brand"><CheckCircle2 size={14} aria-hidden="true" /> BMI screening, {formatDate(body.date)}</span>
                            : <span className="hiv-badge hiv-badge-neutral">Reported by student</span>}
                    </header>
                    <div className="hiv-meas">
                        <div className="hiv-big">
                            <span className="hiv-big-k">Height</span>
                            <span className="hiv-big-v">{filled(body.height_cm) ? body.height_cm : '—'}<small> cm</small></span>
                            {body.previous && <span className="hiv-big-sub">{changeText(body.height_cm, body.previous.height_cm, 'cm')}</span>}
                        </div>
                        <div className="hiv-big">
                            <span className="hiv-big-k">Weight</span>
                            <span className="hiv-big-v">{filled(body.weight_kg) ? body.weight_kg : '—'}<small> kg</small></span>
                            {body.previous && <span className="hiv-big-sub">{changeText(body.weight_kg, body.previous.weight_kg, 'kg')}</span>}
                        </div>
                        {body.bmi != null && (
                            <div className="hiv-big">
                                <span className="hiv-big-k">BMI</span>
                                <span className="hiv-big-v">{body.bmi}</span>
                                <BmiBadge label={body.bmi_label} />
                            </div>
                        )}
                    </div>
                    {body.previous && body.previous.date && <p className="hiv-date">Change since {formatDate(body.previous.date)}</p>}
                </div>
            )}
        </section>
    );
}

// Last vital signs record: the newest of the Vital Signs screening results and the time-in / time-out vitals of the clinic visits.
function VitalsCard({ vitals }) {
    const cell = (value, unit) => (filled(value) ? <>{value}<small> {unit}</small></> : '—');
    return (
        <section className="hiv-section" aria-labelledby="hiv-vitals">
            <h4 id="hiv-vitals" className="hiv-heading"><HeartPulse size={18} aria-hidden="true" /> Recent Vital Signs Record</h4>
            {!vitals ? (
                <p className="hiv-muted">No vital signs yet.</p>
            ) : (
                <div className="hiv-card">
                    <header className="hiv-card-head">
                        <span className={`hiv-badge ${vitals.source === 'screening' ? 'hiv-badge-brand' : 'hiv-badge-neutral'}`}>
                            {vitals.label}{vitals.date ? `, ${formatDate(vitals.date)}` : ''}
                        </span>
                        {vitals.is_abnormal !== null && vitals.is_abnormal !== undefined && <ResultBadge abnormal={!!vitals.is_abnormal} />}
                    </header>
                    <div className="hiv-meas">
                        <div className="hiv-big">
                            <span className="hiv-big-k">Blood pressure</span>
                            <span className="hiv-big-v">{cell(vitals.blood_pressure, 'mmHg')}</span>
                        </div>
                        <div className="hiv-big">
                            <span className="hiv-big-k">Pulse rate</span>
                            <span className="hiv-big-v">{cell(vitals.pulse_rate, 'bpm')}</span>
                        </div>
                        <div className="hiv-big">
                            <span className="hiv-big-k">Temperature</span>
                            <span className="hiv-big-v">{cell(vitals.temperature, '°C')}</span>
                        </div>
                        <div className="hiv-big">
                            <span className="hiv-big-k">Respiratory rate</span>
                            <span className="hiv-big-v">{cell(vitals.respiratory_rate, '/min')}</span>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

// Health Information tab, read only: body measurements and health history side by side, then (nurse only)
// the latest doctor assessment of each check-up service, the latest result of each screening type and the uploaded proofs.
// onEditHistory (nurse profile only) adds an edit button beside the Health History heading.
export default function HealthInfoView({ studentId, healthInfo, healthProofs, showCheckups = false, onEditHistory }) {
    const info = healthInfo || {};
    const [screenings, setScreenings] = useState([]);
    const [body, setBody] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [checkups, setCheckups] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!studentId) return undefined;
        let cancelled = false;
        setLoading(true);
        const id = encodeURIComponent(studentId);
        const summary = fetch(`${API}/api/students/${id}/health-summary`)
            .then((res) => res.json())
            .then((data) => {
                if (cancelled) return;
                setScreenings(data.success && Array.isArray(data.screenings) ? data.screenings : []);
                setBody(data.success ? data.body || null : null);
                setVitals(data.success ? data.vitals || null : null);
            })
            .catch(() => { if (!cancelled) { setScreenings([]); setBody(null); setVitals(null); } });
        const visits = showCheckups
            ? fetch(`${API}/api/health-records/${id}/latest-checkups`)
                .then((res) => res.json())
                .then((data) => { if (!cancelled) setCheckups(data.success && Array.isArray(data.checkups) ? data.checkups : []); })
                .catch(() => { if (!cancelled) setCheckups([]); })
            : Promise.resolve();
        Promise.all([summary, visits]).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [studentId, showCheckups]);

    const conditions = CONDITIONS.filter((c) => info[c.flag]).map((c) => ({
        ...c,
        rows: c.details.map((d) => ({ label: d.label, value: detailValue(d, info) })).filter((r) => r.value)
    }));

    return (
        <div className="hiv-root">
            <div className="hiv-top">
                <BodyCard body={body} />

                <section className="hiv-section" aria-labelledby="hiv-history">
                    <h4 id="hiv-history" className="hiv-heading">
                        <ClipboardList size={18} aria-hidden="true" /> Health History
                        {onEditHistory && (
                            <button
                                type="button"
                                className="hiv-edit"
                                onClick={onEditHistory}
                                aria-label="Edit health history"
                                title="Edit health history"
                                aria-haspopup="dialog"
                            >
                                <Pencil size={18} aria-hidden="true" />
                            </button>
                        )}
                    </h4>
                    {conditions.length === 0 ? (
                        <p className="hiv-muted">No health history filled in.</p>
                    ) : (
                        <div className="hiv-card-stack">
                            {conditions.map((c) => (
                                <article key={c.flag} className="hiv-card">
                                    <header className="hiv-card-head"><strong>{c.label}</strong></header>
                                    {c.rows.length > 0 && (
                                        <dl className="hiv-list">
                                            {c.rows.map((r) => (
                                                <div key={r.label} className="hiv-row">
                                                    <dt>{r.label}</dt>
                                                    <dd>{r.value}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <VitalsCard vitals={vitals} />

            {showCheckups && (
                <section className="hiv-section" aria-labelledby="hiv-checkups">
                    <h4 id="hiv-checkups" className="hiv-heading"><Stethoscope size={18} aria-hidden="true" /> Recent Check-up</h4>
                    {loading ? (
                        <p className="hiv-muted" role="status">Loading...</p>
                    ) : checkups.length === 0 ? (
                        <p className="hiv-muted">No check-up yet.</p>
                    ) : (
                        <div className="hiv-card-grid">
                            {checkups.map((c) => (
                                <article key={c.visit_type} className="hiv-card">
                                    <header className="hiv-card-head">
                                        <strong>{c.visit_type}</strong>
                                    </header>
                                    <p className="hiv-date">{[c.doctor_name, c.date ? formatDate(c.date) : ''].filter(Boolean).join(', ')}</p>
                                    <dl className="hiv-list">
                                        {hasVitals(inVitalsOf(c)) && <div className="hiv-row"><dt>Vital signs</dt><dd>{vitalsLine(inVitalsOf(c))}</dd></div>}
                                        {filled(c.chief_complaint) && <div className="hiv-row"><dt>Complaint</dt><dd>{c.chief_complaint}</dd></div>}
                                        {filled(c.clinical_findings) && <div className="hiv-row"><dt>Findings</dt><dd>{c.clinical_findings}</dd></div>}
                                        {filled(c.diagnosis) && <div className="hiv-row"><dt>Diagnosis</dt><dd>{c.diagnosis}</dd></div>}
                                        {filled(c.treatment_recommendations) && <div className="hiv-row"><dt>Plan</dt><dd>{c.treatment_recommendations}</dd></div>}
                                        {dispensedLine(c) && <div className="hiv-row"><dt>Medicine</dt><dd>{dispensedLine(c)}</dd></div>}
                                    </dl>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            )}

            <section className="hiv-section" aria-labelledby="hiv-screenings">
                <h4 id="hiv-screenings" className="hiv-heading"><Activity size={18} aria-hidden="true" /> Recent Screening</h4>
                {loading ? (
                    <p className="hiv-muted" role="status">Loading...</p>
                ) : screenings.length === 0 ? (
                    <p className="hiv-muted">No screening results yet.</p>
                ) : (
                    <div className="hiv-card-grid">
                        {screenings.map((s) => (
                            <article key={s.screening_type} className={`hiv-card${s.is_bmi ? ' hiv-card-bmi' : ''}`}>
                                <header className="hiv-card-head">
                                    <strong>{s.screening_type}</strong>
                                    <ResultBadge abnormal={s.is_abnormal} />
                                </header>
                                <p className="hiv-date">{s.date ? formatDate(s.date) : ''}</p>
                                <dl className="hiv-list">
                                    {s.items.map((it) => (
                                        <div key={it.label} className="hiv-row">
                                            <dt>{it.label}</dt>
                                            <dd>{it.value}{it.note ? ` (${it.note})` : ''}</dd>
                                        </div>
                                    ))}
                                </dl>
                                {s.remarks && <p className="hiv-remarks">{s.remarks}</p>}
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <HealthProofList proofs={healthProofs} />
        </div>
    );
}
