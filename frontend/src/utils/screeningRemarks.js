// Automatic remark and play decision of a screening result. Same rules and wording as buildAutoRemarks /
// evaluateTemplateAnswers on the server (connection.js); the server stores the final text, this one only previews it.
import { calculate } from './formula';

const hasValue = (v) => v !== undefined && v !== null && String(v).trim() !== '';

// numbers (and calculated values) typed so far, by field key, with the band label of calculated fields
export const readValues = (fields, answers) => {
  const values = {};
  const labels = {};
  (fields || []).forEach((f) => {
    if (f.type === 'number') {
      const raw = answers?.[f.key];
      if (hasValue(raw) && Number.isFinite(Number(raw))) values[f.key] = Number(raw);
    } else if (f.type === 'calculated') {
      const c = calculate(f, answers);
      if (c) { values[f.key] = c.value; if (c.label) labels[f.key] = c.label; }
    }
  });
  return { values, labels };
};

// Why the student may not play: a number outside the play range or a blocking choice. { hasRule, blocked, reasons, keys }
export const playDecision = (fields, answers) => {
  const { values } = readValues(fields, answers);
  const reasons = [];
  const keys = [];
  let hasRule = false;
  (fields || []).forEach((f) => {
    if (f.type === 'number' || f.type === 'calculated') {
      if (f.play_min === undefined && f.play_max === undefined) return;
      hasRule = true;
      const v = values[f.key];
      if (v === undefined) return;
      const unit = f.unit ? ` ${f.unit}` : '';
      if (f.play_min !== undefined && v < f.play_min) { reasons.push(`${f.label} ${v}${unit} is below ${f.play_min}`); keys.push(f.key); }
      else if (f.play_max !== undefined && v > f.play_max) { reasons.push(`${f.label} ${v}${unit} is above ${f.play_max}`); keys.push(f.key); }
    } else if ((f.play_block_options || []).length > 0) {
      hasRule = true;
      const v = answers?.[f.key];
      if ((f.play_block_options || []).includes(v)) { reasons.push(`${f.label}: ${v}`); keys.push(f.key); }
    }
  });
  return { hasRule, blocked: reasons.length > 0, reasons, keys };
};

export const bpFieldsOf = (fields) => {
  const pick = (role, re) => (fields || []).find((f) => f.type === 'number' && (f.role === role || (!f.role && re.test(f.label))));
  return { sys: pick('systolic', /systolic/i), dia: pick('diastolic', /diastolic/i) };
};

// Blood pressure reading label: 'Normal' | 'High Blood' | 'Low Blood' (against the normal range of the form's own fields), or '' with no reading
export const bloodPressureLabel = (fields, answers) => {
  const { sys, dia } = bpFieldsOf(fields);
  const { values } = readValues(fields, answers);
  const sv = sys ? values[sys.key] : undefined;
  const dv = dia ? values[dia.key] : undefined;
  if (sv === undefined && dv === undefined) return '';
  const high = (sv !== undefined && sys.max !== undefined && sv > sys.max) || (dv !== undefined && dia.max !== undefined && dv > dia.max);
  const low = (sv !== undefined && sys.min !== undefined && sv < sys.min) || (dv !== undefined && dia.min !== undefined && dv < dia.min);
  return high ? 'High Blood' : low ? 'Low Blood' : 'Normal';
};

// asthma: { has: boolean, triggers: string }
export const buildAutoRemark = (fields, answers, asthma) => {
  const list = fields || [];
  const { values, labels } = readValues(list, answers);
  const lines = [];
  const used = new Set();
  const { sys, dia } = bpFieldsOf(list);
  const sv = sys ? values[sys.key] : undefined;
  const dv = dia ? values[dia.key] : undefined;
  if (sv !== undefined || dv !== undefined) {
    if (sys) used.add(sys.key);
    if (dia) used.add(dia.key);
    lines.push(`Blood pressure ${sv !== undefined ? sv : '?'}/${dv !== undefined ? dv : '?'} mmHg: ${bloodPressureLabel(list, answers)}.`);
  }
  list.forEach((f) => {
    if (used.has(f.key) || (f.type !== 'number' && f.type !== 'calculated')) return;
    const v = values[f.key];
    if (v === undefined) return;
    const unit = f.unit ? ` ${f.unit}` : '';
    const band = labels[f.key] ? ` (${labels[f.key]})` : '';
    if (f.min !== undefined && v < f.min) lines.push(`${f.label} ${v}${unit}: Low${band}.`);
    else if (f.max !== undefined && v > f.max) lines.push(`${f.label} ${v}${unit}: High${band}.`);
    else if (f.min !== undefined || f.max !== undefined) lines.push(`${f.label} ${v}${unit}: Normal${band}.`);
  });
  list.forEach((f) => {
    if (f.type !== 'select' && f.type !== 'yesno') return;
    const v = answers?.[f.key];
    if (hasValue(v) && (f.abnormal_options || []).includes(v)) lines.push(`${f.label}: ${v} (needs attention).`);
  });
  const play = playDecision(list, answers);
  if (play.hasRule && Object.keys(values).length + list.filter((f) => hasValue(answers?.[f.key])).length > 0) {
    lines.push(play.blocked ? `Not allowed to play: ${play.reasons.join('; ')}.` : 'Allowed to play.');
  }
  if (asthma && asthma.has) lines.push(`History of asthma${asthma.triggers ? ` (${asthma.triggers})` : ''}.`);
  return lines.join(' ');
};

// normal-range text of a field with the allowed-to-play range after it
export const playRangeText = (f) => {
  if (f.play_min === undefined && f.play_max === undefined) return '';
  return `${f.play_min !== undefined ? f.play_min : '...'} to ${f.play_max !== undefined ? f.play_max : '...'}${f.unit ? ` ${f.unit}` : ''}`;
};
