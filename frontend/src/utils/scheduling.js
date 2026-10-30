// scheduling.js
// Shared by the nurse and the doctor scheduling screens (one interface, one set of rules) and the student booking page.

export const API = 'http://localhost:3001';

// A schedule is a session with a queue: the nurse accepts the students who asked for a place in its listing (they get a queue number) and the only
// switch is allow_walk_in. What is categorized is HOW A STUDENT GOT IN, from doctor_appointments.booking_source:
//   Nurse | Doctor -> accepted / appointed into the listed queue, Walk-in -> walk-in lane.
export const SCHEDULING_WAYS = {
    appointment: { label: 'Accepted from the listing', short: 'Appointed', cls: 'type-appointment-sc' },
    walk_in: { label: 'Walk-in', short: 'Walk-in', cls: 'type-walkin-sc' }
};
export const SCHEDULING_WAY_KEYS = Object.keys(SCHEDULING_WAYS);
export const wayOf = (bookingSource) => (bookingSource === 'Walk-in' ? 'walk_in' : 'appointment');

const on = (v) => v === true || Number(v) === 1;
export const hasWalkIn = (s) => on(s && s.allow_walk_in);
// every schedule has time slots now; kept so older call sites read the same
export const hasSlots = () => true;

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---- who covers which check-up (the server sends allowed_visit_types / covered_visit_types and is the one that enforces it) ----
// allowed: what the doctor's specialization can take (General Check Up + the visit type the specialization adds)
// covered: what the doctor chose to take from that (everything allowed until they narrow it down in My Profile)
export const GENERAL_VISIT_TYPE = 'General Check Up';
const SYSTEM_VISIT_TYPES = ['Follow-up', 'Referral'];

export const allowedTypes = (doctor) => (doctor && doctor.allowed_visit_types) || [GENERAL_VISIT_TYPE];
export const coveredTypes = (doctor) => (doctor && doctor.covered_visit_types) || [GENERAL_VISIT_TYPE];

// Why a doctor cannot take a visit type, or '' when they can
export const visitRefusal = (doctor, visitType) => {
    if (!doctor || !visitType || visitType === 'Any' || SYSTEM_VISIT_TYPES.includes(visitType)) return '';
    if (!allowedTypes(doctor).includes(visitType)) return `${doctor.specialization || 'This doctor'} cannot take ${visitType} check-ups.`;
    if (!coveredTypes(doctor).includes(visitType)) return `This doctor does not cover ${visitType} check-ups.`;
    return '';
};

export const doctorOffers = (doctor, visitType) => !visitRefusal(doctor, visitType);
export const eligibleDoctors = (doctors, visitType) => doctors.filter((d) => doctorOffers(d, visitType));

// What a doctor covers, in words
export const coverageLabel = (doctor) => coveredTypes(doctor).join(', ');

// ---- check-up request statuses ----
export const REQUEST_STATUS_CLASS = {
    'Waiting for Approval': 'badge-pending-ds',
    'Waiting List': 'badge-expired-ds',
    'Awaiting Reconfirmation': 'badge-pending-ds',
    'Reconfirmed': 'badge-open-ds',
    'Appointed': 'badge-open-ds',
    'Booked': 'badge-open-ds',
    'Fulfilled': 'badge-open-ds',
    'Missed': 'badge-closed-ds',
    'Denied': 'badge-closed-ds',
    'Withdrawn': 'badge-closed-ds'
};

// ---- dates and times ----
export const pad2 = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export const parseDay = (str) => new Date(`${str}T00:00:00`);
export const addDays = (str, n) => { const d = parseDay(str); d.setDate(d.getDate() + n); return dateKey(d); };
export const dayOfWeek = (str) => parseDay(str).getDay();

export const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
export const to12h = (t) => {
    if (!t) return '';
    const [h, m] = String(t).slice(t.length > 8 ? 11 : 0).split(':').map(Number);
    if (Number.isNaN(h)) return '';
    return `${h % 12 || 12}:${pad2(m || 0)} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const timeRange = (start, end) => `${to12h(start)} - ${to12h(end)}`;

export const dayLabel = (str, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
    (str ? parseDay(str).toLocaleDateString('en-PH', opts) : '');

export const minutesBetween = (start, end) => {
    const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m; };
    return toMin(end) - toMin(start);
};

// The next dates a schedule runs on (for picking a session day)
export const upcomingDates = (schedule, count = 8) => {
    const today = todayKey();
    const dates = [];
    if (schedule.recurrence === 'Once') {
        if (schedule.schedule_date >= today) dates.push(schedule.schedule_date);
        return dates;
    }
    const from = schedule.valid_from > today ? schedule.valid_from : today;
    for (let d = from; d <= schedule.valid_until && dates.length < count; d = addDays(d, 1)) {
        if (dayOfWeek(d) === Number(schedule.day_of_week)) dates.push(d);
    }
    return dates;
};

// Has this session day already finished? Past sessions are closed for booking, appointing and walk-ins.
export const sessionEnded = (schedule, dateStr) => {
    if (dateStr < todayKey()) return true;
    if (dateStr > todayKey()) return false;
    const now = new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}` >= hhmm(schedule.end_time);
};
