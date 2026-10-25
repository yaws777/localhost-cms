// ConsultationModal.jsx
// Clinical consultation documentation for one doctor visit: findings, diagnosis, treatment plan,
// prescriptions and follow-up notes, plus the doctor's own template fields and the Dental / Vision forms.
import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardPlus, Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatTime } from '../../utils/datetime';
import { visitLabel, fullName, localDateStr } from '../../utils/visitPurpose';
import { TemplateFields, emptyValue, missingRequired, toResponses } from './TemplateFields';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const EMPTY_RX = { medicine: '', dosage: '', frequency: '', duration: '', instructions: '' };

const blankDental = () => ({
    oral_hygiene: '', gum_condition: '', caries_count: 0, missing_count: 0, filled_count: 0, malocclusion: false,
    tooth_notes: '', treatment_done: '', treatment_needed: '', referral_needed: false, referral_to: '', next_visit_recommendation: '', remarks: ''
});
const blankVision = () => ({
    visual_acuity_left: '', visual_acuity_right: '', va_left_corrected: '', va_right_corrected: '', wears_eyeglasses: false,
    wears_contacts: false, color_vision: '', eye_findings: '', recommended_action: 'No action', remarks: ''
});

const dentalFrom = (a) => ({
    ...blankDental(),
    oral_hygiene: a.oral_hygiene || '', gum_condition: a.gum_condition || '',
    caries_count: a.caries_count ?? 0, missing_count: a.missing_count ?? 0, filled_count: a.filled_count ?? 0,
    malocclusion: !!a.malocclusion, tooth_notes: a.tooth_notes || '', treatment_done: a.treatment_done || '',
    treatment_needed: a.treatment_needed || '', referral_needed: !!a.referral_needed, referral_to: a.referral_to || '',
    next_visit_recommendation: a.next_visit_recommendation || '', remarks: a.dental_remarks || ''
});
const visionFrom = (a) => ({
    ...blankVision(),
    visual_acuity_left: a.visual_acuity_left || '', visual_acuity_right: a.visual_acuity_right || '',
    va_left_corrected: a.va_left_corrected || '', va_right_corrected: a.va_right_corrected || '',
    wears_eyeglasses: !!a.wears_eyeglasses, wears_contacts: !!a.wears_contacts, color_vision: a.color_vision || '',
    eye_findings: a.eye_findings || '', recommended_action: a.recommended_action || 'No action', remarks: a.vision_remarks || ''
});

