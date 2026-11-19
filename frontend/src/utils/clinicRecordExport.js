// clinicRecordExport.js
// PDF (print preview) of the Clinic Logs & Records tabs, same school header / layout as the other reports (printReport.js):
// the list of the tab plus the full content of every record (visit form, dispensed medicine, incident, screening result,
// doctor check-up assessment). Used by the student, parent and nurse (Health Records) screens.
import { formatDate, formatTime, formatDateTime } from './datetime';
import { openReportWindow, writeDetailedReport } from './printReport';
import { printAssessment, assessmentBodyHtml } from './assessmentPdf';
import { buildAssessmentModel } from './assessmentModel';
import { FORM_CSS, formBodyHtml, printFormDocument } from './formDocument';
import { buildClinicVisitModel, buildDispensedModel, buildIncidentModel, buildScreeningRecordModel } from './formModels';
import { vitalsLine, inVitalsOf, outVitalsOf } from './vitals';
import { dispensedLine } from './dispensed';
import { visitOutcome, visitDoctor, visitTitle } from '../components/common/ClinicRecordViews';

export const EXPORT_TITLES = {
    'clinic-visits': 'Clinic Visit Log',
    'medicine-dispensed': 'Medicine Dispensed',
    'incident-reports': 'Incident Reports',
    'health-screenings': 'Health Screening',
    'doctor-visits': 'Doctor Visits (Check-up)',
    'document-requests': 'Document Requests',
    'student-requirements': 'Student Requirements'
};

const NA = 'N/A';
const has = (v) => v !== null && v !== undefined && v !== '';
const text = (v) => (has(v) ? String(v) : NA);

const asDate = (v) => (v ? new Date(String(v).includes(' ') && !String(v).includes('T') ? String(v).replace(' ', 'T') : v) : null);
const dateOnly = (v) => {
    if (!has(v)) return NA;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v.slice(0, 10)) || NA;
    return formatDate(asDate(v)) || NA;
};
const dateTime = (v) => {
    const d = asDate(v);
    return d && !Number.isNaN(d.getTime()) ? formatDateTime(d) : NA;
};
const timeText = (v) => (has(v) ? (formatTime(v) || NA) : NA);

const nurseName = (r) => (r.nurse_first_name && r.nurse_last_name ? `${r.nurse_first_name} ${r.nurse_last_name}` : (r.nurse_id || NA));

const keyLabel = (key) => {
    const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').trim();
    const n = spaced.toLowerCase();
    if (['complaint', 'chief complaint', 'complaint id', 'complaint name', 'complaint text', 'complaint type'].includes(n)) return 'Medical Condition';
    if (['specify complaint', 'specified complaint', 'specify complaint text', 'specify complaint other', 'specified complaint text'].includes(n)) return 'Specify Medical Condition';
    return spaced.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const genericValue = (value) => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T00:00/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnly(value);
        if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value)) return dateTime(value);
    }
    return String(value);
};

// every filled scalar field (medicine dispensed, incident report, document request, requirement)
const genericRows = (record) => Object.entries(record)
    .filter(([, v]) => has(v) && typeof v !== 'object')
    .map(([k, v]) => [keyLabel(k), genericValue(v)]);

const compact = (rows) => rows.filter(([, v]) => has(v));

const COLUMNS = {
    'clinic-visits': ['Visit ID', 'Student ID', 'Nurse Name', 'Date', 'Time In / Out', 'Vital Signs'],
    'medicine-dispensed': ['Dispense ID', 'Type', 'Student ID', 'Brand Name', 'Generic Name', 'Qty', 'Date & Time'],
    'incident-reports': ['Incident ID', 'Student ID', 'Nurse Name', 'Location', 'Date & Time'],
    'health-screenings': ['Type', 'Student ID', 'Date', 'Status'],
    'doctor-visits': ['Date', 'Student ID', 'Check-up', 'Doctor Name', 'Number', 'Status', 'Assessment'],
    'document-requests': ['Request ID', 'Type', 'Student ID', 'Reason', 'Date Created', 'Status'],
    'student-requirements': ['Requirement', 'Student ID', 'Submitted Date', 'Status']
};

