// ConsultationModal.jsx
// Clinical check-up documentation for one doctor visit: findings, diagnosis, treatment plan,
// prescriptions and follow-up notes, plus the doctor's own template fields. Exam questions (Dental / Vision examination) are templates, not fixed forms.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardPlus, Plus, Trash2, Sparkles, CalendarDays, Clock, Thermometer, HeartPulse, Activity, Wind } from 'lucide-react';
import Modal from '../common/Modal';
import { notifyRecordChanged } from '../../hooks/useRecordSync';
import { VITAL_FIELDS, vitalState, vitalStatusLabel } from '../../utils/vitals';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, fullName, localDateStr } from '../../utils/visitPurpose';
import { TemplateFields, missingRequired, toResponses } from './TemplateFields';
import { STANDARD_FORM_DEFAULT, isCoreKey, asText } from '../../utils/standardForm';
import { OTHER, RX_OPTIONS, PLACEHOLDERS, complaintOptions, diagnosisOptions, buildTreatmentPlan, inVitalValues } from '../../utils/assessmentSuggestions';
import '../../styles/doctor/DoctorLayout.css';

const API = 'https://localhost-cms.onrender.com';

const VITAL_ICONS = { blood_pressure: HeartPulse, temperature: Thermometer, pulse_rate: Activity, respiratory_rate: Wind };
const initialsOf = (first, last) => `${(first || '').trim().charAt(0)}${(last || '').trim().charAt(0)}`.toUpperCase() || '?';

const EMPTY_RX = { medicine: '', dosage: '', frequency: '', duration: '', instructions: '' };

// A prescription part with a fixed list (dosage, frequency, duration, instructions) plus "Other" to write your own
const PickOrType = ({ label, value, options, onChange, maxLength, hint }) => {
    const custom = value !== '' && !options.includes(value);
    const [other, setOther] = useState(custom);
    const writing = other || custom;
    return (
        <div className="dp-field">
            <label>{label}</label>
            <select className="dp-select" aria-label={label} value={writing ? OTHER : value} onChange={(e) => {
                if (e.target.value === OTHER) { setOther(true); onChange(''); } else { setOther(false); onChange(e.target.value); }
            }}>
                <option value="">{hint}</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value={OTHER}>{OTHER}</option>
            </select>
            {writing && <input className="dp-input" style={{ marginTop: 6 }} maxLength={maxLength} aria-label={`${label}: write the answer`} placeholder="Write the answer" value={value} onChange={(e) => onChange(e.target.value)} />}
        </div>
    );
};

