// assessmentModel.js
// One description of a documented check-up, laid out like the doctor's assessment form (ConsultationModal):
// header, vital signs, the form fields, prescription, follow-up, referral. The on-screen read-only form
// (components/doctor/AssessmentForm.jsx) and the PDF (utils/assessmentPdf.js) both read this, so they always match.
import { formatDate, formatDateTime, formatTime } from './datetime';
import { visitLabel, fullName } from './visitPurpose';
import { VITAL_FIELDS, inVitalsOf, outVitalsOf, hasVitals, vitalMeta } from './vitals';
import { dispensedLine } from './dispensed';
import { STANDARD_FORM_DEFAULT } from './standardForm';

export const NURSE_NAME = 'Marilou H. Balarao';
export const NURSE_ROLE = 'School Nurse';

const DENTAL_FIELDS = [
    ['oral_hygiene', 'Oral hygiene'], ['gum_condition', 'Gums'], ['caries_count', 'Decayed'], ['missing_count', 'Missing'], ['filled_count', 'Filled'],
    ['tooth_notes', 'Tooth notes'], ['treatment_done', 'Treatment done'], ['treatment_needed', 'Treatment needed'], ['referral_to', 'Referred to'],
    ['next_visit_recommendation', 'Next visit'], ['dental_remarks', 'Remarks']
];
const VISION_FIELDS = [
    ['visual_acuity_left', 'Left eye'], ['visual_acuity_right', 'Right eye'], ['va_left_corrected', 'Left eye (corrected)'], ['va_right_corrected', 'Right eye (corrected)'],
    ['color_vision', 'Color vision'], ['eye_findings', 'Eye findings'], ['recommended_action', 'Recommended action'], ['vision_remarks', 'Remarks']
];

const filled = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
const asDate = (v) => (v ? new Date(String(v).includes(' ') && !String(v).includes('T') ? String(v).replace(' ', 'T') : v) : null);
const dayText = (v) => {
    if (!v) return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v.slice(0, 10));
    const d = asDate(v);
    return d && !Number.isNaN(d.getTime()) ? formatDate(d) : '';
};
const valueText = (v) => (Array.isArray(v) ? v.join(', ') : String(v));

// labels of the four core questions, as the standard form words them
const CORE_LABEL = Object.fromEntries(STANDARD_FORM_DEFAULT.fields.map((f) => [f.key, f.label]));

// a = any record that carries the assessment columns (doctor visit row, student / parent record, student check-up history)
// ctx = what the record does not carry itself: { student, studentId, purpose, doctor, when }
export const buildAssessmentModel = (a, ctx = {}) => {
    const record = a || {};
    const documented = !!(record.assessment_id || record.documented || record.diagnosis || record.clinical_findings || record.chief_complaint);

    const doctorFirst = record.doc_first_name || record.doctor_first_name;
    const doctorLast = record.doc_last_name || record.doctor_last_name;
    const doctor = ctx.doctor || record.doctor_name || (doctorFirst || doctorLast ? `Dr. ${fullName(doctorFirst, doctorLast)}` : '');
    const start = asDate(record.start_time);
    const end = asDate(record.end_time);
    const when = ctx.when || (start && !Number.isNaN(start.getTime())
        ? `${formatDate(start)}${end && !Number.isNaN(end.getTime()) && !record.queue_state && !record.queue_label ? `, ${formatTime(start)} - ${formatTime(end)}` : ''}`
        : dayText(record.date));
    const isRepeat = record.visit_type === 'Follow-up' || !!record.is_repeat;
    const purpose = ctx.purpose || (isRepeat ? 'Follow-up check-up' : visitLabel(record.visit_type, record.purpose_other));

    const header = [
        ['Student', ctx.student || fullName(record.student_first_name, record.student_last_name) || ''],
        ['Student ID', ctx.studentId || record.student_id || ''],
        ['Check-up', purpose],
        ['Doctor', doctor],
        ['Date', when]
    ].filter(([, v]) => filled(v));

    // vital signs the nurse took (time in always, time out when recorded)
    const vitalGroup = (title, values) => ({
        title,
        items: VITAL_FIELDS.map((f) => ({ label: f.label, unit: f.unit, ...vitalMeta(f.key, values[f.key]) })).filter((i) => i.value)
    });
    const vitals = [];
    if (hasVitals(inVitalsOf(record))) vitals.push(vitalGroup('Vital signs - time in', inVitalsOf(record)));
    if (hasVitals(outVitalsOf(record))) vitals.push(vitalGroup('Vital signs - time out', outVitalsOf(record)));

    // the form itself: the four standard questions + the doctor's own questions, or the template that was used
    const answers = Array.isArray(record.template_responses) ? record.template_responses.filter((r) => r && filled(r.value)) : [];
    const usedTemplate = !!record.template_name;
    const core = ['chief_complaint', 'clinical_findings', 'diagnosis', 'treatment_recommendations']
        .filter((k) => filled(record[k]))
        .map((k) => ({ key: k, label: CORE_LABEL[k], type: k === 'chief_complaint' ? 'text' : 'textarea', value: String(record[k]) }));
    const answerFields = answers.map((r) => ({
        key: r.key, label: r.label, type: r.type === 'textarea' || String(valueText(r.value)).length > 80 ? 'textarea' : 'text', value: valueText(r.value)
    }));
    const sections = [];
    if (usedTemplate) {
        sections.push({ title: record.template_name, fields: [...core, ...answerFields] });
    } else if (core.length + answerFields.length > 0) {
        sections.push({ title: 'Check-up form', fields: [...core, ...answerFields] });
    }
    const detail = record.visit_type === 'Dental' ? [['Dental record', DENTAL_FIELDS]] : record.visit_type === 'Vision' ? [['Vision record', VISION_FIELDS]] : [];
    detail.forEach(([title, list]) => {
        const fields = list.filter(([k]) => filled(record[k])).map(([k, label]) => ({ key: k, label, type: 'text', value: String(record[k]) }));
        if (fields.length) sections.push({ title, fields });
    });

    const prescriptions = (Array.isArray(record.prescriptions) ? record.prescriptions : []).filter((m) => m && m.medicine);
    const dispensed = dispensedLine(record);

    const followUp = record.follow_up_needed
        ? { date: record.follow_up_date ? dayText(record.follow_up_date) : '', notes: record.follow_up_notes || '' }
        : null;
    const referral = record.referral_facility || record.referral_reason
        ? { facility: record.referral_facility || '', reason: record.referral_reason || '' }
        : null;

    const documentedBy = [
        record.assessment_date ? formatDateTime(asDate(record.assessment_date)) : '',
        record.documented_by_name ? `by ${record.documented_by_name}${record.documented_by_role ? ` (${record.documented_by_role})` : ''}` : ''
    ].filter(Boolean).join(' ');

    return {
        documented, header, vitals, sections, prescriptions, dispensed, followUp, referral,
        abnormal: !!record.is_abnormal, documentedBy,
        nurseRemarks: String(record.nurse_remarks || record.out_nurse_note || '').trim(),
        fileName: `Assessment ${ctx.studentId || record.student_id || ''}`.trim()
    };
};