const listRow = (tab, r) => {
    switch (tab) {
        case 'clinic-visits':
            return [r.visit_id, r.student_id, nurseName(r), dateOnly(r.visit_date),
                `${timeText(r.time_in)} - ${r.time_out ? timeText(r.time_out) : NA}`,
                `BP: ${r.blood_pressure || NA} | Temp: ${r.temperature || NA}°C`];
        case 'medicine-dispensed':
            return [r.id, r.dispensation_type, r.student_id || NA, r.brand_name || NA, r.generic_name || NA, r.quantity_dispensed, r.dispensed_at ? dateTime(r.dispensed_at) : NA];
        case 'incident-reports':
            return [r.incident_id, r.student_id, nurseName(r), r.incident_location, r.incident_datetime ? dateTime(r.incident_datetime) : NA];
        case 'health-screenings':
            return [r.screening_type || r.requirement_type, r.student_id, dateOnly(r.record_date || r.date), r.status];
        case 'doctor-visits':
            return [r.start_time ? dateOnly(r.start_time) : NA, r.student_id, visitTitle(r), visitDoctor(r), r.queue_label || '-', visitOutcome(r).label,
                r.documented ? (r.diagnosis || 'Documented') : '-'];
        case 'document-requests':
            return [r.request_id, r.document_type, r.student_id, r.reason || NA, dateOnly(r.created_at || r.date_created || r.createdAt || r.request_date), r.status];
        case 'student-requirements':
            return [r.requirement_name || 'Health Requirement', r.student_id, dateOnly(r.submitted_at || r.date_submitted || r.submitted_date || r.submittedAt), r.status || 'Not Submitted'];
        default:
            return [];
    }
};

// Doctor visit: check-up + the doctor's assessment
const doctorVisitRows = (v) => {
    const outcome = visitOutcome(v);
    const start = asDate(v.start_time);
    const end = asDate(v.end_time);
    const prescriptions = Array.isArray(v.prescriptions) ? v.prescriptions : [];
    const responses = Array.isArray(v.template_responses) ? v.template_responses.filter((r) => r && has(r.value)) : [];
    const rows = [
        ['Check-up', visitTitle(v)],
        ['Doctor', `${visitDoctor(v)}${v.location ? `, ${v.location}` : ''}`],
        ['Date', `${dateOnly(v.start_time)}${start && end ? `, ${formatTime(start)} - ${formatTime(end)}` : ''}`],
        ['Number', v.queue_label],
        ['Status', outcome.label],
        ['Reason', v.chief_complaint || v.booking_reason],
        ['Attendance', v.attendance_status],
        ['Time in', v.check_in_time ? dateTime(v.check_in_time) : null],
        ['Reason declined', v.decline_reason],
        ['Notes', v.student_notes],
        ['Vital signs - At time in', vitalsLine(inVitalsOf(v))],
        ['Vital signs - At time out', vitalsLine(outVitalsOf(v))]
    ];
    if (v.documented) {
        rows.push(['Assessment - Findings', v.clinical_findings]);
        rows.push(['Assessment - Diagnosis', v.diagnosis]);
        rows.push(['Assessment - Advice', v.treatment_recommendations]);
        rows.push(['Assessed on', v.assessment_date ? dateOnly(v.assessment_date) : null]);
        if (v.is_abnormal) rows.push(['Attention', 'The doctor marked this result as needing attention.']);
        if (prescriptions.length > 0) {
            rows.push(['Prescription', prescriptions.map((m) => {
                const dose = [m.dosage, m.frequency, m.duration].filter(Boolean).join(', ');
                return `${m.medicine}${dose ? ` - ${dose}` : ''}${m.instructions ? ` (${m.instructions})` : ''}`;
            }).join('\n')]);
        }
        responses.forEach((r) => rows.push([r.label || v.template_name || 'Doctor form', Array.isArray(r.value) ? r.value.join(', ') : String(r.value)]));
        rows.push(['Refer to', v.referral_facility]);
        rows.push(['Referral reason', v.referral_reason]);
        if (v.follow_up_needed) {
            rows.push(['Follow-up check-up advised by', v.follow_up_date ? dateOnly(v.follow_up_date) : 'As soon as possible']);
            rows.push(['Follow-up check-up notes', v.follow_up_notes]);
        }
    } else {
        rows.push(['Assessment', outcome.tone === 'info' ? 'Not yet available.' : 'No assessment was recorded for this check-up.']);
    }
    rows.push(['Medicine dispensed (time out)', dispensedLine(v)]);
    ['oral_hygiene', 'caries_count', 'missing_count', 'filled_count', 'gum_condition', 'malocclusion', 'tooth_notes', 'treatment_done', 'treatment_needed',
        'referral_needed', 'referral_to', 'next_visit_recommendation', 'dental_remarks'].forEach((k) => rows.push([`Dental - ${keyLabel(k)}`, has(v[k]) ? genericValue(v[k]) : null]));
    ['visual_acuity_left', 'visual_acuity_right', 'va_left_corrected', 'va_right_corrected', 'wears_eyeglasses', 'wears_contacts', 'color_vision',
        'eye_findings', 'recommended_action', 'vision_remarks'].forEach((k) => rows.push([`Vision - ${keyLabel(k)}`, has(v[k]) ? genericValue(v[k]) : null]));
    return compact(rows);
};

