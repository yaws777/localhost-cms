// formModels.js
// Descriptions of the filled-in clinic forms (clinic visit, medicine dispensed, incident report, health screening), laid out like the
// forms the nurse fills up. Read by the on-screen read-only form (components/common/FormDocument.jsx) and the PDF (utils/formDocument.js),
// so both always show the same sections and labels. The doctor's assessment has its own model (assessmentModel.js).
//
// Model: { title, fileName, header: [[label, value]], flag, sections: [{ title, cols, fields: [{ label, value, wide, area }] }], foot }
import { formatDate, formatDateTime, formatTime } from './datetime';
import { fullName } from './visitPurpose';
import { classLabel } from './scheduling';

const has = (v) => v !== null && v !== undefined && v !== '';
const dash = (v) => (has(v) ? String(v) : '--');
const asDate = (v) => (v ? new Date(String(v).includes(' ') && !String(v).includes('T') ? String(v).replace(' ', 'T') : v) : null);

// 'YYYY-MM-DD...' or a Date -> "Oct. 22, 2026"
export const dayText = (v) => {
    if (!has(v)) return '';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v.slice(0, 10));
    const d = asDate(v);
    return d && !Number.isNaN(d.getTime()) ? formatDate(d) : '';
};
export const dateTimeText = (v) => {
    const d = asDate(v);
    return d && !Number.isNaN(d.getTime()) ? formatDateTime(d) : '';
};
const timeText = (v) => (has(v) ? formatTime(v) : '');

// 2, 2.5 (a measured unit keeps its decimals, a count is whole)
const amountText = (value) => {
    const n = parseFloat(value);
    return Number.isNaN(n) ? String(value) : String(Math.round(n * 100) / 100);
};

const nurseOf = (r, ctx = {}) => ctx.nurse || r.nurse_name
    || (r.nurse_first_name || r.nurse_last_name ? fullName(r.nurse_first_name, r.nurse_last_name) : '')
    || r.nurse_id || '';

const field = (label, value, opts = {}) => ({ label, value: dash(value), ...opts });

// ---------- clinic visit ----------
// v: a clinic_visits row (student, nurse, vital signs, intervention, dispensed medicine) | ctx: { nurse, student }
export const buildClinicVisitModel = (v, ctx = {}) => {
    const name = ctx.student || fullName(v.student_first_name || v.first_name, v.student_last_name || v.last_name);
    const nurse = nurseOf(v, ctx);
    const condition = v.complaint_name || v.complaint_id;
    const specify = v.specify_complaint_text || v.specify_complaints_text;
    const dispensed = Boolean(v.batch_id || v.medicine_name);
    const qty = has(v.dosage_consumption_unit_value) ? amountText(v.dosage_consumption_unit_value) : '';

    const sections = [
        {
            title: 'Visit Info', cols: 2, fields: [
                field('Time In', timeText(v.time_in)),
                field('Time Out', timeText(v.time_out)),
                field('Medical Condition', condition, { wide: true }),
                ...(has(specify) ? [field('Specify Medical Condition Details', specify, { wide: true })] : [])
            ]
        },
        {
            title: 'Vital Signs - Time In', cols: 4, fields: [
                field('BP (mmHg)', v.blood_pressure), field('Temp (°C)', v.temperature),
                field('Pulse (bpm)', v.pulse_rate), field('Resp Rate', v.respiratory_rate)
            ]
        }
    ];
    if (v.time_out) {
        sections.push({
            title: 'Vital Signs - Time Out', cols: 4, fields: [
                field('BP (mmHg)', v.out_blood_pressure), field('Temp (°C)', v.out_temperature),
                field('Pulse (bpm)', v.out_pulse_rate), field('Resp Rate', v.out_respiratory_rate),
                field('Student Condition After Time-out', v.out_nurse_note, { wide: true, area: true })
            ]
        });
    }
    sections.push({
        title: 'Intervention & Dispensation', cols: 2, fields: [
            field('Nursing Intervention', v.nursing_intervention, { wide: true, area: true }),
            field('Assessment', v.assessment || v.health_advice, { wide: true, area: true }),
            field('Dispensed Medicine', dispensed ? (v.medicine_name || v.batch_id) : 'No medication dispensed', { wide: true }),
            ...(dispensed ? [field('Dosage / Quantity', qty), field('Unit of Measure', v.dosage_consumption_unit_of_measure)] : [])
        ]
    });

    return {
        title: 'Clinic Visit Form',
        fileName: `Clinic Visit ${v.visit_id || v.student_id || ''}`.trim(),
        header: [
            ['Visit ID', v.visit_id], ['Student', name], ['Student ID', v.student_id],
            ['Visit date', dayText(v.visit_date)], ['Nurse', nurse]
        ].filter(([, x]) => has(x)),
        sections
    };
};

