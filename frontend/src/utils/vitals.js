// vitals.js
// Vital signs of a check-up: the nurse records them at time in (not normal values are flagged, they do not stop the check-up)
// and, optionally, at time out. Same ranges as the server (readVitals in connection.js).
export const VITAL_FIELDS = [
    { key: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', placeholder: '120/80', normal: '90-120 / 60-80' },
    { key: 'temperature', label: 'Temperature', unit: '°C', placeholder: '36.5', normal: '36.1-37.5', min: 36.1, max: 37.5, limit: [30, 45] },
    { key: 'pulse_rate', label: 'Pulse', unit: 'bpm', placeholder: '80', normal: '60-100', min: 60, max: 100, limit: [30, 250] },
    { key: 'respiratory_rate', label: 'Respiratory rate', unit: '/min', placeholder: '16', normal: '12-20', min: 12, max: 20, limit: [8, 60] }
];

export const EMPTY_VITALS = { blood_pressure: '', temperature: '', pulse_rate: '', respiratory_rate: '' };

const BP_NORMAL = { sys: [90, 120], dia: [60, 80] };

// 'normal' | 'abnormal' | 'invalid' | 'empty' for one field
export const vitalState = (key, value) => {
    const v = String(value ?? '').trim();
    if (!v) return 'empty';
    if (key === 'blood_pressure') {
        const m = /^(\d{2,3})\/(\d{2,3})$/.exec(v);
        if (!m) return 'invalid';
        const sys = Number(m[1]);
        const dia = Number(m[2]);
        if (sys <= dia || sys > 260 || dia < 30) return 'invalid';
        return sys < BP_NORMAL.sys[0] || sys > BP_NORMAL.sys[1] || dia < BP_NORMAL.dia[0] || dia > BP_NORMAL.dia[1] ? 'abnormal' : 'normal';
    }
    const f = VITAL_FIELDS.find((x) => x.key === key);
    const n = Number(v);
    if (!f || !Number.isFinite(n) || n < f.limit[0] || n > f.limit[1]) return 'invalid';
    return n < f.min || n > f.max ? 'abnormal' : 'normal';
};

// the fields that are filled and not normal
export const abnormalVitals = (values) => VITAL_FIELDS.filter((f) => vitalState(f.key, values[f.key]) === 'abnormal');

export const hasVitals = (values) => VITAL_FIELDS.some((f) => String(values?.[f.key] ?? '').trim() !== '');

// 'Normal' | 'Not normal' | '' (empty or invalid) for one value
export const vitalStatusLabel = (key, value) => ({ normal: 'Normal', abnormal: 'Not normal' }[vitalState(key, value)] || '');

// { value, status, range } of one reading for read-only forms and PDFs: the value stays alone in its box,
// the status ('Normal' | 'Not normal') and the range ("Range 36.1-37.5 °C") are drawn under it. Empty value: all empty.
export const vitalMeta = (key, value) => {
    const v = String(value ?? '').trim();
    const f = VITAL_FIELDS.find((x) => x.key === key);
    if (!v || !f) return { value: v, status: '', range: '' };
    return { value: v, status: vitalStatusLabel(key, v), range: `Range ${f.normal} ${f.unit}` };
};

// one line: BP 120/80 mmHg (Normal) | 36.5 °C (Normal) | 130 bpm (Not normal) | 16 /min (Normal)
export const vitalsLine = (values) => {
    if (!hasVitals(values)) return '';
    return VITAL_FIELDS.map((f) => {
        const v = String(values[f.key] ?? '').trim();
        if (!v) return null;
        const status = vitalStatusLabel(f.key, v);
        return `${f.key === 'blood_pressure' ? 'BP ' : ''}${v} ${f.unit}${status ? ` (${status})` : ''}`;
    }).filter(Boolean).join(' | ');
};

// the normal ranges as one line, for the printed record
export const vitalsRangeLine = () => VITAL_FIELDS.map((f) => `${f.key === 'blood_pressure' ? 'BP' : f.label} ${f.normal} ${f.unit}`).join(' | ');

// Remarks written from the vital signs (time out): what is not normal, or that everything is normal. Same wording as the screening remarks.
export const vitalsRemarks = (values) => {
    if (!hasVitals(values)) return '';
    const parts = [];
    const bp = String(values.blood_pressure ?? '').trim();
    const m = /^(\d{2,3})\/(\d{2,3})$/.exec(bp);
    if (m && vitalState('blood_pressure', bp) === 'abnormal') {
        const sys = Number(m[1]);
        const dia = Number(m[2]);
        const high = sys > BP_NORMAL.sys[1] || dia > BP_NORMAL.dia[1];
        const low = sys < BP_NORMAL.sys[0] || dia < BP_NORMAL.dia[0];
        parts.push(`${high && low ? 'Out of range' : high ? 'High' : 'Low'} blood pressure (${bp} mmHg)`);
    }
    const wording = { temperature: ['Low temperature', 'Fever'], pulse_rate: ['Low pulse', 'High pulse'], respiratory_rate: ['Low respiratory rate', 'High respiratory rate'] };
    VITAL_FIELDS.filter((f) => f.key !== 'blood_pressure').forEach((f) => {
        const v = String(values[f.key] ?? '').trim();
        if (!v || vitalState(f.key, v) !== 'abnormal') return;
        parts.push(`${wording[f.key][Number(v) < f.min ? 0 : 1]} (${v} ${f.unit})`);
    });
    if (parts.length > 0) return `Not normal: ${parts.join('; ')}.`;
    return VITAL_FIELDS.every((f) => vitalState(f.key, values[f.key]) === 'normal') ? 'All vital signs are normal. In good condition.' : 'Recorded vital signs are normal.';
};

// the vitals of an appointment row (in_* / out_* columns of the doctor visit select)
export const inVitalsOf = (a) => ({
    blood_pressure: a?.in_blood_pressure || '', temperature: a?.in_temperature || '', pulse_rate: a?.in_pulse_rate || '', respiratory_rate: a?.in_respiratory_rate || ''
});
export const outVitalsOf = (a) => ({
    blood_pressure: a?.out_blood_pressure || '', temperature: a?.out_temperature || '', pulse_rate: a?.out_pulse_rate || '', respiratory_rate: a?.out_respiratory_rate || ''
});
