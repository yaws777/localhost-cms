# Revision Request: Doctor Visits, Health Screening, Reports and Inventory Alerts

You are working in the Clinic Management System repo (CRA React 18 frontend, single-file Express + MySQL backend).
Rules from AGENTS.md: all endpoints go inline in backend/src/database/connection.js; raw mysql2/promise queries
(no ORM); frontend uses hardcoded http://localhost:3001 fetches; per-page CSS in frontend/src/styles/;
schema changes go in new migration_*.sql files at the repo root (idempotent, safe to re-run, never drop data);
do not change password handling; do not commit secrets. Use webpush.sendNotification (never sendPushNotification).
Schema reference: backups/ClinicManagementSystem_pre_dispense_migration_*.sql.

Work through the items in order. After each workstream, run both servers and verify in the browser.

## A. Move Dental and Vision from Health Screening into Doctor Visits
Health Screening (nurse-run, mass) must no longer offer Dental or Vision. They become doctor-conducted visit types.

A1. Doctor visit types. Add `visit_type` to `doctor_appointments`
    (ENUM/varchar: 'General Checkup','Dental Examination','Vision Examination','Follow-up','Referral', default 'General Checkup').
    The mass-schedule modal in doctorVisits.jsx gets a Visit Type select. Picking Dental or Vision filters the doctor
    list to matching specializations (Dentist / Optometrist / Ophthalmologist) and shows a warning if none exist.
    Replace the placeholder text at doctorVisits.jsx:1734 accordingly.
A2. Assessment forms per type (replace the generic findings form for these types):
    - Dental: oral hygiene (Good/Fair/Poor), teeth with caries / missing / filled counts (DMFT), gum condition,
      malocclusion (Y/N), tooth/area notes, treatment done, treatment needed, referral needed (Y/N + to whom),
      next visit recommendation, remarks.
    - Vision: visual acuity left/right uncorrected AND corrected (e.g. 20/20), wears eyeglasses/contacts (Y/N),
      color vision (Normal/Deficient), eye condition findings, recommended action
      (No action / Eyeglasses / Refer to ophthalmologist), remarks.
    - General Checkup keeps clinical_findings / diagnosis / treatment_recommendations.
    Add an `is_abnormal` flag and `follow_up_needed` flag to every assessment.
A3. Database (new migration_doctor_dental_vision.sql):
    - Keep dental_assessment_records and vision_screening_records (do NOT drop; legacy data must remain).
    - Make screening_schedule_id NULLable; add appointment_id (FK doctor_appointments, nullable), doctor_id,
      and the new detail columns above. Backfill nothing destructive.
    - doctor_assessments links to those detail rows via appointment_id + student_id.
A4. Backend: POST /api/doctor-assessments writes the type-specific record in the same transaction, upserts on
    (appointment_id, student_id) so re-saving never duplicates, and marks only that student's row as assessed
    (do not mark the whole appointment Completed until every present student is assessed).
A5. Health Screening cleanup: remove Dental/Vision from the type select (~healthScreening.jsx:996), the past-tab
    filter (~852), card badges (~912), the document forms (~1469-1499) and POST /api/screenings/:id/document.
    Keep legacy records visible: GET /health-screenings/clinicLogs&Records (and the doctor-visits equivalent) must
    still return old dental/vision rows, labelled "Dental (legacy)" / "Vision (legacy)". Student and parent clinic
    logs show new dental/vision results under the Doctor Visits tab.
A6. New Health Screening types replacing them: Vital Signs (BP systolic/diastolic, pulse, temperature,
    respiratory rate, with Normal/Elevated/High flags by age-appropriate ranges) and Hearing (left/right ear:
    Pass/Refer, remarks). BMI stays. Optional extras if time allows: Scoliosis/Posture, Lab (blood sugar,
    urinalysis) so lab results feed the health-trend counts in section I. Store results in new tables with a
    UNIQUE (student_id, screening_schedule_id) key; add is_abnormal on every result.

