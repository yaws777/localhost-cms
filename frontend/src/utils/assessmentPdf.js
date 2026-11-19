// assessmentPdf.js
// PDF (print preview) of one assessment, in the clinic report layout of printReport.js (school header, title line, nurse signature)
// with the body laid out like the assessment form. Built from buildAssessmentModel, the same data the on-screen form shows.
// The CSS and the boxed field are shared with every other filled-in form (formDocument.js).
import { openReportWindow, writeHtmlReport, escapeHtml } from './printReport';
import { buildAssessmentModel } from './assessmentModel';
import { FORM_CSS, fieldHtml } from './formDocument';

const field = (label, value) => fieldHtml(label, value);

export const assessmentBodyHtml = (m) => {
    const parts = [];
    parts.push(`<div class="af-card">${m.header.map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('')}</div>`);
    if (m.abnormal) parts.push('<p class="af-flag">The doctor marked this result as needing attention.</p>');

    m.vitals.forEach((g) => {
        parts.push(`<div class="af-section"><h3>${escapeHtml(g.title)}</h3><div class="af-row">${g.items.map((i) => field(`${i.label}${i.unit ? ` (${i.unit})` : ''}`, i.value)).join('')}</div></div>`);
    });
    m.sections.forEach((s) => {
        parts.push(`<div class="af-section"><h3>${escapeHtml(s.title)}</h3>${s.fields.map((f) => field(f.label, f.value)).join('')}</div>`);
    });
    if (m.prescriptions.length > 0 || m.dispensed) {
        parts.push(`<div class="af-section"><h3>Prescription</h3>${m.prescriptions.map((p) => `<div class="af-rx"><div class="af-row">${
            field('Medicine', p.medicine)}${field('Dosage', p.dosage || '')}${field('Frequency', p.frequency || '')}${field('Duration', p.duration || '')}</div>${
            p.instructions ? field('Instructions', p.instructions) : ''}</div>`).join('')}${m.dispensed ? field('Medicine dispensed (time out)', m.dispensed) : ''}</div>`);
    }
    if (m.followUp) {
        parts.push(`<div class="af-section"><h3>Follow-up</h3><p class="af-check">&#9745; Follow-up needed</p>${
            field('Follow-up date', m.followUp.date || 'As soon as possible')}${m.followUp.notes ? field('Follow-up notes', m.followUp.notes) : ''}</div>`);
    }
    if (m.referral) {
        parts.push(`<div class="af-section"><h3>Referral</h3>${field('Refer to', m.referral.facility)}${m.referral.reason ? field('Reason', m.referral.reason) : ''}</div>`);
    }
    if (m.documentedBy) parts.push(`<p class="af-foot">Documented ${escapeHtml(m.documentedBy)}</p>`);
    return parts.join('');
};

// a: the record with the assessment columns | ctx: see buildAssessmentModel | onBlocked: called when the browser blocks the popup
export const printAssessment = (a, ctx, onBlocked) => {
    const win = openReportWindow(onBlocked);
    if (!win) return;
    const m = buildAssessmentModel(a, ctx);
    writeHtmlReport(win, { title: 'Check-up Assessment', bodyHtml: assessmentBodyHtml(m), extraCss: FORM_CSS, fileName: m.fileName });
};