// doctorId: whose templates are offered; nurseId is set when the nurse documents the visit instead of the doctor
const ConsultationModal = ({ appt, doctorId, nurseId, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const editing = !!appt?.assessment_id;
    const visitType = appt?.visit_type || 'General Check Up';

    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
    // the doctor must pick the assessment form before documenting a new check-up: draft = the radio choice ('std' = the standard form), chosen = confirmed
    const [chosen, setChosen] = useState(false);
    const [draft, setDraft] = useState(null);
    const [tplLoaded, setTplLoaded] = useState(false);
    const [std, setStd] = useState(STANDARD_FORM_DEFAULT);
    const [answers, setAnswers] = useState({});
    const [vals, setVals] = useState({}); // answers to the fields of the doctor's standard form (the four core ones are saved in the assessment itself)
    const [form, setForm] = useState(null);
    const [followTime, setFollowTime] = useState('09:00');
    const [followDuration, setFollowDuration] = useState(15);
    const [bookFollowUp, setBookFollowUp] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // reset whenever another appointment is opened
    useEffect(() => {
        if (!appt) return;
        setForm({
            is_abnormal: !!appt.is_abnormal,
            follow_up_needed: !!appt.follow_up_needed,
            follow_up_date: appt.follow_up_date || '',
            follow_up_notes: appt.follow_up_notes || '',
            prescriptions: Array.isArray(appt.prescriptions) && appt.prescriptions.length > 0 ? appt.prescriptions.map((p) => ({ ...EMPTY_RX, ...p })) : []
        });
        setAnswers({});
        const saved = {
            chief_complaint: appt.chief_complaint || appt.booking_reason || '',
            clinical_findings: appt.clinical_findings || '',
            diagnosis: appt.diagnosis || '',
            treatment_recommendations: appt.treatment_recommendations || ''
        };
        // answers to the doctor's own questions are saved with the check-up under their keys (s1, s2 ...)
        (Array.isArray(appt.template_responses) ? appt.template_responses : []).forEach((r) => { if (/^s\d+$/.test(String(r.key))) saved[r.key] = r.value; });
        setVals(saved);
        setTemplateId('');
        setChosen(!!appt.assessment_id);
        setDraft(null);
        setBookFollowUp(false);
        setError('');
        setBusy(false);
    }, [appt]);

    // the doctor's standard check-up form (wording, required parts, prescription on / off)
    useEffect(() => {
        if (!appt || !doctorId) return undefined;
        let live = true;
        fetch(`${API}/api/doctor/${doctorId}/standard-form`)
            .then((r) => r.json())
            .then((d) => {
                if (!live || !d.success) return;
                setStd(d.form);
                // a core field that is a checklist now: the saved text goes back to the picked options
                setVals((v) => {
                    const next = { ...v };
                    d.form.fields.forEach((f) => { if (f.type === 'checkbox' && typeof next[f.key] === 'string') next[f.key] = next[f.key] ? next[f.key].split(', ') : []; });
                    return next;
                });
            })
            .catch(() => {});
        return () => { live = false; };
    }, [appt, doctorId]);

    // The doctor picks the template to use here, when documenting (optional). Active templates that fit the purpose of the check-up are offered;
    // when an old check-up is edited, the template it was saved with is selected (even if it was archived since).
    useEffect(() => {
        if (!appt || !doctorId) return undefined;
        const savedId = editing ? appt.template_id : '';
        let live = true;
        setTplLoaded(false);
        fetch(`${API}/api/doctor/${doctorId}/templates?include_inactive=1`)
            .then((r) => r.json())
            .then((d) => {
                if (!live) return;
                setTplLoaded(true);
                if (!d.success) return;
                const fits = (t) => t.template_id === savedId || (t.is_active && (!t.visit_type || t.visit_type === visitType));
                setTemplates(d.templates.filter(fits));
                const picked = savedId ? d.templates.find((t) => t.template_id === savedId) : null;
                if (!picked) return;
                setTemplateId(picked.template_id);
                if (Array.isArray(appt.template_responses)) {
                    const prefill = {};
                    appt.template_responses.forEach((r) => { if (!/^s\d+$/.test(String(r.key))) prefill[r.key] = r.value; });
                    setAnswers(prefill);
                }
            })
            .catch(() => { if (live) setTplLoaded(true); });
        return () => { live = false; };
    }, [appt, doctorId, editing, visitType]);

    const template = useMemo(() => templates.find((t) => t.template_id === templateId) || null, [templates, templateId]);

    // medicines of the clinic as suggestions for the prescription (the doctor can still type another name)
    const [medicineNames, setMedicineNames] = useState([]);
    useEffect(() => {
        let live = true;
        fetch(`${API}/api/medicines`).then((r) => r.json()).then((d) => {
            const rows = Array.isArray(d) ? d : d.medicines || d.data || [];
            if (!live) return;
            const names = rows.map((m) => [m.generic_name, m.display_strength_value && m.display_strength_unit ? `${m.display_strength_value} ${m.display_strength_unit}` : ''].filter(Boolean).join(' ')).filter(Boolean);
            setMedicineNames([...new Set(names)]);
        }).catch(() => {});
        return () => { live = false; };
    }, []);

    // the standard form: the complaint and the diagnosis are dropdowns (with Other) unless the doctor made them something else; every box has a placeholder
    const stdFields = useMemo(() => (Array.isArray(std.fields) ? std.fields : []).map((f) => {
        const next = { ...f, placeholder: f.placeholder || PLACEHOLDERS[f.key] };
        if (f.key === 'chief_complaint' && ['text', 'textarea'].includes(f.type)) {
            return { ...next, type: 'select', options: complaintOptions(visitType), hint: f.hint && !/^e\.g\. Headache/.test(f.hint) ? f.hint : '' };
        }
        if (f.key === 'diagnosis' && ['text', 'textarea'].includes(f.type)) {
            return { ...next, type: 'select', options: diagnosisOptions(visitType), hint: f.hint || '' };
        }
        return next;
    }), [std, visitType]);

    // the treatment plan writes itself from the diagnosis, the complaint, the vital signs, the prescription and the follow-up, until the doctor edits it
    const planKeys = useMemo(() => {
        if (!template) return { plan: 'treatment_recommendations', diagnosis: 'diagnosis', complaint: 'chief_complaint' };
        const find = (re, types = ['text', 'textarea', 'select']) => (template.fields.find((f) => types.includes(f.type) && re.test(f.label)) || {}).key;
        return {
            plan: find(/advis|recommend/i, ['text', 'textarea']) || find(/^(?!.*\bdone\b).*(treatment|plan)/i, ['text', 'textarea']),
            diagnosis: find(/diagnos/i),
            complaint: find(/complaint|reason/i),
            findings: find(/findings/i, ['checkbox'])
        };
    }, [template]);
    const planFieldsNow = template ? template.fields : stdFields;
    const planKey = planKeys.plan && planFieldsNow.some((f) => f.key === planKeys.plan) ? planKeys.plan : null;
    const cur = template ? answers : vals;
    const clean = (v) => { const t = asText(v).trim(); return t === OTHER ? '' : t; };
    const generatedPlan = useMemo(() => buildTreatmentPlan({
        visitType,
        complaint: clean(cur[planKeys.complaint]),
        diagnosis: clean(cur[planKeys.diagnosis]),
        findings: planKeys.findings ? cur[planKeys.findings] : null,
        prescriptions: form ? form.prescriptions : [],
        vitals: inVitalValues(appt),
        followUp: form ? { needed: form.follow_up_needed, date: form.follow_up_date, notes: form.follow_up_notes } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [visitType, cur[planKeys.complaint], cur[planKeys.diagnosis], cur[planKeys.findings], form, appt]);
    const lastPlan = useRef('');
    useEffect(() => {
        if (!planKey || !form) return;
        const setCur = template ? setAnswers : setVals;
        setCur((v) => {
            const now = String(v[planKey] ?? '');
            if (now === generatedPlan) return v;
            if (now !== '' && now !== lastPlan.current) return v; // the doctor wrote or edited it: leave it
            lastPlan.current = generatedPlan;
            return { ...v, [planKey]: generatedPlan };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generatedPlan, planKey, template]);
    const writePlanAgain = () => {
        lastPlan.current = generatedPlan;
        (template ? setAnswers : setVals)((v) => ({ ...v, [planKey]: generatedPlan }));
    };
    const planAction = planKey ? {
        [planKey]: (
            <button type="button" className="dp-btn dp-btn-ghost dp-btn-icon" onClick={writePlanAgain} disabled={!generatedPlan} aria-label="Write the plan again" title="Write the plan again">
                <Sparkles size={16} aria-hidden="true" />
            </button>
        )
    } : undefined;

    if (!appt || !form) return null;

    // a new check-up starts by choosing the form; with no template to choose from, the standard form is the only one
    const formReady = chosen || editing || (tplLoaded && templates.length === 0);
    if (!formReady) {
        const confirmForm = () => {
            if (draft === null) return;
            setTemplateId(draft === 'std' ? '' : draft);
            setAnswers({});
            setChosen(true);
        };
        return (
            <Modal isOpen onClose={onClose} title="Select assessment form" icon={<ClipboardPlus size={20} />} size="md" closeOnBackdrop={false}>
                <div className="dp-form">
                    <div className="dp-notice"><strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - {visitLabel(visitType, appt.purpose_other)}</div>
                    {!tplLoaded ? <p className="dp-hint" role="status">Loading forms...</p> : (
                        <fieldset className="dp-form-pick" aria-describedby="form-pick-hint">
                            <legend className="dp-section-label">Assessment form</legend>
                            <label className={`dp-form-opt ${draft === 'std' ? 'on' : ''}`}>
                                <input type="radio" name="assessment-form" checked={draft === 'std'} onChange={() => setDraft('std')} />
                                <span><strong>Standard check-up form</strong></span>
                            </label>
                            {templates.map((t) => (
                                <label key={t.template_id} className={`dp-form-opt ${draft === t.template_id ? 'on' : ''}`}>
                                    <input type="radio" name="assessment-form" checked={draft === t.template_id} onChange={() => setDraft(t.template_id)} />
                                    <span><strong>{t.template_name}</strong>{t.visit_type ? <small> {t.visit_type}</small> : null}</span>
                                </label>
                            ))}
                            <small id="form-pick-hint" className="dp-hint">Pick one to start.</small>
                        </fieldset>
                    )}
                    <div className="dp-modal-foot">
                        <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="button" className="dp-btn dp-btn-primary" onClick={confirmForm} disabled={draft === null || !tplLoaded}>Continue</button>
                    </div>
                </div>
            </Modal>
        );
    }

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setRx = (i, patch) => set({ prescriptions: form.prescriptions.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

    // a new check-up cannot be closed until the required fields are filled (Esc, the X and Cancel are off); editing one can be closed any time
    // one assessment form only: the picked template, or the standard check-up form when none is picked
    const requiredFilled = template
        ? missingRequired(template.fields, answers).length === 0
        : missingRequired(stdFields, vals).length === 0;
    const locked = !editing && !requiredFilled;

    const coreText = (key, kept) => (stdFields.some((f) => f.key === key) ? asText(vals[key]) : kept);

    const submit = async (e) => {
        e.preventDefault();
        setError('');

        if (['Absent', 'Excused'].includes(appt.attendance_status)) { setError(`The student is marked ${appt.attendance_status}. Change the attendance first.`); return; }
        // the check-up is documented only after the nurse's time in with normal vital signs
        if (appt.attendance_status === 'Pending') { setError('The nurse records the time in and the vital signs first.'); return; }
        const missing = missingRequired(template ? template.fields : stdFields, template ? answers : vals);
        if (missing.length > 0) { setError(`Please answer: ${missing.join(', ')}.`); return; }
        if (form.prescriptions.some((r) => (r.dosage || r.frequency || r.duration || r.instructions) && !r.medicine.trim())) {
            setError('Every prescription line needs a medicine name.');
            return;
        }

        if (form.follow_up_needed && bookFollowUp && !form.follow_up_date) { setError('Pick the follow-up date to book it.'); return; }

        setBusy(true);
        try {
            const payload = {
                appointment_id: appt.appointment_id,
                student_id: appt.student_id,
                student_user_id: appt.student_user_id,
                sender_id: userId,
                documented_by_doctor_id: nurseId ? undefined : doctorId,
                // a core question the doctor took out of the form keeps what was saved before
                // with a template the standard form is not used: the core columns are not sent (the server skips their required check)
                chief_complaint: template ? (appt.chief_complaint || undefined) : coreText('chief_complaint', appt.chief_complaint || undefined),
                clinical_findings: template ? undefined : coreText('clinical_findings', appt.clinical_findings || ''),
                diagnosis: template ? undefined : coreText('diagnosis', appt.diagnosis || ''),
                treatment_recommendations: template ? undefined : coreText('treatment_recommendations', appt.treatment_recommendations || ''),
                is_abnormal: form.is_abnormal,
                follow_up_needed: form.follow_up_needed,
                follow_up_date: form.follow_up_needed ? form.follow_up_date : '',
                follow_up_notes: form.follow_up_needed ? form.follow_up_notes : '',
                prescriptions: std.prescription_enabled ? form.prescriptions : undefined,
                template_id: template ? template.template_id : '',
                template_name: template ? template.template_name : '',
                template_responses: template ? toResponses(template.fields, answers) : toResponses(stdFields.filter((f) => !isCoreKey(f.key)), vals),
            };
            const res = await fetch(`${API}/api/doctor-assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!data.success) { setError(data.message || 'Could not save the check-up.'); return; }

            let followUpMessage = '';
            if (form.follow_up_needed && bookFollowUp) {
                const fu = await fetch(`${API}/api/doctor-visits/${appt.appointment_id}/follow-up`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: appt.student_id, ...(nurseId ? { nurse_id: nurseId } : { created_by_doctor_id: doctorId }), sender_id: userId,
                        start_time: `${form.follow_up_date} ${followTime}:00`, duration_min: followDuration, notes: form.follow_up_notes
                    })
                });
                const fd = await fu.json();
                followUpMessage = fd.success ? ' The follow-up appointment was booked.' : ` The follow-up could not be booked: ${fd.message}`;
            }
            showAlert(`Check-up saved.${followUpMessage}`, followUpMessage.includes('could not') ? 'warning' : 'success');
            notifyRecordChanged(['checkup', 'visit']);
            onSaved?.();
            onClose();
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    const inVitals = VITAL_FIELDS
        .map((f) => ({ ...f, value: appt[`in_${f.key}`] }))
        .filter((f) => f.value);

    return (
        <Modal isOpen onClose={locked ? undefined : onClose} title={editing ? 'Edit check-up' : 'Document check-up'} icon={<ClipboardPlus size={20} />} size="xl" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <section className="dp-patient" aria-label="Student">
                    <div className="dp-patient-top">
                        <span className="dp-patient-avatar" aria-hidden="true">{initialsOf(appt.student_first_name, appt.student_last_name)}</span>
                        <div className="dp-patient-id">
                            <strong className="dp-patient-name">{fullName(appt.student_first_name, appt.student_last_name)}</strong>
                            <span className="dp-patient-sub">{appt.student_id}</span>
                        </div>
                        <span className="dp-chip dp-patient-purpose">{visitLabel(visitType, appt.purpose_other)}</span>
                    </div>
                    <div className="dp-patient-meta">
                        <span><CalendarDays size={16} aria-hidden="true" />{appt.queue_state ? formatDate(appt.start_time) : <>{formatDate(appt.start_time)}, {formatTime(appt.start_time)} - {formatTime(appt.end_time)}</>}</span>
                        {appt.check_in_time ? <span><Clock size={16} aria-hidden="true" />Time in {formatTime(appt.check_in_time)}</span> : null}
                    </div>
                    {inVitals.length > 0 && (
                        <ul className="dp-vitals" aria-label="Vital signs at time in">
                            {inVitals.map((v) => {
                                const Icon = VITAL_ICONS[v.key] || Activity;
                                const bad = vitalState(v.key, v.value) === 'abnormal';
                                return (
                                    <li key={v.key} className={`dp-vital${bad ? ' is-abnormal' : ''}`}>
                                        <Icon size={18} aria-hidden="true" />
                                        <span className="dp-vital-label">{v.label}</span>
                                        <span className="dp-vital-value">{v.value}<small>{v.unit}</small></span>
                                        <small className="dp-vital-range">Range {v.normal} {v.unit}</small>
                                        <span className={`dp-vital-flag${bad ? '' : ' ok'}`}>{bad ? vitalStatusLabel(v.key, v.value) : 'Normal'}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {appt.booking_reason || appt.nurse_remarks || appt.out_nurse_note ? (
                        <dl className="dp-patient-notes">
                            {appt.booking_reason ? <div><dt>Reason given</dt><dd>{appt.booking_reason}</dd></div> : null}
                            {appt.nurse_remarks || appt.out_nurse_note ? <div><dt>Nurse remarks</dt><dd>{appt.nurse_remarks || appt.out_nurse_note}</dd></div> : null}
                        </dl>
                    ) : null}
                </section>
                {error && <div className="dp-error" role="alert">{error}</div>}

                {templates.length > 0 && (
                    <div className="dp-field">
                        <label htmlFor="consult-template">Assessment form</label>
                        <select id="consult-template" className="dp-select" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setAnswers({}); }}>
                            <option value="">Standard check-up form</option>
                            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.template_name}{t.is_active ? '' : ' (archived)'}</option>)}
                        </select>
                    </div>
                )}

                {template && (
                    <>
                        <div className="dp-section-label">{template.template_name}</div>
                        <TemplateFields fields={template.fields} values={answers} onChange={setAnswers} idPrefix="consult" actions={planAction} />
                    </>
                )}

                {!template && stdFields.length > 0 && (
                    <>
                        <div className="dp-section-label">Check-up form</div>
                        <TemplateFields fields={stdFields} values={vals} onChange={setVals} idPrefix="consult-std" actions={planAction} />
                    </>
                )}

                {std.prescription_enabled && <div className="dp-section-label">Prescription</div>}
                {std.prescription_enabled && form.prescriptions.length === 0 && <p className="dp-hint" style={{ margin: 0 }}>No medicine prescribed.</p>}
                {std.prescription_enabled && form.prescriptions.map((r, i) => (
                    <div key={i} className="dp-card" style={{ padding: 12, boxShadow: 'none' }}>
                        <div className="dp-row">
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label>Medicine</label>
                                <input className="dp-input" list="consult-medicines" maxLength={150} value={r.medicine} onChange={(e) => setRx(i, { medicine: e.target.value })} placeholder="Pick or type, e.g. Paracetamol 500 mg" />
                            </div>
                            <PickOrType label="Dosage" value={r.dosage} options={RX_OPTIONS.dosage} maxLength={80} hint="Select the dose" onChange={(v) => setRx(i, { dosage: v })} />
                            <PickOrType label="Frequency" value={r.frequency} options={RX_OPTIONS.frequency} maxLength={80} hint="How often" onChange={(v) => setRx(i, { frequency: v })} />
                            <PickOrType label="Duration" value={r.duration} options={RX_OPTIONS.duration} maxLength={80} hint="For how long" onChange={(v) => setRx(i, { duration: v })} />
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 10 }}>
                            <div style={{ flex: 1 }}>
                                <PickOrType label="Instructions" value={r.instructions} options={RX_OPTIONS.instructions} maxLength={255} hint="How to take it (optional)" onChange={(v) => setRx(i, { instructions: v })} />
                            </div>
                            <button type="button" className="dp-btn dp-btn-danger dp-btn-icon" onClick={() => set({ prescriptions: form.prescriptions.filter((_, idx) => idx !== i) })} aria-label="Remove medicine"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
                {std.prescription_enabled && <datalist id="consult-medicines">{medicineNames.map((n) => <option key={n} value={n} />)}</datalist>}
                {std.prescription_enabled && <div><button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => set({ prescriptions: [...form.prescriptions, { ...EMPTY_RX }] })}><Plus size={15} /> Add medicine</button></div>}

                <div className="dp-section-label">Follow-up</div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                    <label className="dp-check"><input type="checkbox" checked={form.follow_up_needed} onChange={(e) => set({ follow_up_needed: e.target.checked })} /> Follow-up needed</label>
                </div>
                {form.follow_up_needed && (
                    <>
                        <div className="dp-row">
                            <div className="dp-field">
                                <label>Follow-up date</label>
                                <input className="dp-input" type="date" min={localDateStr()} value={form.follow_up_date} onChange={(e) => set({ follow_up_date: e.target.value })} />
                            </div>
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label>Follow-up notes</label>
                                <input className="dp-input" maxLength={500} value={form.follow_up_notes} onChange={(e) => set({ follow_up_notes: e.target.value })} placeholder="e.g. Return if the headache persists after 3 days" />
                            </div>
                        </div>
                        {nurseId
                            ? <label className="dp-check"><input type="checkbox" checked={bookFollowUp} onChange={(e) => setBookFollowUp(e.target.checked)} /> Appoint the follow-up now (direct appointment on that date). Without it the student waits in the Follow-ups list for a schedule.</label>
                            : <p className="dp-hint" style={{ margin: 0 }}>The student joins the Follow-ups list. The nurse puts the student in a schedule.</p>}
                        {nurseId && bookFollowUp && (
                            <div className="dp-row">
                                <div className="dp-field"><label>Time</label><input className="dp-input" type="time" value={followTime} onChange={(e) => setFollowTime(e.target.value)} /></div>
                                <div className="dp-field"><label>Minutes</label><input className="dp-input" type="number" min={5} max={240} step={5} value={followDuration} onChange={(e) => setFollowDuration(e.target.value)} /></div>
                            </div>
                        )}
                    </>
                )}

                <div className="dp-modal-foot">
                    {locked && <span className="dp-hint" role="status">Fill in the required fields (*) to save or close this form.</span>}
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose} disabled={locked}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Save check-up'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default ConsultationModal;
