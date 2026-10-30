-- =============================================================================
-- Migration: consultations offered <-> specializations <-> doctors
--   * A consultation offered (a visit type, e.g. Dental) can be linked to several specializations and a specialization can
--     offer several consultations: `specializations` now has one row per (name, visit_type) instead of one per name.
--   * Which doctors take a consultation is still `doctors.services_offered` (NULL = everything the specialization allows);
--     the nurse assigns the doctors in Manage Doctor Accounts, only doctors whose specialization is linked can be assigned.
-- Idempotent. Run AFTER migration_specializations_visit_types.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_consultations_offered.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_specialization_key;

DELIMITER $$

CREATE PROCEDURE cms_specialization_key()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'specializations' AND INDEX_NAME = 'uq_specialization_name') THEN
    ALTER TABLE specializations DROP INDEX uq_specialization_name;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'specializations' AND INDEX_NAME = 'uq_specialization_consultation') THEN
    ALTER TABLE specializations ADD UNIQUE KEY uq_specialization_consultation (name, visit_type);
  END IF;
END$$

DELIMITER ;

CALL cms_specialization_key();
DROP PROCEDURE IF EXISTS cms_specialization_key;
