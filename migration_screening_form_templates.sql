-- =============================================================================
-- Migration: Screening form templates (nurse-built result forms)
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_screening_types.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_screening_form_templates.sql
-- The backend runs the same steps on start (ensureScreeningTemplates), so running this by hand is optional.
--
-- What it does
--   0. The conversion of the old BMI / Vital Signs forms into templates (and the copy of their results) is done by the
--      backend on start (convertBuiltInForms), not by this file.
--   1. screening_form_templates: name + fields (JSON list of { key, label, type, required, unit, min, max, options, abnormal_options }).
--   2. screening_types.template_id: a type with form_kind CUSTOM points at a template.
--   3. The form_kind CHECK of screening_types is dropped (the server validates: BMI | VITAL_SIGNS | HEARING | CUSTOM).
--   4. screening_custom_results: one row per student and screening, answers stored as JSON.
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_screening_templates;

DELIMITER $$

CREATE PROCEDURE cms_screening_templates()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'screening_types' AND COLUMN_NAME = 'template_id') THEN
    ALTER TABLE screening_types ADD COLUMN template_id INT NULL AFTER form_kind;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'screening_types' AND CONSTRAINT_NAME = 'chk_screening_types_form_kind') THEN
    ALTER TABLE screening_types DROP CHECK chk_screening_types_form_kind;
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS screening_form_templates (
  template_id INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(60)  NOT NULL,
  description VARCHAR(255) NULL,
  fields      JSON         NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (template_id),
  UNIQUE KEY uq_screening_form_templates_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL cms_screening_templates();

CREATE TABLE IF NOT EXISTS screening_custom_results (
  custom_record_id      VARCHAR(45) NOT NULL,
  student_id            VARCHAR(45) NOT NULL,
  screening_schedule_id VARCHAR(45) NOT NULL,
  template_id           INT         NOT NULL,
  answers               JSON        NOT NULL,
  is_abnormal           TINYINT(1)  NOT NULL DEFAULT 0,
  remarks               TEXT        NULL,
  recorded_at           TIMESTAMP   NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (custom_record_id),
  UNIQUE KEY uq_custom_student_schedule (student_id, screening_schedule_id),
  KEY idx_custom_schedule (screening_schedule_id),
  KEY idx_custom_template (template_id),
  CONSTRAINT fk_custom_student  FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_custom_schedule FOREIGN KEY (screening_schedule_id) REFERENCES screening_schedules (screening_schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS cms_screening_templates;
