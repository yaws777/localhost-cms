// Formula of a calculated field of a screening form template. Same grammar as the server (compileFormula in connection.js):
// numbers, {f1}-style field keys, + - * / and brackets. The server computes the stored value again; this one only previews it.
export const compileFormula = (src) => {
  const text = String(src || '');
  const tokens = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|\{(f\d{1,3})\}|([-+*/()]))/y;
  let pos = 0;
  while (pos < text.length && text.slice(pos).trim() !== '') {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) return { error: 'it has something that is not a number, field, + - * / or bracket.' };
    pos = re.lastIndex;
    if (m[1] !== undefined) tokens.push({ n: Number(m[1]) });
    else if (m[2]) tokens.push({ k: m[2] });
    else tokens.push({ o: m[3] });
  }
  if (tokens.length === 0) return { error: 'it is empty.' };
  let i = 0;
  const keys = new Set();
  const isOp = (...ops) => tokens[i] && ops.includes(tokens[i].o);
  const factor = () => {
    const t = tokens[i++];
    if (!t) throw new Error('it ends too early.');
    if (t.n !== undefined) return () => t.n;
    if (t.k) { keys.add(t.k); return (v) => (typeof v[t.k] === 'number' ? v[t.k] : NaN); }
    if (t.o === '-') { const inner = factor(); return (v) => -inner(v); }
    if (t.o === '(') {
      const inner = expr();
      if (!isOp(')')) throw new Error('a bracket is not closed.');
      i++;
      return inner;
    }
    throw new Error('check the order of the numbers and signs.');
  };
  const term = () => {
    let left = factor();
    while (isOp('*', '/')) {
      const op = tokens[i++].o; const l = left; const r = factor();
      left = op === '*' ? (v) => l(v) * r(v) : (v) => l(v) / r(v);
    }
    return left;
  };
  const expr = () => {
    let left = term();
    while (isOp('+', '-')) {
      const op = tokens[i++].o; const l = left; const r = term();
      left = op === '+' ? (v) => l(v) + r(v) : (v) => l(v) - r(v);
    }
    return left;
  };
  try {
    const fn = expr();
    if (i < tokens.length) throw new Error('check the order of the numbers and signs.');
    return { keys: [...keys], run: (values) => { const out = fn(values); return Number.isFinite(out) ? out : null; } };
  } catch (e) {
    return { error: e.message };
  }
};

// the label of the band a value falls in (bands go up by limit; the last one may have no limit)
export const bandLabelOf = (bands, value) => {
  for (const b of bands || []) {
    if (b.upto === null || b.upto === undefined || value < b.upto) return b.label;
  }
  return null;
};

// Value (and band label) of a calculated field from the answers typed so far: { value, label } or null
export const calculate = (field, answers) => {
  const compiled = compileFormula(field.formula);
  if (compiled.error) return null;
  const numbers = {};
  Object.entries(answers || {}).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v))) numbers[k] = Number(v);
  });
  const raw = compiled.run(numbers);
  if (raw === null) return null;
  const value = Number(raw.toFixed(field.decimals ?? 1));
  return { value, label: bandLabelOf(field.bands, value) };
};
