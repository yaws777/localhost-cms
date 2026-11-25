// screeningHistoryPdf.js
// PDF (print preview) of every screening record of one student (the list in StudentScreeningHistoryModal), grouped by
// school year: one block per screening with a box per reading and the remarks. Same school header, boxed fields and
// nurse signature as the other filled-in forms (formDocument.js / printReport.js).
import { openReportWindow, writeHtmlReport, escapeHtml } from './printReport';
import { FORM_CSS, fieldHtml } from './formDocument';
import { dayText } from './formModels';
import { flaggedText } from './vitals';

const HISTORY_CSS = `
    .sh-year { font-size: 13px; letter-spacing: 0.8px; text-transform: uppercase; color: #1e3a8a; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1e3a8a; page-break-after: avoid; }
    .sh-rec { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px 2px; margin: 0 0 12px; page-break-inside: avoid; }
    .sh-rec.sh-miss { border-style: dashed; }
    .sh-top { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    .sh-top h4 { margin: 0; font-size: 14px; color: #0f172a; }
    .sh-top .sh-sub { font-size: 12px; color: #475569; }
    .sh-top .sh-date { font-size: 12px; font-weight: bold; white-space: nowrap; }
    .sh-badge { display: inline-block; font-size: 11px; font-weight: bold; border: 1px solid #94a3b8; border-radius: 10px; padding: 1px 8px; margin-top: 3px; }
    .sh-badge.sh-bad { border-color: #b91c1c; color: #b91c1c; }
    .sh-bad-val .af-value { border-color: #b91c1c; color: #b91c1c; font-weight: bold; }
`;

const has = (v) => v !== null && v !== undefined && v !== '';

// n: { student, studentId, classText, filterText, groups: [{ year, items: [{ title, type, date, attendance, missed, abnormal, results, metrics, remarks }] }] }
const bodyHtml = (n) => {
    const total = n.groups.reduce((sum, g) => sum + g.items.length, 0);
    const header = [
        ['Student', n.student], ['Student ID', n.studentId], ['Program / Year / Section', n.classText],
        ['Records', n.filterText ? `${total} (${n.filterText})` : String(total)]
    ].filter(([, v]) => has(v));
    const parts = [`<div class="af-card">${header.map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('')}</div>`];

    n.groups.forEach((g) => {
        parts.push(`<h3 class="sh-year">${escapeHtml(g.year ? `School Year ${g.year}` : 'No school year')} (${g.items.length})</h3>`);
        g.items.forEach((r) => {
            const status = r.missed ? r.attendance || 'No result' : (r.abnormal ? flaggedText(r.results) || 'Not normal' : 'Normal');
            const readings = r.metrics.map((m) => {
                const text = `${m.value}${m.unit ? ` ${m.unit}` : ''}${m.tag ? ` (${m.tag})` : ''}`;
                return `<div class="${m.flagged ? 'sh-bad-val' : ''}">${fieldHtml(m.label || 'Result', text)}</div>`;
            }).join('');
            parts.push(`<div class="sh-rec${r.missed ? ' sh-miss' : ''}">
                <div class="sh-top">
                    <div><h4>${escapeHtml(r.title)}</h4><div class="sh-sub">${escapeHtml(r.type)}</div>
                        <span class="sh-badge${!r.missed && r.abnormal ? ' sh-bad' : ''}">${escapeHtml(status)}</span></div>
                    <div class="sh-date">${escapeHtml(dayText(r.date))}</div>
                </div>
                ${r.missed
        ? fieldHtml('Result', r.missedLine || 'No result was recorded.')
        : `<div class="af-row">${readings}</div>${r.remarks ? fieldHtml('Remarks', r.remarks) : ''}`}
            </div>`);
        });
    });
    return parts.join('');
};

// n: see above | onBlocked: called when the browser blocks the popup
export const printScreeningHistory = (n, onBlocked) => {
    const win = openReportWindow(onBlocked);
    if (!win) return;
    writeHtmlReport(win, {
        title: 'Health Screening Records',
        bodyHtml: bodyHtml(n),
        extraCss: FORM_CSS + HISTORY_CSS,
        fileName: `Screening Records ${n.studentId || ''} ${n.student || ''}`.trim()
    });
};
