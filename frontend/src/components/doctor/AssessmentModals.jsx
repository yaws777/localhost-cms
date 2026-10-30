// AssessmentModals.jsx
// Read-only looks at documented check-ups, shared by the doctor portal and the nurse's Doctor Visit page:
//   - AssessmentViewModal: the assessment (or, when nothing was documented, the details) of one check-up
//   - AssessmentHistoryModal: every assessment the clinic documented for one student
import React, { useState, useEffect } from 'react';
import { ClipboardList, History } from 'lucide-react';
import Modal from '../common/Modal';
import { formatDate, formatDateTime, formatTime } from '../../utils/datetime';
import { visitLabel, sourceLabel, statusClass, statusLabel, fullName } from '../../utils/visitPurpose';
import '../../styles/doctor/DoctorLayout.css';

const API = 'http://localhost:3001';

const DENTAL_FIELDS = [
    ['oral_hygiene', 'Oral hygiene'], ['gum_condition', 'Gums'], ['caries_count', 'Decayed'], ['missing_count', 'Missing'], ['filled_count', 'Filled'],
    ['tooth_notes', 'Tooth notes'], ['treatment_done', 'Treatment done'], ['treatment_needed', 'Treatment needed'], ['referral_to', 'Referred to'],
    ['next_visit_recommendation', 'Next visit'], ['dental_remarks', 'Remarks']
];
const VISION_FIELDS = [
    ['visual_acuity_left', 'Left eye'], ['visual_acuity_right', 'Right eye'], ['va_left_corrected', 'Left eye (corrected)'], ['va_right_corrected', 'Right eye (corrected)'],
    ['color_vision', 'Color vision'], ['eye_findings', 'Eye findings'], ['recommended_action', 'Recommended action'], ['vision_remarks', 'Remarks']
];

const filled = (v) => v !== null && v !== undefined && v !== '';

const Fact = ({ label, children }) => (
    <>
        <dt>{label}</dt>
        <dd>{children}</dd>
    </>
);

// What the doctor wrote for one check-up
export const AssessmentDetails = ({ a }) => {
    const medicines = Array.isArray(a.prescriptions) ? a.prescriptions : [];
    const answers = Array.isArray(a.template_responses) ? a.template_responses.filter((r) => filled(r.value) && !(Array.isArray(r.value) && r.value.length === 0)) : [];
    const detail = a.visit_type === 'Dental' ? DENTAL_FIELDS : a.visit_type === 'Vision' ? VISION_FIELDS : [];

    return (
        <dl className="dp-kv">
            {a.chief_complaint && <Fact label="Chief complaint">{a.chief_complaint}</Fact>}
            {a.clinical_findings && <Fact label="Clinical findings">{a.clinical_findings}</Fact>}
            {a.diagnosis && <Fact label="Diagnosis">{a.diagnosis}</Fact>}
            {a.treatment_recommendations && <Fact label="Treatment plan">{a.treatment_recommendations}</Fact>}
            {detail.filter(([k]) => filled(a[k])).map(([k, label]) => <Fact key={k} label={label}>{String(a[k])}</Fact>)}
            {medicines.length > 0 && (
                <Fact label="Medicines">
                    <ul className="dp-plain-list">
                        {medicines.map((m, i) => (
                            <li key={i}><strong>{m.medicine}</strong>{[m.dosage, m.frequency, m.duration].filter(Boolean).length > 0 ? ` - ${[m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}` : ''}{m.instructions ? ` (${m.instructions})` : ''}</li>
                        ))}
                    </ul>
                </Fact>
            )}
            {answers.map((r) => <Fact key={r.key} label={r.label}>{Array.isArray(r.value) ? r.value.join(', ') : String(r.value)}</Fact>)}
            {!!a.follow_up_needed && (
                <Fact label="Repeat">
                    {a.follow_up_date ? `Around ${formatDate(a.follow_up_date)}` : 'Needed, no date given'}{a.follow_up_notes ? ` - ${a.follow_up_notes}` : ''}
                </Fact>
            )}
            {a.referral_facility && <Fact label="Referral">{a.referral_facility}{a.referral_reason ? ` - ${a.referral_reason}` : ''}</Fact>}
            {(a.documented_by_name || a.assessment_date) && (
                <Fact label="Documented">
                    {a.assessment_date ? formatDateTime(a.assessment_date) : ''}{a.documented_by_name ? ` by ${a.documented_by_name}${a.documented_by_role ? ` (${a.documented_by_role})` : ''}` : ''}
                </Fact>
            )}
        </dl>
    );
};

