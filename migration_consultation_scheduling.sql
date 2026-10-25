-- =============================================================================
-- Migration: Doctor consultation scheduling (waiting list + three schedule types)
--   * Appointment status "Pending Approval" becomes "Waiting for Approval"
--   * Schedule types: Appointment | Open Slot | Walk-in (+ announcement, time extensions)
--   * consultation_requests: a student asks for a consultation (even with no schedule yet),
--     the nurse/doctor approves or denies it with a reason, then reminds / reconfirms / appoints
--   * Doctors set the check-ups (services) they offer
--   * Assessment metadata: chief complaint, visit purpose snapshot, who documented it
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_doctor_role_portal.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root < migration_consultation_scheduling.sql
-- (otherwise the CHECK constraint literals are stored in the console charset)
-- Take a backup first:  mysqldump ClinicManagementSystem > backup.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
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
-- 1. Status wording: a request nobody has answered yet is "Waiting for Approval"
--    (the old CHECK has to go before the rows can change)
-- -----------------------------------------------------------------------------
CALL cms_drop_check('doctor_appointments', 'chk_appointment_status');

ALTER TABLE doctor_appointments MODIFY COLUMN status varchar(30) NULL DEFAULT 'Scheduled';
ALTER TABLE doctor_appointment_logs MODIFY COLUMN from_status varchar(30) NULL;
ALTER TABLE doctor_appointment_logs MODIFY COLUMN to_status varchar(30) NULL;

UPDATE doctor_appointments     SET status      = 'Waiting for Approval' WHERE status      = 'Pending Approval';
UPDATE doctor_appointment_logs SET from_status = 'Waiting for Approval' WHERE from_status = 'Pending Approval';
UPDATE doctor_appointment_logs SET to_status   = 'Waiting for Approval' WHERE to_status   = 'Pending Approval';

CALL cms_replace_check('doctor_appointments', 'chk_appointment_status',
  "status IN ('Scheduled','Completed','No-Show','Cancelled','Waiting for Approval','Declined')", 'Waiting for Approval');

-- -----------------------------------------------------------------------------
-- 2. Doctors: the check-ups / specializations they cover
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctors', 'services_offered', 'json NULL COMMENT ''JSON array of visit purposes the doctor takes (General Check Up, Dental, Vision, Other); NULL = follows the specialization''');
CALL cms_add_column('doctors', 'services_notes',   'varchar(255) NULL COMMENT ''free text: other conditions / specialties covered''');

-- -----------------------------------------------------------------------------
-- 3. Schedules: the three scheduling types
--      Appointment : staff appoint the students (usually from the waiting list); walk-ins still accepted
--      Open Slot   : students book a time block (needs approval unless auto_confirm); walk-ins still accepted
--      Walk-in     : announcement only, students just come in
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_schedules', 'schedule_type',    'varchar(15) NOT NULL DEFAULT ''Open Slot'' COMMENT ''Appointment | Open Slot | Walk-in''');
CALL cms_add_column('doctor_schedules', 'announcement',     'varchar(500) NULL COMMENT ''text shown to students (mainly Walk-in sessions)''');
CALL cms_add_column('doctor_schedules', 'extended_minutes', 'smallint NOT NULL DEFAULT 0 COMMENT ''total minutes the session was extended''');
CALL cms_add_column('doctor_schedules', 'original_end_time','time NULL COMMENT ''end time before the first extension''');

CALL cms_replace_check('doctor_schedules', 'chk_ds_type',
  "schedule_type IN ('Appointment','Open Slot','Walk-in')", 'Open Slot');