// ---------- medicine dispensed ----------
// d: a dispensation row, nurse list (medicine_name, complaint_name ...) or student / parent record (brand_name, generic_name ...)
export const buildDispensedModel = (d, ctx = {}) => {
    const name = ctx.student || fullName(d.first_name || d.student_first_name, d.last_name || d.student_last_name);
    const medicine = d.medicine_name || [d.brand_name, d.generic_name ? `(${d.generic_name})` : ''].filter(Boolean).join(' ');
    const unit = d.dosage_consumption_unit_of_measure || '';
    const qty = has(d.dosage_consumption_unit_value) ? amountText(d.dosage_consumption_unit_value) : (d.quantity_dispensed || '');
    const condition = d.complaint_name ? (d.specify_complaint_text ? `${d.complaint_name} (${d.specify_complaint_text})` : d.complaint_name) : '';
    const nurse = nurseOf(d, ctx);

    return {
        title: 'Medicine Dispensing Form',
        fileName: `Medicine Dispensed ${d.id || ''}`.trim(),
        header: [
            ['Transaction ID', has(d.id) ? `#${d.id}` : ''], ['Student', name], ['Student ID', d.student_id],
            ['Date & time', dateTimeText(d.dispensed_at)], ['Dispensed by', nurse]
        ].filter(([, x]) => has(x)),
        sections: [
            {
                title: 'Medicine', cols: 2, fields: [
                    field('Dispensation Type', d.dispensation_type, { wide: true }),
                    field('Medicine Name', medicine, { wide: true }),
                    field('Medical Condition', condition, { wide: true }),
                    field('Dosage / Quantity', has(d.dosage_consumption_unit_value) ? qty : (d.quantity_dispensed || '')),
                    field('Unit of Measure', unit)
                ]
            }
        ]
    };
};

// ---------- incident report ----------
// r: an incident_reports row with student, class and nurse names and the medicine given
export const buildIncidentModel = (r, ctx = {}) => {
    const name = ctx.student || fullName(r.student_first_name, r.student_last_name);
    const klass = classLabel(r) || '';
    const medicine = r.medicine_name
        ? `${r.medicine_name}${has(r.dosage_consumption_unit_value) ? ` - ${Math.round(parseFloat(r.dosage_consumption_unit_value))} ${r.dosage_consumption_unit_of_measure || ''}`.trimEnd() : ''}`
        : '';
    const nurse = nurseOf(r, ctx);

    return {
        title: 'Incident Report Form',
        fileName: `Incident Report ${r.incident_id || r.student_id || ''}`.trim(),
        header: [
            ['Incident ID', r.incident_id], ['Student', name], ['Student ID', r.student_id],
            ['Program / Year / Section', klass], ['Date & time', dateTimeText(r.incident_datetime)],
            ['Recorded by', nurse ? `Nurse ${nurse}` : '']
        ].filter(([, x]) => has(x)),
        sections: [
            {
                title: 'Incident', cols: 2, fields: [
                    field('Location', r.incident_location, { wide: true }),
                    field('Description', r.incident_description, { wide: true, area: true }),
                    field('First Aid', r.first_aid_administered, { wide: true, area: true }),
                    field('Disposition', r.current_physical_situation, { wide: true, area: true })
                ]
            },
            { title: 'Medicine', cols: 2, fields: [field('Medicine Dispensed', medicine || 'None', { wide: true })] }
        ]
    };
};

