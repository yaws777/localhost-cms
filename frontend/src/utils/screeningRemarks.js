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

// the decision as the first sentence of the remark; PLAY_SENTENCE_RE finds it (or the old "Allow-to-Play Status: ..." line) at the start
export const PLAY_STATUS_SENTENCES = {
  ALLOWED: 'The student is allowed to play.',
  RESTRICTED: 'The student is allowed to play with restrictions.',
  NOT_ALLOWED: 'The student is not allowed to play.',
};
export const PLAY_SENTENCE_RE = /^(?:The student is (?:not )?allowed to play(?: with restrictions)?\.|Allow-to-Play Status: [^.]*\.)/;

// Vital signs that are not normal, as status words only (never the readings): [{ name: 'blood pressure', state: 'high' }].
// blocked = outside the play range (or a blocking choice) -> cannot play; otherwise outside the normal range -> monitor.
const vitalStatesOf = (fields, answers, blocked) => {
  const { values } = readValues(fields, answers);
  const { sys, dia } = bpFieldsOf(fields);
  const isBp = (k) => (sys && sys.key === k) || (dia && dia.key === k);
  const play = playDecision(fields, answers);
  const out = [];
  const add = (key, label, state) => {
    const name = isBp(key) ? 'blood pressure' : String(label).toLowerCase();
    if (!out.some((o) => o.name === name)) out.push({ name, state });
  };
  (fields || []).forEach((f) => {
    const isBlocked = play.keys.includes(f.key);
    if (f.type === 'number' || f.type === 'calculated') {
      const v = values[f.key];
      if (v === undefined) return;
      if (blocked) {
        if (isBlocked) add(f.key, f.label, f.play_min !== undefined && v < f.play_min ? 'low' : 'high');
      } else if (!isBlocked) {
        if (f.min !== undefined && v < f.min) add(f.key, f.label, 'low');
        else if (f.max !== undefined && v > f.max) add(f.key, f.label, 'high');
      }
    } else if (blocked && isBlocked) add(f.key, f.label, 'not safe');
  });
  return out;
};
const vitalList = (states) => states.map((o) => `${o.name} ${o.state}`).join(', ');

// Clearance decision of a Physical Activities screening from the vitals (play range, readings outside normal) and the health history
// (health = { blockers, restrictions, conditions } the server sends for each participant). Same rules as playClearanceOf on the server.
// Vital signs are told by status only (blood pressure high), never by value.
export const playClearance = (fields, answers, health) => {
  const list = fields || [];
  const blockers = [];
  const restrictions = [...((health && health.restrictions) || [])];
  const blockedStates = vitalStatesOf(list, answers, true);
  if (blockedStates.length > 0) blockers.push(`Due to not normal vital signs: ${vitalList(blockedStates)}.`);
  blockers.push(...((health && health.blockers) || []));
  const blockedNames = new Set(blockedStates.map((o) => o.name));
  const monitorStates = vitalStatesOf(list, answers, false).filter((o) => !blockedNames.has(o.name));
  if (monitorStates.length > 0) restrictions.unshift(`Monitor these vital signs during the activity: ${vitalList(monitorStates)}.`);
  const status = blockers.length > 0 ? 'NOT_ALLOWED' : restrictions.length > 0 ? 'RESTRICTED' : 'ALLOWED';
  return { status, label: PLAY_STATUS_LABELS[status], blockers, restrictions };
};

// ctx = { category: 'GENERAL' | 'PHYSICAL', health: { blockers, restrictions, conditions }, status: chosen decision code or '' (auto) }
// Physical Activities: the Allow-to-Play status, then why (Not Allowed: not normal vital signs by status + health history) or what to monitor
// (Restrictions); readings are never written as values. Other screenings list the readings outside normal and end with the health history.
export const buildAutoRemark = (fields, answers, ctx = {}) => {
  const list = fields || [];
  const { values, labels } = readValues(list, answers);
  const lines = [];
  const used = new Set();
  const physical = ctx.category === 'PHYSICAL';
  const play = physical ? playDecision(list, answers) : { keys: [] };
  if (physical) {
    const c = playClearance(list, answers, ctx.health);
    const status = ctx.status && PLAY_STATUS_LABELS[ctx.status] ? ctx.status : c.status;
    lines.push(PLAY_STATUS_SENTENCES[status]);
    if (status === 'NOT_ALLOWED') lines.push(...(c.blockers.length > 0 ? c.blockers : c.restrictions));
    else if (status === 'RESTRICTED') lines.push(...(c.restrictions.length > 0 ? c.restrictions : c.blockers));
  }
  const { sys, dia } = bpFieldsOf(list);
  const sv = sys ? values[sys.key] : undefined;
  const dv = dia ? values[dia.key] : undefined;
  if (!physical && (sv !== undefined || dv !== undefined)) {
    if (sys) used.add(sys.key);
    if (dia) used.add(dia.key);
    const label = bloodPressureLabel(list, answers);
    if (label === 'High Blood' || label === 'Low Blood') {
      lines.push(`Blood pressure is ${sv !== undefined ? sv : '?'}/${dv !== undefined ? dv : '?'} mmHg. ${label}.`);
    }
  }
  if (!physical) {
    list.forEach((f) => {
      if (used.has(f.key) || (f.type !== 'number' && f.type !== 'calculated')) return;
      const v = values[f.key];
      if (v === undefined) return;
      const unit = f.unit ? ` ${f.unit}` : '';
      const state = f.min !== undefined && v < f.min ? 'low' : f.max !== undefined && v > f.max ? 'high' : '';
      if (state) lines.push(`${f.label} is ${v}${unit}. Not normal (${state}${labels[f.key] ? `, ${labels[f.key]}` : ''}).`);
    });
  }
  list.forEach((f) => {
    if (f.type !== 'select' && f.type !== 'yesno') return;
    const v = answers?.[f.key];
    if (hasValue(v) && (f.abnormal_options || []).includes(v) && !play.keys.includes(f.key)) lines.push(`${f.label} is ${v}. Not normal.`);
  });
  const conditions = (ctx.health && ctx.health.conditions) || [];
  if (!physical && conditions.length > 0) lines.push(`Health history: ${conditions.join(', ')}.`);
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
