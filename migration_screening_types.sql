-- =============================================================================
-- Migration: Screening Types (nurse-managed list of Health Screening types)
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Run AFTER migration_health_screening_transactions.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_screening_types.sql
-- Take a backup first:  mysqldump --default-character-set=utf8mb4 -u root -p ClinicManagementSystem > backup.sql
--
-- What it does
--   1. screening_types table: BMI, Vital Signs and Hearing are seeded as system rows.
--      form_kind picks the result form + result table (BMI | VITAL_SIGNS | HEARING). Custom types use BMI or VITAL_SIGNS.
--   2. screening_schedules.screening_type is widened from varchar(30) to varchar(60) (type names go up to 60 characters).
--   3. Existing screening_schedules.screening_type values are matched by name (the column stays a name, no FK):
--      the spelling is normalised to the type's name, unknown names are imported as INACTIVE types so old
--      schedules keep a type row. Dental / Vision stay legacy (Doctor Visits) and are not imported.
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_widen_screening_type;

DELIMITER $$

CREATE PROCEDURE cms_widen_screening_type()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'screening_schedules'
               AND COLUMN_NAME = 'screening_type' AND CHARACTER_MAXIMUM_LENGTH < 60) THEN
    ALTER TABLE screening_schedules MODIFY COLUMN screening_type varchar(60) DEFAULT 'BMI';
  END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------------------------------
-- 1. Table (name is unique and case-insensitive through the table collation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS screening_types (
  screening_type_id INT NOT NULL AUTO_INCREMENT,
  name        VARCHAR(60)  NOT NULL,
  description VARCHAR(255) NULL,
  form_kind   VARCHAR(20)  NOT NULL,
  is_system   TINYINT(1)   NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (screening_type_id),
  UNIQUE KEY uq_screening_types_name (name),
  CONSTRAINT chk_screening_types_form_kind CHECK (form_kind IN ('BMI', 'VITAL_SIGNS', 'HEARING'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 2. Room for custom names
-- -----------------------------------------------------------------------------
CALL cms_widen_screening_type();

-- -----------------------------------------------------------------------------
-- 3. System types (one per form_kind; a renamed system row is not seeded twice)
-- -----------------------------------------------------------------------------
INSERT INTO screening_types (name, description, form_kind, is_system, is_active)
SELECT v.name, v.description, v.form_kind, 1, 1
FROM (
  SELECT 'BMI' AS name, 'Height, weight and body mass index.' AS description, 'BMI' AS form_kind
  UNION ALL SELECT 'Vital Signs', 'Blood pressure, pulse, respiratory rate, temperature.', 'VITAL_SIGNS'
  UNION ALL SELECT 'Hearing', 'Left and right ear pass / refer result.', 'HEARING'
) v
WHERE NOT EXISTS (SELECT 1 FROM screening_types t WHERE t.is_system = 1 AND t.form_kind = v.form_kind);

-- -----------------------------------------------------------------------------
-- 4. Backfill from existing schedules (by name)
-- -----------------------------------------------------------------------------
-- unknown names become inactive custom types; the form is the one their recorded results used (BMI when none)
INSERT INTO screening_types (name, description, form_kind, is_system, is_active)
SELECT n.name,
       'Imported from existing screening schedules. Check the form, then activate it to use it again.',
       CASE WHEN EXISTS (SELECT 1 FROM vital_signs_records v
                         JOIN screening_schedules x ON x.screening_schedule_id = v.screening_schedule_id
                         WHERE TRIM(x.screening_type) = n.name) THEN 'VITAL_SIGNS' ELSE 'BMI' END,
       0, 0
FROM (
  SELECT DISTINCT TRIM(screening_type) AS name
  FROM screening_schedules
  WHERE screening_type IS NOT NULL AND TRIM(screening_type) <> ''
    AND TRIM(screening_type) NOT IN ('Dental', 'Vision')
) n
WHERE NOT EXISTS (SELECT 1 FROM screening_types t WHERE t.name = n.name);

-- one spelling per type: 'bmi' / 'BMI ' become 'BMI'
UPDATE screening_schedules s
JOIN screening_types t ON t.name = TRIM(s.screening_type)
SET s.screening_type = t.name
WHERE BINARY s.screening_type <> BINARY t.name;

DROP PROCEDURE IF EXISTS cms_widen_screening_type;
