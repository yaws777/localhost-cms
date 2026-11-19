// formDocument.js
// One PDF (print preview) layout for every filled-in clinic form: clinic visit, medicine dispensed, incident report,
// health screening and the doctor's assessment. The body is laid out like the form itself (section titles, boxed fields),
// inside the clinic report shell of printReport.js (school header, title line, nurse signature "Marilou H. Balarao").
//
// A form is described as a model, built by utils/formModels.js (or assessmentModel.js), and read by both this PDF and the
// on-screen read-only form (components/common/FormDocument.jsx), so the screen and the PDF always match:
//   { title, fileName, header: [[label, value]], flag, sections: [{ title, cols, fields: [{ label, value, wide, area }] }], foot }
import { openReportWindow, writeHtmlReport, escapeHtml } from './printReport';

export const FORM_CSS = `
    .af-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 13px; }
    .af-flag { color: #b91c1c; font-weight: bold; margin: 0 0 12px; font-size: 13px; }
    .af-section { margin: 0 0 14px; }
    .af-section h3 { font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; color: #1e3a8a; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; page-break-after: avoid; }
    .af-field { margin: 0 0 10px; page-break-inside: avoid; }
    .af-field .af-label { display: block; font-size: 11px; font-weight: bold; color: #0f172a; margin-bottom: 3px; }
    .af-field .af-value { border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px 10px; font-size: 13px; min-height: 18px; white-space: pre-line; }
    .af-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0 12px; }
    .af-grid { display: grid; grid-template-columns: repeat(var(--c, 2), minmax(0, 1fr)); gap: 0 12px; }
    .af-grid .af-wide { grid-column: 1 / -1; }
    .af-rx { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 10px 0; margin-bottom: 10px; page-break-inside: avoid; }
    .af-check { font-size: 13px; margin: 0 0 8px; }
    .af-foot { font-size: 11px; color: #475569; margin: 8px 0 0; }
`;

export const fieldHtml = (label, value, wide = false) => `<div class="af-field${wide ? ' af-wide' : ''}"><span class="af-label">${escapeHtml(label)}</span><div class="af-value">${escapeHtml(value)}</div></div>`;

// the body of the PDF for a model made of sections of fields
export const formBodyHtml = (m) => {
    const parts = [];
    if (m.header && m.header.length > 0) {
        parts.push(`<div class="af-card">${m.header.map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('')}</div>`);
    }
    if (m.flag) parts.push(`<p class="af-flag">${escapeHtml(m.flag)}</p>`);
    (m.sections || []).filter((s) => s.fields.length > 0).forEach((s) => {
        parts.push(`<div class="af-section"><h3>${escapeHtml(s.title)}</h3><div class="af-grid" style="--c:${s.cols || 2}">${
            s.fields.map((f) => fieldHtml(f.label, f.value, f.wide)).join('')}</div></div>`);
    });
    if (m.foot) parts.push(`<p class="af-foot">${escapeHtml(m.foot)}</p>`);
    return parts.join('');
};

// model: see the top of the file | onBlocked: called when the browser blocks the popup
export const printFormDocument = (model, onBlocked) => {
    const win = openReportWindow(onBlocked);
    if (!win) return;
    writeHtmlReport(win, { title: model.title, bodyHtml: formBodyHtml(model), extraCss: FORM_CSS, fileName: model.fileName });
};
