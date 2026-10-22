// printReport.js
// One print layout for the clinic reports (Doctor Visits, Health Screening): school header,
// title line, optional detail card, a table and the nurse signature. The page opens the window
// first (so the popup is not blocked), loads its rows, then writes the report into it.
import stiLogo from '../assets/sti-logof.png';
import { formatDate } from './datetime';

export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const REPORT_CSS = `
    body { font-family: Arial, Helvetica, sans-serif; margin: 25px; color: #0f172a; }
    .report-header { display: flex; align-items: center; border-bottom: 2px solid #0056b3; padding-bottom: 12px; margin-bottom: 16px; }
    .report-header img { height: 60px; margin-right: 20px; }
    .report-title h2 { margin: 0; font-size: 20px; color: #1e3a8a; }
    .report-title p { margin: 4px 0 0; font-size: 13px; color: #475569; }
    .meta-info { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 16px; font-weight: 500; }
    .details-card { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 35px; }
    th { background-color: #f1f5f9; color: #0f172a; text-align: left; padding: 9px 10px; border: 1px solid #cbd5e1; font-weight: bold; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .signature-section { margin-top: 40px; font-size: 13px; }
    .signature-title { color: #475569; margin-bottom: 35px; }
    .signature-name { font-weight: bold; font-size: 14px; color: #0f172a; }
    .signature-role { font-style: italic; color: #64748b; }
    .section-heading { font-size: 14px; color: #1e3a8a; margin: 18px 0 8px; page-break-after: avoid; }
    tr { page-break-inside: avoid; }
    @media print { body { margin: 0; } }
`;

// Returns the new window, or null (after calling onBlocked) when the browser blocked the popup
export const openReportWindow = (onBlocked) => {
    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win && onBlocked) onBlocked();
    return win;
};

const detailsBlock = (details) => details.length
    ? `<div class="details-card">${details.map(([k, v]) => `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</div>`).join('')}</div>`
    : '';

const tableBlock = (columns, rows, emptyText) => {
    const rowsHtml = rows.length
        ? rows.map(cells => `<tr>${cells.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}">${escapeHtml(emptyText)}</td></tr>`;
    return `<table>
            <thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>`;
};

// title: shown in capitals above the table | details: [[label, value], ...] | columns: header labels
// rows: arrays of plain-text cells (escaped here)
export const writeReport = (win, { title, details = [], columns, rows, emptyText }) => {
    writeShell(win, title, detailsBlock(details) + tableBlock(columns, rows, emptyText));
};

// Several titled tables in one report: sections = [{ heading, columns, rows, emptyText }]
export const writeSectionedReport = (win, { title, details = [], sections }) => {
    const body = sections
        .map(({ heading, columns, rows, emptyText }) => `<h3 class="section-heading">${escapeHtml(heading)}</h3>${tableBlock(columns, rows, emptyText)}`)
        .join('');
    writeShell(win, title, detailsBlock(details) + body);
};

// school header + title line + body + nurse signature, written into the opened window
const writeShell = (win, title, bodyHtml) => {
    win.document.open();
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title><style>${REPORT_CSS}</style></head><body>
        <div class="report-header">
            <img src="${stiLogo}" alt="STI Logo" />
            <div class="report-title">
                <h2>STI COLLEGE BALIUAG</h2>
                <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan</p>
            </div>
        </div>
        <div class="meta-info">
            <span><strong>${escapeHtml(title.toUpperCase())}</strong></span>
            <span>Date Generated: ${escapeHtml(formatDate(new Date()))}</span>
        </div>
        ${bodyHtml}
        <div class="signature-section">
            <div class="signature-title">Prepared by:</div>
            <div class="signature-name">Marilou H. Balarao</div>
            <div class="signature-role">School Nurse</div>
        </div>
        <script>window.onload = function () { window.print(); };</script>
    </body></html>`);
    win.document.close();
};