const ConsultationModal = ({ appt, doctorId, userId, onClose, onSaved }) => {
    const { showAlert } = useAlert();
    const editing = !!appt?.assessment_id;
    const visitType = appt?.visit_type || 'General Check Up';

    const [templates, setTemplates] = useState([]);
    const [templateId, setTemplateId] = useState('');
    const [answers, setAnswers] = useState({});
    const [form, setForm] = useState(null);
    const [dental, setDental] = useState(blankDental());
    const [vision, setVision] = useState(blankVision());
    const [followTime, setFollowTime] = useState('09:00');
    const [followDuration, setFollowDuration] = useState(15);
    const [bookFollowUp, setBookFollowUp] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // reset whenever another appointment is opened
    useEffect(() => {
        if (!appt) return;
        setForm({
            chief_complaint: appt.chief_complaint || appt.booking_reason || '',
            clinical_findings: appt.clinical_findings || '',
            diagnosis: appt.diagnosis || '',
            treatment_recommendations: appt.treatment_recommendations || '',
            is_abnormal: !!appt.is_abnormal,
            follow_up_needed: !!appt.follow_up_needed,
            follow_up_date: appt.follow_up_date || '',
            follow_up_notes: appt.follow_up_notes || '',
            prescriptions: Array.isArray(appt.prescriptions) && appt.prescriptions.length > 0 ? appt.prescriptions.map((p) => ({ ...EMPTY_RX, ...p })) : []
        });
        setDental(dentalFrom(appt));
        setVision(visionFrom(appt));
        setAnswers({});
        setTemplateId('');
        setBookFollowUp(false);
        setError('');
        setBusy(false);
    }, [appt]);

    // the doctor's templates that fit this purpose
    useEffect(() => {
        if (!appt || !doctorId) return undefined;
        let live = true;
        fetch(`${API}/api/doctor/${doctorId}/templates?visit_type=${encodeURIComponent(visitType)}`)
            .then((r) => r.json())
            .then((d) => {
                if (!live || !d.success) return;
                setTemplates(d.templates);
                const saved = d.templates.find((t) => t.template_id === appt.template_id);
                const pick = saved || (!editing ? d.templates.find((t) => t.is_default) : null);
                if (pick) {
                    setTemplateId(pick.template_id);
                    if (saved && Array.isArray(appt.template_responses)) {
                        const prefill = {};
                        appt.template_responses.forEach((r) => { prefill[r.key] = r.value; });
                        setAnswers(prefill);
                    }
                }
            })
            .catch(() => {});
        return () => { live = false; };
    }, [appt, doctorId, visitType, editing]);

    const template = useMemo(() => templates.find((t) => t.template_id === templateId) || null, [templates, templateId]);

    const chooseTemplate = (id) => {
        setTemplateId(id);
        const t = templates.find((x) => x.template_id === id);
        const next = {};
        (t?.fields || []).forEach((f) => { if (f.type !== 'heading') next[f.key] = answers[f.key] ?? emptyValue(f); });
        setAnswers(next);
    };

    if (!appt || !form) return null;

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const setRx = (i, patch) => set({ prescriptions: form.prescriptions.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
    const isDental = visitType === 'Dental';
    const isVision = visitType === 'Vision';

    const submit = async (e) => {
        e.preventDefault();
        setError('');

        if (['Absent', 'Excused'].includes(appt.attendance_status)) { setError(`The student is marked ${appt.attendance_status}. Change the attendance first.`); return; }
        if (!isDental && !isVision) {
            if (!form.clinical_findings.trim() || !form.diagnosis.trim()) { setError('Clinical findings and diagnosis are required.'); return; }
            if (!form.treatment_recommendations.trim()) { setError('Add the treatment plan / recommendations.'); return; }
        }
        if (template) {
            const missing = missingRequired(template.fields, answers);
            if (missing.length > 0) { setError(`Please answer: ${missing.join(', ')}.`); return; }
        }
        if (form.prescriptions.some((r) => (r.dosage || r.frequency || r.duration || r.instructions) && !r.medicine.trim())) {
            setError('Every prescription line needs a medicine name.');
            return;
        }
        if (form.follow_up_needed && bookFollowUp && !form.follow_up_date) { setError('Pick the follow-up date to book it.'); return; }

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
                documented_by_doctor_id: doctorId,
                chief_complaint: form.chief_complaint,
                clinical_findings: form.clinical_findings,
                diagnosis: form.diagnosis,
                treatment_recommendations: form.treatment_recommendations,
                is_abnormal: form.is_abnormal,
                follow_up_needed: form.follow_up_needed,
                follow_up_date: form.follow_up_needed ? form.follow_up_date : '',
                follow_up_notes: form.follow_up_needed ? form.follow_up_notes : '',
                prescriptions: form.prescriptions,
                template_id: template ? template.template_id : '',
                template_name: template ? template.template_name : '',
                template_responses: template ? toResponses(template.fields, answers) : [],
                dental: isDental ? dental : undefined,
                vision: isVision ? vision : undefined
            };
            const res = await fetch(`${API}/api/doctor-assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!data.success) { setError(data.message || 'Could not save the consultation.'); return; }

            let followUpMessage = '';
            if (form.follow_up_needed && bookFollowUp) {
                const fu = await fetch(`${API}/api/doctor-visits/${appt.appointment_id}/follow-up`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: appt.student_id, created_by_doctor_id: doctorId, sender_id: userId,
                        start_time: `${form.follow_up_date} ${followTime}:00`, duration_min: followDuration, notes: form.follow_up_notes
                    })
                });
                const fd = await fu.json();
                followUpMessage = fd.success ? ' The follow-up appointment was booked.' : ` The follow-up could not be booked: ${fd.message}`;
            }
            showAlert(`Consultation saved.${followUpMessage}`, followUpMessage.includes('could not') ? 'warning' : 'success');
            onSaved?.();
            onClose();
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal isOpen onClose={onClose} title={editing ? 'Edit consultation' : 'Document consultation'} icon={<ClipboardPlus size={20} />} size="xl" closeOnBackdrop={false}>
            <form className="dp-form" onSubmit={submit}>
                <div className="dp-notice">
                    <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - {visitLabel(visitType, appt.purpose_other)}<br />
                    {formatDate(appt.start_time)}, {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                    {appt.booking_reason ? <><br />Reason given: {appt.booking_reason}</> : null}
                </div>
                {error && <div className="dp-error" role="alert">{error}</div>}

                {templates.length > 0 && (
                    <div className="dp-field">
                        <label htmlFor="consult-template">Assessment form template</label>
                        <select id="consult-template" className="dp-select" value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
                            <option value="">No template (standard form only)</option>
                            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.template_name}{t.is_default ? ' (default)' : ''}</option>)}
                        </select>
                    </div>
                )}

                {isDental && (
                    <>
                        <div className="dp-section-label">Dental examination</div>
                        <div className="dp-row">
                            <div className="dp-field">
                                <label>Oral hygiene</label>
                                <select className="dp-select" required value={dental.oral_hygiene} onChange={(e) => setDental({ ...dental, oral_hygiene: e.target.value })}>
                                    <option value="">-- Select --</option>
                                    <option>Good</option><option>Fair</option><option>Poor</option>
                                </select>
                            </div>
                            <div className="dp-field">
                                <label>Gum condition</label>
                                <select className="dp-select" value={dental.gum_condition} onChange={(e) => setDental({ ...dental, gum_condition: e.target.value })}>
                                    <option value="">-- Select --</option>
                                    <option>Healthy</option><option>Gingivitis</option><option>Bleeding gums</option><option>Swollen gums</option><option>Periodontal concern</option>
                                </select>
                            </div>
                        </div>
                        <div className="dp-row">
                            {[['caries_count', 'Decayed'], ['missing_count', 'Missing'], ['filled_count', 'Filled']].map(([k, label]) => (
                                <div className="dp-field" key={k}>
                                    <label>{label}</label>
                                    <input className="dp-input" type="number" min={0} max={32} value={dental[k]} onChange={(e) => setDental({ ...dental, [k]: e.target.value })} />
                                </div>
                            ))}
                            <div className="dp-field">
                                <label>DMFT index</label>
                                <input className="dp-input" readOnly value={(parseInt(dental.caries_count, 10) || 0) + (parseInt(dental.missing_count, 10) || 0) + (parseInt(dental.filled_count, 10) || 0)} />
                            </div>
                        </div>
                        <label className="dp-check"><input type="checkbox" checked={dental.malocclusion} onChange={(e) => setDental({ ...dental, malocclusion: e.target.checked })} /> Malocclusion observed</label>
                        <div className="dp-field">
                            <label>Tooth / area notes</label>
                            <textarea className="dp-textarea" rows={2} value={dental.tooth_notes} onChange={(e) => setDental({ ...dental, tooth_notes: e.target.value })} placeholder="e.g. Caries on #16 and #26" />
                        </div>
                        <div className="dp-row">
                            <div className="dp-field">
                                <label>Treatment done</label>
                                <textarea className="dp-textarea" rows={2} value={dental.treatment_done} onChange={(e) => setDental({ ...dental, treatment_done: e.target.value })} />
                            </div>
                            <div className="dp-field">
                                <label>Treatment needed</label>
                                <textarea className="dp-textarea" rows={2} value={dental.treatment_needed} onChange={(e) => setDental({ ...dental, treatment_needed: e.target.value })} />
                            </div>
                        </div>
                        <div className="dp-row">
                            <div className="dp-field">
                                <label className="dp-check"><input type="checkbox" checked={dental.referral_needed} onChange={(e) => setDental({ ...dental, referral_needed: e.target.checked })} /> Referral needed</label>
                                {dental.referral_needed && <input className="dp-input" placeholder="Refer to (clinic / specialist)" value={dental.referral_to} onChange={(e) => setDental({ ...dental, referral_to: e.target.value })} />}
                            </div>
                            <div className="dp-field">
                                <label>Next visit recommendation</label>
                                <input className="dp-input" value={dental.next_visit_recommendation} onChange={(e) => setDental({ ...dental, next_visit_recommendation: e.target.value })} placeholder="e.g. Return in 6 months" />
                            </div>
                        </div>
                    </>
                )}

                {isVision && (
                    <>
                        <div className="dp-section-label">Vision examination</div>
                        <div className="dp-row">
                            <div className="dp-field"><label>Left eye (uncorrected)</label><input className="dp-input" required maxLength={10} placeholder="20/20" value={vision.visual_acuity_left} onChange={(e) => setVision({ ...vision, visual_acuity_left: e.target.value })} /></div>
                            <div className="dp-field"><label>Right eye (uncorrected)</label><input className="dp-input" required maxLength={10} placeholder="20/20" value={vision.visual_acuity_right} onChange={(e) => setVision({ ...vision, visual_acuity_right: e.target.value })} /></div>
                            <div className="dp-field"><label>Left eye (corrected)</label><input className="dp-input" maxLength={10} value={vision.va_left_corrected} onChange={(e) => setVision({ ...vision, va_left_corrected: e.target.value })} /></div>
                            <div className="dp-field"><label>Right eye (corrected)</label><input className="dp-input" maxLength={10} value={vision.va_right_corrected} onChange={(e) => setVision({ ...vision, va_right_corrected: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                            <label className="dp-check"><input type="checkbox" checked={vision.wears_eyeglasses} onChange={(e) => setVision({ ...vision, wears_eyeglasses: e.target.checked })} /> Wears eyeglasses</label>
                            <label className="dp-check"><input type="checkbox" checked={vision.wears_contacts} onChange={(e) => setVision({ ...vision, wears_contacts: e.target.checked })} /> Wears contact lenses</label>
                        </div>
                        <div className="dp-row">
                            <div className="dp-field">
                                <label>Color vision</label>
                                <select className="dp-select" value={vision.color_vision} onChange={(e) => setVision({ ...vision, color_vision: e.target.value })}>
                                    <option value="">Not tested</option><option>Normal</option><option>Deficient</option>
                                </select>
                            </div>
                            <div className="dp-field">
                                <label>Recommended action</label>
                                <select className="dp-select" value={vision.recommended_action} onChange={(e) => setVision({ ...vision, recommended_action: e.target.value })}>
                                    <option>No action</option><option>Eyeglasses</option><option>Refer to ophthalmologist</option>
                                </select>
                            </div>
                        </div>
                        <div className="dp-field">
                            <label>Eye condition findings</label>
                            <textarea className="dp-textarea" rows={2} value={vision.eye_findings} onChange={(e) => setVision({ ...vision, eye_findings: e.target.value })} />
                        </div>
                    </>
                )}

                {template && (
                    <>
                        <div className="dp-section-label">{template.template_name}</div>
                        <TemplateFields fields={template.fields} values={answers} onChange={setAnswers} idPrefix="consult" />
                    </>
                )}

                <div className="dp-section-label">Chief complaint</div>
                <div className="dp-field">
                    <label htmlFor="consult-complaint">Why the student came (reason for the consultation)</label>
                    <input id="consult-complaint" className="dp-input" type="text" maxLength={255} value={form.chief_complaint} onChange={(e) => set({ chief_complaint: e.target.value })} placeholder="e.g. Headache and fever since yesterday" />
                </div>

                <div className="dp-section-label">Diagnosis and treatment plan</div>
                <div className="dp-field">
                    <label htmlFor="consult-findings">Clinical findings{isDental || isVision ? ' (optional, filled from the exam when empty)' : ''}</label>
                    <textarea id="consult-findings" className="dp-textarea" rows={3} value={form.clinical_findings} onChange={(e) => set({ clinical_findings: e.target.value })} />
                </div>
                <div className="dp-field">
                    <label htmlFor="consult-diagnosis">Diagnosis{isDental || isVision ? ' (optional)' : ''}</label>
                    <textarea id="consult-diagnosis" className="dp-textarea" rows={2} value={form.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} />
                </div>
                <div className="dp-field">
                    <label htmlFor="consult-plan">Treatment plan / recommendations{isDental || isVision ? ' (optional)' : ''}</label>
                    <textarea id="consult-plan" className="dp-textarea" rows={3} value={form.treatment_recommendations} onChange={(e) => set({ treatment_recommendations: e.target.value })} />
                </div>

                <div className="dp-section-label">Prescription</div>
                {form.prescriptions.length === 0 && <p className="dp-hint" style={{ margin: 0 }}>No medicine prescribed.</p>}
                {form.prescriptions.map((r, i) => (
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
                <div><button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => set({ prescriptions: [...form.prescriptions, { ...EMPTY_RX }] })}><Plus size={15} /> Add medicine</button></div>

                <div className="dp-section-label">Follow-up</div>
                <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                    <label className="dp-check"><input type="checkbox" checked={form.is_abnormal} onChange={(e) => set({ is_abnormal: e.target.checked })} /> Abnormal finding</label>
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
                        <label className="dp-check"><input type="checkbox" checked={bookFollowUp} onChange={(e) => setBookFollowUp(e.target.checked)} /> Also book the follow-up appointment on that date</label>
                        {bookFollowUp && (
                            <div className="dp-row">
                                <div className="dp-field"><label>Time</label><input className="dp-input" type="time" value={followTime} onChange={(e) => setFollowTime(e.target.value)} /></div>
                                <div className="dp-field"><label>Minutes</label><input className="dp-input" type="number" min={5} max={240} step={5} value={followDuration} onChange={(e) => setFollowDuration(e.target.value)} /></div>
                            </div>
                        )}
                    </>
                )}

                <div className="dp-modal-foot">
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="dp-btn dp-btn-primary" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Save consultation'}</button>
                </div>
            </form>
        </Modal>
    );
};

export default ConsultationModal;
