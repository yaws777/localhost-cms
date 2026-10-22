-- =============================================================================
-- Migration: Dental / Vision become doctor-conducted visit types (Doctor Visits)
--            + new Health Screening types (Vital Signs, Hearing)
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Nothing is dropped; legacy dental/vision rows that
-- came from Health Screening stay in place (screening_schedule_id is kept, and is
-- only relaxed to NULL so doctor-visit records can exist without a screening).
--
-- Take a backup first:  mysqldump ClinicManagementSystem > backup.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;

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

DELIMITER ;

-- -----------------------------------------------------------------------------
-- 1. Doctor visit type
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_appointments', 'visit_type',
  "varchar(30) NOT NULL DEFAULT 'General Checkup' COMMENT 'General Checkup | Dental Examination | Vision Examination | Follow-up | Referral'");

-- -----------------------------------------------------------------------------
-- 2. Every doctor assessment can be flagged
-- -----------------------------------------------------------------------------
CALL cms_add_column('doctor_assessments', 'is_abnormal',      'tinyint(1) NOT NULL DEFAULT 0');
CALL cms_add_column('doctor_assessments', 'follow_up_needed', 'tinyint(1) NOT NULL DEFAULT 0');

-- -----------------------------------------------------------------------------
-- 3. Dental records: linked to a doctor visit instead of (only) a screening
-- -----------------------------------------------------------------------------
ALTER TABLE dental_assessment_records
  MODIFY COLUMN screening_schedule_id varchar(45) NULL,
  MODIFY COLUMN dental_findings text NULL;

CALL cms_add_column('dental_assessment_records', 'appointment_id',            'char(36) NULL');
CALL cms_add_column('dental_assessment_records', 'doctor_id',                 'varchar(45) NULL');
CALL cms_add_column('dental_assessment_records', 'oral_hygiene',              "varchar(10) NULL COMMENT 'Good | Fair | Poor'");
CALL cms_add_column('dental_assessment_records', 'caries_count',              'int NOT NULL DEFAULT 0');
CALL cms_add_column('dental_assessment_records', 'missing_count',             'int NOT NULL DEFAULT 0');
CALL cms_add_column('dental_assessment_records', 'filled_count',              'int NOT NULL DEFAULT 0');
CALL cms_add_column('dental_assessment_records', 'gum_condition',             'varchar(40) NULL');
CALL cms_add_column('dental_assessment_records', 'malocclusion',              'tinyint(1) NOT NULL DEFAULT 0');
CALL cms_add_column('dental_assessment_records', 'tooth_notes',               'text NULL');
CALL cms_add_column('dental_assessment_records', 'treatment_done',            'text NULL');
CALL cms_add_column('dental_assessment_records', 'treatment_needed',         'text NULL');
CALL cms_add_column('dental_assessment_records', 'referral_needed',           'tinyint(1) NOT NULL DEFAULT 0');
CALL cms_add_column('dental_assessment_records', 'referral_to',               'varchar(120) NULL');
CALL cms_add_column('dental_assessment_records', 'next_visit_recommendation', 'varchar(255) NULL');

CALL cms_add_index('dental_assessment_records', 'uq_dental_appt_student',
  'UNIQUE KEY `uq_dental_appt_student` (`appointment_id`, `student_id`)');
CALL cms_add_fk('dental_assessment_records', 'fk_dental_appointment',
  'FOREIGN KEY (`appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE CASCADE');

-- -----------------------------------------------------------------------------
-- 4. Vision records
--    visual_acuity_left / visual_acuity_right keep meaning "uncorrected" (legacy
--    screening rows only had one reading).
-- -----------------------------------------------------------------------------
ALTER TABLE vision_screening_records
  MODIFY COLUMN screening_schedule_id varchar(45) NULL,
  MODIFY COLUMN visual_acuity_left  varchar(10) NULL,
  MODIFY COLUMN visual_acuity_right varchar(10) NULL;

