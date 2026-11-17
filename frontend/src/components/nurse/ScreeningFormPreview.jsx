import React, { useId, useState } from 'react';
import { Hash, Sigma, Type, List, ToggleLeft, TriangleAlert, CircleCheck } from 'lucide-react';
import '../../styles/nurse/ScreeningSetup.css';

export const FIELD_TYPES = [
  { value: 'number', label: 'Number', Icon: Hash },
  { value: 'calculated', label: 'Calculated', Icon: Sigma },
  { value: 'text', label: 'Short text', Icon: Type },
  { value: 'select', label: 'Choice list', Icon: List },
  { value: 'yesno', label: 'Yes / No', Icon: ToggleLeft }
];
export const fieldMeta = (type) => FIELD_TYPES.find((t) => t.value === type) || FIELD_TYPES[0];
export const fieldTypeLabel = (type) => fieldMeta(type).label;

const has = (v) => v !== '' && v !== null && v !== undefined;
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// "Normal 18.5-24.9" / "Abnormal: Poor"; works on server fields and on editor drafts shaped like them
export const rangeText = (f) => {
  if (f.type === 'select' || f.type === 'yesno') {
    const abn = f.abnormal_options || [];
    return abn.length ? `Abnormal: ${abn.join(', ')}` : '';
  }
  if (has(f.min) && has(f.max)) return `Normal ${f.min} to ${f.max}`;
  if (has(f.min)) return `Normal from ${f.min}`;
  if (has(f.max)) return `Normal up to ${f.max}`;
  return '';
};

// the value, result label and abnormal flag of one field for the answers typed so far (answers = { key: text })
export const evalField = (f, fields, answers) => {
  const raw = answers[f.key];
  let value = null;
  if (f.type === 'calculated') {
    let bad = false;
    const expr = String(f.formula || '').replace(/\{([^{}]+)\}/g, (m, name) => {
      const t = fields.find((x) => x.type === 'number' && (x.key === name.trim() || norm(x.label) === norm(name)));
      const v = t ? parseFloat(answers[t.key]) : NaN;
      if (Number.isNaN(v)) bad = true;
      return `(${Number.isNaN(v) ? 0 : v})`;
    });
    if (bad || !expr.trim() || !/^[\d+\-*/().\s]+$/.test(expr)) return { value: null };
    try {
      // eslint-disable-next-line no-new-func
      const r = Function(`"use strict";return (${expr})`)();
      if (!Number.isFinite(r)) return { value: null };
      value = r;
    } catch (e) {
      return { value: null };
    }
  } else if (f.type === 'number') {
    const v = parseFloat(raw);
    if (!Number.isNaN(v)) value = v;
  }
  if (f.type === 'number' || f.type === 'calculated') {
    if (value === null) return { value: null };
    let band = '';
    if (f.type === 'calculated') {
      const dec = Math.min(4, Math.max(0, parseInt(f.decimals, 10) || 0));
      const bands = f.bands || [];
      const hit = bands.find((b) => has(b.upto) && value < Number(b.upto)) || bands.find((b) => !has(b.upto));
      band = hit ? hit.label : '';
      value = Number(value.toFixed(dec));
    }
    const abnormal = (has(f.min) && value < Number(f.min)) || (has(f.max) && value > Number(f.max));
    return { value, band, abnormal: !!abnormal };
  }
  return { value: raw || null, abnormal: !!(raw && (f.abnormal_options || []).includes(raw)) };
};

/** Read-only list of the fields of a form (what the nurse will fill in). */
export function FieldSummary({ fields }) {
  if (!fields || fields.length === 0) return <p className="sx-muted-hs">No fields yet.</p>;
  return (
    <ul className="sx-fsum-hs">
      {fields.map((f) => {
        const { Icon } = fieldMeta(f.type);
        const range = rangeText(f);
        return (
          <li key={f.key}>
            <Icon size={15} aria-hidden="true" />
            <span>
              <strong>{f.label || 'Untitled field'}</strong>
              {f.unit ? <span className="sx-muted-hs"> ({f.unit})</span> : null}
              {f.required ? <span className="sx-req-hs" title="Required"> *</span> : null}
              {range ? <small>{range}</small> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The result form as the nurse sees it. Typing works: formulas, result labels and the abnormal flag update live. */
export function FormPreview({ fields }) {
  const uid = useId();
  const [answers, setAnswers] = useState({});
  const set = (key, value) => setAnswers((cur) => ({ ...cur, [key]: value }));

  if (!fields || fields.length === 0) return <p className="sx-muted-hs">Add a field to see the form.</p>;

  return (
    <div className="sx-pv-list-hs">
      {fields.map((f) => {
        const id = `${uid}-${f.key}`;
        const r = evalField(f, fields, answers);
        const range = f.type === 'number' || f.type === 'calculated' ? rangeText(f) : '';
        const answered = r.value !== null && r.value !== '' && r.value !== undefined;
        return (
          <div className="sx-pf-hs" key={f.key}>
            <label htmlFor={id} className="sx-pf-label-hs">
              {f.label || 'Untitled field'}
              {f.required && <><span className="sx-req-hs" aria-hidden="true"> *</span><span className="sx-sr-hs"> (required)</span></>}
            </label>

            {f.type === 'number' && (
              <div className="sx-unit-wrap-hs">
                <input id={id} type="number" step="any" inputMode="decimal" value={answers[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                <span className="sx-unit-hs">{f.unit}</span>
              </div>
            )}
            {f.type === 'text' && (
              <div className="sx-unit-wrap-hs">
                <input id={id} type="text" value={answers[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />
                <span className="sx-unit-hs">{f.unit}</span>
              </div>
            )}
            {f.type === 'select' && (
              <select id={id} value={answers[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">Select</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {f.type === 'yesno' && (
              <div className="sx-yn-hs" role="radiogroup" aria-label={f.label}>
                {['Yes', 'No'].map((o) => (
                  <label key={o}>
                    <input type="radio" name={id} value={o} checked={answers[f.key] === o} onChange={() => set(f.key, o)} /> {o}
                  </label>
                ))}
              </div>
            )}
            {f.type === 'calculated' && (
              <div className="sx-calc-hs">
                <output id={id}>{r.value === null ? '-' : r.value}</output>
                {f.unit && <span className="sx-unit-hs">{f.unit}</span>}
                {r.band && <span className={`sx-chip-hs ${r.abnormal ? 'sx-crit-hs' : 'sx-ok-hs'}`}>{r.band}</span>}
              </div>
            )}

            {range && <span className="sx-hint-line-hs">{range}</span>}
            <span className="sx-flag-hs" aria-live="polite">
              {r.abnormal && <span className="sx-chip-hs sx-crit-hs"><TriangleAlert size={14} aria-hidden="true" /> Abnormal</span>}
              {!r.abnormal && answered && f.type !== 'text' && <span className="sx-chip-hs sx-ok-hs"><CircleCheck size={14} aria-hidden="true" /> Normal</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