## B. Doctor schedule process (no schedule yet -> nurse sets it up -> patients book)
Current gap: doctors have no availability, appointments are only created in nurse mass batches.
B1. New "Doctor Schedule" module in the nurse area (new tab or page next to Doctor Visits):
    nurse sets a doctor's availability: date or recurring weekday, start/end time, slot duration (min),
    max patients per slot, location, status (Open/Closed). Table doctor_schedules (+ doctor_schedule_slots or
    computed slots) via migration. Edit/close/delete a schedule; closing notifies already-booked students.
B2. If a doctor has no open schedule, Doctor Visits shows "No schedule yet" with a "Set up schedule" action
    (this is the process requested by the nurse).
B3. Student module: new page/section "Book a Check-up": lists doctors with open schedules (filter by visit type:
    General/Dental/Vision), shows available slots; the student picks a slot and gives a reason. Creates a
    doctor_appointments + doctor_appointment_students row with status 'Pending Approval' (or auto-confirmed if
    the nurse enabled auto-confirm on that schedule). Student can cancel/reschedule their own booking.
    Parents can view (read-only) their child's bookings in the parent module.
B4. Nurse approves/declines booking requests (with reason); student and parent get in-app + push notification.
B5. Server-side validation (not only client): no overlapping appointments for the same doctor, slot capacity
    respected, booking only inside an open schedule, no booking in the past, one active booking per student
    per slot. Return 409 with a clear message on conflict.
B6. Mass batch scheduling must also respect the doctor's open schedule and the overlap check.

## C. More transactions in Doctor Visits
Add (backend endpoint + UI action + notification where it makes sense):
 1. Walk-in visit registration (no prior appointment) with immediate assessment.
 2. Per-student reschedule (the unused PUT /api/doctor-visits/reschedule/:id gets a UI) and per-student cancel.
 3. Mark No-Show / Excused with reason; auto-mark Absent after end (move this write out of the GET).
 4. Follow-up visit: from an assessment with follow_up_needed, one click creates a follow-up appointment.
 5. Referral slip to an outside facility/specialist (printable), stored with the assessment.
 6. Edit / correct / delete an assessment (with audit fields updated_by, updated_at).
 7. Printable documents: medical certificate / clearance and visit summary per student.
 8. Notify parent of results when is_abnormal or follow_up_needed.
 9. Per-student doctor-visit history view for the nurse (all visit types).
10. Wire the existing backend-only endpoints: batch-start and send-reminders (also run send-reminders on a
    node-cron schedule once daily).
11. Remove the dead client fallback to DELETE /api/mass-schedules/:id (route does not exist).
12. Fix nurseLayout.jsx notification routing so APPOINTMENT_* and BATCH_* types open /DoctorVisit.

## D. More transactions in Health Screening
 1. Edit / re-document a result (upsert on the UNIQUE key) and delete a result. Fixes duplicate rows.
 2. Abnormal result flag -> "Refer to Doctor": creates a doctor visit (or follow-up) for that student.
 3. Re-screening / make-up session for absentees: one click schedules a new screening for ABSENT students only.
 4. Attendance override from the Past tab (wire PUT /api/screenings/:id/students/:studentId/attendance) with
    reason, and scanning only allowed within the time window (or nurse confirm).
 5. Soft-cancel: add status (Scheduled/Ongoing/Completed/Cancelled) + cancelled_reason; cancelling must not fail
    when results exist and must keep history. Hard delete only when there are no results.
 6. Save the announcement on create and let Edit change title, type, date, times and announcement.
 7. Wire POST /api/screenings/:id/start and a daily node-cron for send-reminders.
 8. Notify parents of abnormal results.
 9. Results export (CSV/print) with the actual measurements, plus a results summary per screening
    (e.g. BMI category distribution, abnormal count).
10. Per-student screening history for the nurse.
11. Create schedule + participants in one DB transaction (no orphan schedules).