CALL cms_add_column('vision_screening_records', 'appointment_id',       'char(36) NULL');
CALL cms_add_column('vision_screening_records', 'doctor_id',            'varchar(45) NULL');
CALL cms_add_column('vision_screening_records', 'va_left_corrected',    'varchar(10) NULL');
CALL cms_add_column('vision_screening_records', 'va_right_corrected',   'varchar(10) NULL');
CALL cms_add_column('vision_screening_records', 'wears_eyeglasses',     'tinyint(1) NOT NULL DEFAULT 0');
CALL cms_add_column('vision_screening_records', 'wears_contacts',       'tinyint(1) NOT NULL DEFAULT 0');
CALL cms_add_column('vision_screening_records', 'color_vision',         "varchar(20) NULL COMMENT 'Normal | Deficient'");
CALL cms_add_column('vision_screening_records', 'eye_findings',         'text NULL');
CALL cms_add_column('vision_screening_records', 'recommended_action',   "varchar(40) NULL COMMENT 'No action | Eyeglasses | Refer to ophthalmologist'");

CALL cms_add_index('vision_screening_records', 'uq_vision_appt_student',
  'UNIQUE KEY `uq_vision_appt_student` (`appointment_id`, `student_id`)');
CALL cms_add_fk('vision_screening_records', 'fk_vision_appointment',
  'FOREIGN KEY (`appointment_id`) REFERENCES `doctor_appointments` (`appointment_id`) ON DELETE CASCADE');

-- -----------------------------------------------------------------------------
-- 5. New Health Screening types replacing Dental / Vision
-- -----------------------------------------------------------------------------
CALL cms_add_column('bmi_monitoring_logs', 'is_abnormal', 'tinyint(1) NOT NULL DEFAULT 0');

-- BMI categories other than Normal are flagged abnormal for existing rows
UPDATE bmi_monitoring_logs SET is_abnormal = 1
WHERE is_abnormal = 0 AND bmi_category IS NOT NULL AND bmi_category <> 'Normal';

CREATE TABLE IF NOT EXISTS vital_signs_records (
  vital_record_id        varchar(45)  NOT NULL,
  student_id             varchar(45)  NOT NULL,
  screening_schedule_id  varchar(45)  NOT NULL,
  bp_systolic            smallint     NULL,
  bp_diastolic           smallint     NULL,
  pulse_rate             smallint     NULL,
  temperature_c          decimal(4,1) NULL,
  respiratory_rate       smallint     NULL,
  bp_flag                varchar(10)  NULL COMMENT 'Normal | Elevated | High | Low',
  pulse_flag             varchar(10)  NULL,
  temperature_flag       varchar(10)  NULL,
  respiratory_flag       varchar(10)  NULL,
  is_abnormal            tinyint(1)   NOT NULL DEFAULT 0,
  remarks                text         NULL,
  recorded_at            timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (vital_record_id),
  UNIQUE KEY uq_vital_student_schedule (student_id, screening_schedule_id),
  KEY idx_vital_schedule (screening_schedule_id),
  CONSTRAINT fk_vital_student  FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_vital_schedule FOREIGN KEY (screening_schedule_id) REFERENCES screening_schedules (screening_schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS hearing_screening_records (
  hearing_record_id      varchar(45)  NOT NULL,
  student_id             varchar(45)  NOT NULL,
  screening_schedule_id  varchar(45)  NOT NULL,
  left_ear_result        varchar(10)  NOT NULL COMMENT 'Pass | Refer',
  right_ear_result       varchar(10)  NOT NULL COMMENT 'Pass | Refer',
  is_abnormal            tinyint(1)   NOT NULL DEFAULT 0,
  remarks                text         NULL,
  recorded_at            timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (hearing_record_id),
  UNIQUE KEY uq_hearing_student_schedule (student_id, screening_schedule_id),
  KEY idx_hearing_schedule (screening_schedule_id),
  CONSTRAINT fk_hearing_student  FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_hearing_schedule FOREIGN KEY (screening_schedule_id) REFERENCES screening_schedules (screening_schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_add_fk;
