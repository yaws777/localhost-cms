-- =============================================================================
-- Migration: every doctor schedule is a hybrid
--   No schedule type is picked any more. Staff can appoint students into any schedule and students can book its open
--   time slots; the only per-schedule switch left is allow_walk_in. Old Appointment / Open Slot / Walk-in-only rows
--   are converted (walk-in setting is kept). How a student was scheduled (appointment, open time slot, walk-in) is
--   read from doctor_appointments.booking_source (Nurse|Doctor = appointment, Student = open time slot, Walk-in).
-- Idempotent. Run AFTER migration_schedule_modes_followups_chat.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_hybrid_schedules.sql
-- =============================================================================

USE ClinicManagementSystem;

UPDATE doctor_schedules
SET allow_appointment = 1, allow_open_booking = 1, schedule_type = 'Hybrid'
WHERE allow_appointment <> 1 OR allow_open_booking <> 1 OR schedule_type <> 'Hybrid';
