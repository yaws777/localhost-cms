// StudentScreeningHistoryModal.jsx
// Every screening of one student (results, absences), grouped by school year. Trends on top, school year / status chips,
// one card per record with a tile per reading (the result string is split into readings by parseSummary).
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileText, UserX } from 'lucide-react';
import { HsDialog, HsDialogHeader } from './HsDialog';
import { classLabel as classLabelOf } from '../../utils/scheduling';

const ATTENDANCE_LABEL = { ABSENT: 'Absent', CANCELLED: 'Cancelled', PENDING: 'Not documented', PRESENT: 'Present' };
const MISS_LINE = { ABSENT: 'Did not attend', CANCELLED: 'Screening cancelled' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TREND_LABEL = { bmi: 'BMI', weight: 'Weight', bp: 'Blood pressure' };
const isNormalTag = (t) => /^(normal|adequate|pass|passed|none|negative)$/i.test(t);

// "A 1 cm, B 2/3 mmHg (High)" -> split on commas outside brackets
const splitTop = (s) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

const parseToken = (tok) => {
  let rest = tok;
  let tag = '';
  const p = rest.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (p) { rest = p[1]; tag = p[2].trim(); }
  const n = rest.match(/^(.*?)\s+(-?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)(?:\s+(.+))?$/);
  if (n) return { label: n[1], value: n[2], unit: n[3] || '', tag };
  return { label: '', value: rest, unit: '', tag };
};

const metricKey = (label) => {
  if (/^bmi/i.test(label)) return 'bmi';
  if (/^weight/i.test(label)) return 'weight';
  if (/^(bp|blood pressure)/i.test(label)) return 'bp';
  return '';
};

// Systolic + diastolic become one Blood pressure tile
const mergeBp = (items) => {
  const si = items.findIndex((m) => /^systolic/i.test(m.label));
  const di = items.findIndex((m) => /^diastolic/i.test(m.label));
  if (si < 0 || di < 0) return items;
  const s = items[si];
  const d = items[di];
  const tag = [s.tag, d.tag].find((t) => t && !isNormalTag(t)) || s.tag || d.tag;
  const merged = { label: 'Blood pressure', value: `${s.value}/${d.value}`, unit: s.unit, tag };
  return items.map((m, i) => (i === si ? merged : m)).filter((_, i) => i !== di);
};

const parseSummary = (summary) => mergeBp(splitTop(summary || '').map(parseToken)).map((m) => {
  const key = metricKey(m.label);
  const n = key ? Number(String(m.value).split('/')[0]) : NaN;
  return { ...m, key, n: Number.isFinite(n) ? n : null, flagged: !!m.tag && !isNormalTag(m.tag) };
});

const dateParts = (date) => {
  const [y, m, d] = String(date || '').split('T')[0].split('-');
  return y && m && d ? { mo: MONTHS[Number(m) - 1] || '', d: Number(d), y } : null;
};

const Sparkline = ({ points, label }) => {
  const ns = points.map((p) => p.n);
  const lo = Math.min(...ns);
  const hi = Math.max(...ns);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * 72, hi === lo ? 14 : 26 - ((p.n - lo) / span) * 24]);
  const end = xy[xy.length - 1];
  return (
    <svg viewBox="0 0 72 28" role="img" aria-label={label}>
      <polyline points={xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} />
      <circle cx={end[0]} cy={end[1].toFixed(1)} r="3" />
    </svg>
  );
};

const StatusBadge = ({ row }) => {
  if (row.status === 'ok') return <span className="hist-badge-hs ok"><Check size={16} aria-hidden="true" />Normal</span>;
  if (row.status === 'miss') {
    const absent = row.attendance_status === 'ABSENT' || row.attendance_status === 'CANCELLED';
    return (
      <span className="hist-badge-hs miss">
        {absent && <UserX size={16} aria-hidden="true" />}
        {ATTENDANCE_LABEL[row.attendance_status] || 'No result'}
      </span>
    );
  }
  return null;
};

const Tile = ({ m }) => (
  <div className={`hist-tile-hs${m.flagged ? ' bad' : ''}`}>
    {m.label && <dt>{m.label}</dt>}
    <dd>{m.value}{m.unit && <span className="u">{m.unit}</span>}</dd>
    {m.tag && (
      <dd className="tag">
        {m.flagged ? <AlertTriangle size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}{m.tag}
      </dd>
    )}
  </div>
);

