// ScreeningImportModal.jsx
// Import the results of one screening from a CSV file.
// Columns: Student ID, Program, Year, Section, then one column per field of the screening form, then Remarks.
// A by-section folder only takes rows whose program, year level and section match the folder; a custom folder
// takes any participant of the screening. Valid rows are saved one by one through POST /api/screenings/:id/document.
import React, { useMemo, useRef, useState } from 'react';
import { Upload, Download, CheckCircle, X, Lock, AlertTriangle } from 'lucide-react';
import { HsDialog, HsDialogHeader } from './HsDialog';

const API_BASE = 'https://localhost-cms.onrender.com/api';
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const digits = (v) => { const m = String(v ?? '').match(/\d+/); return m ? Number(m[0]) : null; };

// one line of text into cells: quoted CSV, or tabs / pipes / semicolons, or plain spaces
const splitLine = (line) => {
  const delim = [',', '\t', '|', ';'].find((d) => line.includes(d));
  if (!delim) return line.trim().split(/\s+/);
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { cells.push(cur.trim()); cur = ''; } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

// the form columns of this screening: [{ key, label, field }]
const formColumns = (schedule) => {
  if (schedule?.form_kind === 'HEARING') {
    return [{ key: 'left_ear_result', label: 'Left ear', options: ['Pass', 'Refer'], required: true }, { key: 'right_ear_result', label: 'Right ear', options: ['Pass', 'Refer'], required: true }];
  }
  return (schedule?.template?.fields || []).filter((f) => f.type !== 'calculated').map((f) => ({
    key: f.key, label: f.label, unit: f.unit, type: f.type, options: f.options, required: !!f.required, min: f.min, max: f.max
  }));
};

const sheetHeader = (cols) => ['Student ID', 'Program', 'Year', 'Section', ...cols.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)), 'Remarks'];

const parseSheet = (text, cols) => {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const names = sheetHeader(cols);
  let order = names.map((_, i) => i); // position of each column in the file
  let start = 0;
  const first = splitLine(lines[0]).map(norm);
  if (first.some((c) => c.includes('student')) || first.includes('id')) {
    start = 1;
    order = names.map((n) => {
      const base = norm(n).replace(/\s*\(.*\)$/, '');
      const at = first.findIndex((c) => c === norm(n) || c.replace(/\s*\(.*\)$/, '') === base);
      return at;
    });
  }
  return lines.slice(start).map((line, i) => {
    const cells = splitLine(line);
    const at = (col) => (order[col] >= 0 ? (cells[order[col]] ?? '') : null);
    const values = {};
    cols.forEach((c, k) => { values[c.key] = at(4 + k); });
    return { n: start + i + 1, id: at(0) || '', program: at(1), year: at(2), section: at(3), values, remarks: at(4 + cols.length) || '' };
  });
};