// ---------- health screening ----------
// "Left ear: Normal | Right ear: Normal" -> [{label, value}] (older results are stored as one text)
export const detailPairs = (details) => String(details || '').split(' | ').map((part) => {
    const i = part.indexOf(':');
    return i > 0 && i < 30 ? { label: part.slice(0, i).trim(), value: part.slice(i + 1).trim() } : { label: '', value: part.trim() };
}).filter((p) => p.value);

// The student / parent record of a screening -> what buildScreeningModel reads
export const screeningFromRecord = (s) => ({
    student: fullName(s.first_name, s.last_name),
    studentId: s.student_id,
    type: s.screening_type,
    title: s.title && s.title !== s.screening_type ? s.title : '',
    date: s.record_date,
    time: s.start_time && s.end_time ? `${formatTime(s.start_time)} - ${formatTime(s.end_time)}` : '',
    status: s.status,
    attendance: s.attendance ? s.attendance.charAt(0) + s.attendance.slice(1).toLowerCase() : '',
    results: Array.isArray(s.results) && s.results.length > 0 ? s.results : detailPairs(s.details),
    remarks: s.remarks,
    abnormal: !!s.is_abnormal,
    notes: s.announcement,
    cancelledReason: s.cancelled_reason
});

// n: { student, studentId, classText, type, title, date, time, status, attendance, results: [{label, value, unit, note}],
//      remarks, abnormal, notes, cancelledReason, schoolYear, nurse }
export const buildScreeningModel = (n) => {
    const completed = n.status === 'Completed' || (!n.status && (n.results || []).length > 0);
    const results = (n.results || []).filter((r) => r && has(r.value));
    const resultFields = results.map((r) => field(
        r.label || 'Result',
        `${r.value}${r.unit ? ` ${r.unit}` : ''}${r.note ? ` (${r.note})` : ''}`
    ));

    const sections = [
        {
            title: 'Screening', cols: 2, fields: [
                ...(has(n.title) ? [field('Title', n.title)] : []),
                ...(has(n.time) ? [field('Time', n.time)] : []),
                ...(has(n.attendance) ? [field('Attendance', n.attendance)] : []),
                ...(has(n.status) ? [field('Status', n.status)] : []),
                ...(has(n.schoolYear) ? [field('School Year', n.schoolYear)] : []),
                ...(has(n.cancelledReason) ? [field('Reason Cancelled', n.cancelledReason, { wide: true })] : []),
                ...(has(n.notes) ? [field('Notes', n.notes, { wide: true, area: true })] : [])
            ]
        }
    ];
    if (completed || resultFields.length > 0) {
        sections.push({
            title: 'Result', cols: 2, fields: [
                ...resultFields,
                field('Remarks', n.remarks, { wide: true, area: true })
            ]
        });
    } else {
        sections.push({
            title: 'Result', cols: 2, fields: [
                field('Result', n.status === 'Upcoming' || n.status === 'Ongoing' ? 'Not yet available.' : 'No result was recorded.', { wide: true })
            ]
        });
    }

    return {
        title: 'Health Screening Form',
        fileName: `Screening ${n.studentId || ''} ${n.type || ''}`.trim(),
        header: [
            ['Student', n.student], ['Student ID', n.studentId], ['Program / Year / Section', n.classText],
            ['Screening', n.type], ['Date', dayText(n.date)], ['Documented by', n.nurse]
        ].filter(([, x]) => has(x)),
        flag: n.abnormal ? 'Some values are outside the normal range. See the clinic.' : '',
        sections
    };
};

export const buildScreeningRecordModel = (s) => buildScreeningModel(screeningFromRecord(s));
