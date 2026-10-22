// Shared date/time formatting — always renders in Philippine time (Asia/Manila),
// regardless of the viewer's device/browser timezone, so timestamps shown in
// the UI stay correct in both development and production.
//
// Output style (used by every module):
//   date      -> "Oct. 22, 2026"
//   time      -> "10:00 PM"          (12-hour, no seconds)
//   date+time -> "Oct. 22, 2026, 10:00 PM"

const MANILA_TZ = 'Asia/Manila';

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_ONLY_RE = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const toDate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date;
};

// Breaks a Date into Manila-time calendar parts.
const manilaParts = (date) => {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone: MANILA_TZ, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', weekday: 'long',
    }).formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour) % 24,
        minute: Number(parts.minute),
        weekday: parts.weekday,
    };
};

const to12Hour = (hour24, minute) => {
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour = hour24 % 12 || 12;
    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const dateFromParts = ({ year, month, day }) => `${MONTHS[month - 1]} ${day}, ${year}`;

// "Thursday, Oct. 22, 2026"
export const formatCurrentDate = (date = new Date()) => {
    const d = toDate(date);
    if (!d) return '';
    const p = manilaParts(d);
    return `${p.weekday}, ${dateFromParts(p)}`;
};

// "Oct. 22, 2026"
export const formatDate = (value) => {
    if (typeof value === 'string') {
        const m = DATE_ONLY_RE.exec(value.trim());
        if (m) return dateFromParts({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) });
    }
    const d = toDate(value);
    return d ? dateFromParts(manilaParts(d)) : '';
};

// "Oct. 22" (no year)
export const formatMonthDay = (value) => {
    const d = toDate(value);
    if (!d) return '';
    const p = manilaParts(d);
    return `${MONTHS[p.month - 1]} ${p.day}`;
};

// "Oct." — short month name only
export const formatMonthShort = (value) => {
    const d = toDate(value);
    return d ? MONTHS[manilaParts(d).month - 1] : '';
};

// "10:00 PM". Also accepts plain time strings such as "13:00" or "13:00:00".
export const formatTime = (value) => {
    if (typeof value === 'string') {
        const m = TIME_ONLY_RE.exec(value.trim());
        if (m) return to12Hour(Number(m[1]) % 24, Number(m[2]));
    }
    const d = toDate(value);
    if (!d) return '';
    const p = manilaParts(d);
    return to12Hour(p.hour, p.minute);
};

// "Oct. 22, 2026, 10:00 PM"
export const formatDateTime = (value) => {
    const d = toDate(value);
    if (!d) return '';
    const p = manilaParts(d);
    return `${dateFromParts(p)}, ${to12Hour(p.hour, p.minute)}`;
};

// "10:00 PM - 11:00 PM"
export const formatTimeRange = (start, end) => {
    const s = formatTime(start);
    const e = formatTime(end);
    if (s && e) return `${s} - ${e}`;
    return s || e;
};
