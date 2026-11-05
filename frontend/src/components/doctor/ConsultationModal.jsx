// ConsultationModal.jsx
// Clinical check-up documentation for one doctor visit: findings, diagnosis, treatment plan,
// prescriptions and follow-up notes, plus the doctor's own template fields. Exam questions (Dental / Vision examination) are templates, not fixed forms.
import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardPlus, Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, fullName, localDateStr } from '../../utils/visitPurpose';
import { TemplateFields, missingRequired, toResponses } from './TemplateFields';
import { STANDARD_FORM_DEFAULT, isCoreKey, asText } from '../../utils/standardForm';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const EMPTY_RX = { medicine: '', dosage: '', frequency: '', duration: '', instructions: '' };

// doctorId: whose templates are offered; nurseId is set when the nurse documents the visit instead of the doctor
const ConsultationModal = ({ appt, doctorId, nurseId, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const editing = !!appt?.assessment_id;
    const visitType = appt?.visit_type || 'General Check Up';

    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
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
        fetch(`${API}/api/doctor/${doctorId}/templates?include_inactive=1`)
            .then((r) => r.json())
            .then((d) => {
                if (!live || !d.success) return;
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
            .catch(() => {});
        return () => { live = false; };
    }, [appt, doctorId, editing, visitType]);

    const template = useMemo(() => templates.find((t) => t.template_id === templateId) || null, [templates, templateId]);

    if (!appt || !form) return null;

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setRx = (i, patch) => set({ prescriptions: form.prescriptions.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });

    // a new check-up cannot be closed until the required fields are filled (Esc, the X and Cancel are off); editing one can be closed any time
    // the fields of the doctor's standard form
    const stdFields = Array.isArray(std.fields) ? std.fields : [];
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
        const missing = missingRequired(template ? template.fields : stdFields, template ? answers : vals);
        if (missing.length > 0) { setError(`Please answer: ${missing.join(', ')}.`); return; }
        if (form.prescriptions.some((r) => (r.dosage || r.frequency || r.duration || r.instructions) && !r.medicine.trim())) {
            setError('Every prescription line needs a medicine name.');
            return;
        }

        if (form.follow_up_needed && bookFollowUp && !form.follow_up_date) { setError('Pick the repeat date to book it.'); return; }

        setBusy(true);
        try {
            // documenting a visit means the student attended
            if (appt.attendance_status === 'Pending') {
                await fetch(`${API}/api/doctor-visits/status/${appt.appointment_id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: appt.student_id, status: 'Present' })
                });
            }

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
                followUpMessage = fd.success ? ' The repeat appointment was booked.' : ` The repeat could not be booked: ${fd.message}`;
            }
            showAlert(`Check-up saved.${followUpMessage}`, followUpMessage.includes('could not') ? 'warning' : 'success');
            onSaved?.();
            onClose();
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={locked ? undefined : onClose} title={editing ? 'Edit check-up' : 'Document check-up'} icon={<ClipboardPlus size={20} />} size="xl" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - {visitLabel(visitType, appt.purpose_other)}<br />
                    {appt.queue_state ? formatDate(appt.start_time) : <>{formatDate(appt.start_time)}, {formatTime(appt.start_time)} - {formatTime(appt.end_time)}</>}
                    {appt.check_in_time ? <><br />Time in: {formatTime(appt.check_in_time)}</> : null}
                    {appt.booking_reason ? <><br />Reason given: {appt.booking_reason}</> : null}
                </div>
                {error && <div className="dp-error" role="alert">{error}</div>}

                {templates.length > 0 && (
                    <div className="dp-field">
                        <label htmlFor="consult-template">Assessment form</label>
                        <select id="consult-template" className="dp-select" value={templateId} onChange={(e) => { setTemplateId(e.target.value); setAnswers({}); }}>
                            <option value="">Standard check-up form</option>
                            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.template_name}{t.is_active ? '' : ' (archived)'}</option>)}
                        </select>
                        <small className="dp-hint">Choose one: the standard check-up form or one template. Manage templates in the Templates page.</small>
                    </div>
                )}

                {template && (
                    <>
                        <div className="dp-section-label">{template.template_name}</div>
                        <TemplateFields fields={template.fields} values={answers} onChange={setAnswers} idPrefix="consult" />
                    </>
                )}

                {!template && stdFields.length > 0 && (
                    <>
                        <div className="dp-section-label">Check-up form</div>
                        <TemplateFields fields={stdFields} values={vals} onChange={setVals} idPrefix="consult-std" />
                    </>
                )}

                {std.prescription_enabled && <div className="dp-section-label">Prescription</div>}
                {std.prescription_enabled && form.prescriptions.length === 0 && <p className="dp-hint" style={{ margin: 0 }}>No medicine prescribed.</p>}
                {std.prescription_enabled && form.prescriptions.map((r, i) => (
                    <div key={i} className="dp-card" style={{ padding: 12, boxShadow: 'none' }}>
                        <div className="dp-row">
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label>Medicine</label>
                                <input className="dp-input" maxLength={150} value={r.medicine} onChange={(e) => setRx(i, { medicine: e.target.value })} placeholder="e.g. Paracetamol 500 mg" />
                            </div>
                            <div className="dp-field"><label>Dosage</label><input className="dp-input" maxLength={80} value={r.dosage} onChange={(e) => setRx(i, { dosage: e.target.value })} placeholder="1 tablet" /></div>
                            <div className="dp-field"><label>Frequency</label><input className="dp-input" maxLength={80} value={r.frequency} onChange={(e) => setRx(i, { frequency: e.target.value })} placeholder="every 6 hours" /></div>
                            <div className="dp-field"><label>Duration</label><input className="dp-input" maxLength={80} value={r.duration} onChange={(e) => setRx(i, { duration: e.target.value })} placeholder="3 days" /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 10 }}>
                            <div className="dp-field" style={{ flex: 1 }}>
                                <label>Instructions</label>
                                <input className="dp-input" maxLength={255} value={r.instructions} onChange={(e) => setRx(i, { instructions: e.target.value })} placeholder="e.g. After meals" />
                            </div>
                            <button type="button" className="dp-btn dp-btn-danger dp-btn-icon" onClick={() => set({ prescriptions: form.prescriptions.filter((_, idx) => idx !== i) })} aria-label="Remove medicine"><Trash2 size={16} /></button>
                        </div>
                    </div>
                ))}
                {std.prescription_enabled && <div><button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => set({ prescriptions: [...form.prescriptions, { ...EMPTY_RX }] })}><Plus size={15} /> Add medicine</button></div>}

                <div className="dp-section-label">Repeat</div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                    <label className="dp-check"><input type="checkbox" checked={form.follow_up_needed} onChange={(e) => set({ follow_up_needed: e.target.checked })} /> Repeat needed</label>
                </div>
                {form.follow_up_needed && (
                    <>
                        <div className="dp-row">
                            <div className="dp-field">
                                <label>Repeat date</label>
                                <input className="dp-input" type="date" min={localDateStr()} value={form.follow_up_date} onChange={(e) => set({ follow_up_date: e.target.value })} />
                            </div>
                            <div className="dp-field" style={{ gridColumn: 'span 2' }}>
                                <label>Repeat notes</label>
                                <input className="dp-input" maxLength={500} value={form.follow_up_notes} onChange={(e) => set({ follow_up_notes: e.target.value })} placeholder="e.g. Return if the headache persists after 3 days" />
                            </div>
                        </div>
                        {nurseId
                            ? <label className="dp-check"><input type="checkbox" checked={bookFollowUp} onChange={(e) => setBookFollowUp(e.target.checked)} /> Appoint the repeat now (direct appointment on that date). Without it the student waits in the Repeats list for a schedule.</label>
                            : <p className="dp-hint" style={{ margin: 0 }}>The student joins the Repeats list. The nurse puts the student in a schedule.</p>}
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
