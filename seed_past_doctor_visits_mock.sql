-- Mock past doctor visit sessions (check-up) with records and linked clinic visits.
-- Idempotent. Run: mysql -u root -p --default-character-set=utf8mb4 clinicmanagementsystem < seed_past_doctor_visits_mock.sql
-- Session 1: Mon 2026-11-16 Dental, DOC-583a0f4f (2 seen, 1 void)
-- Session 2: Tue 2026-11-17 Vision, DOC-ed638364 (3 seen). All results normal.

START TRANSACTION;

-- clean previous run
DELETE FROM clinic_visits WHERE visit_id LIKE 'VISIT-MOCK-%';
DELETE FROM doctor_assessments WHERE assessment_id LIKE 'DVAS-MOCK-%';
DELETE FROM doctor_appointment_students WHERE appointment_id LIKE 'DVSCHED-MOCK-%';
DELETE FROM doctor_appointments WHERE appointment_id LIKE 'DVSCHED-MOCK-%';
DELETE FROM session_end_confirmations WHERE schedule_id LIKE 'DSCH-MOCK-%';
DELETE FROM doctor_schedules WHERE schedule_id LIKE 'DSCH-MOCK-%';

-- schedules
INSERT INTO doctor_schedules
  (schedule_id, doctor_id, visit_type, recurrence, schedule_date, start_time, end_time, slot_duration_min, max_patients_per_slot,
   location, notes, status, created_by_doctor_id, schedule_type, announcement, allow_appointment, allow_open_booking, allow_walk_in,
   listing_limit, listing_open, created_at)
VALUES
  ('DSCH-MOCK-0001', 'DOC-583a0f4f', 'Dental', 'Once', '2026-11-16', '09:00:00', '11:00:00', 15, 1,
   'Clinic', 'Dental check-up session', 'Open', 'DOC-583a0f4f', 'Hybrid', 'Dental check-up session', 1, 1, 1,
   10, 0, '2026-11-12 10:00:00'),
  ('DSCH-MOCK-0002', 'DOC-ed638364', 'Vision', 'Once', '2026-11-17', '13:00:00', '15:00:00', 15, 1,
   'Clinic', 'Eye check-up session', 'Open', 'DOC-ed638364', 'Hybrid', 'Eye check-up session', 1, 1, 1,
   10, 0, '2026-11-12 10:05:00');

-- session end confirmed
INSERT INTO session_end_confirmations (schedule_id, session_date, confirmed_by, confirmed_at) VALUES
  ('DSCH-MOCK-0001', '2026-11-16', 'DOC-583a0f4f', '2026-11-16 11:02:00'),
  ('DSCH-MOCK-0002', '2026-11-17', 'DOC-ed638364', '2026-11-17 15:03:00');

-- queue rows (one appointment per student, spanning the session window)
INSERT INTO doctor_appointments
  (appointment_id, doctor_id, start_time, end_time, assigned_by_nurse_id, status, title, announcement, visit_type, schedule_id,
   booking_source, booking_reason, assigned_by_doctor_id, queue_lane, queue_no, queue_state, queue_called_at)
VALUES
  ('DVSCHED-MOCK-1-1', 'DOC-583a0f4f', '2026-11-16 09:00:00', '2026-11-16 11:00:00', NULL, 'Completed', 'Dental Appointment', '', 'Dental', 'DSCH-MOCK-0001',
   'Student', NULL, NULL, 'Listed', 1, 'Done', '2026-11-16 09:08:00'),
  ('DVSCHED-MOCK-1-2', 'DOC-583a0f4f', '2026-11-16 09:00:00', '2026-11-16 11:00:00', NULL, 'Completed', 'Dental Appointment', '', 'Dental', 'DSCH-MOCK-0001',
   'Student', NULL, NULL, 'Listed', 2, 'Done', '2026-11-16 09:30:00'),
  ('DVSCHED-MOCK-1-3', 'DOC-583a0f4f', '2026-11-16 09:00:00', '2026-11-16 11:00:00', NULL, 'Scheduled', 'Dental Appointment', '', 'Dental', 'DSCH-MOCK-0001',
   'Student', NULL, NULL, 'Listed', 3, 'Void', NULL),
  ('DVSCHED-MOCK-2-1', 'DOC-ed638364', '2026-11-17 13:00:00', '2026-11-17 15:00:00', NULL, 'Completed', 'Vision Appointment', '', 'Vision', 'DSCH-MOCK-0002',
   'Student', NULL, NULL, 'Listed', 1, 'Done', '2026-11-17 13:06:00'),
  ('DVSCHED-MOCK-2-2', 'DOC-ed638364', '2026-11-17 13:00:00', '2026-11-17 15:00:00', NULL, 'Completed', 'Vision Appointment', '', 'Vision', 'DSCH-MOCK-0002',
   'Student', NULL, NULL, 'Listed', 2, 'Done', '2026-11-17 13:28:00'),
  ('DVSCHED-MOCK-2-3', 'DOC-ed638364', '2026-11-17 13:00:00', '2026-11-17 15:00:00', NULL, 'Completed', 'Vision Appointment', '', 'Vision', 'DSCH-MOCK-0002',
   'Student', NULL, NULL, 'Listed', 3, 'Done', '2026-11-17 13:52:00');

