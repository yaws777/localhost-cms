// notificationRoutes.js
// Which page each role's notification belongs to (pure: no navigation, no state). The layouts use it to open the page
// from the bell and to put a red dot on the sidebar item, which goes away when that page is opened.
// MESSAGE_ROUTE = the chat window, not a page.
export const MESSAGE_ROUTE = 'MESSAGE';

export const nurseRouteOf = (notification) => {
    const type = (notification.type || '').toLowerCase();
    const title = (notification.title || '').toLowerCase();
    const msg = (notification.message || '').toLowerCase();

    // Doctor schedule / booking / appointment notifications must be matched before the generic 'request' and 'visit' rules
    if (type.includes('restock')) return '/ReportsAnalytics?tab=inventory';
    if (type === 'consultation_request' || type === 'consultation_reconfirmed') return '/DoctorVisit?section=waiting';
    if (type === 'schedule_update') return '/DoctorVisit?section=availability';
    if (type.startsWith('schedule_request')) return '/DoctorVisit?section=availability';
    if (type.startsWith('booking') || type.startsWith('queue_') || type === 'advance_listing') return '/DoctorVisit';
    if (type.includes('appointment') || type.includes('batch') || type.includes('assessment') || type.includes('doctor_visit')) return '/DoctorVisit';
    if (type.includes('requirement') || msg.includes('requirement') || title.includes('submission')) return '/RequirementManagement';
    if (type.includes('visit') || type.includes('consultation') || msg.includes('clinic visit')) return '/VisitLogConsultation';
    if (type.includes('health_record') || type.includes('record')) return '/HealthRecords';
    if (type.includes('dispense') || msg.includes('dispensed')) return '/DispensedMedicine';
    if (type.includes('inventory') || msg.includes('stock')) return '/MedicineInventory';
    if (type.includes('request') || msg.includes('request')) return '/DocumentIssuance';
    if (type.includes('screening')) return '/HealthScreening';
    if (type.includes('doctor')) return '/DoctorVisit';
    if (type.includes('incident')) return '/IncidentReport';
    if (type.includes('insurance') || type.includes('vault')) return '/InsuranceVault';
    if (type.includes('doctor_account')) return '/ManageDoctorAccounts';
    if (type.includes('student_account')) return '/ManageStudentAccounts';
    if (type.includes('parent_account')) return '/ManageParentAccounts';
    if (type.includes('message') || type.includes('chat')) return MESSAGE_ROUTE;
    if (type.includes('report')) return '/ReportsAnalytics';
    if (type.includes('setting')) return '/NurseNotificationSettings';

    return '/NurseDashboard';
};

export const studentRouteOf = (notification) => {
    const type = (notification.type || '').toLowerCase();
    const title = (notification.title || '').toLowerCase();
    const msg = (notification.message || '').toLowerCase();

    if (type.includes('message') || msg.includes('message') || title.includes('message')) return MESSAGE_ROUTE;
    // "now calling", "your turn is near" and "number skipped": the queue card on the dashboard shows the live numbers
    if (type.startsWith('queue_')) return '/StudentDashboard';
    if (type.includes('booking') || type.includes('appointment') || type.startsWith('consultation_')) return '/BookCheckup';
    if (type.includes('requirement') || msg.includes('requirement') || title.includes('requirement')) return '/MyRequirements';
    if (['doctor', 'incident', 'visit', 'record'].some((k) => type.includes(k)) || ['clinic', 'incident', 'doctor', 'consultation', 'visit'].some((k) => msg.includes(k))) return '/ClinicLogsAndRecords';
    if (type.includes('request') || msg.includes('request')) return '/RequestModule';
    if (type.includes('tip') || msg.includes('health tip')) return '/HealthTips';
    if (type.includes('qr') || msg.includes('qr')) return '/MyQr';
    if (type.includes('profile') || msg.includes('profile')) return '/MyProfile';
    return '/StudentDashboard';
};

// null = the notification opens a pop-up, not a page
export const parentRouteOf = (notification) => {
    const type = notification.type ? notification.type.toLowerCase() : '';
    const msg = notification.message ? notification.message.toLowerCase() : '';

    if (type.includes('message') || msg.includes('message')) return MESSAGE_ROUTE;
    if (type.includes('booking') || type.includes('appointment') || type.includes('assessment') || type.includes('doctor_visit') || type.startsWith('consultation_')) return '/ChildClinicRecords';
    if (type.includes('clinic') || msg.includes('clinic') || msg.includes('medical')) return '/ChildClinicRecords';
    if (type.includes('profile') || msg.includes('profile')) return '/ChildProfile';
    return null;
};

export const doctorRouteOf = (notification) => {
    const type = String(notification.type || '').toUpperCase();
    if (type === 'MESSAGE') return '/DoctorChat';
    if (type === 'CONSULTATION_REQUEST' || type === 'CONSULTATION_RECONFIRMED') return '/DoctorMySchedule?tab=waiting';
    if (type === 'SCHEDULE_UPDATE') return '/DoctorMySchedule';
    if (type.startsWith('SCHEDULE_REQUEST')) return '/DoctorMySchedule?tab=schedules';
    if (type.includes('ASSESSMENT')) return '/DoctorCheckup';
    if (type.includes('BOOKING') || type.includes('APPOINTMENT') || type.includes('BATCH')) return '/DoctorCheckup';
    return '/DoctorDashboard';
};
