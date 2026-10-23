-- =============================================================================
-- Migration: Doctor role / portal
--   * Doctor user role + doctor accounts (login, phone verification for password recovery)
--   * Visit purposes: General Check Up | Dental | Vision | Other (specify)
--   * Doctors (and nurses) can create schedules and direct appointments
--   * Appointment lifecycle reason log, doctor unavailable dates
--   * Consultation documentation: prescriptions + follow-up notes, doctor assessment templates
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_doctor_schedule_booking.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root < migration_doctor_role_portal.sql
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
-- 1. Doctor role + doctor accounts
-- -----------------------------------------------------------------------------
INSERT INTO roles (role_id, role_name)
SELECT 'DCTR', 'Doctor' FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_id = 'DCTR');

CALL cms_add_column('doctors', 'user_id',             'varchar(45) NULL COMMENT ''login account (users.user_id); NULL = profile only''');
CALL cms_add_column('doctors', 'phone_confirmed_at',  'timestamp NULL COMMENT ''set when the doctor confirms the phone used for password recovery''');
CALL cms_add_column('doctors', 'created_by_nurse_id', 'varchar(45) NULL');
CALL cms_add_column('doctors', 'created_at',          'timestamp NULL DEFAULT CURRENT_TIMESTAMP');

CALL cms_add_index('doctors', 'uq_doctors_user', 'UNIQUE KEY `uq_doctors_user` (`user_id`)');
CALL cms_add_fk('doctors', 'fk_doctors_user',  'FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)');
CALL cms_add_fk('doctors', 'fk_doctors_nurse', 'FOREIGN KEY (`created_by_nurse_id`) REFERENCES `nurses` (`nurse_id`)');

-- -----------------------------------------------------------------------------
-- 2. Visit purposes: General Check Up | Dental | Vision | Other (specify)
--    (Follow-up and Referral stay as system-created purposes)
-- -----------------------------------------------------------------------------
UPDATE doctor_appointments SET visit_type = 'General Check Up' WHERE visit_type = 'General Checkup';
UPDATE doctor_appointments SET visit_type = 'Dental'           WHERE visit_type = 'Dental Examination';
UPDATE doctor_appointments SET visit_type = 'Vision'           WHERE visit_type = 'Vision Examination';
UPDATE doctor_schedules    SET visit_type = 'General Check Up' WHERE visit_type = 'General Checkup';
UPDATE doctor_schedules    SET visit_type = 'Dental'           WHERE visit_type = 'Dental Examination';
UPDATE doctor_schedules    SET visit_type = 'Vision'           WHERE visit_type = 'Vision Examination';

ALTER TABLE doctor_appointments
  MODIFY COLUMN visit_type varchar(30) NOT NULL DEFAULT 'General Check Up'
  COMMENT 'General Check Up | Dental | Vision | Other (see purpose_other) | Follow-up | Referral';

CALL cms_add_column('doctor_appointments', 'purpose_other', 'varchar(150) NULL COMMENT ''the purpose, when visit_type = Other''');

CALL cms_replace_check('doctor_appointments', 'chk_appointment_visit_type',
  "visit_type IN ('General Check Up','Dental','Vision','Other','Follow-up','Referral')", 'General Check Up');
CALL cms_replace_check('doctor_appointments', 'chk_appointment_other_specified',
  "visit_type <> 'Other' OR (purpose_other IS NOT NULL AND CHAR_LENGTH(TRIM(purpose_other)) > 0)", 'purpose_other');
CALL cms_replace_check('doctor_schedules', 'chk_ds_visit_type',
  "visit_type IN ('Any','General Check Up','Dental','Vision','Other','Follow-up','Referral')", 'General Check Up');

-- -----------------------------------------------------------------------------
-- 3. Doctors can create schedules and appointments too (not only nurses)
-- -----------------------------------------------------------------------------
ALTER TABLE doctor_appointments MODIFY COLUMN assigned_by_nurse_id varchar(45) NULL;
CALL cms_add_column('doctor_appointments', 'assigned_by_doctor_id', 'varchar(45) NULL');
CALL cms_add_fk('doctor_appointments', 'fk_da_assigned_doctor', 'FOREIGN KEY (`assigned_by_doctor_id`) REFERENCES `doctors` (`doctor_id`)');

