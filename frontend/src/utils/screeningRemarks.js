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
      if (f.play_min !== undefined && v < f.play_min) { reasons.push(`${f.label} is ${v}${unit}. This is too low to play.`); keys.push(f.key); }
      else if (f.play_max !== undefined && v > f.play_max) { reasons.push(`${f.label} is ${v}${unit}. This is too high to play.`); keys.push(f.key); }
    } else if ((f.play_block_options || []).length > 0) {
      hasRule = true;
      const v = answers?.[f.key];
      if ((f.play_block_options || []).includes(v)) { reasons.push(`${f.label} is ${v}. This is not safe for play.`); keys.push(f.key); }
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

export const PLAY_STATUS_LABELS = { ALLOWED: 'Allowed to Play', RESTRICTED: 'Allowed with Restrictions', NOT_ALLOWED: 'Not Allowed to Play' };

// Clearance decision of a Physical Activities screening from the vitals (play range, readings outside normal) and the health history
// (health = { blockers, restrictions, conditions } the server sends for each participant). Same rules as playClearanceOf on the server.
export const playClearance = (fields, answers, health) => {
  const list = fields || [];
  const { values } = readValues(list, answers);
  const vit = playDecision(list, answers);
  const blockers = [...vit.reasons, ...((health && health.blockers) || [])];
  const restrictions = [...((health && health.restrictions) || [])];
  const { sys, dia } = bpFieldsOf(list);
  const skip = new Set([sys && sys.key, dia && dia.key].filter(Boolean));
  const sv = sys ? values[sys.key] : undefined;
  const dv = dia ? values[dia.key] : undefined;
  const bpBlocked = vit.keys.some((k) => skip.has(k));
  if ((sv !== undefined || dv !== undefined) && !bpBlocked) {
    const label = bloodPressureLabel(list, answers);
    if (label && label !== 'Normal') restrictions.push("Monitor the student's blood pressure during the activity.");
  }
  list.forEach((f) => {
    if (skip.has(f.key) || (f.type !== 'number' && f.type !== 'calculated') || vit.keys.includes(f.key)) return;
    const v = values[f.key];
    if (v === undefined) return;
    if ((f.min !== undefined && v < f.min) || (f.max !== undefined && v > f.max)) {
      restrictions.push(`Monitor the student's ${String(f.label).toLowerCase()} during the activity.`);
    }
  });
  const status = blockers.length > 0 ? 'NOT_ALLOWED' : restrictions.length > 0 ? 'RESTRICTED' : 'ALLOWED';
  return { status, label: PLAY_STATUS_LABELS[status], blockers, restrictions };
};

// ctx = { category: 'GENERAL' | 'PHYSICAL', health: { blockers, restrictions, conditions }, status: chosen decision code or '' (auto) }
// Physical Activities opens the remark with the Allow-to-Play status; every screening ends it with the health history.
export const buildAutoRemark = (fields, answers, ctx = {}) => {
  const list = fields || [];
  const { values, labels } = readValues(list, answers);
  const lines = [];
  const used = new Set();
  const physical = ctx.category === 'PHYSICAL';
  // plain sentences only; a reading that already blocks play is told in the clearance sentences at the end
  const c = physical ? playClearance(list, answers, ctx.health) : null;
  const vit = physical ? playDecision(list, answers) : { keys: [] };
  if (physical) {
    const status = ctx.status && PLAY_STATUS_LABELS[ctx.status] ? ctx.status : c.status;
    lines.push(`Allow-to-Play Status: ${PLAY_STATUS_LABELS[status]}.`);
  }
  const { sys, dia } = bpFieldsOf(list);
  const sv = sys ? values[sys.key] : undefined;
  const dv = dia ? values[dia.key] : undefined;
  if (sv !== undefined || dv !== undefined) {
    if (sys) used.add(sys.key);
    if (dia) used.add(dia.key);
    if (!vit.keys.some((k) => k === (sys && sys.key) || k === (dia && dia.key))) {
      const label = bloodPressureLabel(list, answers);
      if (label === 'High Blood' || label === 'Low Blood') {
        lines.push(`Blood pressure is ${sv !== undefined ? sv : '?'}/${dv !== undefined ? dv : '?'} mmHg. ${label}.`);
      }
    }
  }
  list.forEach((f) => {
    if (used.has(f.key) || (f.type !== 'number' && f.type !== 'calculated') || vit.keys.includes(f.key)) return;
    const v = values[f.key];
    if (v === undefined) return;
    const unit = f.unit ? ` ${f.unit}` : '';
    const state = f.min !== undefined && v < f.min ? 'low' : f.max !== undefined && v > f.max ? 'high' : '';
    if (state) lines.push(`${f.label} is ${v}${unit}. Not normal (${state}${labels[f.key] ? `, ${labels[f.key]}` : ''}).`);
  });
  list.forEach((f) => {
    if (f.type !== 'select' && f.type !== 'yesno') return;
    const v = answers?.[f.key];
    if (hasValue(v) && (f.abnormal_options || []).includes(v)) lines.push(`${f.label} is ${v}. Not normal.`);
  });
  const conditions = (ctx.health && ctx.health.conditions) || [];
  // Physical Activities: only the health history that affects physical activity (already sentences); other screenings list the history
  if (physical) lines.push(...c.blockers, ...c.restrictions);
  else if (conditions.length > 0) lines.push(`Health history: ${conditions.join(', ')}.`);
  return lines.join(' ');
};

// Combined blood pressure input ("120/80") for a form that has a systolic and a diastolic field
export const bpPair = (fields) => {
  const { sys, dia } = bpFieldsOf(fields);
  return sys && dia ? { sys, dia } : null;
};
export const bpText = (answers, pair) => {
  const s = answers?.[pair.sys.key];
  const d = answers?.[pair.dia.key];
  if (!hasValue(s) && !hasValue(d)) return '';
  return `${hasValue(s) ? s : ''}/${hasValue(d) ? d : ''}`;
};
// text typed in the BP box -> { [sysKey]: '120', [diaKey]: '80' }
export const bpParse = (text, pair) => {
  const [s = '', d = ''] = String(text).replace(/[^\d/]/g, '').split('/');
  return { [pair.sys.key]: s.slice(0, 3), [pair.dia.key]: d.slice(0, 3) };
};
export const BP_PATTERN = '\\d{2,3}/\\d{2,3}';

// normal-range text of a field with the allowed-to-play range after it
export const playRangeText = (f) => {
  if (f.play_min === undefined && f.play_max === undefined) return '';
  const unit = f.unit ? ` ${f.unit}` : '';
  if (f.play_min === undefined) return `up to ${f.play_max}${unit}`;
  if (f.play_max === undefined) return `from ${f.play_min}${unit}`;
  return `${f.play_min} to ${f.play_max}${unit}`;
};
