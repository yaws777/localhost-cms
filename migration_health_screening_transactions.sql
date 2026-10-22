-- =============================================================================
-- Migration: Health Screening transactions (section D) and attendance/duplicate fixes (section E)
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_doctor_dental_vision.sql and
-- migration_doctor_schedule_booking.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root < migration_health_screening_transactions.sql
-- Take a backup first:  mysqldump ClinicManagementSystem > backup.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
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

CREATE PROCEDURE cms_add_index(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN definition TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD ', definition);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE cms_add_fk(IN tbl VARCHAR(64), IN fk VARCHAR(64), IN definition TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl
                   AND CONSTRAINT_NAME = fk AND CONSTRAINT_TYPE = 'FOREIGN KEY') THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD CONSTRAINT `', fk, '` ', definition);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE cms_replace_check(IN tbl VARCHAR(64), IN chk VARCHAR(64), IN expr TEXT, IN must_contain VARCHAR(64))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = chk
                   AND CHECK_CLAUSE LIKE CONCAT('%', must_contain, '%')) THEN
    IF EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS
               WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = chk) THEN
      SET @ddl = CONCAT('ALTER TABLE `', tbl, '` DROP CHECK `', chk, '`');
      PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
    END IF;
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD CONSTRAINT `', chk, '` CHECK (', expr, ')');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------------------------------
-- 1. Schedules: status (soft-cancel keeps history), reason, make-up link
-- -----------------------------------------------------------------------------
CALL cms_add_column('screening_schedules', 'status',           "varchar(12) NOT NULL DEFAULT 'Scheduled'");
CALL cms_add_column('screening_schedules', 'cancelled_reason', 'varchar(255) NULL');
CALL cms_add_column('screening_schedules', 'cancelled_at',     'timestamp NULL');
CALL cms_add_column('screening_schedules', 'makeup_of',        'varchar(45) NULL');

CALL cms_replace_check('screening_schedules', 'chk_screening_status',
  "status IN ('Scheduled','Ongoing','Completed','Cancelled')", 'Cancelled');

-- -----------------------------------------------------------------------------
-- 2. Participants: no duplicates, override reason, doctor referral link
-- -----------------------------------------------------------------------------
-- keep one row per (schedule, student): prefer PRESENT, then the newest
DELETE p1 FROM screening_schedule_participants p1
JOIN screening_schedule_participants p2
  ON p1.screening_schedule_id = p2.screening_schedule_id
 AND p1.student_id = p2.student_id
 AND p1.participant_id <> p2.participant_id
 AND (
      (p2.attendance_status = 'PRESENT' AND p1.attendance_status <> 'PRESENT')
   OR (p1.attendance_status = p2.attendance_status AND p1.participant_id < p2.participant_id)
 );

CALL cms_add_index('screening_schedule_participants', 'uq_participant_schedule_student',
  'UNIQUE KEY `uq_participant_schedule_student` (`screening_schedule_id`, `student_id`)');
CALL cms_add_column('screening_schedule_participants', 'attendance_note', 'varchar(255) NULL');
CALL cms_add_column('screening_schedule_participants', 'referral_appointment_id', 'char(36) NULL');
CALL cms_add_fk('screening_schedule_participants', 'fk_participant_referral',
  'FOREIGN KEY (`referral_appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE SET NULL');

-- -----------------------------------------------------------------------------
-- 3. BMI results: one per student per schedule (re-documenting updates in place)
-- -----------------------------------------------------------------------------
DELETE b1 FROM bmi_monitoring_logs b1
JOIN bmi_monitoring_logs b2
  ON b1.student_id = b2.student_id
 AND b1.screening_schedule_id = b2.screening_schedule_id
 AND b1.bmi_log_id <> b2.bmi_log_id
 AND (b1.logged_at < b2.logged_at OR (b1.logged_at = b2.logged_at AND b1.bmi_log_id < b2.bmi_log_id));

CALL cms_add_index('bmi_monitoring_logs', 'uq_bmi_student_schedule',
  'UNIQUE KEY `uq_bmi_student_schedule` (`student_id`, `screening_schedule_id`)');

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
DROP PROCEDURE IF EXISTS cms_replace_check;
