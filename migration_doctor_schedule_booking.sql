-- =============================================================================
-- Migration: Doctor schedules + student booking (section B) and the extra
--            Doctor Visit transactions (section C)
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_doctor_dental_vision.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root < migration_doctor_schedule_booking.sql
-- (otherwise the CHECK constraint literals are stored in the console charset)
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

-- Re-creates a CHECK constraint unless its current definition already contains `must_contain`.
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
-- 1. Doctor schedules (availability the nurse sets up; students book into it)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_schedules (
  schedule_id            varchar(45)  NOT NULL,
  doctor_id              varchar(45)  NOT NULL,
  visit_type             varchar(30)  NOT NULL DEFAULT 'Any' COMMENT 'Any or one of the doctor visit types',
  recurrence             varchar(10)  NOT NULL DEFAULT 'Once' COMMENT 'Once | Weekly',
  schedule_date          date         NULL COMMENT 'Once: the date',
  day_of_week            tinyint      NULL COMMENT 'Weekly: 0=Sunday .. 6=Saturday',
  valid_from             date         NULL COMMENT 'Weekly: first date it applies',
  valid_until            date         NULL COMMENT 'Weekly: last date it applies',
  start_time             time         NOT NULL,
  end_time               time         NOT NULL,
  slot_duration_min      smallint     NOT NULL DEFAULT 15,
  max_patients_per_slot  smallint     NOT NULL DEFAULT 1,
  location               varchar(100) NULL,
  notes                  varchar(255) NULL,
  auto_confirm           tinyint(1)   NOT NULL DEFAULT 0 COMMENT '1 = student bookings are confirmed without nurse approval',
  status                 varchar(10)  NOT NULL DEFAULT 'Open' COMMENT 'Open | Closed',
  closed_reason          varchar(255) NULL,
  created_by_nurse_id    varchar(45)  NOT NULL,
  created_at             timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_id),
  KEY idx_ds_doctor (doctor_id),
  KEY idx_ds_date (schedule_date),
  CONSTRAINT fk_ds_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id),
  CONSTRAINT fk_ds_nurse  FOREIGN KEY (created_by_nurse_id) REFERENCES nurses (nurse_id),
  CONSTRAINT chk_ds_time        CHECK (end_time > start_time),
  CONSTRAINT chk_ds_recurrence  CHECK (recurrence IN ('Once', 'Weekly')),
  CONSTRAINT chk_ds_status      CHECK (status IN ('Open', 'Closed')),
  CONSTRAINT chk_ds_capacity    CHECK (max_patients_per_slot >= 1 AND slot_duration_min >= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 2. Appointments: booking metadata, follow-up link, new statuses
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_appointments', 'schedule_id',    'varchar(45) NULL');
CALL cms_add_column('doctor_appointments', 'booking_source', "varchar(10) NOT NULL DEFAULT 'Nurse' COMMENT 'Nurse | Student | Walk-in'");
CALL cms_add_column('doctor_appointments', 'booking_reason', 'varchar(255) NULL');
CALL cms_add_column('doctor_appointments', 'decline_reason', 'varchar(255) NULL');
CALL cms_add_column('doctor_appointments', 'parent_appointment_id', 'char(36) NULL');

CALL cms_add_index('doctor_appointments', 'idx_da_schedule', 'INDEX `idx_da_schedule` (`schedule_id`)');
CALL cms_add_index('doctor_appointments', 'idx_da_doctor_time', 'INDEX `idx_da_doctor_time` (`doctor_id`, `start_time`, `end_time`)');
CALL cms_add_fk('doctor_appointments', 'fk_da_schedule', 'FOREIGN KEY (`schedule_id`) REFERENCES `doctor_schedules` (`schedule_id`)');

CALL cms_replace_check('doctor_appointments', 'chk_appointment_status',
  "status IN ('Scheduled','Completed','No-Show','Cancelled','Pending Approval','Declined')", 'Pending Approval');

CALL cms_replace_check('doctor_appointment_students', 'chk_student_attendance',
  "attendance_status IN ('Pending','Present','Absent','Excused')", 'Excused');

-- -----------------------------------------------------------------------------
-- 3. Assessments: audit fields + referral slip
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_assessments', 'updated_by',         'varchar(45) NULL');
CALL cms_add_column('doctor_assessments', 'updated_at',         'timestamp NULL');
CALL cms_add_column('doctor_assessments', 'referral_facility',  'varchar(150) NULL');
CALL cms_add_column('doctor_assessments', 'referral_reason',    'text NULL');
CALL cms_add_column('doctor_assessments', 'referral_issued_at', 'timestamp NULL');

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
DROP PROCEDURE IF EXISTS cms_replace_check;
