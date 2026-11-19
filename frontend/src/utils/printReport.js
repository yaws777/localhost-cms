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
    .record-block { page-break-inside: avoid; margin-bottom: 18px; }
    .record-block h4 { font-size: 13px; color: #1e3a8a; margin: 0 0 6px; }
    .record-block table { margin-bottom: 0; }
    .record-form { page-break-inside: auto; }
    .record-block th { width: 30%; }
    .record-block td { white-space: pre-line; }
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
// editable: the report opens as a page the nurse can edit (click any text) and prints with the Print button, no auto print
export const writeSectionedReport = (win, { title, details = [], sections, editable = false }) => {
    const body = sections
        .map(({ heading, columns, rows, emptyText }) => `<h3 class="section-heading">${escapeHtml(heading)}</h3>${tableBlock(columns, rows, emptyText)}`)
        .join('');
    writeShell(win, title, detailsBlock(details) + body + (editable ? REMARKS_BLOCK : ''), '', '', editable);
};

// List table plus the full content of every record (label / value block each):
// records = [{ heading, rows: [[label, value], ...] }] or [{ heading, html }] (a ready-made filled-in form, with its CSS in extraCss)
export const writeDetailedReport = (win, { title, details = [], columns, rows, emptyText, recordsHeading = 'Record Details', records = [], extraCss = '' }) => {
    const blocks = records.map(({ heading, rows: pairs, html }) => (html
        ? `<div class="record-block record-form"><h4>${escapeHtml(heading)}</h4>${html}</div>`
        : `<div class="record-block"><h4>${escapeHtml(heading)}</h4><table><tbody>${
            pairs.map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('')
        }</tbody></table></div>`)).join('');
    const detailsHtml = records.length ? `<h3 class="section-heading">${escapeHtml(recordsHeading)}</h3>${blocks}` : '';
    writeShell(win, title, detailsBlock(details) + tableBlock(columns, rows, emptyText) + detailsHtml, extraCss);
};

// A report whose body is ready-made HTML (the assessment form): same header, title line and nurse signature, plus extra CSS
export const writeHtmlReport = (win, { title, bodyHtml, extraCss = '', fileName }) => writeShell(win, title, bodyHtml, extraCss, fileName);

// school header + title line + body + nurse signature, written into the opened window
const EDIT_CSS = `
    .edit-bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; margin: -25px -25px 16px; padding: 8px 25px; background: #1e3a8a; color: #ffffff; font-size: 14px; }
    .edit-bar button { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; border: 0; border-radius: 6px; background: #ffffff; color: #1e3a8a; cursor: pointer; }
    .edit-bar button:hover { background: #dbeafe; }
    .edit-bar button:focus-visible { outline: 3px solid #ffffff; outline-offset: 2px; }
    .edit-bar { flex-wrap: wrap; }
    .edit-bar .sep { width: 1px; align-self: stretch; background: rgba(255,255,255,0.4); margin: 4px 2px; }
    .edit-bar svg { flex: none; }
    .edit-bar .edit-hint { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
    #report:focus { outline: none; }
    #report th, #report td, #report h3, #report .details-card div, #report .report-title h2, #report .report-title p, #report .meta-info span { outline: 1px dashed #7aa2d6; outline-offset: -2px; cursor: text; }
    #report th:hover, #report td:hover, #report h3:hover, #report .details-card div:hover, #report .report-title h2:hover, #report .report-title p:hover, #report .meta-info span:hover { background: #eef5ff; outline-color: #0056b3; }
    #report th:focus, #report td:focus, #report h3:focus, #report .details-card div:focus, #report .report-title h2:focus, #report .report-title p:focus, #report .meta-info span:focus { outline: 2px solid #0056b3; background: #dbeafe; }
    .remarks-box { min-height: 130px; padding: 10px 12px; border: 1px solid #94a3b8; border-radius: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; background: #eef5ff; cursor: text; }
    .remarks-box:focus { outline: 2px solid #0056b3; }
    .remarks-box:empty:before { content: attr(data-placeholder); color: #64748b; }
    .remarks-block { page-break-inside: avoid; }
    @media print {
        .edit-bar { display: none; }
        #report th, #report td, #report h3, #report .details-card div, #report .report-title h2, #report .report-title p, #report .meta-info span { outline: none; background: transparent; }
        .remarks-box { background: transparent; border-color: #cbd5e1; }
        .remarks-box:empty:before { content: ''; }
    }
`;

const REMARKS_BLOCK = '<div class="remarks-block"><h3 class="section-heading">Remarks and observations</h3><div class="remarks-box" data-placeholder="Click here to type your remarks, observations or opinion"></div></div>';

const PENCIL_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

const PRINT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

const toolIcon = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const toolButton = (act, label, inner) => `<button type="button" data-act="${act}" aria-label="${label}" title="${label}">${toolIcon(inner)}</button>`;
const TABLE_TOOLS = '<span class="sep"></span>'
    + toolButton('addCol', 'Add column right of the selected cell', '<rect x="2" y="3" width="11" height="18" rx="1"/><path d="M18 9v6M15 12h6"/>')
    + toolButton('delCol', 'Delete the selected column', '<rect x="2" y="3" width="11" height="18" rx="1"/><path d="M15 12h6"/>')
    + toolButton('addRow', 'Add row below the selected cell', '<rect x="3" y="2" width="18" height="11" rx="1"/><path d="M12 17v6M9 20h6"/>')
    + toolButton('delRow', 'Delete the selected row', '<rect x="3" y="2" width="18" height="11" rx="1"/><path d="M9 20h6"/>')
    + '<span class="sep"></span>';

// Runs inside the report window (injected as text): remarks placeholder + add / delete column and row on the cell last clicked
const initEditor = () => {
    const report = document.getElementById('report');
    let cell = null;

    document.querySelectorAll('.remarks-box').forEach((box) => {
        box.addEventListener('input', () => { if (!box.textContent.trim()) box.innerHTML = ''; });
    });

    document.addEventListener('selectionchange', () => {
        const sel = document.getSelection();
        const node = sel && sel.anchorNode;
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        const found = el && el.closest ? el.closest('td, th') : null;
        if (found && report.contains(found)) cell = found;
    });

    const isSpan = (row) => row.cells.length === 1 && row.cells[0].colSpan > 1;
    const pick = () => {
        if (!cell || !cell.isConnected) { window.alert('Click a table cell first.'); return null; }
        if (isSpan(cell.parentElement)) { window.alert('No data in this row. Pick another cell.'); return null; }
        return cell;
    };
    const focusCell = (target) => {
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = document.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    };
    const makeCell = (tag, html) => {
        const el = document.createElement(tag);
        el.innerHTML = html;
        return el;
    };

    const actions = {
        addCol() {
            const c = pick(); if (!c) return;
            const table = c.closest('table');
            const at = c.cellIndex + 1;
            Array.from(table.rows).forEach((row) => {
                if (isSpan(row)) { row.cells[0].colSpan += 1; return; }
                const head = row.parentElement.tagName === 'THEAD';
                row.insertBefore(makeCell(head ? 'th' : 'td', head ? 'New column' : '<br>'), row.cells[at] || null);
            });
            const added = c.parentElement.cells[at];
            if (added) focusCell(added);
        },
        delCol() {
            const c = pick(); if (!c) return;
            const table = c.closest('table');
            if (table.rows[0].cells.length <= 1) { window.alert('A table needs at least one column.'); return; }
            if (!window.confirm('Delete this column?')) return;
            const at = c.cellIndex;
            Array.from(table.rows).forEach((row) => {
                if (isSpan(row)) { row.cells[0].colSpan -= 1; return; }
                row.deleteCell(at);
            });
            cell = null;
        },
        addRow() {
            const c = pick(); if (!c) return;
            const row = c.parentElement;
            const table = c.closest('table');
            const tr = document.createElement('tr');
            for (let i = 0; i < table.rows[0].cells.length; i += 1) tr.appendChild(makeCell('td', '<br>'));
            const body = table.tBodies[0];
            if (row.parentElement.tagName === 'THEAD') body.insertBefore(tr, body.rows[0] || null);
            else row.after(tr);
            focusCell(tr.cells[0]);
        },
        delRow() {
            const c = pick(); if (!c) return;
            const row = c.parentElement;
            const table = c.closest('table');
            if (row.parentElement.tagName === 'THEAD') { window.alert('Pick a data row, not the heading.'); return; }
            if (!window.confirm('Delete this row?')) return;
            const body = row.parentElement;
            row.remove();
            if (!body.rows.length) {
                const tr = document.createElement('tr');
                const td = makeCell('td', 'No records.');
                td.colSpan = table.rows[0].cells.length;
                tr.appendChild(td);
                body.appendChild(tr);
            }
            cell = null;
        }
    };

    document.querySelectorAll('[data-act]').forEach((button) => {
        button.addEventListener('click', () => actions[button.dataset.act]());
    });
};

const writeShell = (win, title, bodyHtml, extraCss = '', fileName = '', editable = false) => {
    win.document.open();
    win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(fileName || title)}</title><style>${REPORT_CSS}${extraCss}${editable ? EDIT_CSS : ''}</style></head><body>
        ${editable ? `<div class="edit-bar" role="toolbar"><button type="button" onclick="window.print()" aria-label="Print or save as PDF" title="Print or save as PDF">${PRINT_ICON}</button>${TABLE_TOOLS}<span class="edit-hint">${PENCIL_ICON}Click a cell to edit, then add or delete a column or row</span></div><div id="report" contenteditable="true" spellcheck="false">` : ''}
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
        ${editable ? `</div><script>(${initEditor.toString()})();</script>` : '<script>window.onload = function () { window.print(); };</script>'}
    </body></html>`);
    win.document.close();
};