const chipsOf = (a) => (
    <div className="dp-appt-chips">
        <span className={`dp-chip ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
        {!!a.is_abnormal && <span className="dp-chip abnormal">Abnormal</span>}
        {!!a.follow_up_needed && <span className="dp-chip st-pending-approval">Repeat</span>}
        {a.template_name && <span className="dp-chip source">{a.template_name}</span>}
    </div>
);

// ---------------------------------------------------------------------------
// One check-up: the assessment, or its details when nothing was documented
// ---------------------------------------------------------------------------
export const AssessmentViewModal = ({ appt, onClose }) => {
    if (!appt) return null;
    const documented = !!appt.assessment_id;
    return (
        <Modal isOpen onClose={onClose} title={documented ? 'Assessment' : 'Check-up details'} icon={<ClipboardList size={20} />} size="lg">
            <div className="dp-notice">
                <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - {visitLabel(appt.visit_type, appt.purpose_other)}<br />
                {formatDate(appt.start_time)}, {formatTime(appt.start_time)} - {formatTime(appt.end_time)} - Dr. {appt.doc_first_name} {appt.doc_last_name}
            </div>
            {chipsOf(appt)}
            {documented ? <AssessmentDetails a={appt} /> : (
                <dl className="dp-kv">
                    <Fact label="Attendance">{appt.attendance_status || 'Pending'}</Fact>
                    <Fact label="Scheduled by">{sourceLabel(appt.booking_source)}</Fact>
                    {appt.booking_reason && <Fact label="Reason given">{appt.booking_reason}</Fact>}
                    {appt.decline_reason && <Fact label={appt.status === 'Declined' ? 'Declined because' : 'Cancelled because'}>{appt.decline_reason}</Fact>}
                    {appt.notes && <Fact label="Notes">{appt.notes}</Fact>}
                    <Fact label="Assessment">Not documented.</Fact>
                </dl>
            )}
            <div className="dp-modal-foot">
                <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
            </div>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Every assessment documented for the student (all doctors), newest first
// ---------------------------------------------------------------------------
export const AssessmentHistoryModal = ({ appt, onClose }) => {
    const [rows, setRows] = useState(null);

    useEffect(() => {
        if (!appt) return undefined;
        let live = true;
        setRows(null);
        fetch(`${API}/api/doctor/patients/${encodeURIComponent(appt.student_id)}/record`)
            .then((r) => r.json())
            .then((d) => { if (live) setRows(d.success ? d.consultations : []); })
            .catch(() => { if (live) setRows([]); });
        return () => { live = false; };
    }, [appt]);

    return (
        <Modal isOpen={!!appt} onClose={onClose} title="Assessment history" icon={<History size={20} />} size="lg">
            {appt && (
                <div className="dp-notice" style={{ marginBottom: 14 }}>
                    <strong>{fullName(appt.student_first_name, appt.student_last_name)}</strong> ({appt.student_id}) - every assessment documented for this student
                </div>
            )}
            {rows === null ? <p className="dp-hint">Loading...</p> : rows.length === 0 ? (
                <p className="dp-hint">No assessment was documented for this student yet.</p>
            ) : (
                <ul className="dp-history">
                    {rows.map((r) => (
                        <li key={`${r.appointment_id}-${r.student_id}`} className={appt && r.appointment_id === appt.appointment_id ? 'current' : ''}>
                            <div className="dp-history-head">
                                <strong>{formatDate(r.start_time)}</strong>
                                <span>{visitLabel(r.visit_type, r.purpose_other)} - Dr. {r.doc_first_name} {r.doc_last_name}</span>
                                {appt && r.appointment_id === appt.appointment_id && <span className="dp-chip source">This check-up</span>}
                            </div>
                            {chipsOf(r)}
                            <AssessmentDetails a={r} />
                        </li>
                    ))}
                </ul>
            )}
            <div className="dp-modal-foot">
                <button type="button" className="dp-btn dp-btn-ghost" onClick={onClose}>Close</button>
            </div>
        </Modal>
    );
};