export default function StudentScreeningHistoryModal({ student, rows, loading, onClose, zIndex = 1050 }) {
  const [year, setYear] = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const records = useMemo(() => rows.map((r) => ({
    ...r,
    status: !r.summary ? 'miss' : (r.is_abnormal ? 'flag' : 'ok'),
    metrics: r.summary ? parseSummary(r.summary) : []
  })), [rows]);
  const years = useMemo(() => [...new Set(records.map((r) => r.school_year).filter(Boolean))].sort().reverse(), [records]);

  // readings seen at least twice, oldest to newest
  const trends = useMemo(() => {
    const asc = [...records].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return ['bmi', 'weight', 'bp'].map((k) => {
      const pts = [];
      asc.forEach((r) => r.metrics.forEach((m) => { if (m.key === k && m.n !== null) pts.push({ n: m.n, v: m.value, u: m.unit }); }));
      return pts.length >= 2 ? { key: k, pts, last: pts[pts.length - 1], prev: pts[pts.length - 2] } : null;
    }).filter(Boolean);
  }, [records]);

  const inYear = records.filter((r) => year === 'ALL' || r.school_year === year);
  const countOf = (s) => inYear.filter((r) => r.status === s).length;
  const visible = inYear.filter((r) => status === 'ALL' || r.status === status);
  const groups = [...years, ''].map((y) => ({ year: y, items: visible.filter((r) => (r.school_year || '') === y) })).filter((g) => g.items.length > 0);
  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  const classLabel = classLabelOf(student.program_id || student.program_name, student.year_level, student.section);

  const yearChip = (value, label, n) => (
    <button key={value} type="button" className="hist-chip-hs" aria-pressed={year === value} onClick={() => setYear(value)}>
      {label}<span className="n">{n}</span>
    </button>
  );
  const statusChip = (value, label, n, Icon, cls = '') => (
    <button key={value} type="button" className={`hist-chip-hs ${cls}`} aria-pressed={status === value} onClick={() => setStatus(value)}>
      {Icon && <Icon size={16} aria-hidden="true" />}{label}<span className="n">{n}</span>
    </button>
  );

  return (
    <HsDialog onClose={onClose} zIndex={zIndex}>
      <HsDialogHeader
        onClose={onClose}
        sub={<p className="modal-sub-hs"><span className="hist-id-hs">{student.student_id}</span>{classLabel ? ` - ${classLabel}` : ''}{student.graduated_at || student.graduated_school_year ? ` - Graduated${student.graduated_school_year ? ` ${student.graduated_school_year}` : ''}` : ''}</p>}
      >
        Screening records: {name}
      </HsDialogHeader>
      <div className="modal-body-hs hist-body-hs">
        {loading ? <p className="hint-hs" role="status">Loading...</p> : records.length === 0 ? (
          <p className="hint-hs">No screening record yet.</p>
        ) : (
          <>
            {trends.length > 0 && (
              <section className="hist-trends-hs" aria-label="Trends">
                {trends.map((t) => (
                  <div className="hist-trend-hs" key={t.key}>
                    <span className="k">{TREND_LABEL[t.key]}</span>
                    <span className="v">{t.last.v}{t.last.u && <small>{t.last.u}</small>}</span>
                    <Sparkline points={t.pts} label={`${TREND_LABEL[t.key]} over ${t.pts.length} records`} />
                    <span className="was">was {t.prev.v}</span>
                  </div>
                ))}
              </section>
            )}

            <div className="hist-filters-hs">
              <div className="hist-group-hs" role="group" aria-label="School year">
                {yearChip('ALL', 'All years', records.length)}
                {years.map((y) => yearChip(y, y, records.filter((r) => r.school_year === y).length))}
              </div>
              <div className="hist-group-hs" role="group" aria-label="Status">
                {statusChip('ALL', 'All', inYear.length)}
                {statusChip('ok', 'Normal', countOf('ok'), Check, 'is-ok')}
                {statusChip('miss', 'No result', countOf('miss'), UserX, 'is-miss')}
              </div>
            </div>

            {groups.length === 0 ? <p className="hist-empty-hs" role="status">No records</p> : groups.map((g) => (
              <section key={g.year || 'none'} className="hist-year-hs" aria-label={g.year ? `School year ${g.year}` : 'No school year'}>
                <h3 className="hist-year-head-hs">
                  {g.year || 'No school year'}<span className="count">{g.items.length}</span>
                </h3>
                <ul className="hist-list-hs">
                  {g.items.map((h, i) => {
                    const dp = dateParts(h.date);
                    return (
                      <li key={`${h.screening_schedule_id}-${h.screening_type}-${i}`} className={`hist-rec-hs${h.status === 'miss' ? ' is-miss' : ''}`}>
                        <div className="hist-date-hs">
                          {dp ? <><span className="mo">{dp.mo}</span><span className="d">{dp.d}</span><span className="y">{dp.y}</span></> : <span className="mo">-</span>}
                        </div>
                        <div className="hist-main-hs">
                          <div className="hist-top-hs">
                            <div className="hist-title-hs">
                              <h4>{h.title}</h4>
                              <span className="type">{h.screening_type}</span>
                            </div>
                            <StatusBadge row={h} />
                          </div>
                          {h.status === 'miss' ? (
                            <p className="hist-miss-line-hs"><UserX size={16} aria-hidden="true" />{MISS_LINE[h.attendance_status] || 'Not documented'}</p>
                          ) : (
                            <>
                              <dl className="hist-tiles-hs">{h.metrics.map((m, mi) => <Tile key={`${m.label}-${mi}`} m={m} />)}</dl>
                              {h.remarks && <p className="hist-note-hs"><FileText size={16} aria-hidden="true" /><span><b>Remarks</b> {h.remarks}</span></p>}
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
      <div className="modal-footer-hs">
        <button type="button" className="btn-hs btn-secondary-hs" onClick={onClose}>Close</button>
      </div>
    </HsDialog>
  );
}
