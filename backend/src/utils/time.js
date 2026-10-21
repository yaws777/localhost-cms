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

module.exports = { nowManila, todayManilaStr, currentMonthManilaStr, MANILA_TZ };
