// Philippine-timezone helpers. The app must behave the same regardless of
// the host machine's configured timezone, so any "today"/"this month"
// business logic should derive its calendar date from these helpers
// instead of reading the server process's local clock directly.

const MANILA_TZ = 'Asia/Manila';

// A Date whose getFullYear/getMonth/getDate/getHours (local-timezone)
// getters reflect the current Asia/Manila wall-clock time. Only use this
// for deriving calendar dates/boundaries ("today", "this month") -- it is
// NOT safe to use .getTime() on the result for duration/elapsed-time math.
function nowManila() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: MANILA_TZ }));
}

// "YYYY-MM-DD" for the current Manila calendar day. Built from the LOCAL
// getters of nowManila() (never toISOString/UTC getters, which would
// reintroduce a dependency on the host machine's own timezone).
function todayManilaStr() {
    const d = nowManila();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// "YYYY-MM" for the current Manila calendar month.
function currentMonthManilaStr() {
    return todayManilaStr().slice(0, 7);
}

// Display formatters (always Asia/Manila):
//   date -> "Oct. 22, 2026", time -> "10:00 PM", both -> "Oct. 22, 2026, 10:00 PM"
const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];

function manilaParts(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return null;
    const p = {};
    new Intl.DateTimeFormat('en-US', {
        timeZone: MANILA_TZ, hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(date).forEach((x) => { p[x.type] = Number(x.value); });
    p.hour = p.hour % 24;
    return p;
}

const fmtDate = (p) => `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`;
const fmtTime = (p) => `${p.hour % 12 || 12}:${String(p.minute).padStart(2, '0')} ${p.hour >= 12 ? 'PM' : 'AM'}`;

function formatDateManila(value) {
    const p = manilaParts(value);
    return p ? fmtDate(p) : '';
}

function formatTimeManila(value) {
    const p = manilaParts(value);
    return p ? fmtTime(p) : '';
}

function formatDateTimeManila(value) {
    const p = manilaParts(value);
    return p ? `${fmtDate(p)}, ${fmtTime(p)}` : '';
}

module.exports = {
    nowManila, todayManilaStr, currentMonthManilaStr, MANILA_TZ,
    formatDateManila, formatTimeManila, formatDateTimeManila,
};