## E. Fix: error when presenting/attendance in Health Screening
 - GET /api/screenings must return present_count (and absent_count). Cards and exports read it instead of 0.
 - Make the auto-ABSENT rule identical on server and client (based on end datetime, done by cron/explicit
   action, not by the GET). Remove the UI/DB status mismatch.
 - Add res.ok checks in fetchSchedules/fetchPrograms so an API error cannot crash the render (schedules.filter on
   an object).
 - Prevent duplicate rows (UNIQUE keys, upserts) and duplicate React keys in the participant list.
 - Fix BMI category boundaries (29.9 currently returns "Normal"); validate numeric formData server-side.
 - Reproduce the original error first (present a student via QR and manual ID on Ongoing and Past tabs) and
   report the root cause in your summary.

## F. Organize records into containers (sections) and folder-style UI
Feedback: with ~1,000 records the flat list is unusable.
F1. Doctor Visits: folder UI. Top level = folders by Program, then Year-Section (e.g. "BSIT > 3 > A"), plus a
    "Walk-ins & Individual Bookings" folder. Folder card shows name, total visits, upcoming, completed, abnormal
    counts. Click opens the folder (breadcrumb navigation) showing the existing Upcoming/Ongoing/Past tabs, search
    and filters inside it, with pagination (20 per page). Keep all existing modals working.
F2. Health Screening: same container pattern grouped by Program > Year-Section (and screening type filter),
    with counts and pagination, so one section's records stay together.
F3. Backend: add grouped summary endpoints (counts per program/year/section) and paginated list endpoints
    (page, pageSize, search, status, type) so the browser never loads thousands of rows at once.
F4. Student results lists (participants tables) are also paginated and searchable.

## G. Automated low-stock report for the office
Feedback: when medicine stock runs out/low, an automated report should be shown to the office for restocking.
G1. Per-medicine (not per-batch) stock status using low/critical/adequate levels already on `medicines`, plus
    nearly-expired and expired batches.
G2. node-cron job (daily, e.g. 07:00 + on stock change) generates a restock report: medicine, current total,
    threshold, status (Low/Critical/Out of stock), 30-day forecast demand, suggested restock quantity, nearest
    expiry. Store it in a new table (medicine_restock_reports + items) so history is kept.
G3. Show it in the app: a "Restock Report" panel/page the office can open, with Print/PDF export, plus
    notification (in-app + push) to nurse/office users when a medicine becomes Low, Critical or Out of stock
    (deduplicated: notify once per status change, not every run).
G4. The dashboard alert and the report must use the same per-medicine numbers (today the dashboard computes
    per batch on the client and discards the backend query).

## H. Predictive calculation: 30 days, not monthly
 - Make the 30-day rolling forecast (backend/src/utils/medicineForecast.js) the only method. Remove the
   per-month baseline fields (avgMonthlyDispensed, predictedNeed, complaintPredictedNeed) from
   GET /api/predictive-medicine, the dashboard and its Export. Label everything "Next 30 days".
 - Restock suggestion = forecast 30-day demand + critical level - current stock (never negative).
 - Current stock for the forecast comes from live inventory, not the monthly snapshot.

## I. Health Trends, weekly report and illness summary
I1. Health Trends / Weekly Reports must be selectable by Daily, Weekly or Monthly (toggle) and actually work:
    fix GET /api/weekly-reports (Mon-Sun only today) to accept granularity + start/end; fix totalIncidents
    (currently hard-coded 0) by counting incident_reports; the dashboard trend must follow the same toggle.
I2. Health Trends must track common health issues (medical conditions) with counts: top conditions ranked by
    number of visits, with count per period. Count every visit (not one per student per month); also show
    distinct students per condition. Include conditions from doctor-visit diagnoses and lab results when
    available.
I3. "Past 30 days" illness summary report: list of the most common illnesses in the last 30 days with count,
    % of total and trend vs the previous 30 days; printable. Weekly report PDF must include the breakdown
    tables/charts, not only the four summary cards.

## J. Quality and acceptance
 - Idempotent migrations; list every new migration file and the order to run them.
 - No regression in student/parent dashboards, clinic logs, notifications or QR attendance.
 - Mobile-friendly folder/list views using existing CSS patterns (-dv / -hs suffixes).
 - Summarize per item: done / partially done / not done, files touched, and anything that could not be verified.
 - Do not commit; leave changes in the working tree.
