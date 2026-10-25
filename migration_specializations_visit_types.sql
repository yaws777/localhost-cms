-- =============================================================================
-- Migration: specializations <-> visit types
--   * `specializations` lists every specialization a doctor can have and the visit type (purpose of the consultation)
--     that specialization takes. Adding a specialization adds its visit type, so students see it when they pick the
--     purpose of a consultation. General Check Up belongs to General Physician and every doctor can take it.
--   * "Other" is no longer a visit purpose: the CHECK constraints that listed the allowed visit types are dropped
--     (the server validates against `specializations` instead) and "Other" is removed from what doctors offer.
--   * Open schedules posted for "Other" become "Any". Old appointments keep their "Other: ..." label for the history.
-- Idempotent. Run AFTER migration_hybrid_schedules.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_specializations_visit_types.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_drop_check;

DELIMITER $$

CREATE PROCEDURE cms_drop_check(IN tbl VARCHAR(64), IN chk VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = chk) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` DROP CHECK `', chk, '`');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS specializations (
  specialization_id int          NOT NULL AUTO_INCREMENT,
  name              varchar(80)  NOT NULL,
  visit_type        varchar(30)  NOT NULL COMMENT 'the purpose of the consultation this specialization takes (doctor_appointments.visit_type is varchar(30))',
  is_system         tinyint(1)   NOT NULL DEFAULT 0,
  created_at        timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (specialization_id),
  UNIQUE KEY uq_specialization_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO specializations (name, visit_type, is_system) VALUES
  ('General Physician',  'General Check Up',        1),
  ('Dentist',            'Dental',                  1),
  ('Optometrist',        'Vision',                  1),
  ('Ophthalmologist',    'Vision',                  1),
  ('Pediatrician',       'Pediatric Consultation',  0),
  ('Dermatologist',      'Skin Consultation',       0),
  ('ENT Specialist',     'Ear Nose Throat',         0),
  ('Psychologist',       'Mental Health',           0),
  ('Psychiatrist',       'Mental Health',           0),
  ('Nutritionist',       'Nutrition Counseling',    0),
  ('Orthopedic Doctor',  'Bone and Joint',          0),
  ('OB-GYN',             'Women''s Health',         0),
  ('Cardiologist',       'Heart Consultation',      0);

-- typed-by-hand spellings of the standard ones are folded into them
UPDATE doctors SET specialization = 'General Physician' WHERE specialization REGEXP '^general phys' AND specialization <> 'General Physician';
UPDATE doctors SET specialization = 'Dentist' WHERE specialization REGEXP '^dentist' AND specialization <> 'Dentist';

-- doctors saved with a specialization that is not on the list keep working: it is added with a visit type of its own
INSERT IGNORE INTO specializations (name, visit_type, is_system)
SELECT DISTINCT TRIM(d.specialization), LEFT(CONCAT(TRIM(d.specialization), ' Consultation'), 30), 0
FROM doctors d
WHERE d.specialization IS NOT NULL AND TRIM(d.specialization) <> ''
  AND NOT EXISTS (SELECT 1 FROM specializations s WHERE s.name = TRIM(d.specialization))
  AND NOT (TRIM(d.specialization) REGEXP 'dent|optom|ophthal|eye|vision');

-- the allowed visit types are now data, not a CHECK list
CALL cms_drop_check('doctor_appointments', 'chk_appointment_visit_type');
CALL cms_drop_check('doctor_appointments', 'chk_appointment_other_specified');
CALL cms_drop_check('doctor_schedules',    'chk_ds_visit_type');
CALL cms_drop_check('consultation_requests', 'chk_cr_visit');
CALL cms_drop_check('consultation_requests', 'chk_cr_other');

-- "Other" is gone from what a doctor offers, and from the schedules that are still open
UPDATE doctors
SET services_offered = JSON_REMOVE(services_offered, JSON_UNQUOTE(JSON_SEARCH(services_offered, 'one', 'Other')))
WHERE services_offered IS NOT NULL AND JSON_SEARCH(services_offered, 'one', 'Other') IS NOT NULL;

UPDATE doctors SET services_offered = NULL WHERE services_offered IS NOT NULL AND JSON_LENGTH(services_offered) = 0;
UPDATE doctors SET services_notes = NULL WHERE services_notes IS NOT NULL;

UPDATE doctor_schedules SET visit_type = 'Any' WHERE visit_type = 'Other' AND status = 'Open';

DROP PROCEDURE IF EXISTS cms_drop_check;