export default function ScreeningImportModal({ schedule, students, folderLabel, folderClass, programs, senderId, onClose, onDone }) {
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(null);
  const fileRef = useRef(null);
  const cols = useMemo(() => formColumns(schedule), [schedule]);
  const custom = !folderClass || folderClass.custom;

  const programName = (id) => programs.find((p) => p.program_id === id)?.program_name || '';

  const checkRow = (r) => {
    const st = students.find((s) => norm(s.student_id) === norm(r.id));
    if (!r.id) return { ok: false, why: 'No student ID' };
    if (!st) return { ok: false, why: 'Not in this screening' };
    if (!custom) {
      const bad = [];
      const wantProgram = [norm(folderClass.program_id), norm(programName(folderClass.program_id))];
      if (r.program === null || r.year === null || r.section === null || r.program === '' || r.year === '' || r.section === '') {
        return { ok: false, why: `Needs program, year, section of ${folderLabel}` };
      }
      if (!wantProgram.includes(norm(r.program))) bad.push(`program ${r.program}`);
      if (digits(r.year) !== Number(folderClass.year_level)) bad.push(`year ${r.year}`);
      if (norm(r.section) !== norm(folderClass.section)) bad.push(`section ${r.section}`);
      if (bad.length) return { ok: false, why: `Not ${folderLabel}: ${bad.join(', ')}` };
    }
    if (st.attendance_status !== 'PRESENT') return { ok: false, why: 'Not timed in' };
    const formData = { answers: {}, remarks: r.remarks };
    const hearing = {};
    for (const c of cols) {
      const raw = String(r.values[c.key] ?? '').trim();
      if (raw === '') {
        if (c.required) return { ok: false, why: `Missing ${c.label}` };
        continue;
      }
      if (c.options) {
        const hit = c.options.find((o) => norm(o) === norm(raw));
        if (!hit) return { ok: false, why: `${c.label}: ${c.options.join(' / ')}` };
        formData.answers[c.key] = hit;
        hearing[c.key] = hit;
      } else if (c.type === 'number') {
        if (Number.isNaN(Number(raw))) return { ok: false, why: `${c.label} is not a number` };
        formData.answers[c.key] = raw;
      } else formData.answers[c.key] = raw;
    }
    const body = schedule.form_kind === 'HEARING' ? { ...hearing, remarks: r.remarks } : formData;
    const hasOld = !!(st.custom_record_id || st.hearing_record_id);
    return { ok: true, why: hasOld ? 'Updates result' : 'Matches', body, student: st, replaces: hasOld };
  };

  const rows = useMemo(() => parseSheet(text, cols).map((r) => ({ ...r, c: checkRow(r) })), [text, cols, students, folderClass]); // eslint-disable-line react-hooks/exhaustive-deps
  const okRows = rows.filter((r) => r.c.ok);

  const readFile = async (file) => {
    if (file) setText(await file.text());
  };

  const downloadTemplate = () => {
    const header = sheetHeader(cols);
    const sample = students.slice(0, 2).map((s) => [s.student_id, s.program_id, s.year_level, s.section, ...cols.map(() => ''), '']);
    const csv = [header, ...sample].map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'screening_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    let saved = 0;
    const failed = [];
    for (let i = 0; i < okRows.length; i++) {
      const r = okRows[i];
      setProgress(`${i + 1}/${okRows.length}`);
      try {
        const res = await fetch(`${API_BASE}/screenings/${schedule.screening_schedule_id}/document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_id: r.c.student.student_id, screening_type: schedule.screening_type, formData: r.c.body, sender_id: senderId })
        });
        const data = await res.json();
        if (res.ok) saved++; else failed.push(`${r.id}: ${data.error || 'failed'}`);
      } catch (err) {
        failed.push(`${r.id}: no connection`);
      }
    }
    setProgress(null);
    onDone({ saved, rejected: rows.length - okRows.length, failed });
  };

  return (
    <HsDialog onClose={progress ? undefined : onClose} size="lg">
      <HsDialogHeader onClose={progress ? undefined : onClose}>
        Import results <span className="chip-hs chip-info-hs"><Lock size={14} aria-hidden="true" /> {folderLabel}</span>
      </HsDialogHeader>
      <div className="modal-body-hs">
        <div className="imp-bar-hs">
          <input
            ref={fileRef}
            id="hs-import-file"
            className="sr-only-hs"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button type="button" className="btn-hs btn-icon-hs btn-primary-hs" onClick={() => fileRef.current?.click()} aria-label="Choose CSV file" title="Choose CSV file">
            <Upload size={18} aria-hidden="true" />
          </button>
          <button type="button" className="btn-hs btn-icon-hs btn-secondary-hs" onClick={downloadTemplate} aria-label="Download CSV template" title="Download CSV template">
            <Download size={18} aria-hidden="true" />
          </button>
        </div>

        {rows.length > 0 && (
          <>
            <div className="chips-hs">
              <span className="chip-hs chip-ok-hs"><CheckCircle size={14} aria-hidden="true" /> {okRows.length} match</span>
              <span className={`chip-hs ${rows.length - okRows.length ? 'chip-bad-hs' : ''}`}><X size={14} aria-hidden="true" /> {rows.length - okRows.length} rejected</span>
              {!custom && <span className="chip-hs chip-info-hs"><Lock size={14} aria-hidden="true" /> {folderLabel}</span>}
            </div>
            <div className="table-wrapper-hs">
              <table className="table-hs">
                <thead>
                  <tr>
                    <th>Student ID</th><th>Program</th><th>Year</th><th>Section</th>
                    {cols.map((c) => <th key={c.key}>{c.label}</th>)}
                    <th>Check</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.n} className={r.c.ok ? '' : 'imp-rej-hs'}>
                      <td>{r.id}</td><td>{r.program ?? ''}</td><td>{r.year ?? ''}</td><td>{r.section ?? ''}</td>
                      {cols.map((c) => <td key={c.key}>{r.values[c.key] ?? ''}</td>)}
                      <td>
                        <span className={`chip-hs ${r.c.ok ? (r.c.replaces ? 'chip-warn-hs' : 'chip-ok-hs') : 'chip-bad-hs'}`}>
                          {r.c.ok ? <CheckCircle size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />} {r.c.why}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="modal-footer-hs">
        <button type="button" className="btn-hs btn-secondary-hs" onClick={onClose} disabled={!!progress}>Cancel</button>
        <button type="button" className="btn-hs btn-primary-hs" onClick={runImport} disabled={!okRows.length || !!progress} aria-label="Import matching rows" title="Import matching rows">
          <Upload size={16} aria-hidden="true" /> {progress || okRows.length || ''}
        </button>
      </div>
    </HsDialog>
  );
}