INSERT INTO doctor_appointment_students (appointment_id, student_id, attendance_status, check_in_time, notes) VALUES
  ('DVSCHED-MOCK-1-1', '02000120504', 'Present', '2026-11-16 09:05:00', NULL),
  ('DVSCHED-MOCK-1-2', '02000121416', 'Present', '2026-11-16 09:27:00', NULL),
  ('DVSCHED-MOCK-1-3', '02000213546', 'Absent',  NULL, 'Did not show up'),
  ('DVSCHED-MOCK-2-1', '02000232323', 'Present', '2026-11-17 13:03:00', NULL),
  ('DVSCHED-MOCK-2-2', '02000236949', 'Present', '2026-11-17 13:25:00', NULL),
  ('DVSCHED-MOCK-2-3', '02000254206', 'Present', '2026-11-17 13:49:00', NULL);

-- doctor records
INSERT INTO doctor_assessments
  (assessment_id, appointment_id, student_id, clinical_findings, diagnosis, treatment_recommendations, assessment_date,
   is_abnormal, follow_up_needed, follow_up_notes, follow_up_date, updated_by, updated_at,
   documented_by_doctor_id, chief_complaint, visit_type, documented_by_role, documented_by_name)
VALUES
  ('DVAS-MOCK-1-1', 'DVSCHED-MOCK-1-1', '02000120504',
   'Teeth and gums normal. No cavities found. Mild plaque on lower molars.', 'Healthy dentition',
   'Brush twice a day, floss daily, limit sweet drinks.', '2026-11-16 09:25:00',
   0, 0, NULL, NULL, 'DOC-583a0f4f', '2026-11-16 09:25:00',
   'DOC-583a0f4f', 'Routine dental check-up', 'Dental', 'Doctor', 'Katherine Reyes'),
  ('DVAS-MOCK-1-2', 'DVSCHED-MOCK-1-2', '02000121416',
   'Teeth and gums normal. No cavities found. Light stain on front teeth.', 'Healthy dentition',
   'Continue regular brushing. Yearly check-up.', '2026-11-16 09:45:00',
   0, 0, NULL, NULL, 'DOC-583a0f4f', '2026-11-16 09:45:00',
   'DOC-583a0f4f', 'Routine dental check-up', 'Dental', 'Doctor', 'Katherine Reyes'),
  ('DVAS-MOCK-2-1', 'DVSCHED-MOCK-2-1', '02000232323',
   'Visual acuity 20/20 both eyes. No redness or discharge. Color vision normal.', 'Normal vision',
   'No treatment needed. Rest eyes during long screen use.', '2026-11-17 13:20:00',
   0, 0, NULL, NULL, 'DOC-ed638364', '2026-11-17 13:20:00',
   'DOC-ed638364', 'Routine eye check-up', 'Vision', 'Doctor', 'Alvin Ligutan'),
  ('DVAS-MOCK-2-2', 'DVSCHED-MOCK-2-2', '02000236949',
   'Visual acuity 20/20 both eyes. Eye movement and pupils normal.', 'Normal vision',
   'No treatment needed. Yearly eye check-up.', '2026-11-17 13:45:00',
   0, 0, NULL, NULL, 'DOC-ed638364', '2026-11-17 13:45:00',
   'DOC-ed638364', 'Routine eye check-up', 'Vision', 'Doctor', 'Alvin Ligutan'),
  ('DVAS-MOCK-2-3', 'DVSCHED-MOCK-2-3', '02000254206',
   'Visual acuity 20/20 both eyes. No redness or discharge.', 'Normal vision',
   'No treatment needed. Rest eyes during long screen use.', '2026-11-17 14:10:00',
   0, 0, NULL, NULL, 'DOC-ed638364', '2026-11-17 14:10:00',
   'DOC-ed638364', 'Routine eye check-up', 'Vision', 'Doctor', 'Alvin Ligutan');

-- linked clinic visits (check-up kind): time in vitals, time out vitals after the doctor documented
INSERT INTO clinic_visits
  (visit_id, student_id, nurse_id, visit_date, time_in, time_out,
   temperature, respiratory_rate, pulse_rate, blood_pressure,
   out_temperature, out_respiratory_rate, out_pulse_rate, out_blood_pressure, out_nurse_note,
   appointment_id, visit_kind)
VALUES
  ('VISIT-MOCK-1-1', '02000120504', 'NURSE02000', '2026-11-16', '09:05:00', '09:40:00',
   '36.6', '16', '78', '110/70', '36.6', '16', '76', '110/70', 'Stable. Sent back to class.',
   'DVSCHED-MOCK-1-1', 'Check-up'),
  ('VISIT-MOCK-1-2', '02000121416', 'NURSE02000', '2026-11-16', '09:27:00', '10:00:00',
   '36.4', '15', '72', '108/68', '36.4', '15', '72', '108/68', 'No concern. Sent back to class.',
   'DVSCHED-MOCK-1-2', 'Check-up'),
  ('VISIT-MOCK-2-1', '02000232323', 'NURSE02000', '2026-11-17', '13:03:00', '13:35:00',
   '36.5', '16', '80', '112/72', '36.5', '16', '78', '112/72', 'Normal. Sent back to class.',
   'DVSCHED-MOCK-2-1', 'Check-up'),
  ('VISIT-MOCK-2-2', '02000236949', 'NURSE02000', '2026-11-17', '13:25:00', '14:00:00',
   '36.7', '17', '84', '115/75', '36.6', '16', '82', '114/74', 'No concern. Sent back to class.',
   'DVSCHED-MOCK-2-2', 'Check-up'),
  ('VISIT-MOCK-2-3', '02000254206', 'NURSE02000', '2026-11-17', '13:49:00', '14:25:00',
   '36.8', '17', '88', '118/78', '36.7', '16', '84', '116/76', 'Normal. Sent back to class.',
   'DVSCHED-MOCK-2-3', 'Check-up');

COMMIT;
