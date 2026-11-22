// tabNotificationTypes.js
// Notification types that a page shows on its own tabs (red dot per tab, cleared when that tab opens).
// The sidebar leaves these unread when the page opens, so the tabs inside it can still show their dot.
export const HUB_TAB_TYPES = {
    calendar: ['APPOINTMENT_SCHEDULED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_UPDATE', 'BOOKING_REQUEST', 'BOOKING_CANCELLED'],
    schedules: ['SCHEDULE_REQUEST', 'SCHEDULE_REQUEST_DECLINED', 'SCHEDULE_UPDATE'],
    waiting: ['CONSULTATION_REQUEST', 'CONSULTATION_RECONFIRMED', 'CONSULTATION_DENIED', 'ADVANCE_LISTING']
};

export const DOCTOR_VISIT_SECTION_TYPES = {
    visits: ['APPOINTMENT_SCHEDULED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_UPDATE', 'BOOKING_REQUEST', 'BOOKING_CANCELLED', 'QUEUE_VOID'],
    scheduling: ['SCHEDULE_REQUEST', 'SCHEDULE_REQUEST_DECLINED', 'SCHEDULE_UPDATE', 'CONSULTATION_REQUEST', 'CONSULTATION_RECONFIRMED', 'CONSULTATION_DENIED', 'ADVANCE_LISTING']
};

// sidebar route -> the tab maps of its page (every tab with an unread notification is one red dot there)
export const TAB_MAPS_BY_ROUTE = {
    '/DoctorVisit': [DOCTOR_VISIT_SECTION_TYPES, HUB_TAB_TYPES],
    '/DoctorMySchedule': [HUB_TAB_TYPES]
};

// sidebar route -> types its page clears itself
export const CLAIMED_BY_ROUTE = Object.fromEntries(
    Object.entries(TAB_MAPS_BY_ROUTE).map(([route, maps]) => [route, new Set(maps.flatMap((m) => Object.values(m).flat()))])
);
