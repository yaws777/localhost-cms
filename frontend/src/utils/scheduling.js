// scheduling.js
// Shared by the nurse and the doctor scheduling screens (one interface, one set of rules) and the student booking page.

export const API = 'http://localhost:3001';

// The three ways a consultation session can be scheduled
export const SCHEDULE_TYPES = {
    'Appointment': {
        label: 'Appointment',
        short: 'Staff appoint students',
        text: 'The nurse or doctor picks the students (usually from the waiting list) and gives each a time. Walk-ins are still accepted, but appointments come first.',
        cls: 'type-appointment-sc'
    },
    'Open Slot': {
        label: 'Open slot booking',
        short: 'Students book a time block',
        text: 'Students pick a time block themselves. A booking waits for approval from the nurse or doctor, unless you turn on auto-confirm. Walk-ins are still accepted.',
        cls: 'type-open-sc'
    },
    'Walk-in': {
        label: 'Pure walk-in',
        short: 'Announcement only',
        text: 'Just an announcement that the doctor is available. Students come in without a booking and the time can still be extended.',
        cls: 'type-walkin-sc'
    }
};
export const SCHEDULE_TYPE_KEYS = Object.keys(SCHEDULE_TYPES);
export const typeLabel = (type) => (SCHEDULE_TYPES[type] ? SCHEDULE_TYPES[type].label : type || 'Open slot booking');

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---- who can take which check-up (mirrors the server; the server is the one that enforces it) ----
const SPECIALIZATION_RULES = {
    Dental: /dent/i,
    Vision: /optom|ophthal|eye|vision/i
};

const parseServices = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try { const list = JSON.parse(value); return Array.isArray(list) ? list : null; } catch (e) { return null; }
    }
    return null;
};

export const servicesOf = (doctor) => parseServices(doctor && doctor.services_offered);

export const specializationFits = (doctor, visitType) => {
    const rule = SPECIALIZATION_RULES[visitType];
    return !rule || rule.test((doctor && doctor.specialization) || '');
};

// Why a doctor cannot take a visit type, or '' when they can
export const visitRefusal = (doctor, visitType) => {
    if (!doctor || !visitType || visitType === 'Any') return '';
    if (!specializationFits(doctor, visitType)) {
        return visitType === 'Dental' ? 'Only a dentist can take Dental visits.' : 'Only an optometrist or ophthalmologist can take Vision visits.';
    }
    if (visitType === 'Follow-up' || visitType === 'Referral') return '';
    const services = servicesOf(doctor);
    if (services && services.length > 0 && !services.includes(visitType)) return `This doctor does not offer ${visitType} check-ups.`;
    return '';
};

export const doctorOffers = (doctor, visitType) => !visitRefusal(doctor, visitType);
export const eligibleDoctors = (doctors, visitType) => doctors.filter((d) => doctorOffers(d, visitType));

// What a doctor covers, in words (the services list, or what the specialization allows)
export const coverageLabel = (doctor) => {
    const services = servicesOf(doctor);
    if (services && services.length > 0) return services.join(', ');
    const parts = ['General Check Up', 'Other'];
    if (specializationFits(doctor, 'Dental')) parts.splice(1, 0, 'Dental');
    if (specializationFits(doctor, 'Vision')) parts.splice(parts.length - 1, 0, 'Vision');
    return parts.join(', ');
};

// ---- consultation request statuses ----
export const REQUEST_STATUS_CLASS = {
    'Waiting for Approval': 'badge-pending-ds',
    'Waiting List': 'badge-expired-ds',
    'Awaiting Reconfirmation': 'badge-pending-ds',
    'Reconfirmed': 'badge-open-ds',
    'Appointed': 'badge-open-ds',
    'Booked': 'badge-open-ds',
    'Fulfilled': 'badge-open-ds',
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