// the four forms the nurse fills up are exported as the filled-in form (same layout as the screen), the rest as label / value rows
const FORM_MODELS = {
    'clinic-visits': buildClinicVisitModel,
    'medicine-dispensed': buildDispensedModel,
    'incident-reports': buildIncidentModel,
    'health-screenings': buildScreeningRecordModel
};

export const recordRows = (tab, record) => {
    if (tab === 'doctor-visits') return doctorVisitRows(record);
    return genericRows(record);
};

const recordHeading = (tab, r, i) => {
    const id = r.visit_id || r.id || r.incident_id || r.record_id || r.request_id || r.appointment_id || r.submission_id;
    const base = tab === 'doctor-visits' ? `${visitTitle(r)} - ${r.start_time ? dateOnly(r.start_time) : NA}`
        : tab === 'health-screenings' ? `${r.screening_type || 'Screening'} - ${dateOnly(r.record_date)}`
        : `${EXPORT_TITLES[tab]} ${id || i + 1}`;
    return `${i + 1}. ${base}`;
};

// what one record shows in the report: the filled-in form, or rows
const recordBlock = (tab, r, heading) => {
    if (FORM_MODELS[tab]) return { heading, html: formBodyHtml(FORM_MODELS[tab](r)) };
    if (tab === 'doctor-visits' && r.documented) return { heading, html: assessmentBodyHtml(buildAssessmentModel(r)) };
    return { heading, rows: recordRows(tab, r) };
};

// records: the rows of the tab as shown | studentLabel: "Name (ID)" or "All Linked Students" | range: { startDate, endDate }
export const exportClinicRecords = ({ tab, records, studentLabel, range, onBlocked }) => {
    const win = openReportWindow(onBlocked);
    if (!win) return;
    const list = Array.isArray(records) ? records : [];
    const details = [['Student', studentLabel || NA], ['Records', String(list.length)]];
    if (range && range.startDate && range.endDate) details.push(['Period', `${dateOnly(range.startDate)} to ${dateOnly(range.endDate)}`]);
    writeDetailedReport(win, {
        title: `${EXPORT_TITLES[tab] || 'Clinic Records'} Report`,
        details,
        columns: COLUMNS[tab] || [],
        rows: list.map((r) => listRow(tab, r).map(text)),
        emptyText: 'No records found.',
        extraCss: FORM_CSS,
        records: list.map((r, i) => recordBlock(tab, r, recordHeading(tab, r, i)))
    });
};

// one record (from its detail modal)
export const exportClinicRecord = ({ tab, record, studentLabel, onBlocked }) => {
    // the four nurse forms export as the filled-in form
    if (FORM_MODELS[tab]) {
        printFormDocument(FORM_MODELS[tab](record), onBlocked);
        return;
    }
    // a documented check-up exports as the assessment form
    if (tab === 'doctor-visits' && record.documented) {
        printAssessment(record, undefined, onBlocked);
        return;
    }
    const win = openReportWindow(onBlocked);
    if (!win) return;
    writeDetailedReport(win, {
        title: `${EXPORT_TITLES[tab] || 'Clinic Record'} Record`,
        details: [['Student', studentLabel || record.student_id || NA]],
        columns: COLUMNS[tab] || [],
        rows: [listRow(tab, record).map(text)],
        emptyText: 'No record.',
        records: [{ heading: 'Full record', rows: recordRows(tab, record) }]
    });
};
