-- =============================================================================
-- Migration: schedule modes (one or hybrid), individual follow-ups
--   * doctor_schedules.schedule_type stays as the label, but a schedule is now defined by three switches:
--       allow_appointment   : staff appoint students into the session
--       allow_open_booking  : students book a time block themselves
--       allow_walk_in       : walk-ins are accepted during the session
--     Hybrid = appointment + open booking (with or without walk-ins). Walk-in only = announcement.
--   * schedule_type gains the value 'Hybrid'
--   * doctor_assessments: a follow-up can be dismissed from the follow-up list (with a reason)
-- Nurse <-> doctor chat reuses the existing `messages` table (no schema change).
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_consultation_scheduling.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_schedule_modes_followups_chat.sql
-- Take a backup first:  mysqldump ClinicManagementSystem > backup.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_drop_check;
DROP PROCEDURE IF EXISTS cms_replace_check;

DELIMITER $$

CREATE PROCEDURE cms_add_column(IN tbl VARCHAR(64), IN col VARCHAR(64), IN definition TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', definition);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE cms_drop_check(IN tbl VARCHAR(64), IN chk VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = chk) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` DROP CHECK `', chk, '`');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

-- Re-creates a CHECK constraint unless its current definition already contains `must_contain`.
CREATE PROCEDURE cms_replace_check(IN tbl VARCHAR(64), IN chk VARCHAR(64), IN expr TEXT, IN must_contain VARCHAR(64))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = chk
                   AND CHECK_CLAUSE LIKE CONCAT('%', must_contain, '%')) THEN
    CALL cms_drop_check(tbl, chk);
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD CONSTRAINT `', chk, '` CHECK (', expr, ')');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------------------------------
-- 1. Schedule modes
--    Existing rows keep behaving as before: Appointment and Open Slot sessions always accepted walk-ins,
--    a Walk-in session is the announcement-only one.
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_schedules', 'allow_appointment',  'tinyint(1) NOT NULL DEFAULT 0 COMMENT ''staff appoint students into this session''');
CALL cms_add_column('doctor_schedules', 'allow_open_booking', 'tinyint(1) NOT NULL DEFAULT 1 COMMENT ''students book a time block themselves''');
CALL cms_add_column('doctor_schedules', 'allow_walk_in',      'tinyint(1) NOT NULL DEFAULT 1 COMMENT ''walk-ins are accepted during the session''');

-- backfill only the rows that have not been converted yet (the old CHECK still limits schedule_type to the three old values)
UPDATE doctor_schedules SET allow_appointment = 1, allow_open_booking = 0, allow_walk_in = 1 WHERE schedule_type = 'Appointment';
UPDATE doctor_schedules SET allow_appointment = 0, allow_open_booking = 1, allow_walk_in = 1 WHERE schedule_type = 'Open Slot';
UPDATE doctor_schedules SET allow_appointment = 0, allow_open_booking = 0, allow_walk_in = 1 WHERE schedule_type = 'Walk-in';

CALL cms_replace_check('doctor_schedules', 'chk_ds_type',
  "schedule_type IN ('Appointment','Open Slot','Walk-in','Hybrid')", 'Hybrid');

CALL cms_replace_check('doctor_schedules', 'chk_ds_modes',
  "(allow_appointment + allow_open_booking + allow_walk_in) >= 1", 'allow_walk_in');

-- -----------------------------------------------------------------------------
-- 2. Follow-up list: staff can dismiss a follow-up that is no longer needed
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_assessments', 'follow_up_closed',        'tinyint(1) NOT NULL DEFAULT 0 COMMENT ''1 = taken off the follow-up list without a visit''');
CALL cms_add_column('doctor_assessments', 'follow_up_closed_reason', 'varchar(255) NULL');

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_drop_check;
DROP PROCEDURE IF EXISTS cms_replace_check;
