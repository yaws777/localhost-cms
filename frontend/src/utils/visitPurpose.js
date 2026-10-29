// visitPurpose.js
// The purpose of a doctor visit. The list comes from the specializations (hooks/useSpecializations): every specialization adds its own
// visit type. Follow-up and Referral are created by the system from an earlier visit.

// Visits saved as "Other: ..." before Other was removed still read the same in the history
export const visitLabel = (type, other) => {
    const t = type || 'General Check Up';
    return t === 'Other' && other ? `Other: ${other}` : t;
};

// The example shown in the "reason" box, so it fits the purpose the student picked. A purpose added later falls back to a generic hint.
const REASON_HINTS = [
    [/dent/i, 'e.g. Toothache for 2 days, swollen gums, or a teeth cleaning'],
    [/vision|eye|optom|ophthal/i, 'e.g. Blurry vision when reading the board, eye pain, or a new eyeglass prescription'],
    [/mental|counsel|psych/i, 'e.g. Feeling anxious before exams, trouble sleeping, or I need someone to talk to'],
    [/general/i, 'e.g. Fever and cough for 3 days, a yearly check-up, or a medical certificate']
];
export const reasonPlaceholder = (type) => {
    if (!type) return 'Select the purpose of the consultation first';
    const hint = REASON_HINTS.find(([re]) => re.test(type));
    return hint ? hint[1] : `Describe why you need a ${type} consultation`;
};

// How an appointment came to be, in the words the clinic uses
export const sourceLabel = (source) => {
    if (source === 'Student') return 'By open time slot';
    if (source === 'Walk-in') return 'Walk-in';
    return 'By appointment';
};

export const statusLabel = (status) => status || '';

export const statusClass = (status) => `st-${String(status || '').toLowerCase().replace(/[^a-z]+/g, '-')}`;

// 'YYYY-MM-DD' of a Date in the viewer's local calendar
export const localDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');

// 9:05 -> "9:05 am"
export const time12 = (value) => {
    if (!value) return '';
    const m = /(\d{1,2}):(\d{2})/.exec(String(value).slice(String(value).indexOf(' ') + 1));
    if (!m) return '';
    const h = Number(m[1]);
    return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'pm' : 'am'}`;
};

export const initials = (first, last) => `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';

export const fullName = (first, last) => `${first || ''} ${last || ''}`.trim();