ALTER TABLE doctor_schedules MODIFY COLUMN created_by_nurse_id varchar(45) NULL;
CALL cms_add_column('doctor_schedules', 'created_by_doctor_id', 'varchar(45) NULL');
CALL cms_add_fk('doctor_schedules', 'fk_ds_created_doctor', 'FOREIGN KEY (`created_by_doctor_id`) REFERENCES `doctors` (`doctor_id`)');

-- -----------------------------------------------------------------------------
-- 4. Appointment lifecycle log (who confirmed / declined / rescheduled / cancelled, and why)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_appointment_logs (
  log_id          char(36)     NOT NULL,
  appointment_id  char(36)     NOT NULL,
  action          varchar(20)  NOT NULL COMMENT 'Requested | Scheduled | Confirmed | Declined | Rescheduled | Cancelled | Completed | Walk-in',
  from_status     varchar(20)  NULL,
  to_status       varchar(20)  NULL,
  old_start_time  timestamp    NULL,
  old_end_time    timestamp    NULL,
  new_start_time  timestamp    NULL,
  new_end_time    timestamp    NULL,
  reason          varchar(255) NULL,
  actor_user_id   varchar(45)  NULL,
  actor_role      varchar(10)  NULL COMMENT 'Doctor | Nurse | Student | System',
  actor_name      varchar(120) NULL,
  created_at      timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_dal_appointment (appointment_id, created_at),
  CONSTRAINT fk_dal_appointment FOREIGN KEY (appointment_id) REFERENCES doctor_appointments (appointment_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 5. Doctor unavailable dates (whole days, or a time window inside a day)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_unavailable_dates (
  unavailable_id   varchar(45)  NOT NULL,
  doctor_id        varchar(45)  NOT NULL,
  start_date       date         NOT NULL,
  end_date         date         NOT NULL,
  start_time       time         NULL COMMENT 'NULL together with end_time = the whole day(s)',
  end_time         time         NULL,
  reason           varchar(255) NULL,
  created_by_user_id varchar(45) NULL,
  created_by_role  varchar(10)  NULL COMMENT 'Doctor | Nurse',
  created_at       timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (unavailable_id),
  KEY idx_dud_doctor_dates (doctor_id, start_date, end_date),
  CONSTRAINT fk_dud_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id) ON DELETE CASCADE,
  CONSTRAINT chk_dud_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_dud_times CHECK ((start_time IS NULL AND end_time IS NULL)
                               OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 6. Clinical consultation documentation
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_assessments', 'prescriptions',           'json NULL COMMENT ''[{medicine, dosage, frequency, duration, instructions}]''');
CALL cms_add_column('doctor_assessments', 'follow_up_notes',         'text NULL');
CALL cms_add_column('doctor_assessments', 'follow_up_date',          'date NULL');
CALL cms_add_column('doctor_assessments', 'template_id',             'varchar(45) NULL');
CALL cms_add_column('doctor_assessments', 'template_name',           'varchar(120) NULL');
CALL cms_add_column('doctor_assessments', 'template_responses',      'json NULL COMMENT ''[{key, label, type, value}] answers to the doctor template fields''');
CALL cms_add_column('doctor_assessments', 'documented_by_doctor_id', 'varchar(45) NULL');
CALL cms_add_fk('doctor_assessments', 'fk_assessment_doctor', 'FOREIGN KEY (`documented_by_doctor_id`) REFERENCES `doctors` (`doctor_id`)');

-- -----------------------------------------------------------------------------
-- 7. Doctor-defined assessment form templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_assessment_templates (
  template_id    varchar(45)  NOT NULL,
  doctor_id      varchar(45)  NOT NULL,
  template_name  varchar(120) NOT NULL,
  visit_type     varchar(30)  NULL COMMENT 'NULL = usable for any visit purpose',
  description    varchar(255) NULL,
  fields         json         NOT NULL COMMENT '[{key, label, type, required, options[], section}]',
  is_default     tinyint(1)   NOT NULL DEFAULT 0,
  is_active      tinyint(1)   NOT NULL DEFAULT 1,
  created_at     timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id),
  UNIQUE KEY uq_dat_doctor_name (doctor_id, template_name),
  CONSTRAINT fk_dat_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
DROP PROCEDURE IF EXISTS cms_replace_check;
