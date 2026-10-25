// visitPurpose.js
// The purpose of a doctor visit: General Check Up, Dental, Vision or Other (and the purpose has to be specified).
// Follow-up and Referral are created by the system from an earlier visit.

export const PURPOSES = ['General Check Up', 'Dental', 'Vision', 'Other'];

export const visitLabel = (type, other) => {
    const t = type || 'General Check Up';
    return t === 'Other' && other ? `Other: ${other}` : t;
};

// How an appointment came to be, in the words the clinic uses
export const sourceLabel = (source) => {
    if (source === 'Student') return 'Open time block';
    if (source === 'Walk-in') return 'Walk-in';
    return 'Direct appointment';
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