-- -----------------------------------------------------------------------------
-- 4. Appointments: link to the consultation request + extension minutes
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_appointments', 'request_id',        'varchar(45) NULL COMMENT ''consultation_requests.request_id that led to this appointment''');
CALL cms_add_column('doctor_appointments', 'extended_minutes',  'smallint NOT NULL DEFAULT 0');
CALL cms_add_index('doctor_appointments', 'idx_da_request', 'INDEX `idx_da_request` (`request_id`)');

-- -----------------------------------------------------------------------------
-- 5. Consultation requests (the waiting list)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultation_requests (
  request_id             varchar(45)  NOT NULL,
  student_id             varchar(45)  NOT NULL,
  visit_type             varchar(30)  NOT NULL DEFAULT 'General Check Up' COMMENT 'General Check Up | Dental | Vision | Other',
  purpose_other          varchar(150) NULL,
  reason                 varchar(255) NOT NULL COMMENT 'why the student needs a consultation',
  preferred_doctor_id    varchar(45)  NULL,
  preferred_note         varchar(255) NULL COMMENT 'preferred days / times, optional',
  status                 varchar(30)  NOT NULL DEFAULT 'Waiting for Approval'
                         COMMENT 'Waiting for Approval | Denied | Waiting List | Awaiting Reconfirmation | Reconfirmed | Appointed | Booked | Fulfilled | Withdrawn',
  is_priority            tinyint(1)   NOT NULL DEFAULT 0 COMMENT 'set by staff when approving; priority students are scheduled first',
  review_reason          varchar(255) NULL COMMENT 'reason when denied (or note when approved)',
  reviewed_by_user_id    varchar(45)  NULL,
  reviewed_by_role       varchar(10)  NULL,
  reviewed_by_name       varchar(120) NULL,
  reviewed_at            timestamp    NULL,
  notified_schedule_id   varchar(45)  NULL,
  notified_date          date         NULL,
  last_notice_type       varchar(15)  NULL COMMENT 'Reminder | Reconfirm',
  last_notified_at       timestamp    NULL,
  notify_count           smallint     NOT NULL DEFAULT 0,
  reconfirm_response     varchar(5)   NULL COMMENT 'Yes | No',
  reconfirm_note         varchar(255) NULL,
  reconfirm_responded_at timestamp    NULL,
  appointment_id         char(36)     NULL,
  created_at             timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id),
  KEY idx_cr_student (student_id, created_at),
  KEY idx_cr_status (status, visit_type),
  CONSTRAINT fk_cr_student  FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_cr_doctor   FOREIGN KEY (preferred_doctor_id) REFERENCES doctors (doctor_id) ON DELETE SET NULL,
  CONSTRAINT chk_cr_status  CHECK (status IN ('Waiting for Approval','Denied','Waiting List','Awaiting Reconfirmation','Reconfirmed','Appointed','Booked','Fulfilled','Withdrawn')),
  CONSTRAINT chk_cr_visit   CHECK (visit_type IN ('General Check Up','Dental','Vision','Other')),
  CONSTRAINT chk_cr_other   CHECK (visit_type <> 'Other' OR (purpose_other IS NOT NULL AND CHAR_LENGTH(TRIM(purpose_other)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS consultation_request_logs (
  log_id         char(36)     NOT NULL,
  request_id     varchar(45)  NOT NULL,
  action         varchar(25)  NOT NULL COMMENT 'Requested | Approved | Denied | Reminded | Reconfirm Sent | Reconfirmed | Declined Reconfirm | Appointed | Booked | Withdrawn | Fulfilled | Returned to Waiting List',
  from_status    varchar(30)  NULL,
  to_status      varchar(30)  NULL,
  reason         varchar(255) NULL,
  schedule_id    varchar(45)  NULL,
  actor_user_id  varchar(45)  NULL,
  actor_role     varchar(10)  NULL,
  actor_name     varchar(120) NULL,
  created_at     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_crl_request (request_id, created_at),
  CONSTRAINT fk_crl_request FOREIGN KEY (request_id) REFERENCES consultation_requests (request_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 6. Assessment metadata
--    chief_complaint  : the student's reason for the consultation (what they came for)
--    visit_type       : the visit purpose at the time of the assessment (snapshot)
--    documented_by_*  : who filed it (Doctor / Nurse) and their name
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_assessments', 'chief_complaint',    'varchar(255) NULL');
CALL cms_add_column('doctor_assessments', 'visit_type',         'varchar(30) NULL');
CALL cms_add_column('doctor_assessments', 'documented_by_role', 'varchar(10) NULL COMMENT ''Doctor | Nurse''');
CALL cms_add_column('doctor_assessments', 'documented_by_name', 'varchar(120) NULL');

-- fill the new metadata for assessments that already exist
UPDATE doctor_assessments a
JOIN doctor_appointments da ON da.appointment_id = a.appointment_id
SET a.visit_type = COALESCE(a.visit_type, da.visit_type),
    a.chief_complaint = COALESCE(a.chief_complaint, LEFT(da.booking_reason, 255))
WHERE a.visit_type IS NULL OR a.chief_complaint IS NULL;

UPDATE doctor_assessments SET documented_by_role = 'Doctor' WHERE documented_by_role IS NULL AND documented_by_doctor_id IS NOT NULL;
UPDATE doctor_assessments SET documented_by_role = 'Nurse'  WHERE documented_by_role IS NULL;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
DROP PROCEDURE IF EXISTS cms_drop_check;
DROP PROCEDURE IF EXISTS cms_replace_check;
