// doctorVisitDocuments.js
// Printable papers of one doctor visit: visit summary, medical certificate and referral slip.
import stiLogo from '../assets/sti-logof.png';
import { formatTime, formatDate } from './datetime';
import { escapeHtml } from './printReport';

export const printDocument = (title, bodyHtml, onBlocked) => {
    const w = window.open('', '_blank', 'width=900,height=800');
    if (!w) {
        if (onBlocked) onBlocked();
        return;
    }
    w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 32px; }
        .head { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #004b87; padding-bottom: 12px; margin-bottom: 20px; }
        .head img { height: 56px; }
        .head h1 { margin: 0; font-size: 20px; color: #004b87; }
        .head p { margin: 2px 0 0; font-size: 12px; color: #64748b; }
        h2 { text-align: center; letter-spacing: 1px; margin: 18px 0; }
        p { font-size: 14px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        td, th { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 13px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; width: 30%; }
        .sign { margin-top: 70px; display: flex; justify-content: space-between; }
        .sign div { width: 40%; text-align: center; border-top: 1px solid #1e293b; padding-top: 6px; font-size: 13px; }
        .flag { color: #b91c1c; font-weight: 600; }
        .note { font-size: 11px; color: #64748b; margin-top: 24px; }
    </style></head><body>
        <div class="head"><img src="${stiLogo}" alt="STI Logo" /><div><h1>STI College Baliuag - School Clinic</h1><p>Clinic Management System</p></div></div>
        ${bodyHtml}
        <p class="note">Printed on ${escapeHtml(formatDate(new Date()))}</p>
        <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
    w.document.close();
};

// Rows shown in the visit summary for the visit type that was done
const visitDetailRows = (a) => {
    const yn = (v) => (v ? 'Yes' : 'No');
    const rows = [
        ['Visit type', a.visit_type || 'General Checkup'],
        ['Date and time', `${formatDate(a.start_time)}, ${formatTime(a.start_time)} - ${formatTime(a.end_time)}`],
        ['Doctor', `Dr. ${a.doc_first_name || ''} ${a.doc_last_name || ''} (${a.specialization || 'General Physician'})`],
        ['Attendance', a.attendance_status || 'Pending']
    ];
    if (a.visit_type === 'Dental Examination' && a.oral_hygiene) {
        const dmft = (Number(a.caries_count) || 0) + (Number(a.missing_count) || 0) + (Number(a.filled_count) || 0);
        rows.push(['Oral hygiene', a.oral_hygiene]);
        rows.push(['Decayed / Missing / Filled (DMFT)', `${a.caries_count || 0} / ${a.missing_count || 0} / ${a.filled_count || 0} (DMFT ${dmft})`]);
        rows.push(['Gums', a.gum_condition || 'Not noted']);
        rows.push(['Malocclusion', yn(a.malocclusion)]);
        if (a.tooth_notes) rows.push(['Tooth / area notes', a.tooth_notes]);
        if (a.treatment_done) rows.push(['Treatment done', a.treatment_done]);
        if (a.treatment_needed) rows.push(['Treatment needed', a.treatment_needed]);
        if (a.referral_needed) rows.push(['Dental referral', a.referral_to || 'Yes']);
        if (a.next_visit_recommendation) rows.push(['Next visit', a.next_visit_recommendation]);
    } else if (a.visit_type === 'Vision Examination' && a.visual_acuity_left) {
        rows.push(['Visual acuity (uncorrected)', `Left ${a.visual_acuity_left} / Right ${a.visual_acuity_right}`]);
        if (a.va_left_corrected || a.va_right_corrected) rows.push(['Visual acuity (corrected)', `Left ${a.va_left_corrected || '-'} / Right ${a.va_right_corrected || '-'}`]);
        rows.push(['Eyeglasses / contacts', `${yn(a.wears_eyeglasses)} / ${yn(a.wears_contacts)}`]);
        rows.push(['Color vision', a.color_vision || 'Not tested']);
        if (a.eye_findings) rows.push(['Eye findings', a.eye_findings]);
        rows.push(['Recommended action', a.recommended_action || 'No action']);
    } else {
        rows.push(['Clinical findings', a.clinical_findings || '-']);
    }
    rows.push(['Diagnosis', a.diagnosis || '-']);
    rows.push(['Treatment / recommendations', a.treatment_recommendations || '-']);
    if (a.is_abnormal) rows.push(['Result', '<span class="flag">Abnormal finding</span>']);
    if (a.follow_up_needed) rows.push(['Follow-up', '<span class="flag">Follow-up needed</span>']);
    if (a.referral_facility) rows.push(['Referral', `${a.referral_facility} - ${a.referral_reason || ''}`]);
    return rows;
};

export const visitDocumentHtml = (kind, a, issuedBy) => {
    const name = `${a.student_first_name || ''} ${a.student_last_name || ''}`.trim();
    const section = a.program_id ? `${a.program_id} ${a.year_level || ''}${a.section || ''}` : '';
    const doctor = `Dr. ${a.doc_first_name || ''} ${a.doc_last_name || ''}`.trim();
    const visitDate = formatDate(a.start_time);
    const studentLine = `<strong>${escapeHtml(name)}</strong> (Student ID: ${escapeHtml(a.student_id)}${section ? `, ${escapeHtml(section)}` : ''})`;

    const rowsHtml = (rows) => `<table>${rows.map(([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td>${String(v).startsWith('<span class="flag">') ? v : escapeHtml(v)}</td></tr>`).join('')}</table>`;

    if (kind === 'certificate') {
        return `<h2>MEDICAL CERTIFICATE</h2>
            <p>This is to certify that ${studentLine} was seen and examined at the school clinic by <strong>${escapeHtml(doctor)}</strong> on <strong>${escapeHtml(visitDate)}</strong> for a <strong>${escapeHtml(a.visit_type || 'General Checkup')}</strong>.</p>
            <table>
                <tr><th>Diagnosis</th><td>${escapeHtml(a.diagnosis || '-')}</td></tr>
                <tr><th>Recommendations</th><td>${escapeHtml(a.treatment_recommendations || '-')}</td></tr>
                ${a.follow_up_needed ? '<tr><th>Remarks</th><td>Follow-up visit is needed.</td></tr>' : ''}
            </table>
            <p>This certificate is issued upon the request of the student for whatever legal purpose it may serve.</p>
            <div class="sign"><div>${escapeHtml(doctor)}<br/>Attending Doctor</div><div>${escapeHtml(issuedBy || 'School Nurse')}<br/>School Nurse</div></div>`;
    }

    if (kind === 'referral') {
        return `<h2>REFERRAL SLIP</h2>
            <p>Referred to: <strong>${escapeHtml(a.referral_facility || '')}</strong></p>
            <p>Patient: ${studentLine}</p>
            <table>
                <tr><th>Reason for referral</th><td>${escapeHtml(a.referral_reason || '')}</td></tr>
                <tr><th>Visit</th><td>${escapeHtml(a.visit_type || 'General Checkup')} on ${escapeHtml(visitDate)}</td></tr>
                <tr><th>Diagnosis</th><td>${escapeHtml(a.diagnosis || '-')}</td></tr>
                <tr><th>Findings</th><td>${escapeHtml(a.clinical_findings || '-')}</td></tr>
            </table>
            <p>Kindly evaluate and manage the patient. Thank you.</p>
            <div class="sign"><div>${escapeHtml(doctor)}<br/>Referring Doctor</div><div>${escapeHtml(issuedBy || 'School Nurse')}<br/>School Nurse</div></div>`;
    }

    return `<h2>DOCTOR VISIT SUMMARY</h2>
        <p>Patient: ${studentLine}</p>
        ${rowsHtml(visitDetailRows(a))}
        <div class="sign"><div>${escapeHtml(doctor)}<br/>Attending Doctor</div><div>${escapeHtml(issuedBy || 'School Nurse')}<br/>School Nurse</div></div>`;
};
